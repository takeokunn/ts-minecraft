import { Effect, Option } from 'effect'
import * as THREE from 'three'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import { Chunk } from '@ts-minecraft/terrain'
import { TextureError } from '../../domain/errors'
import { MeshedChunk } from './greedy-meshing'
import type { LodLevel } from './lod-simplification'
import { MeshingWorkerPool, type DirtyAABB, type MeshChunkOptions } from './meshing-worker-pool'
import { ATLAS_COLS, ATLAS_SIZE, HALF_TEXEL } from '../textures/block-texture-map'

// Builds a MeshChunkOptions object that satisfies exactOptionalPropertyTypes.
// We construct distinct shapes per branch so each property is either present
// with a defined value or absent — never `T | undefined`.
const buildMeshChunkOptions = (
  lod: LodLevel | undefined,
  dirtyAABB: DirtyAABB | undefined,
): MeshChunkOptions | undefined => {
  if (lod === undefined && dirtyAABB === undefined) return undefined
  if (lod === undefined) return { dirtyAABB: dirtyAABB! }
  if (dirtyAABB === undefined) return { lod }
  return { lod, dirtyAABB }
}

// ─── Draw-call batching strategy ─────────────────────────────────────────────
//
// Why InstancedMesh is NOT used for chunk rendering:
//
// InstancedMesh requires many copies of the *same* geometry placed at different
// positions via per-instance transforms. It excels for particle systems, foliage
// billboards, or entity models where thousands of identical meshes exist.
//
// Chunk terrain does NOT fit this pattern because:
// 1. Greedy meshing (greedy-meshing.ts) already merges adjacent same-type blocks
//    into maximal rectangles. Each chunk produces a SINGLE merged BufferGeometry
//    with variable-size quads — not repeated identical geometry.
// 2. Each chunk's geometry is unique (different block arrangements, face counts,
//    AO values). There is no "template" geometry to instance.
// 3. One chunk = one draw call for opaque geometry (+ optionally one for water).
//    With render distance 8, that's ~200 opaque draw calls — well within GPU
//    command-buffer budgets. InstancedMesh would not reduce this.
//
// Current draw-call reduction techniques already in place:
// - Single shared MeshLambertMaterial (atlas texture) across ALL opaque chunks
// - Single shared ShaderMaterial across ALL water chunks
// - frustumCulled=false + manual AABB frustum culling in WorldRendererService
//   (cheaper than Three.js per-object bounding-sphere checks)
// - Shadow distance culling: castShadow disabled beyond shadow camera range
// - In-place GPU buffer reuse (tryReuseGeometry) avoids reallocation on update
// - Vertex colors encode per-vertex AO; no per-block-type material switching
//
// If InstancedMesh becomes beneficial in the future, candidates would be:
// - Entity rendering (mobs: cow, pig, sheep, zombie — identical box models)
// - Particle effects (block break particles, water splash)
// - Dropped item models
// ─────────────────────────────────────────────────────────────────────────────

const buildGeometry = (meshed: MeshedChunk): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(meshed.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(meshed.normals, 3, false))
  geometry.setAttribute('color', new THREE.BufferAttribute(meshed.colors, 3, true))
  geometry.setAttribute('uv', new THREE.BufferAttribute(meshed.uvs, 2))
  geometry.setAttribute('tileIndex', new THREE.BufferAttribute(meshed.tileIndexes, 1))
  geometry.setIndex(new THREE.BufferAttribute(meshed.indices, 1))
  return geometry
}

const getBufferAttr = (geometry: THREE.BufferGeometry, name: string): THREE.BufferAttribute | null => {
  const attr = geometry.getAttribute(name)
  return attr instanceof THREE.BufferAttribute ? attr : null
}

const copyAndMark = (attr: THREE.BufferAttribute, data: ArrayLike<number>): void => {
  attr.copyArray(data)
  attr.needsUpdate = true
}

// Performance boundary: reuse existing GPU buffers when capacity is sufficient.
// Returns true if in-place update succeeded, false if caller must do full rebuild.
//
// Accepts MeshedChunk (owned arrays from worker transfer or toMeshed() slice).
// With worker-sourced data the .slice() allocation happens in the worker thread,
// so the main thread only pays for the GPU copy here — no intermediate GC pressure.
const tryReuseGeometry = (geometry: THREE.BufferGeometry, meshed: MeshedChunk): boolean => {
  const posAttr = getBufferAttr(geometry, 'position')
  if (!posAttr || posAttr.count * 3 < meshed.positions.length) return false
  copyAndMark(posAttr, meshed.positions)

  const normalAttr = getBufferAttr(geometry, 'normal')
  if (!normalAttr) return false
  copyAndMark(normalAttr, meshed.normals)

  const colorAttr = getBufferAttr(geometry, 'color')
  if (!colorAttr) return false
  copyAndMark(colorAttr, meshed.colors)

  const uvAttr = getBufferAttr(geometry, 'uv')
  if (!uvAttr) return false
  copyAndMark(uvAttr, meshed.uvs)

  const tileIndexAttr = getBufferAttr(geometry, 'tileIndex')
  if (!tileIndexAttr) return false
  copyAndMark(tileIndexAttr, meshed.tileIndexes)

  const indexAttr = geometry.getIndex()
  if (indexAttr instanceof THREE.BufferAttribute && indexAttr.count >= meshed.indices.length) {
    copyAndMark(indexAttr, meshed.indices)
  } else {
    geometry.setIndex(new THREE.BufferAttribute(meshed.indices, 1))
  }
  geometry.setDrawRange(0, meshed.indices.length)

  return true
}

const buildAtlasTexture = (): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.async<THREE.Texture, TextureError>((resume) => {
    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_SIZE
    canvas.height = ATLAS_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resume(Effect.fail(new TextureError({ url: '/textures/atlas.png', cause: new Error('Failed to acquire 2D canvas context') })))
      return
    }
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      const texture = new THREE.CanvasTexture(canvas)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestMipmapNearestFilter
      texture.generateMipmaps = true
      texture.anisotropy = 8
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      resume(Effect.succeed(texture))
    }
    img.onerror = (e) => {
      resume(Effect.fail(new TextureError({ url: '/textures/atlas.png', cause: e instanceof Error ? e : new Error(String(e)) })))
    }
    img.src = '/textures/atlas.png'
    return Effect.sync(() => {
      img.onload = null
      img.onerror = null
    })
  })

export class ChunkMeshService extends Effect.Service<ChunkMeshService>()(
  '@minecraft/infrastructure/three/ChunkMeshService',
  {
    scoped: Effect.gen(function* () {
      const [pool, atlasTexture] = yield* Effect.all(
        [MeshingWorkerPool, Effect.orDie(buildAtlasTexture())],
        { concurrency: 'unbounded' }
      )

      // Per-vertex colors encode three light factors normalized to [0,1] in the shader:
      //   R = ambient occlusion (1 = unoccluded, 0 = fully occluded)
      //   G = sky-light factor   (skyLight / 15)
      //   B = block-light factor (blockLight / 15)
      //
      // The patch below replaces Three.js' vertex-color contribution to combine sky and block
      // light (so torchlight at night is bright like vanilla) and modulate the result by AO.
      // uSunIntensity is exposed per-material (default 1.0 = full daylight); a future
      // time-of-day system can ramp this between 0 and 1 for diurnal cycles.
      const sharedUniforms = { uSunIntensity: { value: 1.0 } }
      const sharedMaterial = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const mat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.08,
            map: atlasTexture,
            vertexColors: true,
          })
          mat.onBeforeCompile = (shader) => {
            shader.uniforms['uSunIntensity'] = sharedUniforms.uSunIntensity
            shader.uniforms['uAtlasCols'] = { value: ATLAS_COLS }
            shader.uniforms['uAtlasHalfTexel'] = { value: HALF_TEXEL }
            // Inject lighting compute into the fragment shader. We replace the standard
            // <color_fragment> chunk (which would multiply diffuseColor by vColor as a tint)
            // with our own combine: sky*sun + block (max-blended), then modulated by AO.
            // The shader's vColor varying carries (R=AO, G=sky, B=block) in [0,1] from the
            // BufferAttribute's `normalized: true` flag.
            // Guard against Three.js upgrade silently breaking smooth-lighting injection.
            if (
              !shader.vertexShader.includes('void main() {')
              || !shader.fragmentShader.includes('void main() {')
              || !shader.fragmentShader.includes('#include <map_fragment>')
              || !shader.fragmentShader.includes('#include <color_fragment>')
            ) {
              throw new Error('chunk-mesh: Three.js shader tokens for atlas/lighting injection not found — terrain shader injection will silently no-op')
            }
            shader.vertexShader = shader.vertexShader
              .replace(
                'void main() {',
                `attribute float tileIndex;\nvarying float vAtlasTileIndex;\nvoid main() {\n  vAtlasTileIndex = tileIndex;`
              )
            shader.fragmentShader = shader.fragmentShader
              .replace(
                'void main() {',
                `uniform float uSunIntensity;\nuniform float uAtlasCols;\nuniform float uAtlasHalfTexel;\nvarying float vAtlasTileIndex;\nvoid main() {`
              )
              .replace(
                '#include <map_fragment>',
                `#ifdef USE_MAP
                  float atlasIndex = floor(vAtlasTileIndex + 0.5);
                  float atlasCol = mod(atlasIndex, uAtlasCols);
                  float atlasRow = floor(atlasIndex / uAtlasCols);
                  vec2 tileUv = fract(vMapUv);
                  vec2 atlasMin = vec2(
                    atlasCol / uAtlasCols + uAtlasHalfTexel,
                    1.0 - (atlasRow + 1.0) / uAtlasCols + uAtlasHalfTexel
                  );
                  vec2 atlasMax = vec2(
                    (atlasCol + 1.0) / uAtlasCols - uAtlasHalfTexel,
                    1.0 - atlasRow / uAtlasCols - uAtlasHalfTexel
                  );
                  vec4 sampledDiffuseColor = texture2D(map, mix(atlasMin, atlasMax, tileUv));
                  #ifdef DECODE_VIDEO_TEXTURE
                    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
                  #endif
                  diffuseColor *= sampledDiffuseColor;
                #endif`
              )
              .replace(
                '#include <color_fragment>',
                `#ifdef USE_COLOR
                   float aoFactor = vColor.r;
                   float skyFactor = vColor.g;
                   float blockFactor = vColor.b;
                   float lightFactor = max(skyFactor * uSunIntensity, blockFactor);
                    diffuseColor.rgb *= (0.38 + 0.62 * lightFactor) * (0.8 + 0.2 * aoFactor);
                 #endif`
              )
          }
          // Three.js caches compiled programs by material UUID + defines; ensure recompile
          // by setting needsUpdate after assignment.
          mat.needsUpdate = true
          return mat
        }),
        (mat) => Effect.sync(() => mat.dispose())
      )

      return {
        atlasTexture,

        createChunkMesh: (
          chunk: Chunk,
          waterMaterial?: THREE.ShaderMaterial,
          lod?: LodLevel
        ): Effect.Effect<{ opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh> }, never> =>
          pool.meshChunk(chunk, lod === undefined ? undefined : { lod }).pipe(
            Effect.map(({ opaque, water }) => {
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

              return { opaqueMesh, waterMesh }
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
        ): Effect.Effect<Option.Option<THREE.Mesh>, never> =>
          pool.meshChunk(chunk, buildMeshChunkOptions(lod, dirtyAABB)).pipe(
            Effect.map(({ opaque, water }) => {
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
              return Option.match(waterMesh, {
                onNone: () => {
                  if (water === null || water.positions.length === 0) {
                    return Option.none()
                  }
                  return Option.match(Option.fromNullable(waterMaterial), {
                    onNone: () => Option.none(),
                    onSome: (mat) => {
                      const wm = new THREE.Mesh(buildGeometry(water), mat)
                      wm.frustumCulled = false
                      wm.castShadow = false
                      wm.receiveShadow = false
                      wm.renderOrder = 1
                      wm.userData['chunkCoord'] = chunk.coord
                      if (chunk.maxY !== undefined) wm.userData['chunkMaxY'] = chunk.maxY
                      return Option.some(wm)
                    },
                  })
                },
                onSome: (wm) => {
                  if (water === null || water.positions.length === 0) {
                    wm.geometry.dispose()
                    return Option.none()
                  }
                  if (!tryReuseGeometry(wm.geometry, water)) {
                    const oldWaterGeometry = wm.geometry
                    wm.geometry = buildGeometry(water)
                    oldWaterGeometry.dispose()
                  }
                  wm.userData['chunkCoord'] = chunk.coord
                  if (chunk.maxY !== undefined) wm.userData['chunkMaxY'] = chunk.maxY
                  return waterMesh
                },
              })
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
          Effect.sync(() => {
            sharedUniforms.uSunIntensity.value = Math.max(0, Math.min(1, value))
          }),
      }
    }),
    dependencies: [MeshingWorkerPool.Default],
  }
) {}
export const ChunkMeshServiceLive = ChunkMeshService.Default
