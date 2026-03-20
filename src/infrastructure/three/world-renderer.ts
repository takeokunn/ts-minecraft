import { Effect, Ref } from 'effect'
import * as THREE from 'three'
import { Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { ChunkMeshService } from './meshing/chunk-mesh'
import { SceneService } from './scene/scene-service'
import { createWaterMaterial } from './water-material'

/**
 * Key for chunk mesh tracking
 */
const chunkKey = (coord: ChunkCoord): string => `${coord.x},${coord.z}`

// Only dispose geometry; materials may be shared across chunk meshes
const disposeMesh = (mesh: THREE.Mesh): void => {
  mesh.geometry.dispose()
}

interface ChunkMeshes {
  opaque: THREE.Mesh
  water: THREE.Mesh | null
}

/**
 * Service for synchronizing chunk state with Three.js scene
 */
export class WorldRendererService extends Effect.Service<WorldRendererService>()(
  '@minecraft/infrastructure/three/WorldRendererService',
  {
    scoped: Effect.gen(function* () {
      const chunkMeshService = yield* ChunkMeshService
      const sceneService = yield* SceneService
      const meshesRef = yield* Ref.make<Map<string, ChunkMeshes>>(new Map())
      // Stable water mesh list for SSRPass.selects — only replaced (new array reference) when
      // chunks are added/removed. SSRPass setter short-circuits when reference is identical,
      // preventing per-frame shader recompilation (60 Hz) that would otherwise occur.
      const waterMeshesRef = yield* Ref.make<ReadonlyArray<THREE.Mesh>>([])

      // Refraction render target — GPU resource, disposed on scope close
      const refractionRT = yield* Effect.acquireRelease(
        Effect.sync(() =>
          new THREE.WebGLRenderTarget(800, 600, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
          })
        ),
        (rt) => Effect.sync(() => rt.dispose())
      )

      // Water ShaderMaterial — GPU resource, disposed on scope close
      const waterMaterial = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createWaterMaterial(
            refractionRT.texture,
            800,
            600
          )
        ),
        (mat) => Effect.sync(() => mat.dispose())
      )

      // Pre-allocated objects for frustum culling and refraction pre-pass — reused every frame to avoid GC pressure
      const _frustum = new THREE.Frustum()
      const _projMatrix = new THREE.Matrix4()
      const _box = new THREE.Box3()
      const _minVec = new THREE.Vector3()
      const _maxVec = new THREE.Vector3()
      const _savedWaterVisibility = new Map<THREE.Mesh, boolean>()

      return {
        /**
         * Sync scene with loaded chunks:
         * - Add meshes for newly loaded chunks not yet in scene
         * - Remove and dispose meshes for chunks no longer loaded
         */
        syncChunksToScene: (loadedChunks: ReadonlyArray<Chunk>, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)

            // Early-exit phase 1: check for new chunks — no Set allocation needed.
            const hasNewChunks = loadedChunks.some((c) => !meshes.has(chunkKey(c.coord)))

            // Early-exit phase 2: detect removals cheaply.
            const hasRemovedChunks = !hasNewChunks && loadedChunks.length < meshes.size

            if (!hasNewChunks && !hasRemovedChunks) {
              return
            }

            // Allocate loadedKeys Set only after confirming work is needed
            const loadedKeys = new Set(loadedChunks.map((c) => chunkKey(c.coord)))

            const nextMeshes = new Map(meshes)

            // Add meshes for newly loaded chunks not yet in scene
            for (const chunk of loadedChunks) {
              const key = chunkKey(chunk.coord)
              if (!nextMeshes.has(key)) {
                const { opaqueMesh, waterMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
                yield* sceneService.add(scene, opaqueMesh)
                if (waterMesh !== null) {
                  yield* sceneService.add(scene, waterMesh)
                }
                nextMeshes.set(key, { opaque: opaqueMesh, water: waterMesh })
              }
            }

            // Remove meshes for chunks no longer loaded
            for (const [key, chunkMeshes] of meshes) {
              if (!loadedKeys.has(key)) {
                yield* sceneService.remove(scene, chunkMeshes.opaque)
                disposeMesh(chunkMeshes.opaque)
                if (chunkMeshes.water !== null) {
                  yield* sceneService.remove(scene, chunkMeshes.water)
                  disposeMesh(chunkMeshes.water)
                }
                nextMeshes.delete(key)
              }
            }

            yield* Ref.set(meshesRef, nextMeshes)

            // Rebuild stable water mesh list for SSRPass.selects
            const nextWaterMeshes: THREE.Mesh[] = []
            for (const cm of nextMeshes.values()) {
              if (cm.water !== null) nextWaterMeshes.push(cm.water)
            }
            yield* Ref.set(waterMeshesRef, nextWaterMeshes)
          }),

        /**
         * Update (re-mesh) a single chunk that has been modified.
         * Call this after block break/place for the affected chunk.
         */
        updateChunkInScene: (chunk: Chunk, scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const key = chunkKey(chunk.coord)
            const meshes = yield* Ref.get(meshesRef)

            const existing = meshes.get(key)
            if (existing !== undefined) {
              // Reuse the existing mesh: update geometry in place, avoiding scene graph mutation
              yield* chunkMeshService.updateChunkMesh(existing.opaque, existing.water, chunk)
            } else {
              // First time this chunk appears — create and register a new mesh
              const { opaqueMesh, waterMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial)
              yield* sceneService.add(scene, opaqueMesh)
              if (waterMesh !== null) {
                yield* sceneService.add(scene, waterMesh)
              }

              yield* Ref.update(meshesRef, (map) => {
                const next = new Map(map)
                next.set(key, { opaque: opaqueMesh, water: waterMesh })
                return next
              })
            }
          }),

        /**
         * Apply frustum culling: toggle mesh.visible for all tracked chunk meshes.
         * Does NOT add/remove objects from scene (avoids scene graph mutation overhead).
         */
        applyFrustumCulling: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            // camera.updateMatrixWorld() is intentionally called here even though Three.js
            // also calls it during renderer.render(). This method runs BEFORE render() in the
            // frame pipeline, so the camera world matrix may be stale (camera.position was
            // just updated in step 8). Without this call, frustum culling would use last
            // frame's matrix, causing one-frame-behind popping artifacts.
            camera.updateMatrixWorld()
            _projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
            _frustum.setFromProjectionMatrix(_projMatrix)

            const meshes = yield* Ref.get(meshesRef)

            for (const chunkMeshes of meshes.values()) {
              const coord = chunkMeshes.opaque.userData['chunkCoord'] as ChunkCoord | undefined
              if (coord === undefined) {
                continue
              }
              const wx = coord.x * CHUNK_SIZE
              const wz = coord.z * CHUNK_SIZE
              _minVec.set(wx, 0, wz)
              _maxVec.set(wx + CHUNK_SIZE, CHUNK_HEIGHT, wz + CHUNK_SIZE)
              _box.set(_minVec, _maxVec)
              const visible = _frustum.intersectsBox(_box)
              chunkMeshes.opaque.visible = visible
              if (chunkMeshes.water !== null) {
                chunkMeshes.water.visible = visible
              }
            }
          }),

        /**
         * Remove all chunk meshes from scene and dispose resources
         */
        clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)
            for (const chunkMeshes of meshes.values()) {
              yield* sceneService.remove(scene, chunkMeshes.opaque)
              disposeMesh(chunkMeshes.opaque)
              if (chunkMeshes.water !== null) {
                yield* sceneService.remove(scene, chunkMeshes.water)
                disposeMesh(chunkMeshes.water)
              }
            }
            yield* Ref.set(meshesRef, new Map())
          }),

        /**
         * Refraction pre-pass: render scene without water meshes into refractionRT.
         * Call this every frame BEFORE the main render.
         */
        doRefractionPrePass: (
          renderer: THREE.WebGLRenderer,
          scene: THREE.Scene,
          camera: THREE.Camera
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)

            // Save current visibility and hide water meshes for the refraction render
            _savedWaterVisibility.clear()
            for (const chunkMeshes of meshes.values()) {
              if (chunkMeshes.water !== null) {
                _savedWaterVisibility.set(chunkMeshes.water, chunkMeshes.water.visible)
                chunkMeshes.water.visible = false
              }
            }

            renderer.setRenderTarget(refractionRT)
            renderer.render(scene, camera)
            renderer.setRenderTarget(null)

            // Restore saved visibility state (preserves frustum culling result)
            for (const [mesh, wasVisible] of _savedWaterVisibility) {
              mesh.visible = wasVisible
            }
          }),

        /**
         * Update water shader uniforms each frame.
         */
        updateWaterUniforms: (
          time: number,
          cameraPosition: THREE.Vector3,
          width: number,
          height: number
        ): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const uniforms = waterMaterial.uniforms
            if (uniforms['uTime']) uniforms['uTime'].value = time
            if (uniforms['uCameraPosition']) (uniforms['uCameraPosition'].value as THREE.Vector3).copy(cameraPosition)
            if (uniforms['uResolution']) (uniforms['uResolution'].value as THREE.Vector2).set(width, height)
          }),

        /**
         * Resize refraction render target when canvas resizes.
         */
        resizeRefractionRT: (width: number, height: number): Effect.Effect<void, never> =>
          Effect.sync(() => {
            refractionRT.setSize(width, height)
          }),

        /**
         * Get all currently tracked water meshes for SSR pass selects.
         * Returns only non-null water meshes that are currently visible.
         */
        getWaterMeshes: (): Effect.Effect<ReadonlyArray<THREE.Mesh>, never> =>
          Ref.get(waterMeshesRef),
      }
    }),
    dependencies: [ChunkMeshService.Default, SceneService.Default],
  }
) {}
export const WorldRendererServiceLive = WorldRendererService.Default
