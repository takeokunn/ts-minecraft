import { Schema } from 'effect'
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, blockIndex } from '@/domain/chunk'
import { getTileIndex, getTileUVs, FaceDir } from '../textures/block-texture-map'

export interface MeshedChunk {
  positions: Float32Array
  normals: Float32Array
  colors: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  blockPositions: Array<{ x: number; y: number; z: number }>
}

export const ChunkWorldOffsetSchema = Schema.Struct({
  wx: Schema.Number,
  wz: Schema.Number,
})
export type ChunkWorldOffset = Schema.Schema.Type<typeof ChunkWorldOffsetSchema>

const AIR = 0

const getBlock = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  const idx = blockIndex(lx, y, lz)
  return idx !== null ? chunk.blocks[idx] ?? AIR : AIR
}

const isAir = (chunk: Chunk, lx: number, y: number, lz: number): boolean =>
  getBlock(chunk, lx, y, lz) === AIR

const isSolid = (chunk: Chunk, lx: number, y: number, lz: number): boolean =>
  !isAir(chunk, lx, y, lz)

const aoXPos = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(chunk, lx + 1, y + 1, lz)) count++
  if (isSolid(chunk, lx + 1, y - 1, lz)) count++
  if (isSolid(chunk, lx + 1, y, lz + 1)) count++
  if (isSolid(chunk, lx + 1, y, lz - 1)) count++
  return Math.min(3, count)
}

const aoXNeg = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(chunk, lx - 1, y + 1, lz)) count++
  if (isSolid(chunk, lx - 1, y - 1, lz)) count++
  if (isSolid(chunk, lx - 1, y, lz + 1)) count++
  if (isSolid(chunk, lx - 1, y, lz - 1)) count++
  return Math.min(3, count)
}

const aoYPos = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(chunk, lx + 1, y + 1, lz)) count++
  if (isSolid(chunk, lx - 1, y + 1, lz)) count++
  if (isSolid(chunk, lx, y + 1, lz + 1)) count++
  if (isSolid(chunk, lx, y + 1, lz - 1)) count++
  return Math.min(3, count)
}

const aoYNeg = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(chunk, lx + 1, y - 1, lz)) count++
  if (isSolid(chunk, lx - 1, y - 1, lz)) count++
  if (isSolid(chunk, lx, y - 1, lz + 1)) count++
  if (isSolid(chunk, lx, y - 1, lz - 1)) count++
  return Math.min(3, count)
}

const aoZPos = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(chunk, lx + 1, y, lz + 1)) count++
  if (isSolid(chunk, lx - 1, y, lz + 1)) count++
  if (isSolid(chunk, lx, y + 1, lz + 1)) count++
  if (isSolid(chunk, lx, y - 1, lz + 1)) count++
  return Math.min(3, count)
}

const aoZNeg = (chunk: Chunk, lx: number, y: number, lz: number): number => {
  let count = 0
  if (isSolid(chunk, lx + 1, y, lz - 1)) count++
  if (isSolid(chunk, lx - 1, y, lz - 1)) count++
  if (isSolid(chunk, lx, y + 1, lz - 1)) count++
  if (isSolid(chunk, lx, y - 1, lz - 1)) count++
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
  const done = new Uint8Array(uSize * vSize)
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

  // ── X+ faces (normal = +1,0,0) ──────────────────────────────────────────
  // Slice over lx; mask u-axis = lz, v-axis = y
  const passXPos = (): void => {
    const normal = [1, 0, 0] as const
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(chunk, lx, y, lz)
          if (blockId !== AIR && isAir(chunk, lx + 1, y, lz)) {
            const ao = aoXPos(chunk, lx, y, lz)
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
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(chunk, lx, y, lz)
          if (blockId !== AIR && isAir(chunk, lx - 1, y, lz)) {
            const ao = aoXNeg(chunk, lx, y, lz)
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
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      const mask = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(chunk, lx, y, lz)
          if (blockId !== AIR && isAir(chunk, lx, y + 1, lz)) {
            const ao = aoYPos(chunk, lx, y, lz)
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
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      const mask = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const blockId = getBlock(chunk, lx, y, lz)
          if (blockId !== AIR && isAir(chunk, lx, y - 1, lz)) {
            const ao = aoYNeg(chunk, lx, y, lz)
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
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(chunk, lx, y, lz)
          if (blockId !== AIR && isAir(chunk, lx, y, lz + 1)) {
            const ao = aoZPos(chunk, lx, y, lz)
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
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const mask = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const blockId = getBlock(chunk, lx, y, lz)
          if (blockId !== AIR && isAir(chunk, lx, y, lz - 1)) {
            const ao = aoZNeg(chunk, lx, y, lz)
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
