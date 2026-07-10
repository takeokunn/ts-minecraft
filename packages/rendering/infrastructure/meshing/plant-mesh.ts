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
  blockTypeToIndex('KELP'),
  blockTypeToIndex('SEAGRASS'),
] as const

const CACTUS_ID = blockTypeToIndex('CACTUS')
const RAIL_ID = blockTypeToIndex('RAIL')
const POWERED_RAIL_ID = blockTypeToIndex('POWERED_RAIL')
const RAIL_HEIGHT = 1 / 16
const LILY_PAD_ID = blockTypeToIndex('LILY_PAD')

const makeLookup = (ids: readonly number[]): Uint8Array => {
  const lookup = new Uint8Array(BLOCK_ID_LIMIT)
  for (const id of ids) lookup[id] = 1
  return lookup
}

const crossPlantLookup = makeLookup(CROSS_PLANT_IDS)
const plantMeshLookup = makeLookup([...CROSS_PLANT_IDS, CACTUS_ID, LILY_PAD_ID, RAIL_ID, POWERED_RAIL_ID])

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

const isRailBlockId = (blockId: number): boolean =>
  blockId === RAIL_ID || blockId === POWERED_RAIL_ID

// A neighbouring rail at the same height or one block up/down connects
// (slopes count). Out-of-chunk cells read as AIR — a border rail defaults to
// a straight along whatever in-chunk neighbour it has.
const railNeighbor = (blocks: Readonly<Uint8Array>, lx: number, y: number, lz: number): boolean =>
  isRailBlockId(getBlock(blocks, lx, y, lz)) ||
  isRailBlockId(getBlock(blocks, lx, y + 1, lz)) ||
  isRailBlockId(getBlock(blocks, lx, y - 1, lz))

// Flat rail plate with the texture oriented along the run; curves render as
// an L of two half plates; a rail one block up along an axis renders as a
// slanted plate climbing onto it. Mirrors the physics-side rail shapes
// (game/domain/rail-shape.ts) so what the cart does matches what you see.
const addRail = (
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
  const x0 = offset.wx + lx
  const x1 = x0 + 1
  const z0 = offset.wz + lz
  const z1 = z0 + 1
  const xm = x0 + 0.5
  const zm = z0 + 0.5
  const fy = y + RAIL_HEIGHT

  const north = railNeighbor(blocks, lx, y, lz - 1)
  const south = railNeighbor(blocks, lx, y, lz + 1)
  const east = railNeighbor(blocks, lx + 1, y, lz)
  const west = railNeighbor(blocks, lx - 1, y, lz)

  // Both faces so the plate is visible from below (bridges, slopes).
  const plate = (ax0: number, az0: number, ax1: number, az1: number, rotate: boolean, y00: number, y01: number, y11: number, y10: number): void => {
    // Corner order controls texture orientation: rotating the ring 90°
    // rotates the tile for east-west runs.
    const corners: ReadonlyArray<Vec3> = rotate
      ? [[ax0, y01, az1], [ax1, y11, az1], [ax1, y10, az0], [ax0, y00, az0]]
      : [[ax0, y00, az0], [ax0, y01, az1], [ax1, y11, az1], [ax1, y10, az0]]
    emitPlantQuad(acc, blockId, 'top', [0, 1, 0], corners[0]!, corners[1]!, corners[2]!, corners[3]!, skyLight, blockLight)
    emitPlantQuad(acc, blockId, 'bottom', [0, -1, 0], corners[3]!, corners[2]!, corners[1]!, corners[0]!, skyLight, blockLight)
  }

  // Ascending: the plate tilts up toward the raised neighbour.
  const upNorth = isRailBlockId(getBlock(blocks, lx, y + 1, lz - 1))
  const upSouth = isRailBlockId(getBlock(blocks, lx, y + 1, lz + 1))
  const upEast = isRailBlockId(getBlock(blocks, lx + 1, y + 1, lz))
  const upWest = isRailBlockId(getBlock(blocks, lx - 1, y + 1, lz))
  if (upNorth || upSouth) {
    const nearY = fy
    const farY = fy + 1
    plate(x0, z0, x1, z1, false, upNorth ? farY : nearY, upSouth ? farY : nearY, upSouth ? farY : nearY, upNorth ? farY : nearY)
    return
  }
  if (upEast || upWest) {
    const y00 = upWest ? fy + 1 : fy
    const y10 = upEast ? fy + 1 : fy
    plate(x0, z0, x1, z1, true, y00, y00, y10, y10)
    return
  }

  const nsCount = (north ? 1 : 0) + (south ? 1 : 0)
  const ewCount = (east ? 1 : 0) + (west ? 1 : 0)
  if (nsCount > 0 && ewCount > 0) {
    // Curve: an L of two half plates meeting at the cell centre.
    plate(x0, north ? z0 : zm, x1, north ? zm : z1, false, fy, fy, fy, fy)
    plate(west ? x0 : xm, z0, west ? xm : x1, z1, true, fy, fy, fy, fy)
    return
  }
  // Straight (or isolated): full plate, texture along the run.
  plate(x0, z0, x1, z1, ewCount > 0, fy, fy, fy, fy)
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
        } else if (isRailBlockId(blockId)) {
          addRail(acc, blocks, blockId, offset, lx, y, lz, skyLight, blockLight)
        }
      }
    }
  }
}
