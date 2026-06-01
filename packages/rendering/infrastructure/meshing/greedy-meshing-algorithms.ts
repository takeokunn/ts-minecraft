import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import type { FacePassState, EmitQuadWithDepth } from './greedy-meshing-passes'
import { makeEmitQuad, packMask, runGreedyExpansion } from './greedy-meshing-passes'
import {
  getBlock,
  aoXPos,
  aoXNeg,
  aoYPos,
  aoYNeg,
  aoZPos,
  aoZNeg,
  sampleCornerLight,
} from './greedy-meshing-ao'
import { AIR } from './greedy-meshing-types'
import { isFluidBlockId, isSolidFaceExposed } from './greedy-meshing-fluid-state'

// ─── Per-face pass functions ─────────────────────────────────────────────────

export const meshXPosFace = (s: FacePassState): void => {
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
    s.getTransparentSolidAcc, s.transparentSolidLookup,
  )
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    s.maskCH.fill(0)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && !isFluidBlockId(blockId) && isSolidFaceExposed(s.blocks, blockId, s.transparentSolidLookup, lx + 1, y, lz)) {
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
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lx))
  }
}

export const meshXNegFace = (s: FacePassState): void => {
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
    s.getTransparentSolidAcc, s.transparentSolidLookup,
  )
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    s.maskCH.fill(0)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && !isFluidBlockId(blockId) && isSolidFaceExposed(s.blocks, blockId, s.transparentSolidLookup, lx - 1, y, lz)) {
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
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lx))
  }
}

export const meshYPosFace = (s: FacePassState): void => {
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
    s.getTransparentSolidAcc, s.transparentSolidLookup,
  )
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    s.maskSS.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && !isFluidBlockId(blockId) && isSolidFaceExposed(s.blocks, blockId, s.transparentSolidLookup, lx, y + 1, lz)) {
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
    runGreedyExpansion(s.maskSS, CHUNK_SIZE, CHUNK_SIZE, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, y))
  }
}

export const meshYNegFace = (s: FacePassState): void => {
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
    s.getTransparentSolidAcc, s.transparentSolidLookup,
  )
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    s.maskSS.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && !isFluidBlockId(blockId) && isSolidFaceExposed(s.blocks, blockId, s.transparentSolidLookup, lx, y - 1, lz)) {
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
    runGreedyExpansion(s.maskSS, CHUNK_SIZE, CHUNK_SIZE, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, y))
  }
}

export const meshZPosFace = (s: FacePassState): void => {
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
    s.getTransparentSolidAcc, s.transparentSolidLookup,
  )
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    s.maskCH.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && !isFluidBlockId(blockId) && isSolidFaceExposed(s.blocks, blockId, s.transparentSolidLookup, lx, y, lz + 1)) {
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
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lz))
  }
}

export const meshZNegFace = (s: FacePassState): void => {
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
    s.getTransparentSolidAcc, s.transparentSolidLookup,
  )
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    s.maskCH.fill(0)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const blockId = getBlock(s.blocks, lx, y, lz)
        if (blockId !== AIR && !isFluidBlockId(blockId) && isSolidFaceExposed(s.blocks, blockId, s.transparentSolidLookup, lx, y, lz - 1)) {
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
    runGreedyExpansion(s.maskCH, CHUNK_SIZE, CHUNK_HEIGHT, (u0, v0, du, dv, mv) => emit(u0, v0, du, dv, mv, lz))
  }
}

