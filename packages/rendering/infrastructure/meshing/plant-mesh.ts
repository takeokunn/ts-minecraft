import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import type { LightGrids } from '@ts-minecraft/block/domain/light'
import type { FaceDir } from '../textures/block-texture-map'
import type { ChunkWorldOffset } from './greedy-meshing-types'
import type { MeshAccumulator } from './greedy-meshing-quads'
import { addQuad } from './greedy-meshing-quads'
import { getBlock, sampleVoxelLight } from './greedy-meshing-ao'

type Vec3 = [number, number, number]
type QuadLight = [number, number, number, number]

const BLOCK_ID_LIMIT = 256
const PLANT_INSET = 0.1
const THIN_BLOCK_INSET = 1 / 16
const LILY_PAD_HEIGHT = 1 / 16
const EMPTY_AO: [0, 0, 0, 0] = [0, 0, 0, 0]

const CROSS_PLANT_IDS = [
  blockTypeToIndex('DANDELION'),
  blockTypeToIndex('POPPY'),
  blockTypeToIndex('BROWN_MUSHROOM'),
  blockTypeToIndex('RED_MUSHROOM'),
  blockTypeToIndex('TALL_GRASS'),
  blockTypeToIndex('FERN'),
  blockTypeToIndex('SUGAR_CANE'),
] as const

const CACTUS_ID = blockTypeToIndex('CACTUS')
const LILY_PAD_ID = blockTypeToIndex('LILY_PAD')

const makeLookup = (ids: readonly number[]): Uint8Array => {
  const lookup = new Uint8Array(BLOCK_ID_LIMIT)
  for (const id of ids) lookup[id] = 1
  return lookup
}

const crossPlantLookup = makeLookup(CROSS_PLANT_IDS)
const plantMeshLookup = makeLookup([...CROSS_PLANT_IDS, CACTUS_ID, LILY_PAD_ID])

export const isPlantMeshBlockId = (blockId: number): boolean =>
  plantMeshLookup[blockId] === 1

const isCrossPlantBlockId = (blockId: number): boolean =>
  crossPlantLookup[blockId] === 1

const getQuadLight = (lightGrids: LightGrids | undefined, lx: number, y: number, lz: number): {
  skyLight: QuadLight
  blockLight: QuadLight
} => {
  const packedLight = sampleVoxelLight(lightGrids, lx, y, lz)
  const sky = (packedLight >> 4) & 0xf
  const block = packedLight & 0xf
  return {
    skyLight: [sky, sky, sky, sky],
    blockLight: [block, block, block, block],
  }
}

const emitPlantQuad = (
  acc: MeshAccumulator,
  blockId: number,
  faceDir: FaceDir,
  normal: Vec3,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  v3: Vec3,
  skyLight: QuadLight,
  blockLight: QuadLight,
): void => {
  addQuad(acc, v0, v1, v2, v3, normal, blockId, EMPTY_AO, skyLight, blockLight, faceDir, 1, 1)
}

const addCrossPlant = (
  acc: MeshAccumulator,
  blockId: number,
  offset: ChunkWorldOffset,
  lx: number,
  y: number,
  lz: number,
  skyLight: QuadLight,
  blockLight: QuadLight,
): void => {
  const x0 = offset.wx + lx + PLANT_INSET
  const x1 = offset.wx + lx + 1 - PLANT_INSET
  const z0 = offset.wz + lz + PLANT_INSET
  const z1 = offset.wz + lz + 1 - PLANT_INSET
  const y0 = y
  const y1 = y + 1

  emitPlantQuad(acc, blockId, 'side', [0, 0, 1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1], [x1, y0, z1], skyLight, blockLight)
  emitPlantQuad(acc, blockId, 'side', [1, 0, 0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z1], [x0, y0, z1], skyLight, blockLight)
}

const addLilyPad = (
  acc: MeshAccumulator,
  blockId: number,
  offset: ChunkWorldOffset,
  lx: number,
  y: number,
  lz: number,
  skyLight: QuadLight,
  blockLight: QuadLight,
): void => {
  const x0 = offset.wx + lx + THIN_BLOCK_INSET
  const x1 = offset.wx + lx + 1 - THIN_BLOCK_INSET
  const z0 = offset.wz + lz + THIN_BLOCK_INSET
  const z1 = offset.wz + lz + 1 - THIN_BLOCK_INSET
  const fy = y + LILY_PAD_HEIGHT

  emitPlantQuad(acc, blockId, 'top', [0, 1, 0], [x0, fy, z0], [x0, fy, z1], [x1, fy, z1], [x1, fy, z0], skyLight, blockLight)
}

const addCactus = (
  acc: MeshAccumulator,
  blocks: Readonly<Uint8Array>,
  blockId: number,
  offset: ChunkWorldOffset,
  lx: number,
  y: number,
  lz: number,
  skyLight: QuadLight,
  blockLight: QuadLight,
): void => {
  const x0 = offset.wx + lx + THIN_BLOCK_INSET
  const x1 = offset.wx + lx + 1 - THIN_BLOCK_INSET
  const z0 = offset.wz + lz + THIN_BLOCK_INSET
  const z1 = offset.wz + lz + 1 - THIN_BLOCK_INSET
  const y0 = y
  const y1 = y + 1

  emitPlantQuad(acc, blockId, 'side', [1, 0, 0], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], skyLight, blockLight)
  emitPlantQuad(acc, blockId, 'side', [-1, 0, 0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], skyLight, blockLight)
  emitPlantQuad(acc, blockId, 'side', [0, 0, 1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], skyLight, blockLight)
  emitPlantQuad(acc, blockId, 'side', [0, 0, -1], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], skyLight, blockLight)

  if (getBlock(blocks, lx, y + 1, lz) !== CACTUS_ID) {
    emitPlantQuad(acc, blockId, 'top', [0, 1, 0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], skyLight, blockLight)
  }
  if (getBlock(blocks, lx, y - 1, lz) !== CACTUS_ID) {
    emitPlantQuad(acc, blockId, 'bottom', [0, -1, 0], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], skyLight, blockLight)
  }
}

export const addPlantMeshes = (
  blocks: Readonly<Uint8Array>,
  lightGrids: LightGrids | undefined,
  getTransparentSolidAcc: () => MeshAccumulator,
  offset: ChunkWorldOffset,
  yLimit: number,
): void => {
  const cappedYLimit = Math.min(CHUNK_HEIGHT, yLimit)
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < cappedYLimit; y++) {
        const blockId = getBlock(blocks, lx, y, lz)
        if (!isPlantMeshBlockId(blockId)) continue

        const { skyLight, blockLight } = getQuadLight(lightGrids, lx, y, lz)
        const acc = getTransparentSolidAcc()
        if (isCrossPlantBlockId(blockId)) {
          addCrossPlant(acc, blockId, offset, lx, y, lz, skyLight, blockLight)
        } else if (blockId === LILY_PAD_ID) {
          addLilyPad(acc, blockId, offset, lx, y, lz, skyLight, blockLight)
        } else if (blockId === CACTUS_ID) {
          addCactus(acc, blocks, blockId, offset, lx, y, lz, skyLight, blockLight)
        }
      }
    }
  }
}
