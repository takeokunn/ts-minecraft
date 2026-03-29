import { Schema } from 'effect'
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
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

// Pooled buffer for greedy-expansion "done" tracking.
// The largest possible slice is CHUNK_SIZE × CHUNK_HEIGHT = 16 × 256 = 4096 cells.
// runGreedyExpansion takes a subarray view (zero-copy) and resets it with fill(0)
// instead of allocating a new Uint8Array per call (576 allocs/chunk-rebuild).
//
// ⚠ CONCURRENCY WARNING: this buffer is module-level shared state. greedyMeshChunk
// must never be called concurrently from two fibers (e.g. Effect.forEach with concurrency > 1)
// or the done-tracking state will be corrupted. Currently safe: WorldRendererService
// calls greedyMeshChunk synchronously within the single frame-handler fiber.
const EMPTY_MESHED_CHUNK: MeshedChunk = {
  positions: new Float32Array(0),
  normals: new Int8Array(0),
  colors: new Uint8Array(0),
  uvs: new Float32Array(0),
  indices: new Uint32Array(0),
}

const getBlock = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return AIR
  return blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE]!
}

const isAir = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): boolean =>
  getBlock(blocks, lx, y, lz) === AIR

const aoXPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (getBlock(blocks, lx + 1, y + 1, lz) !== AIR) count++
  if (getBlock(blocks, lx + 1, y - 1, lz) !== AIR) count++
  if (getBlock(blocks, lx + 1, y, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx + 1, y, lz - 1) !== AIR) count++
  return Math.min(3, count)
}

const aoXNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (getBlock(blocks, lx - 1, y + 1, lz) !== AIR) count++
  if (getBlock(blocks, lx - 1, y - 1, lz) !== AIR) count++
  if (getBlock(blocks, lx - 1, y, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx - 1, y, lz - 1) !== AIR) count++
  return Math.min(3, count)
}

const aoYPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (getBlock(blocks, lx + 1, y + 1, lz) !== AIR) count++
  if (getBlock(blocks, lx - 1, y + 1, lz) !== AIR) count++
  if (getBlock(blocks, lx, y + 1, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx, y + 1, lz - 1) !== AIR) count++
  return Math.min(3, count)
}

const aoYNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (getBlock(blocks, lx + 1, y - 1, lz) !== AIR) count++
  if (getBlock(blocks, lx - 1, y - 1, lz) !== AIR) count++
  if (getBlock(blocks, lx, y - 1, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx, y - 1, lz - 1) !== AIR) count++
  return Math.min(3, count)
}

const aoZPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (getBlock(blocks, lx + 1, y, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx - 1, y, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx, y + 1, lz + 1) !== AIR) count++
  if (getBlock(blocks, lx, y - 1, lz + 1) !== AIR) count++
  return Math.min(3, count)
}

const aoZNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (getBlock(blocks, lx + 1, y, lz - 1) !== AIR) count++
  if (getBlock(blocks, lx - 1, y, lz - 1) !== AIR) count++
  if (getBlock(blocks, lx, y + 1, lz - 1) !== AIR) count++
  if (getBlock(blocks, lx, y - 1, lz - 1) !== AIR) count++
  return Math.min(3, count)
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

  // Vertex colors encode grayscale AO factor as Uint8 [0-255]; texture provides block color.
  // GPU normalizes Uint8 → [0.0, 1.0] float via THREE.BufferAttribute normalized flag.
  const factor0 = Math.round((1.0 - ao[0] * 0.2) * 255)
  const factor1 = Math.round((1.0 - ao[1] * 0.2) * 255)
  const factor2 = Math.round((1.0 - ao[2] * 0.2) * 255)
  const factor3 = Math.round((1.0 - ao[3] * 0.2) * 255)
  acc.colors[pi]     = factor0; acc.colors[pi + 1]  = factor0; acc.colors[pi + 2]  = factor0
  acc.colors[pi + 3] = factor1; acc.colors[pi + 4]  = factor1; acc.colors[pi + 5]  = factor1
  acc.colors[pi + 6] = factor2; acc.colors[pi + 7]  = factor2; acc.colors[pi + 8]  = factor2
  acc.colors[pi + 9] = factor3; acc.colors[pi + 10] = factor3; acc.colors[pi + 11] = factor3

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

// ─── Shared greedy expansion ────────────────────────────────────────────────
//
// Runs the 2-D greedy-merge loop over a pre-built face mask.
// The mask is a flat Uint16Array of size (uSize × vSize) where each cell
// encodes `blockId | (ao << 8)`, or 0 for "no face here".
//
// For each maximal rectangle found the callback `emitQuad` is invoked with
// (u0, v0, du, dv, blockId, ao) so the caller can build axis-specific vertices.

type EmitQuad = (
  u0: number,
  v0: number,
  du: number,
  dv: number,
  blockId: number,
  ao: number
) => void

const runGreedyExpansion = (
  mask: Uint16Array,
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
      const maskValue = mask[mi]
      if (!maskValue || done[mi]) continue
      const blockId = maskValue & 0xFF
      const ao = (maskValue >> 8) & 0x3
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
      emitQuad(u, v, du, dv, blockId, ao)
    }
  }
}

// ─── Main meshing function ───────────────────────────────────────────────────

export type GreedyMeshToMeshed = () => { opaque: MeshedChunk; water: MeshedChunk }

export type GreedyMeshResult = {
  /** Zero-copy subarray views into accumulator buffers (valid until next greedyMeshChunk call) */
  readonly opaqueRaw: RawMeshData
  readonly waterRaw: RawMeshData | null
  /** Lazily produces sliced (owned) copies — call only when you need independent arrays */
  readonly toMeshed: GreedyMeshToMeshed
  /** Backward-compatible lazy accessor — calls toMeshed().opaque on first access */
  readonly opaque: MeshedChunk
  /** Backward-compatible lazy accessor — calls toMeshed().water on first access */
  readonly water: MeshedChunk
}

export const GreedyMeshResultSchema = Schema.Struct({
  opaqueRaw: RawMeshDataSchema,
  waterRaw: Schema.NullOr(RawMeshDataSchema),
  toMeshed: Schema.declare((u): u is GreedyMeshToMeshed => typeof u === 'function'),
  opaque: MeshedChunkSchema,
  water: MeshedChunkSchema,
})

export const greedyMeshChunk = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  transparentBlockIds: ReadonlySet<number> = new Set()
): GreedyMeshResult => {
  const opaqueAcc = createAccumulator()
  let waterAcc: MeshAccumulator | null = null
  const transparentLookup = new Uint8Array(256)
  for (const blockId of transparentBlockIds) transparentLookup[blockId] = 1

  const doneBuf = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT)
  const maskCH = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
  const maskSS = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE)

  // Take a readonly snapshot for consistent reads in the hot loop
  const blocks: Readonly<Uint8Array> = chunk.blocks

  // ── X+ faces (normal = +1,0,0) ──────────────────────────────────────────
  // Slice over lx; mask u-axis = lz, v-axis = y
  const passXPos = (): void => {
    const normal = [1, 0, 0] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx + 1, y, lz)) {
            const ao = aoXPos(blocks, lx, y, lz)
            mask[lz * CHUNK_HEIGHT + y] = blockId | (ao << 8)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, blockId, ao) => {
        const lz0 = u0, y0 = vCoord0
        const fx = offset.wx + lx + 1
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = fx; v0[1] = y0; v0[2] = offset.wz + lz0
        v1[0] = fx; v1[1] = y0 + dv; v1[2] = offset.wz + lz0
        v2[0] = fx; v2[1] = y0 + dv; v2[2] = offset.wz + lz0 + du
        v3[0] = fx; v3[1] = y0; v3[2] = offset.wz + lz0 + du
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        addQuad(
          targetAcc,
          v0,
          v1,
          v2,
          v3,
          normal,
          blockId,
          aoQuad,
          'side'
        )
      })
    }
  }

  // ── X- faces (normal = -1,0,0) ──────────────────────────────────────────
  // Slice over lx; mask u-axis = lz, v-axis = y
  const passXNeg = (): void => {
    const normal = [-1, 0, 0] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx - 1, y, lz)) {
            const ao = aoXNeg(blocks, lx, y, lz)
            mask[lz * CHUNK_HEIGHT + y] = blockId | (ao << 8)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, blockId, ao) => {
        const lz0 = u0, y0 = vCoord0
        const fx = offset.wx + lx
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = fx; v0[1] = y0; v0[2] = offset.wz + lz0 + du
        v1[0] = fx; v1[1] = y0 + dv; v1[2] = offset.wz + lz0 + du
        v2[0] = fx; v2[1] = y0 + dv; v2[2] = offset.wz + lz0
        v3[0] = fx; v3[1] = y0; v3[2] = offset.wz + lz0
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        addQuad(
          targetAcc,
          v0,
          v1,
          v2,
          v3,
          normal,
          blockId,
          aoQuad,
          'side'
        )
      })
    }
  }

  // ── Y+ faces (normal = 0,1,0) ────────────────────────────────────────────
  // Slice over y; mask u-axis = lx, v-axis = lz
  const passYPos = (): void => {
    const normal = [0, 1, 0] as const
    const mask = maskSS
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y + 1, lz)) {
            const ao = aoYPos(blocks, lx, y, lz)
            mask[lx * CHUNK_SIZE + lz] = blockId | (ao << 8)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_SIZE, doneBuf, (u0, vCoord0, du, dv, blockId, ao) => {
        const lx0 = u0, lz0 = vCoord0
        const fy = y + 1
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0; v0[1] = fy; v0[2] = offset.wz + lz0
        v1[0] = offset.wx + lx0; v1[1] = fy; v1[2] = offset.wz + lz0 + dv
        v2[0] = offset.wx + lx0 + du; v2[1] = fy; v2[2] = offset.wz + lz0 + dv
        v3[0] = offset.wx + lx0 + du; v3[1] = fy; v3[2] = offset.wz + lz0
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        addQuad(
          targetAcc,
          v0,
          v1,
          v2,
          v3,
          normal,
          blockId,
          aoQuad,
          'top'
        )
      })
    }
  }

  // ── Y- faces (normal = 0,-1,0) ───────────────────────────────────────────
  // Slice over y; mask u-axis = lx, v-axis = lz
  const passYNeg = (): void => {
    const normal = [0, -1, 0] as const
    const mask = maskSS
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y - 1, lz)) {
            const ao = aoYNeg(blocks, lx, y, lz)
            mask[lx * CHUNK_SIZE + lz] = blockId | (ao << 8)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_SIZE, doneBuf, (u0, vCoord0, du, dv, blockId, ao) => {
        const lx0 = u0, lz0 = vCoord0
        const fy = y
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0 + du; v0[1] = fy; v0[2] = offset.wz + lz0
        v1[0] = offset.wx + lx0 + du; v1[1] = fy; v1[2] = offset.wz + lz0 + dv
        v2[0] = offset.wx + lx0; v2[1] = fy; v2[2] = offset.wz + lz0 + dv
        v3[0] = offset.wx + lx0; v3[1] = fy; v3[2] = offset.wz + lz0
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        addQuad(
          targetAcc,
          v0,
          v1,
          v2,
          v3,
          normal,
          blockId,
          aoQuad,
          'bottom'
        )
      })
    }
  }

  // ── Z+ faces (normal = 0,0,1) ────────────────────────────────────────────
  // Slice over lz; mask u-axis = lx, v-axis = y
  const passZPos = (): void => {
    const normal = [0, 0, 1] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y, lz + 1)) {
            const ao = aoZPos(blocks, lx, y, lz)
            mask[lx * CHUNK_HEIGHT + y] = blockId | (ao << 8)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, blockId, ao) => {
        const lx0 = u0, y0 = vCoord0
        const fz = offset.wz + lz + 1
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0 + du; v0[1] = y0; v0[2] = fz
        v1[0] = offset.wx + lx0 + du; v1[1] = y0 + dv; v1[2] = fz
        v2[0] = offset.wx + lx0; v2[1] = y0 + dv; v2[2] = fz
        v3[0] = offset.wx + lx0; v3[1] = y0; v3[2] = fz
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        addQuad(
          targetAcc,
          v0,
          v1,
          v2,
          v3,
          normal,
          blockId,
          aoQuad,
          'side'
        )
      })
    }
  }

  // ── Z- faces (normal = 0,0,-1) ───────────────────────────────────────────
  // Slice over lz; mask u-axis = lx, v-axis = y
  const passZNeg = (): void => {
    const normal = [0, 0, -1] as const
    const mask = maskCH
    const v0 = [0, 0, 0] as [number, number, number]
    const v1 = [0, 0, 0] as [number, number, number]
    const v2 = [0, 0, 0] as [number, number, number]
    const v3 = [0, 0, 0] as [number, number, number]
    const aoQuad = [0, 0, 0, 0] as [number, number, number, number]
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y, lz - 1)) {
            const ao = aoZNeg(blocks, lx, y, lz)
            mask[lx * CHUNK_HEIGHT + y] = blockId | (ao << 8)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, doneBuf, (u0, vCoord0, du, dv, blockId, ao) => {
        const lx0 = u0, y0 = vCoord0
        const fz = offset.wz + lz
        const targetAcc = transparentLookup[blockId] !== 0 ? (waterAcc ??= createAccumulator()) : opaqueAcc
        v0[0] = offset.wx + lx0; v0[1] = y0; v0[2] = fz
        v1[0] = offset.wx + lx0; v1[1] = y0 + dv; v1[2] = fz
        v2[0] = offset.wx + lx0 + du; v2[1] = y0 + dv; v2[2] = fz
        v3[0] = offset.wx + lx0 + du; v3[1] = y0; v3[2] = fz
        aoQuad[0] = ao; aoQuad[1] = ao; aoQuad[2] = ao; aoQuad[3] = ao
        addQuad(
          targetAcc,
          v0,
          v1,
          v2,
          v3,
          normal,
          blockId,
          aoQuad,
          'side'
        )
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
    // Backward-compatible accessors: lazily slice on first access.
    // Tests and createChunkMesh use these via toMeshed() which produces owned copies (.slice()).
    // opaqueRaw/waterRaw are available for potential future direct-update optimization.
    get opaque() { return toMeshed().opaque },
    get water() { return toMeshed().water },
  }
}
