import { Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { Chunk } from '@ts-minecraft/terrain'
import type { LightGrids } from '@ts-minecraft/world-state'

// Re-export all public API so meshing/index.ts and meshing-worker-pool.ts imports still work.
export * from './greedy-meshing-types'
export * from './greedy-meshing-accumulator'

import {
  AIR,
  EMPTY_MESHED_CHUNK,
  RawMeshDataSchema,
  MeshedChunk,
  RawMeshData,
  ChunkWorldOffset,
  GreedyMeshScratch,
  GreedyMeshResult,
  createGreedyMeshScratch,
} from './greedy-meshing-types'

import {
  getBlock,
  isAir,
  aoXPos,
  aoXNeg,
  aoYPos,
  aoYNeg,
  aoZPos,
  aoZNeg,
  sampleCornerLight,
} from './greedy-meshing-ao'

import {
  MeshAccumulator,
  createAccumulator,
} from './greedy-meshing-accumulator'

import {
  packMask,
  runGreedyExpansion,
  makeEmitQuad,
  FacePassState,
  EmitQuadWithDepth,
} from './greedy-meshing-passes'

// ─── Per-face pass functions ─────────────────────────────────────────────────

const meshXPosFace = (s: FacePassState): void => {
  const emit: EmitQuadWithDepth = makeEmitQuad(
    [1, 0, 0],
    'side',
    (u0, v0, du, dv, depth, verts) => {
      const lz0 = u0, y0 = v0
      const fx = s.offset.wx + depth + 1
      verts[0][0] = fx; verts[0][1] = y0;      verts[0][2] = s.offset.wz + lz0
      verts[1][0] = fx; verts[1][1] = y0 + dv; verts[1][2] = s.offset.wz + lz0
      verts[2][0] = fx; verts[2][1] = y0 + dv; verts[2][2] = s.offset.wz + lz0 + du
      verts[3][0] = fx; verts[3][1] = y0;      verts[3][2] = s.offset.wz + lz0 + du
    },
    s.opaqueAcc, s.getWaterAcc, s.transparentLookup,
  )
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    s.maskCH.fill(0)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && isAir(s.blocks, lx + 1, y, lz)) {
          const ao = aoXPos(s.blocks, lx, y, lz)
          // 4 corners on +X face — air voxel at (lx+1,y,lz); tangents (lz, y).
          const c0 = sampleCornerLight(s.lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 0)
          const c1 = sampleCornerLight(s.lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 1)
          const c2 = sampleCornerLight(s.lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 1)
          const c3 = sampleCornerLight(s.lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 0)
          s.maskCH[lz * CHUNK_HEIGHT + y] = packMask(
            blockId, ao,
            (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
            (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
          )
        }
      }
    }
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, s.doneBuf, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lx))
  }
}

const meshXNegFace = (s: FacePassState): void => {
  const emit: EmitQuadWithDepth = makeEmitQuad(
    [-1, 0, 0],
    'side',
    (u0, v0, du, dv, depth, verts) => {
      const lz0 = u0, y0 = v0
      const fx = s.offset.wx + depth
      verts[0][0] = fx; verts[0][1] = y0;      verts[0][2] = s.offset.wz + lz0 + du
      verts[1][0] = fx; verts[1][1] = y0 + dv; verts[1][2] = s.offset.wz + lz0 + du
      verts[2][0] = fx; verts[2][1] = y0 + dv; verts[2][2] = s.offset.wz + lz0
      verts[3][0] = fx; verts[3][1] = y0;      verts[3][2] = s.offset.wz + lz0
    },
    s.opaqueAcc, s.getWaterAcc, s.transparentLookup,
  )
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    s.maskCH.fill(0)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && isAir(s.blocks, lx - 1, y, lz)) {
          const ao = aoXNeg(s.blocks, lx, y, lz)
          // Vertices for X- are emitted in reverse winding (lz0+du..lz0); align corners to that order.
          const c0 = sampleCornerLight(s.lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 0)
          const c1 = sampleCornerLight(s.lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 1)
          const c2 = sampleCornerLight(s.lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 1)
          const c3 = sampleCornerLight(s.lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 0)
          s.maskCH[lz * CHUNK_HEIGHT + y] = packMask(
            blockId, ao,
            (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
            (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
          )
        }
      }
    }
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, s.doneBuf, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lx))
  }
}

const meshYPosFace = (s: FacePassState): void => {
  const emit: EmitQuadWithDepth = makeEmitQuad(
    [0, 1, 0],
    'top',
    (u0, v0, du, dv, depth, verts) => {
      const lx0 = u0, lz0 = v0
      const fy = depth + 1
      verts[0][0] = s.offset.wx + lx0;      verts[0][1] = fy; verts[0][2] = s.offset.wz + lz0
      verts[1][0] = s.offset.wx + lx0;      verts[1][1] = fy; verts[1][2] = s.offset.wz + lz0 + dv
      verts[2][0] = s.offset.wx + lx0 + du; verts[2][1] = fy; verts[2][2] = s.offset.wz + lz0 + dv
      verts[3][0] = s.offset.wx + lx0 + du; verts[3][1] = fy; verts[3][2] = s.offset.wz + lz0
    },
    s.opaqueAcc, s.getWaterAcc, s.transparentLookup,
  )
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    s.maskSS.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && isAir(s.blocks, lx, y + 1, lz)) {
          const ao = aoYPos(s.blocks, lx, y, lz)
          // Vertex order: (lx0, lz0), (lx0, lz0+dv), (lx0+du, lz0+dv), (lx0+du, lz0).
          const c0 = sampleCornerLight(s.lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 0, 0)
          const c1 = sampleCornerLight(s.lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 0, 1)
          const c2 = sampleCornerLight(s.lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 1, 1)
          const c3 = sampleCornerLight(s.lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 1, 0)
          s.maskSS[lx * CHUNK_SIZE + lz] = packMask(
            blockId, ao,
            (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
            (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
          )
        }
      }
    }
    runGreedyExpansion(s.maskSS, CHUNK_SIZE, CHUNK_SIZE, s.doneBuf, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, y))
  }
}

const meshYNegFace = (s: FacePassState): void => {
  const emit: EmitQuadWithDepth = makeEmitQuad(
    [0, -1, 0],
    'bottom',
    (u0, v0, du, dv, depth, verts) => {
      const lx0 = u0, lz0 = v0
      const fy = depth
      verts[0][0] = s.offset.wx + lx0 + du; verts[0][1] = fy; verts[0][2] = s.offset.wz + lz0
      verts[1][0] = s.offset.wx + lx0 + du; verts[1][1] = fy; verts[1][2] = s.offset.wz + lz0 + dv
      verts[2][0] = s.offset.wx + lx0;      verts[2][1] = fy; verts[2][2] = s.offset.wz + lz0 + dv
      verts[3][0] = s.offset.wx + lx0;      verts[3][1] = fy; verts[3][2] = s.offset.wz + lz0
    },
    s.opaqueAcc, s.getWaterAcc, s.transparentLookup,
  )
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    s.maskSS.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && isAir(s.blocks, lx, y - 1, lz)) {
          const ao = aoYNeg(s.blocks, lx, y, lz)
          // Vertex order: (lx0+du, lz0), (lx0+du, lz0+dv), (lx0, lz0+dv), (lx0, lz0).
          const c0 = sampleCornerLight(s.lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 1, 0)
          const c1 = sampleCornerLight(s.lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 1, 1)
          const c2 = sampleCornerLight(s.lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 0, 1)
          const c3 = sampleCornerLight(s.lightGrids, lx, y - 1, lz, 1, 0, 0, 0, 0, 1, 0, 0)
          s.maskSS[lx * CHUNK_SIZE + lz] = packMask(
            blockId, ao,
            (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
            (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
          )
        }
      }
    }
    runGreedyExpansion(s.maskSS, CHUNK_SIZE, CHUNK_SIZE, s.doneBuf, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, y))
  }
}

const meshZPosFace = (s: FacePassState): void => {
  const emit: EmitQuadWithDepth = makeEmitQuad(
    [0, 0, 1],
    'side',
    (u0, v0, du, dv, depth, verts) => {
      const lx0 = u0, y0 = v0
      const fz = s.offset.wz + depth + 1
      verts[0][0] = s.offset.wx + lx0 + du; verts[0][1] = y0;      verts[0][2] = fz
      verts[1][0] = s.offset.wx + lx0 + du; verts[1][1] = y0 + dv; verts[1][2] = fz
      verts[2][0] = s.offset.wx + lx0;      verts[2][1] = y0 + dv; verts[2][2] = fz
      verts[3][0] = s.offset.wx + lx0;      verts[3][1] = y0;      verts[3][2] = fz
    },
    s.opaqueAcc, s.getWaterAcc, s.transparentLookup,
  )
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    s.maskCH.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && isAir(s.blocks, lx, y, lz + 1)) {
          const ao = aoZPos(s.blocks, lx, y, lz)
          // Vertex order: (lx0+du, y0), (lx0+du, y0+dv), (lx0, y0+dv), (lx0, y0).
          const c0 = sampleCornerLight(s.lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 1, 0)
          const c1 = sampleCornerLight(s.lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 1, 1)
          const c2 = sampleCornerLight(s.lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 0, 1)
          const c3 = sampleCornerLight(s.lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 0, 0)
          s.maskCH[lx * CHUNK_HEIGHT + y] = packMask(
            blockId, ao,
            (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
            (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
          )
        }
      }
    }
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, s.doneBuf, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lz))
  }
}

const meshZNegFace = (s: FacePassState): void => {
  const emit: EmitQuadWithDepth = makeEmitQuad(
    [0, 0, -1],
    'side',
    (u0, v0, du, dv, depth, verts) => {
      const lx0 = u0, y0 = v0
      const fz = s.offset.wz + depth
      verts[0][0] = s.offset.wx + lx0;      verts[0][1] = y0;      verts[0][2] = fz
      verts[1][0] = s.offset.wx + lx0;      verts[1][1] = y0 + dv; verts[1][2] = fz
      verts[2][0] = s.offset.wx + lx0 + du; verts[2][1] = y0 + dv; verts[2][2] = fz
      verts[3][0] = s.offset.wx + lx0 + du; verts[3][1] = y0;      verts[3][2] = fz
    },
    s.opaqueAcc, s.getWaterAcc, s.transparentLookup,
  )
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    s.maskCH.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && isAir(s.blocks, lx, y, lz - 1)) {
          const ao = aoZNeg(s.blocks, lx, y, lz)
          // Vertex order: (lx0, y0), (lx0, y0+dv), (lx0+du, y0+dv), (lx0+du, y0).
          const c0 = sampleCornerLight(s.lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 0, 0)
          const c1 = sampleCornerLight(s.lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 0, 1)
          const c2 = sampleCornerLight(s.lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 1, 1)
          const c3 = sampleCornerLight(s.lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 1, 0)
          s.maskCH[lx * CHUNK_HEIGHT + y] = packMask(
            blockId, ao,
            (c0 >> 6) & 0x3, (c1 >> 6) & 0x3, (c2 >> 6) & 0x3, (c3 >> 6) & 0x3,
            (c0 >> 2) & 0x3, (c1 >> 2) & 0x3, (c2 >> 2) & 0x3, (c3 >> 2) & 0x3,
          )
        }
      }
    }
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, s.doneBuf, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lz))
  }
}

// ─── Main meshing function ───────────────────────────────────────────────────

export const greedyMeshChunk = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  transparentBlockIds: ReadonlySet<number> = new Set(),
  scratch: GreedyMeshScratch = createGreedyMeshScratch(),
  lightGrids?: LightGrids,
): GreedyMeshResult => {
  const opaqueAcc = createAccumulator()
  let waterAccStorage: MeshAccumulator | null = null
  const transparentLookup = new Uint8Array(256)
  for (const blockId of transparentBlockIds) transparentLookup[blockId] = 1

  const { doneBuf, maskCH, maskSS } = scratch
  const blocks: Readonly<Uint8Array> = chunk.blocks
  const getWaterAcc = (): MeshAccumulator => (waterAccStorage ??= createAccumulator())

  const state: FacePassState = {
    blocks,
    lightGrids,
    doneBuf,
    maskCH,
    maskSS,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    offset,
  }

  meshXPosFace(state)
  meshXNegFace(state)
  meshYPosFace(state)
  meshYNegFace(state)
  meshZPosFace(state)
  meshZNegFace(state)

  const toRawMeshData = (a: MeshAccumulator): RawMeshData =>
    Schema.decodeUnknownSync(RawMeshDataSchema)({
      positions: a.positions.subarray(0, a.vertexCount * 3),
      normals: a.normals.subarray(0, a.vertexCount * 3),
      colors: a.colors.subarray(0, a.vertexCount * 3),
      uvs: a.uvs.subarray(0, a.vertexCount * 2),
      tileIndexes: a.tileIndexes.subarray(0, a.vertexCount),
      indices: a.indices.subarray(0, a.indexCount),
      vertexCount: a.vertexCount,
      indexCount: a.indexCount,
    })

  const toMeshedChunk = (raw: RawMeshData): MeshedChunk => ({
    positions: raw.positions.slice(),
    normals: raw.normals.slice(),
    colors: raw.colors.slice(),
    uvs: raw.uvs.slice(),
    tileIndexes: raw.tileIndexes.slice(),
    indices: raw.indices.slice(),
  })

  const opaqueRaw = toRawMeshData(opaqueAcc)
  const waterRaw = waterAccStorage !== null ? toRawMeshData(waterAccStorage) : null

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
