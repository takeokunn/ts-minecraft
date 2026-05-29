import { Option, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import { Chunk } from '@ts-minecraft/terrain'
import {
  decodeFluidByte,
  maxLevelFor,
  type FluidCell,
  type FluidType,
  type LightGrids,
} from '@ts-minecraft/world-state'

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
  addQuad,
  createAccumulator,
} from './greedy-meshing-accumulator'

import {
  packMask,
  dequantLight,
  runGreedyExpansion,
  makeEmitQuad,
  FacePassState,
  EmitQuadWithDepth,
} from './greedy-meshing-passes'

const WATER_BLOCK_ID = blockTypeToIndex('WATER')
const LAVA_BLOCK_ID = blockTypeToIndex('LAVA')
const ZERO_AO = [0, 0, 0, 0] as const satisfies readonly [number, number, number, number]

type FluidRenderState = Readonly<{
  readonly blockId: number
  readonly type: FluidType
  readonly height: number
}>

const isFluidBlockId = (blockId: number): boolean => blockId === WATER_BLOCK_ID || blockId === LAVA_BLOCK_ID

const fluidTypeForBlockId = (blockId: number): FluidType => blockId === LAVA_BLOCK_ID ? 'lava' : 'water'

const fluidArrayIndex = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const fallbackFluidCellForBlock = (blockId: number): FluidCell => ({
  level: 0,
  source: true,
  type: fluidTypeForBlockId(blockId),
})

const fluidHeightForCell = (cell: FluidCell): number => {
  if (cell.source) return 1
  const maxLevel = maxLevelFor(cell.type)
  return Math.max(1 / (maxLevel + 1), 1 - cell.level / (maxLevel + 1))
}

const resolveFluidState = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>> | undefined,
  lx: number,
  y: number,
  lz: number,
): FluidRenderState | null => {
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
    return null
  }

  const blockId = getBlock(blocks, lx, y, lz)
  if (!isFluidBlockId(blockId)) {
    return null
  }

  const fallback = fallbackFluidCellForBlock(blockId)
  const decoded = fluid === undefined
    ? fallback
    : Option.getOrElse(decodeFluidByte(fluid[fluidArrayIndex(lx, y, lz)] ?? 0), () => fallback)
  const type = fluidTypeForBlockId(blockId)
  const cell = decoded.type === type ? decoded : { ...decoded, type }

  return {
    blockId,
    type,
    height: fluidHeightForCell(cell),
  }
}

const fluidSurfaceHeightForColumn = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>> | undefined,
  type: FluidType,
  lx: number,
  y: number,
  lz: number,
): number | null => {
  const here = resolveFluidState(blocks, fluid, lx, y, lz)
  if (here === null || here.type !== type) return null

  const above = resolveFluidState(blocks, fluid, lx, y + 1, lz)
  return above !== null && above.type === type ? 1 : here.height
}

const fluidCornerHeightForCell = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>> | undefined,
  current: FluidRenderState,
  lx: number,
  y: number,
  lz: number,
  cornerX: 0 | 1,
  cornerZ: 0 | 1,
): number => {
  let heightSum = 0
  let sampleCount = 0

  for (let sx = lx + cornerX - 1; sx <= lx + cornerX; sx++) {
    for (let sz = lz + cornerZ - 1; sz <= lz + cornerZ; sz++) {
      const height = fluidSurfaceHeightForColumn(blocks, fluid, current.type, sx, y, sz)
      if (height !== null) {
        heightSum += height
        sampleCount++
      }
    }
  }

  return sampleCount > 0 ? heightSum / sampleCount : current.height
}

const fluidTopCornerYsForCell = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>> | undefined,
  current: FluidRenderState,
  lx: number,
  y: number,
  lz: number,
): readonly [number, number, number, number] => [
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 0, 0),
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 0, 1),
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 1, 1),
  y + fluidCornerHeightForCell(blocks, fluid, current, lx, y, lz, 1, 0),
]

// A neighbour occludes a fluid face only when it is TRULY opaque — not air, not
// another fluid, and not a transparent-solid block (GLASS/LEAVES). Water behind
// glass (aquariums) must still show its surface and sides, so glass/leaves are
// not occluders here. Mirrors isSolidFaceExposed on the solid-block side.
const isFluidFaceOccluder = (blockId: number, transparentSolidLookup: Uint8Array): boolean =>
  blockId !== AIR && !isFluidBlockId(blockId) && transparentSolidLookup[blockId] === 0

// Face exposure for the six solid passes (opaque + transparent-solid sources).
// A face is exposed when the neighbour is AIR. Additionally, an OPAQUE source
// block exposes its face through a transparent-solid neighbour (GLASS, LEAVES):
// otherwise the opaque surface behind the glass/leaves would show a see-through
// hole. Transparent-solid SOURCE blocks keep air-only exposure, so adjacent
// same-type panes still cull their shared face (no internal double faces /
// z-fighting). Fluid neighbours are deliberately treated as occluders here —
// fluid surfaces are meshed by the dedicated fluid pass, which owns that
// boundary, so routing opaque faces through them would double-render.
const isSolidFaceExposed = (
  blocks: Readonly<Uint8Array>,
  sourceBlockId: number,
  transparentSolidLookup: Uint8Array,
  nx: number,
  ny: number,
  nz: number,
): boolean => {
  const neighborId = getBlock(blocks, nx, ny, nz)
  if (neighborId === AIR) return true
  if (transparentSolidLookup[sourceBlockId] !== 0) return false
  return transparentSolidLookup[neighborId] !== 0
}

const decodeFaceLighting = (
  c0: number,
  c1: number,
  c2: number,
  c3: number,
): Readonly<{
  readonly sky: readonly [number, number, number, number]
  readonly block: readonly [number, number, number, number]
}> => ({
  sky: [
    dequantLight((c0 >> 6) & 0x3),
    dequantLight((c1 >> 6) & 0x3),
    dequantLight((c2 >> 6) & 0x3),
    dequantLight((c3 >> 6) & 0x3),
  ],
  block: [
    dequantLight((c0 >> 2) & 0x3),
    dequantLight((c1 >> 2) & 0x3),
    dequantLight((c2 >> 2) & 0x3),
    dequantLight((c3 >> 2) & 0x3),
  ],
})

const meshFluidFaces = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>> | undefined,
  lightGrids: LightGrids | undefined,
  opaqueAcc: MeshAccumulator,
  getWaterAcc: () => MeshAccumulator,
  transparentLookup: Uint8Array,
  transparentSolidLookup: Uint8Array,
  offset: ChunkWorldOffset,
): void => {
  const emitFluidQuad = (
    blockId: number,
    normal: readonly [number, number, number],
    faceDir: 'top' | 'side',
    vertices: readonly [
      readonly [number, number, number],
      readonly [number, number, number],
      readonly [number, number, number],
      readonly [number, number, number],
    ],
    lighting: Readonly<{
      readonly sky: readonly [number, number, number, number]
      readonly block: readonly [number, number, number, number]
    }>,
  ): void => {
    const targetAcc = transparentLookup[blockId] !== 0 ? getWaterAcc() : opaqueAcc
    addQuad(
      targetAcc,
      vertices[0],
      vertices[1],
      vertices[2],
      vertices[3],
      normal,
      blockId,
      ZERO_AO,
      lighting.sky,
      lighting.block,
      faceDir,
      1,
      1,
    )
  }

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const current = resolveFluidState(blocks, fluid, lx, y, lz)
        if (current === null) continue

        const [topY00, topY01, topY11, topY10] = fluidTopCornerYsForCell(blocks, fluid, current, lx, y, lz)
        const aboveBlockId = getBlock(blocks, lx, y + 1, lz)
        const aboveFluid = resolveFluidState(blocks, fluid, lx, y + 1, lz)
        if (!isFluidFaceOccluder(aboveBlockId, transparentSolidLookup) && aboveFluid === null) {
          const lighting = decodeFaceLighting(
            sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 0, 0),
            sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 0, 1),
            sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 1, 1),
            sampleCornerLight(lightGrids, lx, y + 1, lz, 1, 0, 0, 0, 0, 1, 1, 0),
          )
          emitFluidQuad(
            current.blockId,
            [0, 1, 0],
            'top',
            [
              [offset.wx + lx, topY00, offset.wz + lz],
              [offset.wx + lx, topY01, offset.wz + lz + 1],
              [offset.wx + lx + 1, topY11, offset.wz + lz + 1],
              [offset.wx + lx + 1, topY10, offset.wz + lz],
            ],
            lighting,
          )
        }

        const xPosNeighborBlockId = getBlock(blocks, lx + 1, y, lz)
        if (!isFluidFaceOccluder(xPosNeighborBlockId, transparentSolidLookup)) {
          const xPosNeighbor = resolveFluidState(blocks, fluid, lx + 1, y, lz)
          const xPosBottomY = xPosNeighbor !== null && xPosNeighbor.type === current.type
            ? y + xPosNeighbor.height
            : y
          if (xPosNeighbor === null || xPosNeighbor.type !== current.type || xPosNeighbor.height < current.height) {
            const lighting = decodeFaceLighting(
              sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 0),
              sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 1),
              sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 1),
              sampleCornerLight(lightGrids, lx + 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 0),
            )
            emitFluidQuad(
              current.blockId,
              [1, 0, 0],
              'side',
              [
                [offset.wx + lx + 1, xPosBottomY, offset.wz + lz],
                [offset.wx + lx + 1, topY10, offset.wz + lz],
                [offset.wx + lx + 1, topY11, offset.wz + lz + 1],
                [offset.wx + lx + 1, xPosBottomY, offset.wz + lz + 1],
              ],
              lighting,
            )
          }
        }

        const xNegNeighborBlockId = getBlock(blocks, lx - 1, y, lz)
        if (!isFluidFaceOccluder(xNegNeighborBlockId, transparentSolidLookup)) {
          const xNegNeighbor = resolveFluidState(blocks, fluid, lx - 1, y, lz)
          const xNegBottomY = xNegNeighbor !== null && xNegNeighbor.type === current.type
            ? y + xNegNeighbor.height
            : y
          if (xNegNeighbor === null || xNegNeighbor.type !== current.type || xNegNeighbor.height < current.height) {
            const lighting = decodeFaceLighting(
              sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 0),
              sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 1, 1),
              sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 1),
              sampleCornerLight(lightGrids, lx - 1, y, lz, 0, 0, 1, 0, 1, 0, 0, 0),
            )
            emitFluidQuad(
              current.blockId,
              [-1, 0, 0],
              'side',
              [
                [offset.wx + lx, xNegBottomY, offset.wz + lz + 1],
                [offset.wx + lx, topY01, offset.wz + lz + 1],
                [offset.wx + lx, topY00, offset.wz + lz],
                [offset.wx + lx, xNegBottomY, offset.wz + lz],
              ],
              lighting,
            )
          }
        }

        const zPosNeighborBlockId = getBlock(blocks, lx, y, lz + 1)
        if (!isFluidFaceOccluder(zPosNeighborBlockId, transparentSolidLookup)) {
          const zPosNeighbor = resolveFluidState(blocks, fluid, lx, y, lz + 1)
          const zPosBottomY = zPosNeighbor !== null && zPosNeighbor.type === current.type
            ? y + zPosNeighbor.height
            : y
          if (zPosNeighbor === null || zPosNeighbor.type !== current.type || zPosNeighbor.height < current.height) {
            const lighting = decodeFaceLighting(
              sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 1, 0),
              sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 1, 1),
              sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 0, 1),
              sampleCornerLight(lightGrids, lx, y, lz + 1, 1, 0, 0, 0, 1, 0, 0, 0),
            )
            emitFluidQuad(
              current.blockId,
              [0, 0, 1],
              'side',
              [
                [offset.wx + lx + 1, zPosBottomY, offset.wz + lz + 1],
                [offset.wx + lx + 1, topY11, offset.wz + lz + 1],
                [offset.wx + lx, topY01, offset.wz + lz + 1],
                [offset.wx + lx, zPosBottomY, offset.wz + lz + 1],
              ],
              lighting,
            )
          }
        }

        const zNegNeighborBlockId = getBlock(blocks, lx, y, lz - 1)
        if (!isFluidFaceOccluder(zNegNeighborBlockId, transparentSolidLookup)) {
          const zNegNeighbor = resolveFluidState(blocks, fluid, lx, y, lz - 1)
          const zNegBottomY = zNegNeighbor !== null && zNegNeighbor.type === current.type
            ? y + zNegNeighbor.height
            : y
          if (zNegNeighbor === null || zNegNeighbor.type !== current.type || zNegNeighbor.height < current.height) {
            const lighting = decodeFaceLighting(
              sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 0, 0),
              sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 0, 1),
              sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 1, 1),
              sampleCornerLight(lightGrids, lx, y, lz - 1, 1, 0, 0, 0, 1, 0, 1, 0),
            )
            emitFluidQuad(
              current.blockId,
              [0, 0, -1],
              'side',
              [
                [offset.wx + lx, zNegBottomY, offset.wz + lz],
                [offset.wx + lx, topY00, offset.wz + lz],
                [offset.wx + lx + 1, topY10, offset.wz + lz],
                [offset.wx + lx + 1, zNegBottomY, offset.wz + lz],
              ],
              lighting,
            )
          }
        }
      }
    }
  }
}

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

// ─── Main meshing function ───────────────────────────────────────────────────

export const greedyMeshChunk = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  transparentBlockIds: ReadonlySet<number> = new Set(),
  scratch: GreedyMeshScratch = createGreedyMeshScratch(),
  lightGrids?: LightGrids,
  transparentSolidBlockIds: ReadonlySet<number> = new Set(),
): GreedyMeshResult => {
  const opaqueAcc = createAccumulator()
  let waterAccStorage: MeshAccumulator | null = null
  let transparentSolidAccStorage: MeshAccumulator | null = null
  const transparentLookup = new Uint8Array(256)
  for (const blockId of transparentBlockIds) transparentLookup[blockId] = 1
  const transparentSolidLookup = new Uint8Array(256)
  for (const blockId of transparentSolidBlockIds) transparentSolidLookup[blockId] = 1

  const { maskCH, maskSS } = scratch
  const blocks: Readonly<Uint8Array> = chunk.blocks
  const getWaterAcc = (): MeshAccumulator => (waterAccStorage ??= createAccumulator())
  const getTransparentSolidAcc = (): MeshAccumulator => (transparentSolidAccStorage ??= createAccumulator())

  const state: FacePassState = {
    blocks,
    lightGrids,
    maskCH,
    maskSS,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    getTransparentSolidAcc,
    transparentSolidLookup,
    offset,
  }

  meshXPosFace(state)
  meshXNegFace(state)
  meshYPosFace(state)
  meshYNegFace(state)
  meshZPosFace(state)
  meshZNegFace(state)
  meshFluidFaces(
    blocks,
    Option.getOrUndefined(chunk.fluid),
    lightGrids,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    transparentSolidLookup,
    offset,
  )

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
  const transparentSolidRaw = transparentSolidAccStorage !== null ? toRawMeshData(transparentSolidAccStorage) : null

  // Lazy cache: toMeshed() allocates sliced copies on first call, then returns the cached result.
  let _meshedCache: { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } | null = null
  const toMeshed = (): { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } => {
    if (_meshedCache === null) {
      _meshedCache = {
        opaque: toMeshedChunk(opaqueRaw),
        water: waterRaw !== null ? toMeshedChunk(waterRaw) : EMPTY_MESHED_CHUNK,
        transparentSolid: transparentSolidRaw !== null ? toMeshedChunk(transparentSolidRaw) : EMPTY_MESHED_CHUNK,
      }
    }
    return _meshedCache
  }

  return {
    opaqueRaw,
    waterRaw,
    transparentSolidRaw,
    toMeshed,
  }
}
