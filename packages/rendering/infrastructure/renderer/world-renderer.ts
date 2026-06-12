import { Array as Arr, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { CHUNK_SIZE, CHUNK_HEIGHT, ChunkCacheKey } from '@ts-minecraft/core'
import { Chunk, type ChunkAABB } from '@ts-minecraft/world'
import { MAX_SHADOW_HALF_EXTENT } from '@ts-minecraft/core'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import { SceneService } from '../scene/scene-service'
import { createWaterMaterial } from '../post-processing/water-material'
import {
  REFRACTION_RT_WIDTH,
  REFRACTION_RT_HEIGHT,
  type ChunkMeshes,
} from './world-renderer-types'
import { disposeMesh } from './world-renderer-utils'
import { syncChunksToScene } from './world-renderer-chunk-sync'
import { updateChunkInScene } from './world-renderer-chunk-update'
import {
  initialPoseCache,
  isCameraPoseSimilar,
  writeCameraPose,
  type CameraPoseCache,
} from './world-renderer-pose-cache'
import {
  doRefractionPrePass,
  updateWaterUniforms,
  setRefractionValid,
  updateWaterResolution,
  resizeRefractionRT,
  resizeRefractionCamera,
  getWaterMeshes,
} from './world-renderer-refraction'

export { MAX_CHUNK_UPDATES_PER_FRAME, WORLD_RENDERER_TIME_BUDGET_MS } from './world-renderer-types'

export class WorldRendererService extends Effect.Service<WorldRendererService>()(
  '@minecraft/infrastructure/three/WorldRendererService',
  {
    scoped: Effect.gen(function* () {
      // Acquire service dependencies and state
      const chunkMeshService = yield* ChunkMeshService
      const sceneService = yield* SceneService
      const meshesRef = yield* Ref.make(HashMap.empty<ChunkCacheKey, ChunkMeshes>())
      // Stable water mesh list — only replaced (new array reference) when chunks are added/removed.
      const waterMeshesRef = yield* Ref.make<ReadonlyArray<THREE.Mesh>>([])
      // Cache key for frustum culling — invalidated whenever chunk meshes change.
      // FR-3.6: tolerance-based comparison (not strict equality) — see world-renderer-pose-cache.ts.
      const lastFrustumPoseRef = yield* Ref.make<CameraPoseCache>(initialPoseCache())
      // Double-buffer partner for lastFrustumPoseRef. Each cull writes the live camera
      // pose into this reusable scratch (no allocation); on a cache miss the two objects
      // are swapped so the scratch becomes the new "last" and the old "last" is recycled
      // as the next scratch — zero allocation, zero field copy on either path.
      let frustumPoseScratch: CameraPoseCache = initialPoseCache()
      const sceneVersionRef = yield* Ref.make(0)

      // Pre-allocated objects for frustum culling and refraction pre-pass — reused every frame to avoid GC pressure
      const _frustum = new THREE.Frustum()
      const _projMatrix = new THREE.Matrix4()
      const _box = new THREE.Box3()
      const _minVec = new THREE.Vector3()
      const _maxVec = new THREE.Vector3()
      const _savedWaterVisibility = MutableRef.make(new Map<THREE.Mesh, boolean>())
      // Water mesh cache — only return new reference when the mesh set actually changes
      const _waterMeshCache = MutableRef.make<ReadonlyArray<THREE.Mesh>>([])
      // Refraction cache — reused until camera pose or scene version changes
      const _lastRefractionState = MutableRef.make({
        version: -1,
        x: NaN,
        y: NaN,
        z: NaN,
        qx: NaN,
        qy: NaN,
        qz: NaN,
        qw: NaN,
        p0: NaN,
        p5: NaN,
        p10: NaN,
        p14: NaN,
      })

      // Dedicated refraction camera. Projection is synchronized from the main
      // camera only when it changes, keeping render-distance updates visible to
      // the water pre-pass without mutating the main camera.
      const refractionCamera = yield* Effect.sync(() => {
        const cam = new THREE.PerspectiveCamera()
        cam.fov = 75
        cam.near = 0.1
        cam.far = 128
        cam.updateProjectionMatrix()
        return cam
      })

      // GPU resources — disposed on scope close via acquireRelease
      // Refraction render target — GPU resource, disposed on scope close
      const refractionRT = yield* Effect.acquireRelease(
        Effect.sync(() =>
          new THREE.WebGLRenderTarget(REFRACTION_RT_WIDTH, REFRACTION_RT_HEIGHT, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
          })
        ),
        (rt) => Effect.sync(() => rt.dispose())
      )

      // Water ShaderMaterial — GPU resource, disposed on scope close
      const waterMaterial = yield* Effect.acquireRelease(
        Effect.sync(() => createWaterMaterial(refractionRT.texture, 800, 600)),
        (mat) => Effect.sync(() => mat.dispose())
      )

      const invalidateFrustumCache = () =>
        Ref.set(lastFrustumPoseRef, initialPoseCache())
      const invalidateSceneCaches = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* invalidateFrustumCache()
          yield* Ref.update(sceneVersionRef, (version) => version + 1)
        })

      const chunkCtx = { meshesRef, waterMeshesRef, chunkMeshService, sceneService, waterMaterial, invalidateSceneCaches }
      const refractionCtx = { waterMeshesRef, sceneVersionRef, _savedWaterVisibility, _waterMeshCache, _lastRefractionState, refractionCamera, refractionRT, waterMaterial }

      return {
        syncChunksToScene: (loadedChunks: ReadonlyArray<Chunk>, scene: THREE.Scene): Effect.Effect<boolean, never> =>
          syncChunksToScene(chunkCtx, loadedChunks, scene),

        updateChunkInScene: (chunk: Chunk, scene: THREE.Scene, dirtyAABB?: ChunkAABB): Effect.Effect<void, never> =>
          updateChunkInScene(chunkCtx, chunk, scene, dirtyAABB),

        // Toggles mesh.visible only — never mutates scene graph (avoids Three.js graph overhead).
        applyFrustumCulling: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
          // camera.updateMatrixWorld() is intentionally called here even though Three.js
          // also calls it during renderer.render(). This method runs BEFORE render() in the
          // frame pipeline, so the camera world matrix may be stale (camera.position was
          // just updated in step 8). Without this call, frustum culling would use last
          // frame's matrix, causing one-frame-behind popping artifacts.
          Effect.gen(function* () {
            const meshes = yield* Ref.get(meshesRef)
            const lastPose = yield* Ref.get(lastFrustumPoseRef)
            // Compare camera state against lastPose inline first; only allocate
            // a new pose object when something actually changed. The hot-path
            // (camera idle / sub-tolerance jitter) returns immediately with zero allocations.
            const cx = camera.position.x
            const cy = camera.position.y
            const cz = camera.position.z
            const qx = camera.quaternion.x
            const qy = camera.quaternion.y
            const qz = camera.quaternion.z
            const qw = camera.quaternion.w
            const p0 = camera.projectionMatrix.elements[0]
            const p5 = camera.projectionMatrix.elements[5]
            const p10 = camera.projectionMatrix.elements[10]
            const p14 = camera.projectionMatrix.elements[14]

            // FR-3.6: tolerance-based pose comparison — sub-pixel jitter is treated as cache hit
            // (movement of <1 mm or rotation of <0.011° cannot affect chunk-level visibility).
            // Write into the reusable scratch instead of allocating a fresh pose literal.
            writeCameraPose(
              frustumPoseScratch,
              cx, cy, cz, qx, qy, qz, qw,
              p0 ?? Number.NaN, p5 ?? Number.NaN, p10 ?? Number.NaN, p14 ?? Number.NaN,
            )
            if (isCameraPoseSimilar(lastPose, frustumPoseScratch)) {
              return
            }

            camera.updateMatrixWorld()
            _projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
            _frustum.setFromProjectionMatrix(_projMatrix)

            // Performance boundary: imperative loop avoids ~500-900 allocations/frame
            // from Arr.fromIterable + Option.fromNullable + Option.match per chunk
            for (const chunkMeshes of HashMap.values(meshes)) {
              const coord = chunkMeshes.opaque.userData.chunkCoord
              /* c8 ignore next */
              if (coord == null) continue

              // FR-3.3: tighten AABB max-Y to actual chunk content. Empty chunks (maxY = -1)
              // collapse to a near-zero-height box so they're never spuriously included; chunks
              // missing maxY use full CHUNK_HEIGHT for safety.
              const chunkMaxY = chunkMeshes.opaque.userData.chunkMaxY
              /* c8 ignore start -- meshes without chunkMaxY use CHUNK_HEIGHT; not produced in unit tests */
              const maxYBound = chunkMaxY === undefined
                ? CHUNK_HEIGHT
                : chunkMaxY < 0 ? 0 : chunkMaxY + 1
              /* c8 ignore end */

              _minVec.set(coord.x * CHUNK_SIZE, 0, coord.z * CHUNK_SIZE)
              _maxVec.set(coord.x * CHUNK_SIZE + CHUNK_SIZE, maxYBound, coord.z * CHUNK_SIZE + CHUNK_SIZE)
              _box.set(_minVec, _maxVec)

              const visible = _frustum.intersectsBox(_box)
              chunkMeshes.opaque.visible = visible
              // Shadow distance culling: disable castShadow for chunks beyond shadow reach.
              // Shadow map has finite resolution — distant shadows are sub-texel and waste GPU fill.
              const SHADOW_CULL_DIST_SQ = MAX_SHADOW_HALF_EXTENT * MAX_SHADOW_HALF_EXTENT
              const dx = coord.x * CHUNK_SIZE + CHUNK_SIZE * 0.5 - camera.position.x
              const dz = coord.z * CHUNK_SIZE + CHUNK_SIZE * 0.5 - camera.position.z
              chunkMeshes.opaque.castShadow = visible && (dx * dx + dz * dz) < SHADOW_CULL_DIST_SQ
              // Performance boundary: direct _tag check avoids Option.match closure allocation per chunk
              /* c8 ignore start -- water and transparentSolid meshes require chunk generation with water/glass blocks to exercise */
              if (chunkMeshes.water._tag === 'Some') {
                chunkMeshes.water.value.visible = visible
              }
              if (chunkMeshes.transparentSolid._tag === 'Some') {
                chunkMeshes.transparentSolid.value.visible = visible
              }
              /* c8 ignore end */
            }

            // Swap: the scratch we just filled becomes the new "last"; recycle the old
            // "last" object as the next scratch. No allocation, no field copy.
            yield* Ref.set(lastFrustumPoseRef, frustumPoseScratch)
            frustumPoseScratch = lastPose
          }),

        clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const removeAndDispose = (m: THREE.Mesh): Effect.Effect<void, never> =>
              Effect.gen(function* () {
                yield* sceneService.remove(scene, m)
                yield* Effect.sync(() => disposeMesh(m))
              })
            const meshes = yield* Ref.get(meshesRef)
            yield* Effect.forEach(
              Arr.fromIterable(HashMap.values(meshes)),
              (chunkMeshes) => {
                const waterVal = Option.getOrNull(chunkMeshes.water)
                const transparentSolidVal = Option.getOrNull(chunkMeshes.transparentSolid)
                return Effect.gen(function* () {
                  yield* removeAndDispose(chunkMeshes.opaque)
                  if (waterVal !== null) yield* removeAndDispose(waterVal)
                  if (transparentSolidVal !== null) yield* removeAndDispose(transparentSolidVal)
                })
              },
              { concurrency: 1 }
            )
            yield* Ref.set(meshesRef, HashMap.empty())
            yield* Ref.set(waterMeshesRef, [])
            yield* invalidateSceneCaches()
          }),

        doRefractionPrePass: (
          renderer: THREE.WebGLRenderer,
          scene: THREE.Scene,
          camera: THREE.Camera,
          // FR-4.4: 0 disables the screen-ratio gate.
          // Caller (post-processing-stage) passes resolvedGraphics.refractionMinScreenRatio.
          minScreenRatio: number = 0,
        ): Effect.Effect<void, never> =>
          doRefractionPrePass(refractionCtx, renderer, scene, camera, minScreenRatio),

        updateWaterUniforms: (
          time: number,
          cameraPosition: THREE.Vector3,
          sunIntensity: number,
        ): Effect.Effect<void, never> =>
          updateWaterUniforms(waterMaterial, time, cameraPosition, sunIntensity),

        setRefractionValid: (valid: boolean): Effect.Effect<void, never> =>
          setRefractionValid(waterMaterial, valid),

        updateWaterResolution: (width: number, height: number): Effect.Effect<void, never> =>
          updateWaterResolution(waterMaterial, width, height),

        resizeRefractionRT: (width: number, height: number): Effect.Effect<void, never> =>
          resizeRefractionRT(refractionRT, width, height),

        resizeRefractionCamera: (aspect: number): Effect.Effect<void, never> =>
          resizeRefractionCamera(refractionCamera, aspect),

        getWaterMeshes: (): Effect.Effect<ReadonlyArray<THREE.Mesh>, never> =>
          getWaterMeshes(waterMeshesRef, _waterMeshCache),

        getSceneVersion: (): Effect.Effect<number, never> => Ref.get(sceneVersionRef),
      }
    }),
    dependencies: [ChunkMeshService.Default, SceneService.Default],
  }
) {}
export const WorldRendererServiceLive = WorldRendererService.Default
