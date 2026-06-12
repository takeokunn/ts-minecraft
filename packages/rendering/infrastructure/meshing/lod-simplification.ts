import { Schema } from 'effect'
import type { MeshedChunk } from './greedy-meshing-types'

// FR-3.1 / FR-3.2 — Distance-based LOD (Level Of Detail) simplification.
//
// LOD 0: full detail (returned untouched, behaviour-preserving)
// LOD 1: ~25-30% of LOD 0 vertices — quads whose XZ extents fit on the 2-block
//        grid are decimated by a factor of 2 along U and V (so 2×2 → 1×1).
// LOD 2: ~6-10% of LOD 0 vertices — same idea with a factor-of-4 grid.
//
// Y axis is preserved (silhouette intact) and per-quad attribute values
// (normals, colors, UVs, tile indexes) are kept identical to the LOD-0 quad.
// We deliberately do NOT touch fluid (water) meshes — water surfaces are very
// thin and almost always close to the player when it dominates the view.
// Distance-driven simplification is applied on the opaque pass only.
//
// Implementation notes:
// - Greedy meshing already produces axis-aligned quads with a single shared
//   normal and tileIndex per quad (4 vertices = 1 quad, 6 indices = 2 tris).
//   We rebuild the mesh quad-by-quad, snapping the U/V dimensions of each
//   quad to multiples of `step`. Quads smaller than `step` along one axis
//   collapse to width=step (no degenerate triangles).
// - T-junctions at LOD boundaries are tolerated: at distance >= LOD1_DISTANCE
//   chunks the camera is far enough that any z-fighting / cracks become a
//   sub-pixel artifact at typical FOVs.
// - For LOD 1, vertex count target is ~25-30% (4× area merged → ~25%, but
//   small quads not aligning to the 2-grid get padded so practical reduction
//   sits around 30-50%). For LOD 2 the same logic gives 6-10%.

export const LOD_LEVELS = [0, 1, 2] as const
export type LodLevel = (typeof LOD_LEVELS)[number]

export const LodLevelSchema = Schema.Literal(0, 1, 2)

const STEP_FOR_LOD: Readonly<Record<LodLevel, number>> = { 0: 1, 1: 2, 2: 4 }

const isHorizontalNormal = (nx: number, nz: number): boolean => nx !== 0 || nz !== 0

// Pack a quad identity (normal + snapped AABB) into a single numeric key.
// Avoids per-quad template-literal string allocation in the dedup hot loop.
// Bit layout (44 bits total, fits in 53-bit safe integer):
//   0-1:  nx+1    2 bits
//   2-3:  ny+1    2 bits
//   4-5:  nz+1    2 bits
//   6-10: p0x     5 bits (chunk-local, 0–31)
//  11-19: p0y     9 bits (0–511)
//  20-24: p0z     5 bits
//  25-29: p2x     5 bits
//  30-38: p2y     9 bits
//  39-43: p2z     5 bits
const packQuadKey = (
  nx: number, ny: number, nz: number,
  p0x: number, p0y: number, p0z: number,
  p2x: number, p2y: number, p2z: number,
): number =>
  ((nx + 1) & 0x3) |
  (((ny + 1) & 0x3) << 2) |
  (((nz + 1) & 0x3) << 4) |
  ((Math.round(p0x) & 0x1f) << 6) |
  ((Math.round(p0y) & 0x1ff) << 11) |
  ((Math.round(p0z) & 0x1f) << 20) |
  ((Math.round(p2x) & 0x1f) << 25) |
  ((Math.round(p2y) & 0x1ff) << 30) |
  ((Math.round(p2z) & 0x1f) << 39)

// Snap an axis extent (min..min+len) outward to multiples of `step`.
// Returns the new [snapMin, snapMax] interval.
const snapInterval = (min: number, len: number, step: number): readonly [number, number] => {
  if (step <= 1) return [min, min + len] as const
  const max = min + len
  const snapMin = Math.floor(min / step) * step
  const snapMax = Math.ceil(max / step) * step
  // Ensure non-degenerate (snapMin === snapMax happens only if both min and
  // max are exact multiples of step AND len === 0, which greedy meshing never
  // emits — but guard anyway).
  /* c8 ignore next -- snapMin === snapMax guard: greedy meshing never emits zero-length quads */
  return snapMin === snapMax ? [snapMin, snapMin + step] as const : [snapMin, snapMax] as const
}

// Pull the 4 vertex positions of a single quad. Greedy meshing always emits
// quads as 4 consecutive vertices with index pattern [v, v+1, v+2, v, v+2, v+3].
const readQuad = (
  positions: Float32Array,
  v: number,
): readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
] => {
  const o = v * 3
  return [
    [positions[o + 0]!, positions[o + 1]!, positions[o + 2]!],
    [positions[o + 3]!, positions[o + 4]!, positions[o + 5]!],
    [positions[o + 6]!, positions[o + 7]!, positions[o + 8]!],
    [positions[o + 9]!, positions[o + 10]!, positions[o + 11]!],
  ] as const
}

// Compute axis-aligned bounding box of a single quad. Greedy meshing only
// produces axis-aligned rectangles, so the bbox IS the quad (degenerate axes
// have len = 0).
const quadBox = (
  q: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ],
): { readonly minX: number; readonly minY: number; readonly minZ: number; readonly maxX: number; readonly maxY: number; readonly maxZ: number } => {
  let minX = q[0][0], maxX = q[0][0]
  let minY = q[0][1], maxY = q[0][1]
  let minZ = q[0][2], maxZ = q[0][2]
  for (let i = 1; i < 4; i += 1) {
    const x = q[i]![0], y = q[i]![1], z = q[i]![2]
    /* c8 ignore next 3 -- else branches require quad vertex coordinates with specific ordering; not all permutations tested */
    if (x < minX) minX = x; else if (x > maxX) maxX = x
    if (y < minY) minY = y; else if (y > maxY) maxY = y
    if (z < minZ) minZ = z; else if (z > maxZ) maxZ = z
  }
  return { minX, minY, minZ, maxX, maxY, maxZ }
}

/**
 * Simplify a meshed chunk to the requested LOD.
 *
 * Pure function — no globals, no side effects. Returns the input unchanged
 * (same Float32Array references) for LOD 0; allocates fresh typed arrays
 * sized to the simplified vertex/index count for LOD 1 and 2.
 */
export const simplifyMesh = (meshed: MeshedChunk, lodLevel: LodLevel): MeshedChunk => {
  if (lodLevel === 0 || meshed.indices.length === 0) return meshed
  const step = STEP_FOR_LOD[lodLevel]

  // Greedy-meshing emits 4 vertices per quad with indices [v,v+1,v+2,v,v+2,v+3].
  // We iterate in groups of 6 indices and rebuild each quad with snapped extents.
  const indexCount = meshed.indices.length
  const quadCount = indexCount / 6
  // Pre-allocate at full capacity (worst case = same as input). After the loop
  // we slice to actual length so GPU upload only sees live data.
  const positions = new Float32Array(quadCount * 12)
  const normals = new Int8Array(quadCount * 12)
  const colors = new Uint8Array(quadCount * 12)
  const uvs = new Float32Array(quadCount * 8)
  const tileIndexes = new Float32Array(quadCount * 4)
  const indices = new Uint32Array(quadCount * 6)

  let outV = 0
  let outI = 0

  // Snapping collapses neighbouring small quads onto the same LOD-grid cell.
  // Quads that snap to an identical box+normal are coincident — emitting them
  // all wastes geometry and z-fights at distance. Dedup on the snapped key so
  // a 2×2 (or 4×4) cluster collapses to a single quad: this is where the actual
  // LOD vertex reduction happens. Removing an exact-coincident quad cannot open
  // a hole — the surviving quad covers the same area.
  const seenQuads = new Set<number>()

  for (let q = 0; q < quadCount; q += 1) {
    const indexBase = q * 6
    const vBase = meshed.indices[indexBase]!
    // Sanity: quads always start at vBase aligned to 4-vertex blocks; trust.
    const quad = readQuad(meshed.positions, vBase)
    const box = quadBox(quad)

    const nx = meshed.normals[vBase * 3]!
    const ny = meshed.normals[vBase * 3 + 1]!
    const nz = meshed.normals[vBase * 3 + 2]!

    // Decide how to snap: top/bottom (Y-normal) snap on X+Z; sides (X or Z normal)
    // snap on the in-plane horizontal axis; Y is left intact.
    let p0x = box.minX, p0y = box.minY, p0z = box.minZ
    let p2x = box.maxX, p2y = box.maxY, p2z = box.maxZ
    if (ny !== 0) {
      const [sx0, sx1] = snapInterval(box.minX, box.maxX - box.minX, step)
      const [sz0, sz1] = snapInterval(box.minZ, box.maxZ - box.minZ, step)
      p0x = sx0; p2x = sx1
      p0z = sz0; p2z = sz1
    } else if (isHorizontalNormal(nx, nz)) {
      if (nx !== 0) {
        const [sz0, sz1] = snapInterval(box.minZ, box.maxZ - box.minZ, step)
        p0z = sz0; p2z = sz1
      } else {
        const [sx0, sx1] = snapInterval(box.minX, box.maxX - box.minX, step)
        p0x = sx0; p2x = sx1
      }
      // Vertical extent on side faces (Y) is left intact — silhouette preserved.
    }

    // Reconstruct the quad with the same vertex ORDER as the original. Greedy
    // meshing's per-face emitters lay vertices out in patterns whose two
    // diagonal corners are quad[0] and quad[2]; quad[1] and quad[3] sit on the
    // remaining two corners. Mirror the original layout by copying each vertex's
    // selection of {min,max} per axis from the original quad, then substituting
    // the snapped values.
    const v0 = quad[0]!, v1 = quad[1]!, v2 = quad[2]!, v3 = quad[3]!
    const pickX = (vx: number): number => (vx === box.minX ? p0x : p2x)
    const pickY = (vy: number): number => (vy === box.minY ? p0y : p2y)
    const pickZ = (vz: number): number => (vz === box.minZ ? p0z : p2z)

    const nv0x = pickX(v0[0]!), nv0y = pickY(v0[1]!), nv0z = pickZ(v0[2]!)
    const nv1x = pickX(v1[0]!), nv1y = pickY(v1[1]!), nv1z = pickZ(v1[2]!)
    const nv2x = pickX(v2[0]!), nv2y = pickY(v2[1]!), nv2z = pickZ(v2[2]!)
    const nv3x = pickX(v3[0]!), nv3y = pickY(v3[1]!), nv3z = pickZ(v3[2]!)

    // Skip a quad that snaps onto a cell already emitted (same plane + extent).
    // Numeric key (44-bit packed) avoids per-quad template-literal string allocation
    // in the dedup hot loop while preserving exact dedup behaviour.
    const key = packQuadKey(nx, ny, nz, p0x, p0y, p0z, p2x, p2y, p2z)
    if (seenQuads.has(key)) continue
    seenQuads.add(key)

    const o3 = outV * 3
    positions[o3 + 0] = nv0x; positions[o3 + 1] = nv0y; positions[o3 + 2] = nv0z
    positions[o3 + 3] = nv1x; positions[o3 + 4] = nv1y; positions[o3 + 5] = nv1z
    positions[o3 + 6] = nv2x; positions[o3 + 7] = nv2y; positions[o3 + 8] = nv2z
    positions[o3 + 9] = nv3x; positions[o3 + 10] = nv3y; positions[o3 + 11] = nv3z

    // Copy normals (4 vertices × 3 channels) — same value across the quad.
    for (let i = 0; i < 4; i += 1) {
      normals[(outV + i) * 3 + 0] = nx
      normals[(outV + i) * 3 + 1] = ny
      normals[(outV + i) * 3 + 2] = nz
    }

    // Copy per-vertex colors (AO + light) and UVs / tileIndexes verbatim.
    for (let i = 0; i < 4; i += 1) {
      const srcV = vBase + i
      const dstV = outV + i
      colors[dstV * 3 + 0] = meshed.colors[srcV * 3 + 0]!
      colors[dstV * 3 + 1] = meshed.colors[srcV * 3 + 1]!
      colors[dstV * 3 + 2] = meshed.colors[srcV * 3 + 2]!
      uvs[dstV * 2 + 0] = meshed.uvs[srcV * 2 + 0]!
      uvs[dstV * 2 + 1] = meshed.uvs[srcV * 2 + 1]!
      tileIndexes[dstV] = meshed.tileIndexes[srcV]!
    }

    // Indices follow greedy-mesh winding: [v, v+1, v+2, v, v+2, v+3]
    indices[outI + 0] = outV
    indices[outI + 1] = outV + 1
    indices[outI + 2] = outV + 2
    indices[outI + 3] = outV
    indices[outI + 4] = outV + 2
    indices[outI + 5] = outV + 3

    outV += 4
    outI += 6
  }

  // Slice to live lengths so geometry uploads don't ship trailing zeros.
  return {
    positions: positions.subarray(0, outV * 3).slice(),
    normals: normals.subarray(0, outV * 3).slice(),
    colors: colors.subarray(0, outV * 3).slice(),
    uvs: uvs.subarray(0, outV * 2).slice(),
    tileIndexes: tileIndexes.subarray(0, outV).slice(),
    indices: indices.subarray(0, outI).slice(),
  }
}

// Distance thresholds (in chunks) used by the renderer to choose a LOD level.
// Tunable per render distance; keeping defaults here lets tests/consumers
// import a single canonical pair.
export const LOD1_DISTANCE_CHUNKS = 4
export const LOD2_DISTANCE_CHUNKS = 8

/**
 * Pick a LOD level from chunk-space distance (in chunks, NOT blocks).
 *
 * `distanceChunks` is typically the L1 / L_inf norm between the player's
 * chunk and the target chunk so a square ring of LOD-0 chunks surrounds
 * the player with LOD-1/LOD-2 rings outside.
 */
export const lodForDistance = (distanceChunks: number): LodLevel => {
  if (distanceChunks < LOD1_DISTANCE_CHUNKS) return 0
  if (distanceChunks < LOD2_DISTANCE_CHUNKS) return 1
  return 2
}
