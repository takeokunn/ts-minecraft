import { Schema } from 'effect'
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import { getLightAt } from '@ts-minecraft/domain'
import type { LightGrids } from '@ts-minecraft/domain'
import { getTileIndex, getTileUVs, FaceDir } from '../textures/block-texture-map'

// Zero-copy view into accumulator buffers — subarrays (NOT sliced copies).
// Used by the update path (tryReuseGeometry) to avoid an intermediate ~200-400KB allocation
// per chunk that would immediately become garbage after being copied into GPU buffers.
//
// ⚠ These subarrays alias the accumulator's backing store. They are only valid
// until the next call to greedyMeshChunk (which resets the accumulators).
// The update path consumes them synchronously within the same frame-handler tick,
// so this is safe under the current single-fiber meshing model.
export const RawMeshDataSchema = Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Int8Array),
  colors: Schema.instanceOf(Uint8Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  indexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type RawMeshData = Schema.Schema.Type<typeof RawMeshDataSchema>

export const MeshedChunkSchema = Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Int8Array),
  colors: Schema.instanceOf(Uint8Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
})
export type MeshedChunk = Schema.Schema.Type<typeof MeshedChunkSchema>

export const ChunkWorldOffsetSchema = Schema.Struct({
  wx: Schema.Number.pipe(Schema.int()),
  wz: Schema.Number.pipe(Schema.int()),
})
export type ChunkWorldOffset = Schema.Schema.Type<typeof ChunkWorldOffsetSchema>

const AIR = 0

// Greedy meshing scratch buffers.
// Reusing these per worker/service instance avoids reallocating ~4 KB of done-tracking
// plus the two mask buffers on every chunk rebuild.
const EMPTY_MESHED_CHUNK: MeshedChunk = {
  positions: new Float32Array(0),
  normals: new Int8Array(0),
  colors: new Uint8Array(0),
  uvs: new Float32Array(0),
  indices: new Uint32Array(0),
}

// Mask cells now pack 26 bits:
//   blockId      bits 0-7   (8 bits)
//   ao           bits 8-9   (2 bits)
//   sky0..sky3   bits 10-17 (2 bits each, 4 corners)
//   block0..3    bits 18-25 (2 bits each, 4 corners)
// Uint32Array is required to fit all 26 bits.
export type GreedyMeshScratch = {
  readonly doneBuf: Uint8Array
  readonly maskCH: Uint32Array
  readonly maskSS: Uint32Array
}

export const createGreedyMeshScratch = (): GreedyMeshScratch => ({
  doneBuf: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT),
  maskCH: new Uint32Array(CHUNK_SIZE * CHUNK_HEIGHT),
  maskSS: new Uint32Array(CHUNK_SIZE * CHUNK_SIZE),
})

const getBlock = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return AIR
  return blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!
}

const isAir = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): boolean =>
  getBlock(blocks, lx, y, lz) === AIR

const aoXPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx >= CHUNK_SIZE - 1) return 0
  const xOffset = (lx + 1) * CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (y > 0 && blocks[y - 1 + zOffset + xOffset]! !== AIR) count++
  if (y < CHUNK_HEIGHT - 1 && blocks[y + 1 + zOffset + xOffset]! !== AIR) count++
  if (lz > 0 && blocks[y + (lz - 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  if (lz < CHUNK_SIZE - 1 && blocks[y + (lz + 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  return count > 3 ? 3 : count
}

const aoXNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx <= 0) return 0
  const xOffset = (lx - 1) * CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (y > 0 && blocks[y - 1 + zOffset + xOffset]! !== AIR) count++
  if (y < CHUNK_HEIGHT - 1 && blocks[y + 1 + zOffset + xOffset]! !== AIR) count++
  if (lz > 0 && blocks[y + (lz - 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  if (lz < CHUNK_SIZE - 1 && blocks[y + (lz + 1) * CHUNK_HEIGHT + xOffset]! !== AIR) count++
  return count > 3 ? 3 : count
}

const aoYPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (y >= CHUNK_HEIGHT - 1) return 0
  const yOffset = y + 1
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[yOffset + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[yOffset + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (lz + 1 < CHUNK_SIZE && blocks[yOffset + (lz + 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  if (lz > 0 && blocks[yOffset + (lz - 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

const aoYNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (y <= 0) return 0
  const yOffset = y - 1
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  const zOffset = lz * CHUNK_HEIGHT
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[yOffset + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[yOffset + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (lz + 1 < CHUNK_SIZE && blocks[yOffset + (lz + 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  if (lz > 0 && blocks[yOffset + (lz - 1) * CHUNK_HEIGHT + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

const aoZPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lz >= CHUNK_SIZE - 1) return 0
  const zOffset = (lz + 1) * CHUNK_HEIGHT
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[y + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[y + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (y + 1 < CHUNK_HEIGHT && blocks[y + 1 + zOffset + lx * xBase]! !== AIR) count++
  if (y > 0 && blocks[y - 1 + zOffset + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

const aoZNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lz <= 0) return 0
  const zOffset = (lz - 1) * CHUNK_HEIGHT
  const xBase = CHUNK_HEIGHT * CHUNK_SIZE
  let count = 0
  if (lx + 1 < CHUNK_SIZE && blocks[y + zOffset + (lx + 1) * xBase]! !== AIR) count++
  if (lx > 0 && blocks[y + zOffset + (lx - 1) * xBase]! !== AIR) count++
  if (y + 1 < CHUNK_HEIGHT && blocks[y + 1 + zOffset + lx * xBase]! !== AIR) count++
  if (y > 0 && blocks[y - 1 + zOffset + lx * xBase]! !== AIR) count++
  return count > 3 ? 3 : count
}

// ─── Light sampling ──────────────────────────────────────────────────────────

// Per-voxel light read with default of {sky:15, block:0} for out-of-bounds.
// Reads from the AIR side of a face — caller passes (lx,y,lz) of the empty voxel
// adjacent to the solid face.
// Returns packed `(sky << 4) | block` (sky and block each ∈ [0..15]).
const sampleVoxelLight = (
  grids: LightGrids | undefined,
  lx: number,
  y: number,
  lz: number
): number => {
  if (grids === undefined) return 0xf0 /* sky=15,block=0 */
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
    return 0xf0 /* sky=15,block=0 */
  }
  return (getLightAt(grids.skyLight, lx, y, lz) << 4) | getLightAt(grids.blockLight, lx, y, lz)
}

// Sample 4 voxels meeting at a face corner and average their light.
// `airX/airY/airZ` is the AIR-side voxel adjacent to the face.
// `(t1x,t1y,t1z)` and `(t2x,t2y,t2z)` are unit tangent vectors in the face plane;
// the corner offset (du,dv) selects which 2×2 corner we're sampling around.
// Returns packed `(sky << 4) | block`; quantized 2-bit corner extraction at call sites:
//   sky 2-bit  = (packed >> 6) & 0x3   (shift off 4 block bits + 2 low sky bits, mask 2 bits)
//   block 2-bit = (packed >> 2) & 0x3
const sampleCornerLight = (
  grids: LightGrids | undefined,
  airX: number,
  airY: number,
  airZ: number,
  t1x: number,
  t1y: number,
  t1z: number,
  t2x: number,
  t2y: number,
  t2z: number,
  du: number,
  dv: number
): number => {
  if (grids === undefined) return 0xf0 /* sky=15,block=0 */
  // 4 voxels meeting at the corner: the AIR voxel itself plus its 3 neighbors
  // along ±t1 / ±t2 directions, biased by the corner's quadrant (du,dv).
  const o1 = du === 0 ? -1 : 0
  const o2 = dv === 0 ? -1 : 0
  // Sample the 2×2 group of voxels touching the corner.
  let skySum = 0
  let blockSum = 0
  for (let i = 0; i <= 1; i++) {
    for (let j = 0; j <= 1; j++) {
      const sx = airX + (o1 + i) * t1x + (o2 + j) * t2x
      const sy = airY + (o1 + i) * t1y + (o2 + j) * t2y
      const sz = airZ + (o1 + i) * t1z + (o2 + j) * t2z
      const v = sampleVoxelLight(grids, sx, sy, sz)
      skySum += (v >> 4) & 0xf
      blockSum += v & 0xf
    }
  }
  return ((skySum >> 2) << 4) | (blockSum >> 2)
}

// Performance boundary: pre-sized typed arrays for ~95% of chunks without reallocation.
// Previous pattern used number[].push() which triggers backing-store reallocation + copy as JS arrays grow.
// ensureCapacity() doubles buffers if a chunk exceeds this capacity (amortized O(1)).
const INITIAL_QUAD_CAPACITY = 8192
const INITIAL_VERTEX_CAPACITY = INITIAL_QUAD_CAPACITY * 4  // 4 verts per quad
const INITIAL_INDEX_CAPACITY = INITIAL_QUAD_CAPACITY * 6   // 6 indices per quad (2 triangles)

const MeshAccumulatorSchema = Schema.mutable(Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Int8Array),
  colors: Schema.instanceOf(Uint8Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  indexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}))
type MeshAccumulator = Schema.Schema.Type<typeof MeshAccumulatorSchema>

const createAccumulator = (): MeshAccumulator => ({
  positions: new Float32Array(INITIAL_VERTEX_CAPACITY * 3),
  normals: new Int8Array(INITIAL_VERTEX_CAPACITY * 3),
  colors: new Uint8Array(INITIAL_VERTEX_CAPACITY * 3),
  uvs: new Float32Array(INITIAL_VERTEX_CAPACITY * 2),
  indices: new Uint32Array(INITIAL_INDEX_CAPACITY),
  vertexCount: 0,
  indexCount: 0,
})

const ensureCapacity = (acc: MeshAccumulator, additionalQuads: number): void => {
  const neededVerts = acc.vertexCount + additionalQuads * 4
  const neededIndices = acc.indexCount + additionalQuads * 6
  if (neededVerts * 3 > acc.positions.length) {
    const newCap = Math.max(acc.positions.length * 2, neededVerts * 3)
    const newPos = new Float32Array(newCap)
    newPos.set(acc.positions)
    acc.positions = newPos
    const newNorm = new Int8Array(newCap)
    newNorm.set(acc.normals)
    acc.normals = newNorm
    const newCol = new Uint8Array(newCap)
    newCol.set(acc.colors)
    acc.colors = newCol
    const newUvCap = Math.max(acc.uvs.length * 2, neededVerts * 2)
    const newUv = new Float32Array(newUvCap)
    newUv.set(acc.uvs)
    acc.uvs = newUv
  }
  if (neededIndices > acc.indices.length) {
    const newCap = Math.max(acc.indices.length * 2, neededIndices)
    const newIdx = new Uint32Array(newCap)
    newIdx.set(acc.indices)
    acc.indices = newIdx
  }
}

const addQuad = (
  acc: MeshAccumulator,
  v0: readonly [number, number, number],
  v1: readonly [number, number, number],
  v2: readonly [number, number, number],
  v3: readonly [number, number, number],
  normal: readonly [number, number, number],
  blockId: number,
  ao: readonly [number, number, number, number],
  skyLight: readonly [number, number, number, number],
  blockLight: readonly [number, number, number, number],
  faceDir: FaceDir
): void => {
  ensureCapacity(acc, 1)

  const base = acc.vertexCount
  const pi = base * 3

  // Positions — 4 vertices × 3 components
  acc.positions[pi]     = v0[0]; acc.positions[pi + 1]  = v0[1]; acc.positions[pi + 2]  = v0[2]
  acc.positions[pi + 3] = v1[0]; acc.positions[pi + 4]  = v1[1]; acc.positions[pi + 5]  = v1[2]
  acc.positions[pi + 6] = v2[0]; acc.positions[pi + 7]  = v2[1]; acc.positions[pi + 8]  = v2[2]
  acc.positions[pi + 9] = v3[0]; acc.positions[pi + 10] = v3[1]; acc.positions[pi + 11] = v3[2]

  // Normals — same normal for all 4 vertices
  acc.normals[pi]     = normal[0]; acc.normals[pi + 1]  = normal[1]; acc.normals[pi + 2]  = normal[2]
  acc.normals[pi + 3] = normal[0]; acc.normals[pi + 4]  = normal[1]; acc.normals[pi + 5]  = normal[2]
  acc.normals[pi + 6] = normal[0]; acc.normals[pi + 7]  = normal[1]; acc.normals[pi + 8]  = normal[2]
  acc.normals[pi + 9] = normal[0]; acc.normals[pi + 10] = normal[1]; acc.normals[pi + 11] = normal[2]

  // Vertex colors encode three per-vertex factors normalized to [0,1] in the shader:
  //   R = AO factor (1.0 = no darkening)
  //   G = sky-light factor (skyLight / 15)
  //   B = block-light factor (blockLight / 15)
  // The fragment shader combines: light = max(G * sunIntensity, B); diffuse *= (0.15 + 0.85*light) * (0.7 + 0.3*R).
  const aoR0 = Math.round((1.0 - ao[0] * 0.2) * 255)
  const aoR1 = Math.round((1.0 - ao[1] * 0.2) * 255)
  const aoR2 = Math.round((1.0 - ao[2] * 0.2) * 255)
  const aoR3 = Math.round((1.0 - ao[3] * 0.2) * 255)
  const skG0 = Math.round((skyLight[0] / 15) * 255)
  const skG1 = Math.round((skyLight[1] / 15) * 255)
  const skG2 = Math.round((skyLight[2] / 15) * 255)
  const skG3 = Math.round((skyLight[3] / 15) * 255)
  const blB0 = Math.round((blockLight[0] / 15) * 255)
  const blB1 = Math.round((blockLight[1] / 15) * 255)
  const blB2 = Math.round((blockLight[2] / 15) * 255)
  const blB3 = Math.round((blockLight[3] / 15) * 255)
  acc.colors[pi]     = aoR0; acc.colors[pi + 1]  = skG0; acc.colors[pi + 2]  = blB0
  acc.colors[pi + 3] = aoR1; acc.colors[pi + 4]  = skG1; acc.colors[pi + 5]  = blB1
  acc.colors[pi + 6] = aoR2; acc.colors[pi + 7]  = skG2; acc.colors[pi + 8]  = blB2
  acc.colors[pi + 9] = aoR3; acc.colors[pi + 10] = skG3; acc.colors[pi + 11] = blB3

  // UV coordinates from atlas tile lookup
  // NOTE: mask packs blockId in bits 0-7 (supports 0-255); current max is 11 (COBBLESTONE)
  const { u0, v0: tv0, u1, v1: tv1 } = getTileUVs(getTileIndex(blockId, faceDir))
  const ui = base * 2
  acc.uvs[ui]     = u0; acc.uvs[ui + 1] = tv0
  acc.uvs[ui + 2] = u0; acc.uvs[ui + 3] = tv1
  acc.uvs[ui + 4] = u1; acc.uvs[ui + 5] = tv1
  acc.uvs[ui + 6] = u1; acc.uvs[ui + 7] = tv0

  // Indices — 2 triangles per quad
  const ii = acc.indexCount
  acc.indices[ii]     = base;     acc.indices[ii + 1] = base + 1; acc.indices[ii + 2] = base + 2
  acc.indices[ii + 3] = base;     acc.indices[ii + 4] = base + 2; acc.indices[ii + 5] = base + 3

  acc.vertexCount += 4
  acc.indexCount += 6
}

// ─── Mask packing helpers ────────────────────────────────────────────────────
//
// 32-bit mask cell layout:
//   bits  0-7   blockId (8 bits, max 255)
//   bits  8-9   ao quantized [0..3]
//   bits 10-11  sky corner 0 (2 bits)
//   bits 12-13  sky corner 1
//   bits 14-15  sky corner 2
//   bits 16-17  sky corner 3
//   bits 18-19  block corner 0
//   bits 20-21  block corner 1
//   bits 22-23  block corner 2
//   bits 24-25  block corner 3
//
// All four corner lights participate in mask-value equality, so greedy expansion
// only merges quads with identical lighting+ao+blockId — the expected vanilla
// trade-off (mostly merges interior of uniformly-lit slabs).

const packMask = (
  blockId: number,
  ao: number,
  sk0: number,
  sk1: number,
  sk2: number,
  sk3: number,
  bl0: number,
  bl1: number,
  bl2: number,
  bl3: number
): number =>
  (blockId & 0xff)
  | ((ao & 0x3) << 8)
  | ((sk0 & 0x3) << 10)
  | ((sk1 & 0x3) << 12)
  | ((sk2 & 0x3) << 14)
  | ((sk3 & 0x3) << 16)
  | ((bl0 & 0x3) << 18)
  | ((bl1 & 0x3) << 20)
  | ((bl2 & 0x3) << 22)
  | ((bl3 & 0x3) << 24)

// Dequantize 2-bit corner light to a 4-bit value (0..15). Spread evenly:
// 0 → 0, 1 → 5, 2 → 10, 3 → 15.
const dequantLight = (q: number): number => Math.round(q * 5)

// ─── Shared greedy expansion ────────────────────────────────────────────────
//
// Runs the 2-D greedy-merge loop over a pre-built face mask.
// The mask is a flat Uint32Array of size (uSize × vSize) where each cell encodes
// `packMask(blockId, ao, sky0..3, block0..3)`, or 0 for "no face here".
//
// For each maximal rectangle the callback `emitQuad` is invoked with
// (u0, v0, du, dv, maskValue) so the caller can unpack all face attributes.

type EmitQuad = (
  u0: number,
  v0: number,
  du: number,
  dv: number,
  maskValue: number
) => void

const runGreedyExpansion = (
  mask: Uint32Array,
  uSize: number,
  vSize: number,
  doneBuf: Uint8Array,
  emitQuad: EmitQuad
): void => {
  const done = doneBuf.subarray(0, uSize * vSize)
  done.fill(0)
  for (let u = 0; u < uSize; u++) {
    for (let v = 0; v < vSize; v++) {
      const mi = u * vSize + v
      const maskValue = mask[mi]!
      if (!maskValue || done[mi]) continue
      let dv = 1
      while (v + dv < vSize && mask[u * vSize + v + dv] === maskValue && !done[u * vSize + v + dv]) {
        dv++
      }
      let du = 1
      outer: while (u + du < uSize) {
        for (let k = 0; k < dv; k++) {
          if (mask[(u + du) * vSize + v + k] !== maskValue || done[(u + du) * vSize + v + k]) {
            break outer
          }
        }
        du++
      }
      for (let a = u; a < u + du; a++) {
        for (let b = v; b < v + dv; b++) {
          done[a * vSize + b] = 1
        }
      }
      emitQuad(u, v, du, dv, maskValue)
    }
  }
}

// ─── Main meshing function ───────────────────────────────────────────────────

export type GreedyMeshToMeshed = () => { opaque: MeshedChunk; water: MeshedChunk }

export type GreedyMeshResult = {
  // Zero-copy subarray views — valid until next greedyMeshChunk call (aliases accumulator backing store).
  readonly opaqueRaw: RawMeshData
  readonly waterRaw: RawMeshData | null
  // Lazily produces sliced (owned) copies — call only when you need independent arrays.
  readonly toMeshed: GreedyMeshToMeshed
}

export const GreedyMeshResultSchema = Schema.Struct({
  opaqueRaw: RawMeshDataSchema,
  waterRaw: Schema.NullOr(RawMeshDataSchema),
  toMeshed: Schema.declare((u): u is GreedyMeshToMeshed => typeof u === 'function'),
})

export const greedyMeshChunk = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  transparentBlockIds: ReadonlySet<number> = new Set(),
  scratch: GreedyMeshScratch = createGreedyMeshScratch(),
  lightGrids?: LightGrids,
): GreedyMeshResult => {
  const opaqueAcc = createAccumulator()
  let waterAcc: MeshAccumulator | null = null
  const transparentLookup = new Uint8Array(256)
  for (const blockId of transparentBlockIds) transparentLookup[blockId] = 1

  const { doneBuf, maskCH, maskSS } = scratch

  // Take a readonly snapshot for consistent reads in the hot loop
  const blocks: Readonly<Uint8Array> = chunk.blocks

  // ── X+ faces (normal = +1,0,0) ──────────────────────────────────────────
  // Slice over lx; mask u-axis = lz, v-axis = y
  // Face plane tangents: t1 = +Z (lz axis), t2 = +Y (y axis); air side = lx+1.
  const passXPos = (): void => {
    const normal = [1, 0, 0] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    const skyQuad = [0, 0, 0, 0] as [number, number, number, number]
    const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx + 1, y, lz)) {
            const ao = aoXPos(blocks, lx, y, lz)
            // 4 corners on +X face — air voxel at (lx+1,y,lz); tangents (lz, y).
            const c0 = sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 0)
            const c1 = sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 1)
            const c2 = sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 1)
            const c3 = sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 0)
            mask[lz * CHUNK_HEIGHT + y] = packMask(
              blockId, ao,
              (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
              (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
            )
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, maskValue) => {
        const lz0 = u0, y0 = vCoord0
        const fx = offset.wx + lx + 1
        const blockId = maskValue & 0xff
        const ao = (maskValue >> 8) & 0x3
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = fx; v0[1] = y0; v0[2] = offset.wz + lz0
        v1[0] = fx; v1[1] = y0 + dv; v1[2] = offset.wz + lz0
        v2[0] = fx; v2[1] = y0 + dv; v2[2] = offset.wz + lz0 + du
        v3[0] = fx; v3[1] = y0; v3[2] = offset.wz + lz0 + du
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, 'side')
      })
    }
  }

  // ── X- faces (normal = -1,0,0) ──────────────────────────────────────────
  // Air side = lx-1. Tangents: t1 = +Z, t2 = +Y.
  const passXNeg = (): void => {
    const normal = [-1, 0, 0] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    const skyQuad = [0, 0, 0, 0] as [number, number, number, number]
    const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx - 1, y, lz)) {
            const ao = aoXNeg(blocks, lx, y, lz)
            // Vertices for X- are emitted in reverse winding (lz0+du..lz0); align corners to that order.
            const c0 = sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 0)
            const c1 = sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 1)
            const c2 = sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 1)
            const c3 = sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 0)
            mask[lz * CHUNK_HEIGHT + y] = packMask(
              blockId, ao,
              (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
              (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
            )
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, maskValue) => {
        const lz0 = u0, y0 = vCoord0
        const fx = offset.wx + lx
        const blockId = maskValue & 0xff
        const ao = (maskValue >> 8) & 0x3
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = fx; v0[1] = y0; v0[2] = offset.wz + lz0 + du
        v1[0] = fx; v1[1] = y0 + dv; v1[2] = offset.wz + lz0 + du
        v2[0] = fx; v2[1] = y0 + dv; v2[2] = offset.wz + lz0
        v3[0] = fx; v3[1] = y0; v3[2] = offset.wz + lz0
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, 'side')
      })
    }
  }

  // ── Y+ faces (normal = 0,1,0) ────────────────────────────────────────────
  // Air side = y+1. Tangents: t1 = +X, t2 = +Z.
  const passYPos = (): void => {
    const normal = [0, 1, 0] as const
    const mask = maskSS
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    const skyQuad = [0, 0, 0, 0] as [number, number, number, number]
    const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y + 1, lz)) {
            const ao = aoYPos(blocks, lx, y, lz)
            // Vertex order: (lx0, lz0), (lx0, lz0+dv), (lx0+du, lz0+dv), (lx0+du, lz0).
            const c0 = sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 0, 0)
            const c1 = sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 0, 1)
            const c2 = sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 1, 1)
            const c3 = sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 1, 0)
            mask[lx * CHUNK_SIZE + lz] = packMask(
              blockId, ao,
              (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
              (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
            )
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_SIZE, doneBuf, (u0, vCoord0, du, dv, maskValue) => {
        const lx0 = u0, lz0 = vCoord0
        const fy = y + 1
        const blockId = maskValue & 0xff
        const ao = (maskValue >> 8) & 0x3
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0; v0[1] = fy; v0[2] = offset.wz + lz0
        v1[0] = offset.wx + lx0; v1[1] = fy; v1[2] = offset.wz + lz0 + dv
        v2[0] = offset.wx + lx0 + du; v2[1] = fy; v2[2] = offset.wz + lz0 + dv
        v3[0] = offset.wx + lx0 + du; v3[1] = fy; v3[2] = offset.wz + lz0
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, 'top')
      })
    }
  }

  // ── Y- faces (normal = 0,-1,0) ───────────────────────────────────────────
  // Air side = y-1. Tangents: t1 = +X, t2 = +Z.
  const passYNeg = (): void => {
    const normal = [0, -1, 0] as const
    const mask = maskSS
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    const skyQuad = [0, 0, 0, 0] as [number, number, number, number]
    const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y - 1, lz)) {
            const ao = aoYNeg(blocks, lx, y, lz)
            // Vertex order: (lx0+du, lz0), (lx0+du, lz0+dv), (lx0, lz0+dv), (lx0, lz0).
            const c0 = sampleCornerLight(lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 1, 0)
            const c1 = sampleCornerLight(lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 1, 1)
            const c2 = sampleCornerLight(lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 0, 1)
            const c3 = sampleCornerLight(lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 0, 0)
            mask[lx * CHUNK_SIZE + lz] = packMask(
              blockId, ao,
              (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
              (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
            )
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_SIZE, doneBuf, (u0, vCoord0, du, dv, maskValue) => {
        const lx0 = u0, lz0 = vCoord0
        const fy = y
        const blockId = maskValue & 0xff
        const ao = (maskValue >> 8) & 0x3
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0 + du; v0[1] = fy; v0[2] = offset.wz + lz0
        v1[0] = offset.wx + lx0 + du; v1[1] = fy; v1[2] = offset.wz + lz0 + dv
        v2[0] = offset.wx + lx0; v2[1] = fy; v2[2] = offset.wz + lz0 + dv
        v3[0] = offset.wx + lx0; v3[1] = fy; v3[2] = offset.wz + lz0
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, 'bottom')
      })
    }
  }

  // ── Z+ faces (normal = 0,0,1) ────────────────────────────────────────────
  // Air side = lz+1. Tangents: t1 = +X, t2 = +Y.
  const passZPos = (): void => {
    const normal = [0, 0, 1] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    const skyQuad = [0, 0, 0, 0] as [number, number, number, number]
    const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y, lz + 1)) {
            const ao = aoZPos(blocks, lx, y, lz)
            // Vertex order: (lx0+du, y0), (lx0+du, y0+dv), (lx0, y0+dv), (lx0, y0).
            const c0 = sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 1, 0)
            const c1 = sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 1, 1)
            const c2 = sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 0, 1)
            const c3 = sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 0, 0)
            mask[lx * CHUNK_HEIGHT + y] = packMask(
              blockId, ao,
              (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
              (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
            )
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, maskValue) => {
        const lx0 = u0, y0 = vCoord0
        const fz = offset.wz + lz + 1
        const blockId = maskValue & 0xff
        const ao = (maskValue >> 8) & 0x3
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0 + du; v0[1] = y0; v0[2] = fz
        v1[0] = offset.wx + lx0 + du; v1[1] = y0 + dv; v1[2] = fz
        v2[0] = offset.wx + lx0; v2[1] = y0 + dv; v2[2] = fz
        v3[0] = offset.wx + lx0; v3[1] = y0; v3[2] = fz
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, 'side')
      })
    }
  }

  // ── Z- faces (normal = 0,0,-1) ───────────────────────────────────────────
  // Air side = lz-1. Tangents: t1 = +X, t2 = +Y.
  const passZNeg = (): void => {
    const normal = [0, 0, -1] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    const skyQuad = [0, 0, 0, 0] as [number, number, number, number]
    const blockQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y, lz - 1)) {
            const ao = aoZNeg(blocks, lx, y, lz)
            // Vertex order: (lx0, y0), (lx0, y0+dv), (lx0+du, y0+dv), (lx0+du, y0).
            const c0 = sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 0, 0)
            const c1 = sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 0, 1)
            const c2 = sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 1, 1)
            const c3 = sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 1, 0)
            mask[lx * CHUNK_HEIGHT + y] = packMask(
              blockId, ao,
              (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
              (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
            )
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, maskValue) => {
        const lx0 = u0, y0 = vCoord0
        const fz = offset.wz + lz
        const blockId = maskValue & 0xff
        const ao = (maskValue >> 8) & 0x3
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0; v0[1] = y0; v0[2] = fz
        v1[0] = offset.wx + lx0; v1[1] = y0 + dv; v1[2] = fz
        v2[0] = offset.wx + lx0 + du; v2[1] = y0 + dv; v2[2] = fz
        v3[0] = offset.wx + lx0 + du; v3[1] = y0; v3[2] = fz
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        skyQuad[0] = dequantLight((maskValue >> 10) & 0x3)
        skyQuad[1] = dequantLight((maskValue >> 12) & 0x3)
        skyQuad[2] = dequantLight((maskValue >> 14) & 0x3)
        skyQuad[3] = dequantLight((maskValue >> 16) & 0x3)
        blockQuad[0] = dequantLight((maskValue >> 18) & 0x3)
        blockQuad[1] = dequantLight((maskValue >> 20) & 0x3)
        blockQuad[2] = dequantLight((maskValue >> 22) & 0x3)
        blockQuad[3] = dequantLight((maskValue >> 24) & 0x3)
        addQuad(targetAcc, v0, v1, v2, v3, normal, blockId, aoQuad, skyQuad, blockQuad, 'side')
      })
    }
  }

  passXPos()
  passXNeg()
  passYPos()
  passYNeg()
  passZPos()
  passZNeg()

  const toRawMeshData = (a: MeshAccumulator): RawMeshData =>
    Schema.decodeUnknownSync(RawMeshDataSchema)({
      positions: a.positions.subarray(0, a.vertexCount * 3),
      normals: a.normals.subarray(0, a.vertexCount * 3),
      colors: a.colors.subarray(0, a.vertexCount * 3),
      uvs: a.uvs.subarray(0, a.vertexCount * 2),
      indices: a.indices.subarray(0, a.indexCount),
      vertexCount: a.vertexCount,
      indexCount: a.indexCount,
    })

  const toMeshedChunk = (raw: RawMeshData): MeshedChunk => ({
    positions: raw.positions.slice(),
    normals: raw.normals.slice(),
    colors: raw.colors.slice(),
    uvs: raw.uvs.slice(),
    indices: raw.indices.slice(),
  })

  const opaqueRaw = toRawMeshData(opaqueAcc)
  const waterRaw = waterAcc !== null ? toRawMeshData(waterAcc) : null

  // Lazy cache: toMeshed() allocates sliced copies on first call, then returns the cached result.
  let _meshedCache: { opaque: MeshedChunk; water: MeshedChunk } | null = null
  const toMeshed = (): { opaque: MeshedChunk; water: MeshedChunk } => {
    if (_meshedCache === null) {
      _meshedCache = {
        opaque: toMeshedChunk(opaqueRaw),
        water: waterRaw !== null ? toMeshedChunk(waterRaw) : EMPTY_MESHED_CHUNK,
      }
    }
    return _meshedCache
  }

  return {
    opaqueRaw,
    waterRaw,
    toMeshed,
  }
}
