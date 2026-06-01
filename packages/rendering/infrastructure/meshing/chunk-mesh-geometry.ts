import * as THREE from 'three'
import type { MeshedChunk } from './greedy-meshing-types'
import type { LodLevel } from './lod-simplification'
import type { DirtyAABB, MeshChunkOptions } from '@ts-minecraft/worker'

// Builds a MeshChunkOptions object that satisfies exactOptionalPropertyTypes.
// We construct distinct shapes per branch so each property is either present
// with a defined value or absent — never `T | undefined`.
export const buildMeshChunkOptions = (
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

export const buildGeometry = (meshed: MeshedChunk): THREE.BufferGeometry => {
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
export const tryReuseGeometry = (geometry: THREE.BufferGeometry, meshed: MeshedChunk): boolean => {
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
