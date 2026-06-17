import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { LightGrids } from '@ts-minecraft/block'
import type { ChunkWorldOffset } from './greedy-meshing-types'
import { addQuad, type MeshAccumulator } from './greedy-meshing-accumulator'
import { getBlock, sampleCornerLight } from './greedy-meshing-ao'
import {
  decodeFaceLighting,
  fluidTopCornerYsForCell,
  isFluidFaceOccluder,
  resolveFluidState,
} from './greedy-meshing-fluid-state'

const ZERO_AO = [0, 0, 0, 0] as const satisfies readonly [number, number, number, number]

export const meshFluidFaces = (
  blocks: Readonly<Uint8Array>,
  fluid: Readonly<Uint8Array<ArrayBufferLike>>,
  lightGrids: LightGrids | undefined,
  opaqueAcc: MeshAccumulator,
  getWaterAcc: () => MeshAccumulator,
  transparentLookup: Uint8Array,
  transparentSolidLookup: Uint8Array,
  offset: ChunkWorldOffset,
  // Exclusive Y bound = highest non-air block + 1. Fluid is non-air, so none exists above
  // it; capping the scan here skips the empty air column.
  yLimit: number,
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
    for (let y = 0; y < yLimit; y++) {
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
