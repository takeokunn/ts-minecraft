import type { ChunkWorldOffset, MeshedChunk, RawMeshData } from './greedy-meshing-types'
import type { DirtyAABB } from './subregion-greedy'
import type { computeAffectedSlices } from './subregion-greedy'

// Classify a quad by its face direction and depth slice from its first vertex
// position and normal. Returns null when the normal is non-axis-aligned (i.e.
// flat fluid top quads with the same normal-to-axis mapping as Y+ are still
// classified by Y depth — this only fails for diagonal normals which the
// pipeline never emits).
//
//   normal (1,0,0)  → X+ face, depth lx = round(vertex.x − offset.wx − 1)
//   normal (-1,0,0) → X- face, depth lx = round(vertex.x − offset.wx)
//   normal (0,1,0)  → Y+ face, depth y  = floor(vertex.y − 1)   (top fluid: fractional y)
//   normal (0,-1,0) → Y- face, depth y  = floor(vertex.y)
//   normal (0,0,1)  → Z+ face, depth lz = round(vertex.z − offset.wz − 1)
//   normal (0,0,-1) → Z- face, depth lz = round(vertex.z − offset.wz)
export const quadAxisDepth = (
  positions: Float32Array,
  normals: Int8Array,
  quadIndex: number,
  offset: ChunkWorldOffset,
): { readonly axis: 'x' | 'y' | 'z'; readonly depth: number } | null => {
  const v = quadIndex * 4
  const ni = v * 3
  const nx = normals[ni] as number
  const ny = normals[ni + 1] as number
  const nz = normals[ni + 2] as number
  const px = positions[ni] as number
  const py = positions[ni + 1] as number
  const pz = positions[ni + 2] as number
  if (nx === 1) return { axis: 'x', depth: Math.round(px - offset.wx) - 1 }
  if (nx === -1) return { axis: 'x', depth: Math.round(px - offset.wx) }
  if (ny === 1) return { axis: 'y', depth: Math.floor(py - 1 + 1e-6) }
  if (ny === -1) return { axis: 'y', depth: Math.floor(py + 1e-6) }
  if (nz === 1) return { axis: 'z', depth: Math.round(pz - offset.wz) - 1 }
  if (nz === -1) return { axis: 'z', depth: Math.round(pz - offset.wz) }
  /* c8 ignore start -- defensive: in practice all quads have axis-aligned normals */
  return null
}
/* c8 ignore end */

export const quadIsAffected = (
  axis: 'x' | 'y' | 'z',
  depth: number,
  ranges: ReturnType<typeof computeAffectedSlices>,
): boolean => {
  const r = axis === 'x' ? ranges.xRange : axis === 'y' ? ranges.yRange : ranges.zRange
  return depth >= r.start && depth <= r.end
}

// Conservative test for fluid-side quads whose face normal does not pin them
// to a single slice (e.g. fluid mesh emits top quads with fractional y). The
// quad is "affected" if any of its 4 vertices lies inside the expanded AABB.
// Only reachable when quadAxisDepth returns null (non-axis-aligned normal) which
// does not occur with the current axis-aligned meshing algorithm.
/* c8 ignore start */
export const fluidQuadIsAffected = (
  positions: Float32Array,
  quadIndex: number,
  offset: ChunkWorldOffset,
  aabb: DirtyAABB,
): boolean => {
  const pi = quadIndex * 4 * 3
  const exMin = { x: aabb.minX - 1, y: aabb.minY - 1, z: aabb.minZ - 1 }
  const exMax = { x: aabb.maxX + 2, y: aabb.maxY + 2, z: aabb.maxZ + 2 }
  for (let v = 0; v < 4; v++) {
    const lx = (positions[pi + v * 3] ?? 0) - offset.wx
    const ly = positions[pi + v * 3 + 1] ?? 0
    const lz = (positions[pi + v * 3 + 2] ?? 0) - offset.wz
    if (
      lx >= exMin.x && lx <= exMax.x &&
      ly >= exMin.y && ly <= exMax.y &&
      lz >= exMin.z && lz <= exMax.z
    ) return true
  }
  return false
}
/* c8 ignore end */

// ─── Mesh splice ─────────────────────────────────────────────────────────────
//
// Given previously-meshed `prevRaw` (chunk in the pre-edit state) and a
// freshly-meshed `freshRaw` (chunk in the post-edit state), produce a merged
// MeshedChunk that:
//
//   - keeps every prevRaw quad whose slice depth lies OUTSIDE the affected
//     range (these slices have NO input voxel difference from fresh — see
//     `expandedRange` correctness comment), AND
//   - takes every freshRaw quad whose slice depth lies INSIDE the affected
//     range.
//
// As a multiset, the output equals freshRaw because:
//   freshRaw ≡ {fresh quads at unaffected slices} ∪ {fresh quads at affected slices}
//   spliced  ≡ {prev  quads at unaffected slices} ∪ {fresh quads at affected slices}
//   unaffected slices have identical input voxels in prev/fresh → identical mask →
//   identical greedy expansion → byte-identical quad multiset.
//
// Quad ORDERING differs across the splice boundary; rendering is order-
// independent because each quad carries its own indices and material state is
// shared across all opaque chunk quads.
export type QuadSelector = (quadIndex: number) => boolean

export const splitQuads = (raw: RawMeshData, keep: QuadSelector): number[] => {
  const total = raw.indexCount / 6
  const kept: number[] = []
  for (let q = 0; q < total; q++) {
    if (keep(q)) kept.push(q)
  }
  return kept
}

export const concatQuads = (
  source: RawMeshData,
  quadIndices: ReadonlyArray<number>,
  outPos: Float32Array,
  outNormal: Int8Array,
  outColor: Uint8Array,
  outUv: Float32Array,
  outTile: Float32Array,
  outIdx: Uint32Array,
  startVertex: number,
  startIndex: number,
): { vertexCount: number; indexCount: number } => {
  let vCount = 0
  let iCount = 0
  for (let n = 0; n < quadIndices.length; n++) {
    const q = quadIndices[n]!
    const srcVBase = q * 4
    const srcPi = srcVBase * 3
    const srcUi = srcVBase * 2
    const dstVBase = startVertex + vCount
    const dstPi = dstVBase * 3
    const dstUi = dstVBase * 2
    for (let k = 0; k < 12; k++) {
      outPos[dstPi + k] = source.positions[srcPi + k] ?? 0
      outNormal[dstPi + k] = source.normals[srcPi + k] ?? 0
      outColor[dstPi + k] = source.colors[srcPi + k] ?? 0
    }
    for (let k = 0; k < 8; k++) {
      outUv[dstUi + k] = source.uvs[srcUi + k] ?? 0
    }
    for (let k = 0; k < 4; k++) {
      outTile[dstVBase + k] = source.tileIndexes[srcVBase + k] ?? 0
    }
    const srcIi = q * 6
    const dstIi = startIndex + iCount
    outIdx[dstIi]     = source.indices[srcIi]!     - srcVBase + dstVBase
    outIdx[dstIi + 1] = source.indices[srcIi + 1]! - srcVBase + dstVBase
    outIdx[dstIi + 2] = source.indices[srcIi + 2]! - srcVBase + dstVBase
    outIdx[dstIi + 3] = source.indices[srcIi + 3]! - srcVBase + dstVBase
    outIdx[dstIi + 4] = source.indices[srcIi + 4]! - srcVBase + dstVBase
    outIdx[dstIi + 5] = source.indices[srcIi + 5]! - srcVBase + dstVBase
    vCount += 4
    iCount += 6
  }
  return { vertexCount: vCount, indexCount: iCount }
}

export const spliceMesh = (
  prevRaw: RawMeshData,
  freshRaw: RawMeshData,
  isPrevQuadKept: QuadSelector,
  isFreshQuadKept: QuadSelector,
): MeshedChunk => {
  const prevKept = splitQuads(prevRaw, isPrevQuadKept)
  const freshKept = splitQuads(freshRaw, isFreshQuadKept)
  const totalQuads = prevKept.length + freshKept.length
  const totalVerts = totalQuads * 4
  const positions = new Float32Array(totalVerts * 3)
  const normals = new Int8Array(totalVerts * 3)
  const colors = new Uint8Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const tileIndexes = new Float32Array(totalVerts)
  const indices = new Uint32Array(totalQuads * 6)

  const a = concatQuads(prevRaw, prevKept, positions, normals, colors, uvs, tileIndexes, indices, 0, 0)
  concatQuads(freshRaw, freshKept, positions, normals, colors, uvs, tileIndexes, indices, a.vertexCount, a.indexCount)

  return { positions, normals, colors, uvs, tileIndexes, indices }
}

// Construct RawMeshData directly from a MeshedChunk's typed arrays.
// MeshedChunk buffers are produced internally by spliceMesh so Schema validation
// is redundant overhead that also risks throwing outside Effect's error channel.
export const decodeRaw = (m: MeshedChunk): RawMeshData => ({
  positions: m.positions,
  normals: m.normals,
  colors: m.colors,
  uvs: m.uvs,
  tileIndexes: m.tileIndexes,
  indices: m.indices,
  vertexCount: m.positions.length / 3,
  indexCount: m.indices.length,
})

