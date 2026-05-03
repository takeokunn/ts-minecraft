import { Array as Arr, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { CHUNK_SIZE, CHUNK_HEIGHT, ChunkCacheKey } from '@ts-minecraft/kernel'
import { Chunk } from '@ts-minecraft/terrain'
import { MAX_SHADOW_HALF_EXTENT } from '@ts-minecraft/kernel'
import { ChunkMeshService } from '../infrastructure/meshing/chunk-mesh'
import { SceneService } from '../infrastructure/scene/scene-service'
import { createWaterMaterial } from '../infrastructure/water-material'
import {
  REFRACTION_RT_WIDTH,
  REFRACTION_RT_HEIGHT,
  type ChunkMeshes,
} from './world-renderer-types'
import { disposeMesh } from './world-renderer-utils'
import { syncChunksToScene } from './world-renderer-chunk-sync'
import { updateChunkInScene } from './world-renderer-chunk-update'
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
    scoped: Effect.all([
      ChunkMeshService,
      SceneService,
      Ref.make(HashMap.empty<ChunkCacheKey, ChunkMeshes>()),
      // Stable water mesh list — only replaced (new array reference) when
      // chunks are added/removed.
      Ref.make<ReadonlyArray<THREE.Mesh>>([]),
      // Cache key for frustum culling — invalidated whenever chunk meshes change.
      Ref.make({ x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN, p0: NaN, p5: NaN, p10: NaN, p14: NaN }),
      Ref.make(0),
      // Pre-allocated objects for frustum culling and refraction pre-pass — reused every frame to avoid GC pressure
      Effect.sync(() => ({
        _frustum: new THREE.Frustum(),
        _projMatrix: new THREE.Matrix4(),
        _box: new THREE.Box3(),
        _minVec: new THREE.Vector3(),
        _maxVec: new THREE.Vector3(),
        _savedWaterVisibility: MutableRef.make(new Map<THREE.Mesh, boolean>()),
        // Water mesh cache — only return new reference when the mesh set actually changes
        _waterMeshCache: MutableRef.make<ReadonlyArray<THREE.Mesh>>([]),
        // Refraction cache — reused until camera pose or scene version changes
        _lastRefractionState: MutableRef.make({
          version: -1,
          x: NaN,
          y: NaN,
          z: NaN,
          qx: NaN,
          qy: NaN,
          qz: NaN,
          qw: NaN,
        }),
      })),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([chunkMeshService, sceneService, meshesRef, waterMeshesRef, lastFrustumPoseRef, sceneVersionRef, preAlloc]) =>
        // Dedicated refraction camera — cloned once, far=128 permanently.
        // Per-frame doRefractionPrePass copies position/quaternion (cheap matrix copy)
        // instead of mutating the main camera's far plane and calling updateProjectionMatrix() twice.
        Effect.sync(() => {
          const refractionCamera = new THREE.PerspectiveCamera()
          refractionCamera.fov = 75
          refractionCamera.near = 0.1
          refractionCamera.far = 128
          refractionCamera.updateProjectionMatrix()
          return refractionCamera
        }).pipe(Effect.flatMap((refractionCamera) =>
        // Refraction render target — GPU resource, disposed on scope close
        Effect.acquireRelease(
          Effect.sync(() =>
            new THREE.WebGLRenderTarget(REFRACTION_RT_WIDTH, REFRACTION_RT_HEIGHT, {
              minFilter: THREE.LinearFilter,
              magFilter: THREE.LinearFilter,
              format: THREE.RGBAFormat,
            })
          ),
          (rt) => Effect.sync(() => rt.dispose())
        ).pipe(
          Effect.flatMap((refractionRT) =>
            // Water ShaderMaterial — GPU resource, disposed on scope close
            Effect.acquireRelease(
              Effect.sync(() =>
                createWaterMaterial(
                  refractionRT.texture,
                  800,
                  600
                )
              ),
              (mat) => Effect.sync(() => mat.dispose())
            ).pipe(
              Effect.map((waterMaterial) => {
              const { _frustum, _projMatrix, _box, _minVec, _maxVec, _savedWaterVisibility, _waterMeshCache, _lastRefractionState } = preAlloc
              const invalidateFrustumCache = () =>
                Ref.set(lastFrustumPoseRef, { x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN, p0: NaN, p5: NaN, p10: NaN, p14: NaN })
              const invalidateSceneCaches = () =>
                Effect.all([
                  invalidateFrustumCache(),
                  Ref.update(sceneVersionRef, (version) => version + 1),
                ], { concurrency: 'unbounded', discard: true })

              const chunkCtx = { meshesRef, waterMeshesRef, chunkMeshService, sceneService, waterMaterial, invalidateSceneCaches }
              const refractionCtx = { waterMeshesRef, sceneVersionRef, _savedWaterVisibility, _waterMeshCache, _lastRefractionState, refractionCamera, refractionRT, waterMaterial }

              return {
                syncChunksToScene: (loadedChunks: ReadonlyArray<Chunk>, scene: THREE.Scene): Effect.Effect<boolean, never> =>
                  syncChunksToScene(chunkCtx, loadedChunks, scene),

                updateChunkInScene: (chunk: Chunk, scene: THREE.Scene): Effect.Effect<void, never> =>
                  updateChunkInScene(chunkCtx, chunk, scene),

                // Toggles mesh.visible only — never mutates scene graph (avoids Three.js graph overhead).
                applyFrustumCulling: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
                  // camera.updateMatrixWorld() is intentionally called here even though Three.js
                  // also calls it during renderer.render(). This method runs BEFORE render() in the
                  // frame pipeline, so the camera world matrix may be stale (camera.position was
                  // just updated in step 8). Without this call, frustum culling would use last
                  // frame's matrix, causing one-frame-behind popping artifacts.
                  Ref.get(meshesRef).pipe(
                    Effect.flatMap((meshes) =>
                      Ref.get(lastFrustumPoseRef).pipe(
                        Effect.flatMap((lastPose) => Effect.gen(function* () {
                          // Compare camera state against lastPose inline first; only allocate
                          // a new pose object when something actually changed. The hot-path
                          // (camera idle) returns immediately with zero allocations.
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

                          if (
                            lastPose.x === cx &&
                            lastPose.y === cy &&
                            lastPose.z === cz &&
                            lastPose.qx === qx &&
                            lastPose.qy === qy &&
                            lastPose.qz === qz &&
                            lastPose.qw === qw &&
                            lastPose.p0 === p0 &&
                            lastPose.p5 === p5 &&
                            lastPose.p10 === p10 &&
                            lastPose.p14 === p14
                          ) {
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

                            _minVec.set(coord.x * CHUNK_SIZE, 0, coord.z * CHUNK_SIZE)
                            _maxVec.set(coord.x * CHUNK_SIZE + CHUNK_SIZE, CHUNK_HEIGHT, coord.z * CHUNK_SIZE + CHUNK_SIZE)
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
                            if (chunkMeshes.water._tag === 'Some') {
                              chunkMeshes.water.value.visible = visible
                            }
                          }

                          yield* Ref.set(lastFrustumPoseRef, { x: cx, y: cy, z: cz, qx, qy, qz, qw, p0, p5, p10, p14 })
                        }))
                      )
                    )
                  ),

                clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
                  Ref.get(meshesRef).pipe(
                    Effect.flatMap((meshes) =>
                      Effect.forEach(
                        Arr.fromIterable(HashMap.values(meshes)),
                        (chunkMeshes) =>
                          Effect.all([
                            sceneService.remove(scene, chunkMeshes.opaque).pipe(
                              Effect.andThen(Effect.sync(() => disposeMesh(chunkMeshes.opaque)))
                            ),
                            Option.match(chunkMeshes.water, {
                              onNone: () => Effect.void,
                              onSome: (m) =>
                                sceneService.remove(scene, m).pipe(
                                  Effect.andThen(Effect.sync(() => disposeMesh(m)))
                                ),
                            }),
                          ], { concurrency: 'unbounded', discard: true }),
                        { concurrency: 1 }
                      )
                    ),
                    Effect.andThen(Effect.all([
                      Ref.set(meshesRef, HashMap.empty()),
                      Ref.set(waterMeshesRef, []),
                      invalidateSceneCaches(),
                    ], { concurrency: 'unbounded', discard: true }))
                  ),

                doRefractionPrePass: (
                  renderer: THREE.WebGLRenderer,
                  scene: THREE.Scene,
                  camera: THREE.Camera
                ): Effect.Effect<void, never> =>
                  doRefractionPrePass(refractionCtx, renderer, scene, camera),

                updateWaterUniforms: (
                  time: number,
                  cameraPosition: THREE.Vector3,
                ): Effect.Effect<void, never> =>
                  updateWaterUniforms(waterMaterial, time, cameraPosition),

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
              })
            )
          )
        ))
        )
      )
    ),
    dependencies: [ChunkMeshService.Default, SceneService.Default],
  }
) {}
export const WorldRendererServiceLive = WorldRendererService.Default
