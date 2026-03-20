import { Schema } from 'effect'
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '@/domain/chunk'
import { getTileIndex, getTileUVs, FaceDir } from '../textures/block-texture-map'

export const MeshedChunkSchema = Schema.Struct({
  positions: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Float32Array),
  colors: Schema.instanceOf(Float32Array),
  uvs: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  blockPositions: Schema.Array(Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })),
})
export type MeshedChunk = Schema.Schema.Type<typeof MeshedChunkSchema>

export const ChunkWorldOffsetSchema = Schema.Struct({
  wx: Schema.Number,
  wz: Schema.Number,
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
const _doneBuf = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT)

const getBlock = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  const idx = blockIndex(lx, y, lz)
  return idx !== null ? blocks[idx] ?? AIR : AIR
}

const isAir = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): boolean =>
  getBlock(blocks, lx, y, lz) === AIR

const isSolid = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): boolean =>
  !isAir(blocks, lx, y, lz)

const aoXPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(blocks, lx + 1, y + 1, lz)) count++
  if (isSolid(blocks, lx + 1, y - 1, lz)) count++
  if (isSolid(blocks, lx + 1, y, lz + 1)) count++
  if (isSolid(blocks, lx + 1, y, lz - 1)) count++
  return Math.min(3, count)
}

const aoXNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(blocks, lx - 1, y + 1, lz)) count++
  if (isSolid(blocks, lx - 1, y - 1, lz)) count++
  if (isSolid(blocks, lx - 1, y, lz + 1)) count++
  if (isSolid(blocks, lx - 1, y, lz - 1)) count++
  return Math.min(3, count)
}

const aoYPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(blocks, lx + 1, y + 1, lz)) count++
  if (isSolid(blocks, lx - 1, y + 1, lz)) count++
  if (isSolid(blocks, lx, y + 1, lz + 1)) count++
  if (isSolid(blocks, lx, y + 1, lz - 1)) count++
  return Math.min(3, count)
}

const aoYNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(blocks, lx + 1, y - 1, lz)) count++
  if (isSolid(blocks, lx - 1, y - 1, lz)) count++
  if (isSolid(blocks, lx, y - 1, lz + 1)) count++
  if (isSolid(blocks, lx, y - 1, lz - 1)) count++
  return Math.min(3, count)
}

const aoZPos = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(blocks, lx + 1, y, lz + 1)) count++
  if (isSolid(blocks, lx - 1, y, lz + 1)) count++
  if (isSolid(blocks, lx, y + 1, lz + 1)) count++
  if (isSolid(blocks, lx, y - 1, lz + 1)) count++
  return Math.min(3, count)
}

const aoZNeg = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(blocks, lx + 1, y, lz - 1)) count++
  if (isSolid(blocks, lx - 1, y, lz - 1)) count++
  if (isSolid(blocks, lx, y + 1, lz - 1)) count++
  if (isSolid(blocks, lx, y - 1, lz - 1)) count++
  return Math.min(3, count)
}

interface MeshAccumulator {
  positions: number[]
  normals: number[]
  colors: number[]
  uvs: number[]
  indices: number[]
  blockPositions: Array<{ x: number; y: number; z: number }>
}

const addQuad = (
  acc: MeshAccumulator,
  v0: readonly [number, number, number],
  v1: readonly [number, number, number],
  v2: readonly [number, number, number],
  v3: readonly [number, number, number],
  normal: readonly [number, number, number],
  blockId: number,
  worldPos: { x: number; y: number; z: number },
  ao: readonly [number, number, number, number],
  faceDir: FaceDir
): void => {
  const base = acc.positions.length / 3

  for (const v of [v0, v1, v2, v3]) {
    acc.positions.push(v[0], v[1], v[2])
    acc.normals.push(normal[0], normal[1], normal[2])
  }

  // Vertex colors encode grayscale AO factor; texture provides block color
  for (let i = 0; i < 4; i++) {
    const factor = 1.0 - (ao[i] ?? 0) * 0.2
    acc.colors.push(factor, factor, factor)
  }

  // UV coordinates from atlas tile lookup
  // NOTE: mask packs blockId in bits 0-3 (supports 0-15); current max is 11 (COBBLESTONE)
  const tileIndex = getTileIndex(blockId, faceDir)
  const { u0, v0: tv0, u1, v1: tv1 } = getTileUVs(tileIndex)
  acc.uvs.push(u0, tv0, u0, tv1, u1, tv1, u1, tv0)

  acc.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)

  acc.blockPositions.push(worldPos)
}

// ─── Shared greedy expansion ────────────────────────────────────────────────
//
// Runs the 2-D greedy-merge loop over a pre-built face mask.
// The mask is a flat Uint16Array of size (uSize × vSize) where each cell
// encodes `blockId | (ao << 4)`, or 0 for "no face here".
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
  emitQuad: EmitQuad
): void => {
  const done = _doneBuf.subarray(0, uSize * vSize)
  done.fill(0)
  for (let u = 0; u < uSize; u++) {
    for (let v = 0; v < vSize; v++) {
      const mi = u * vSize + v
      const maskValue = mask[mi]
      if (!maskValue || done[mi]) continue
      const blockId = maskValue & 0xF
      const ao = (maskValue >> 4) & 0x3
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

export const greedyMeshChunk = (chunk: Chunk, offset: ChunkWorldOffset): MeshedChunk => {
  const acc: MeshAccumulator = {
    positions: [],
    normals: [],
    colors: [],
    uvs: [],
    indices: [],
    blockPositions: [],
  }

  // Take a readonly snapshot for consistent reads in the hot loop
  const blocks = chunk.blocks as Readonly<Uint8Array>

  // ── X+ faces (normal = +1,0,0) ──────────────────────────────────────────
  // Slice over lx; mask u-axis = lz, v-axis = y
  const passXPos = (): void => {
    const normal = [1, 0, 0] as const
    // Allocate mask once (CHUNK_SIZE * CHUNK_HEIGHT is constant); reset with fill(0) each slice
    const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx + 1, y, lz)) {
            const ao = aoXPos(blocks, lx, y, lz)
            mask[lz * CHUNK_HEIGHT + y] = blockId | (ao << 4)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, blockId, ao) => {
        const lz0 = u0, y0 = v0
        const fx = offset.wx + lx + 1
        addQuad(
          acc,
          [fx, y0,       offset.wz + lz0],
          [fx, y0 + dv,  offset.wz + lz0],
          [fx, y0 + dv,  offset.wz + lz0 + du],
          [fx, y0,       offset.wz + lz0 + du],
          normal,
          blockId,
          { x: offset.wx + lx, y: y0, z: offset.wz + lz0 },
          [ao, ao, ao, ao],
          'side'
        )
      })
    }
  }

  // ── X- faces (normal = -1,0,0) ──────────────────────────────────────────
  // Slice over lx; mask u-axis = lz, v-axis = y
  const passXNeg = (): void => {
    const normal = [-1, 0, 0] as const
    // Allocate mask once (CHUNK_SIZE * CHUNK_HEIGHT is constant); reset with fill(0) each slice
    const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx - 1, y, lz)) {
            const ao = aoXNeg(blocks, lx, y, lz)
            mask[lz * CHUNK_HEIGHT + y] = blockId | (ao << 4)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, blockId, ao) => {
        const lz0 = u0, y0 = v0
        const fx = offset.wx + lx
        addQuad(
          acc,
          [fx, y0,      offset.wz + lz0 + du],
          [fx, y0 + dv, offset.wz + lz0 + du],
          [fx, y0 + dv, offset.wz + lz0],
          [fx, y0,      offset.wz + lz0],
          normal,
          blockId,
          { x: offset.wx + lx, y: y0, z: offset.wz + lz0 },
          [ao, ao, ao, ao],
          'side'
        )
      })
    }
  }

  // ── Y+ faces (normal = 0,1,0) ────────────────────────────────────────────
  // Slice over y; mask u-axis = lx, v-axis = lz
  const passYPos = (): void => {
    const normal = [0, 1, 0] as const
    // Allocate mask once (CHUNK_SIZE * CHUNK_SIZE is constant); reset with fill(0) each slice
    const mask = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE)
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y + 1, lz)) {
            const ao = aoYPos(blocks, lx, y, lz)
            mask[lx * CHUNK_SIZE + lz] = blockId | (ao << 4)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_SIZE, (u0, v0, du, dv, blockId, ao) => {
        const lx0 = u0, lz0 = v0
        const fy = y + 1
        addQuad(
          acc,
          [offset.wx + lx0,      fy, offset.wz + lz0],
          [offset.wx + lx0,      fy, offset.wz + lz0 + dv],
          [offset.wx + lx0 + du, fy, offset.wz + lz0 + dv],
          [offset.wx + lx0 + du, fy, offset.wz + lz0],
          normal,
          blockId,
          { x: offset.wx + lx0, y, z: offset.wz + lz0 },
          [ao, ao, ao, ao],
          'top'
        )
      })
    }
  }

  // ── Y- faces (normal = 0,-1,0) ───────────────────────────────────────────
  // Slice over y; mask u-axis = lx, v-axis = lz
  const passYNeg = (): void => {
    const normal = [0, -1, 0] as const
    // Allocate mask once (CHUNK_SIZE * CHUNK_SIZE is constant); reset with fill(0) each slice
    const mask = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE)
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y - 1, lz)) {
            const ao = aoYNeg(blocks, lx, y, lz)
            mask[lx * CHUNK_SIZE + lz] = blockId | (ao << 4)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_SIZE, (u0, v0, du, dv, blockId, ao) => {
        const lx0 = u0, lz0 = v0
        const fy = y
        addQuad(
          acc,
          [offset.wx + lx0 + du, fy, offset.wz + lz0],
          [offset.wx + lx0 + du, fy, offset.wz + lz0 + dv],
          [offset.wx + lx0,      fy, offset.wz + lz0 + dv],
          [offset.wx + lx0,      fy, offset.wz + lz0],
          normal,
          blockId,
          { x: offset.wx + lx0, y, z: offset.wz + lz0 },
          [ao, ao, ao, ao],
          'bottom'
        )
      })
    }
  }

  // ── Z+ faces (normal = 0,0,1) ────────────────────────────────────────────
  // Slice over lz; mask u-axis = lx, v-axis = y
  const passZPos = (): void => {
    const normal = [0, 0, 1] as const
    // Allocate mask once (CHUNK_SIZE * CHUNK_HEIGHT is constant); reset with fill(0) each slice
    const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y, lz + 1)) {
            const ao = aoZPos(blocks, lx, y, lz)
            mask[lx * CHUNK_HEIGHT + y] = blockId | (ao << 4)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, blockId, ao) => {
        const lx0 = u0, y0 = v0
        const fz = offset.wz + lz + 1
        addQuad(
          acc,
          [offset.wx + lx0 + du, y0,      fz],
          [offset.wx + lx0 + du, y0 + dv, fz],
          [offset.wx + lx0,      y0 + dv, fz],
          [offset.wx + lx0,      y0,      fz],
          normal,
          blockId,
          { x: offset.wx + lx0, y: y0, z: offset.wz + lz },
          [ao, ao, ao, ao],
          'side'
        )
      })
    }
  }

  // ── Z- faces (normal = 0,0,-1) ───────────────────────────────────────────
  // Slice over lz; mask u-axis = lx, v-axis = y
  const passZNeg = (): void => {
    const normal = [0, 0, -1] as const
    // Allocate mask once (CHUNK_SIZE * CHUNK_HEIGHT is constant); reset with fill(0) each slice
    const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(blocks, lx, y, lz)
          if (blockId !== AIR && isAir(blocks, lx, y, lz - 1)) {
            const ao = aoZNeg(blocks, lx, y, lz)
            mask[lx * CHUNK_HEIGHT + y] = blockId | (ao << 4)
          }
        }
      }
      runGreedyExpansion(mask, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, blockId, ao) => {
        const lx0 = u0, y0 = v0
        const fz = offset.wz + lz
        addQuad(
          acc,
          [offset.wx + lx0,      y0,      fz],
          [offset.wx + lx0,      y0 + dv, fz],
          [offset.wx + lx0 + du, y0 + dv, fz],
          [offset.wx + lx0 + du, y0,      fz],
          normal,
          blockId,
          { x: offset.wx + lx0, y: y0, z: offset.wz + lz },
          [ao, ao, ao, ao],
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

  return {
    positions: new Float32Array(acc.positions),
    normals: new Float32Array(acc.normals),
    colors: new Float32Array(acc.colors),
    uvs: new Float32Array(acc.uvs),
    indices: new Uint32Array(acc.indices),
    blockPositions: acc.blockPositions,
  }
}
