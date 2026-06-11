import { Effect, Option } from 'effect'
import * as THREE from 'three'
import type { ChunkCoord } from '@ts-minecraft/core'
import { Chunk } from '@ts-minecraft/world'
import type { LodLevel } from './lod-simplification'
import { MeshingWorkerPool, type DirtyAABB } from '@ts-minecraft/worker'
import { buildGeometry, buildMeshChunkOptions, tryReuseGeometry } from './chunk-mesh-geometry'
import { buildAtlasTexture, createChunkMeshMaterials } from './chunk-mesh-materials'



export class ChunkMeshService extends Effect.Service<ChunkMeshService>()(
  '@minecraft/infrastructure/three/ChunkMeshService',
  {
    scoped: Effect.gen(function* () {
      const pool = yield* MeshingWorkerPool
      // The atlas CanvasTexture (mipmaps + anisotropy 8) owns ~2-4MB of GPU VRAM
      // for the entire session. Register a finalizer so it is released when the
      // ChunkMeshService scope closes — the shared materials below already do the
      // same via createChunkMeshMaterials' acquireRelease.
      const atlasTexture = yield* Effect.acquireRelease(Effect.orDie(buildAtlasTexture()), (tex) =>
        Effect.sync(() => tex.dispose()),
      )
      const { sharedMaterial, transparentSolidMaterial, setSunIntensity } = yield* createChunkMeshMaterials(atlasTexture)

      return {
        atlasTexture,

        createChunkMesh: (
          chunk: Chunk,
          waterMaterial?: THREE.ShaderMaterial,
          lod?: LodLevel
        ): Effect.Effect<{ opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh>; transparentSolidMesh: Option.Option<THREE.Mesh> }, never> =>
          pool.meshChunk(chunk, lod === undefined ? undefined : { lod }).pipe(
            Effect.map(({ opaque, water, transparentSolid }) => {
              const opaqueGeometry = buildGeometry(opaque)
              // All opaque chunks share ONE material instance (sharedMaterial above) —
              // this lets Three.js batch state changes and avoids GPU material switches.
              const opaqueMesh = new THREE.Mesh(opaqueGeometry, sharedMaterial)
              // Disable Three.js per-object bounding-sphere frustum culling;
              // WorldRendererService.applyFrustumCulling does chunk-level AABB culling
              // which is more efficient (known fixed-size boxes, no bounding-sphere compute).
              opaqueMesh.frustumCulled = false
              opaqueMesh.castShadow = true
              opaqueMesh.receiveShadow = true
              opaqueMesh.userData['chunkCoord'] = chunk.coord
              // FR-3.3: propagate chunk-level maxY for tighter frustum AABB. Optional —
              // older chunks (pre-FR-3.3) leave it undefined; renderer falls back to CHUNK_HEIGHT.
              if (chunk.maxY !== undefined) opaqueMesh.userData['chunkMaxY'] = chunk.maxY

              const waterMesh: Option.Option<THREE.Mesh> = water === null || water.positions.length === 0
                ? Option.none()
                // All water chunks share ONE ShaderMaterial instance (waterMaterial from WorldRendererService)
                : Option.map(Option.fromNullable(waterMaterial), (mat) => {
                    const wm = new THREE.Mesh(buildGeometry(water), mat)
                    wm.frustumCulled = false  // manual AABB culling in WorldRendererService
                    wm.castShadow = false
                    wm.receiveShadow = false
                    wm.renderOrder = 1
                    wm.userData['chunkCoord'] = chunk.coord
                    if (chunk.maxY !== undefined) wm.userData['chunkMaxY'] = chunk.maxY
                    return wm
                  })

              // Transparent-solid mesh (GLASS, LEAVES): atlas material + alpha blending.
              const transparentSolidMeshOpt: Option.Option<THREE.Mesh> = transparentSolid === null || transparentSolid.positions.length === 0
                ? Option.none()
                : Option.some((() => {
                    const tsm = new THREE.Mesh(buildGeometry(transparentSolid), transparentSolidMaterial)
                    tsm.frustumCulled = false
                    tsm.castShadow = false
                    tsm.receiveShadow = false
                    tsm.renderOrder = 2
                    tsm.userData['chunkCoord'] = chunk.coord
                    if (chunk.maxY !== undefined) tsm.userData['chunkMaxY'] = chunk.maxY
                    return tsm
                  })())

              return { opaqueMesh, waterMesh, transparentSolidMesh: transparentSolidMeshOpt }
            })
          ),

        updateChunkMesh: (
          opaqueMesh: THREE.Mesh,
          waterMesh: Option.Option<THREE.Mesh>,
          chunk: Chunk,
          waterMaterial?: THREE.ShaderMaterial,
          lod?: LodLevel,
          // FR-4.1: chunk-local AABB of the changed sub-region. When provided,
          // forwarded to the worker through the protocol so future sub-region
          // splicing can short-circuit unaffected slices. Today the worker
          // still produces a full re-mesh; behaviour is preserved either way.
          dirtyAABB?: DirtyAABB,
          transparentSolidMesh?: Option.Option<THREE.Mesh>,
        ): Effect.Effect<{ waterMesh: Option.Option<THREE.Mesh>; transparentSolidMesh: Option.Option<THREE.Mesh> }, never> =>
          pool.meshChunk(chunk, buildMeshChunkOptions(lod, dirtyAABB)).pipe(
            Effect.map(({ opaque, water, transparentSolid }) => {
              // Opaque mesh: in-place update using owned arrays from worker transfer.
              // Falls back to full geometry rebuild only when buffer capacity is insufficient.
              if (!tryReuseGeometry(opaqueMesh.geometry, opaque)) {
                const oldGeom = opaqueMesh.geometry
                opaqueMesh.geometry = buildGeometry(opaque)
                oldGeom.dispose()
              }

              opaqueMesh.userData['chunkCoord'] = { x: chunk.coord.x, z: chunk.coord.z }
              // FR-3.3: refresh maxY whenever chunk geometry is rebuilt (block edits can change it).
              if (chunk.maxY !== undefined) opaqueMesh.userData['chunkMaxY'] = chunk.maxY

              // Water mesh: update in place when it already exists, or create/remove it when topology changes.
              const existingWaterMesh = Option.getOrNull(waterMesh)
              let updatedWaterMesh: Option.Option<THREE.Mesh>
              if (existingWaterMesh === null) {
                if (water === null || water.positions.length === 0 || waterMaterial === null) {
                  updatedWaterMesh = Option.none()
                } else {
                  const wm = new THREE.Mesh(buildGeometry(water), waterMaterial)
                  wm.frustumCulled = false
                  wm.castShadow = false
                  wm.receiveShadow = false
                  wm.renderOrder = 1
                  wm.userData['chunkCoord'] = chunk.coord
                  if (chunk.maxY !== undefined) wm.userData['chunkMaxY'] = chunk.maxY
                  updatedWaterMesh = Option.some(wm)
                }
              } else {
                const wm = existingWaterMesh
                if (water === null || water.positions.length === 0) {
                  wm.geometry.dispose()
                  updatedWaterMesh = Option.none()
                } else {
                  if (!tryReuseGeometry(wm.geometry, water)) {
                    const oldWaterGeometry = wm.geometry
                    wm.geometry = buildGeometry(water)
                    oldWaterGeometry.dispose()
                  }
                  wm.userData['chunkCoord'] = chunk.coord
                  if (chunk.maxY !== undefined) wm.userData['chunkMaxY'] = chunk.maxY
                  updatedWaterMesh = waterMesh
                }
              }

              // Transparent-solid mesh: update in place or create/remove.
              const prevTsMesh = transparentSolidMesh ?? Option.none<THREE.Mesh>()
              const existingTsMesh = Option.getOrNull(prevTsMesh)
              let updatedTransparentSolidMesh: Option.Option<THREE.Mesh>
              if (existingTsMesh === null) {
                if (transparentSolid === null || transparentSolid.positions.length === 0) {
                  updatedTransparentSolidMesh = Option.none()
                } else {
                  const tsm = new THREE.Mesh(buildGeometry(transparentSolid), transparentSolidMaterial)
                  tsm.frustumCulled = false
                  tsm.castShadow = false
                  tsm.receiveShadow = false
                  tsm.renderOrder = 2
                  tsm.userData['chunkCoord'] = chunk.coord
                  if (chunk.maxY !== undefined) tsm.userData['chunkMaxY'] = chunk.maxY
                  updatedTransparentSolidMesh = Option.some(tsm)
                }
              } else {
                const tsm = existingTsMesh
                if (transparentSolid === null || transparentSolid.positions.length === 0) {
                  tsm.geometry.dispose()
                  updatedTransparentSolidMesh = Option.none()
                } else {
                  if (!tryReuseGeometry(tsm.geometry, transparentSolid)) {
                    const oldGeom = tsm.geometry
                    tsm.geometry = buildGeometry(transparentSolid)
                    oldGeom.dispose()
                  }
                  tsm.userData['chunkCoord'] = chunk.coord
                  if (chunk.maxY !== undefined) tsm.userData['chunkMaxY'] = chunk.maxY
                  updatedTransparentSolidMesh = prevTsMesh
                }
              }

              return { waterMesh: updatedWaterMesh, transparentSolidMesh: updatedTransparentSolidMesh }
            })
          ),

        disposeMesh: (mesh: THREE.Mesh): Effect.Effect<void, never> =>
          Effect.sync(() => {
            mesh.geometry.dispose()
          }),

        // SEC-W1: invalidate the sync-fallback per-coord prev mesh cache held
        // inside MeshingWorkerPool. Called by world-renderer-chunk-sync.ts
        // when a chunk is removed from the scene so the cache cannot grow
        // unbounded over long sessions. Worker path is a no-op (worker has
        // no per-coord cache).
        releasePrevCachedMesh: (coord: ChunkCoord): Effect.Effect<void, never> =>
          pool.releasePrevCachedMesh(coord),

        setSunIntensity: (value: number): Effect.Effect<void, never> =>
          Effect.sync(() => setSunIntensity(value)),
      }
    }),
    dependencies: [MeshingWorkerPool.Default],
  }
) {}
export const ChunkMeshServiceLive = ChunkMeshService.Default
