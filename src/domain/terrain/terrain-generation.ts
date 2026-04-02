import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@/domain/chunk'
import type { ChunkCoord } from '@/domain/chunk'

type TerrainBiome = 'PLAINS' | 'DESERT' | 'FOREST' | 'OCEAN' | 'MOUNTAINS' | 'SNOW' | 'SWAMP' | 'JUNGLE'

type TerrainBiomeProperties = {
  readonly surfaceBlockIndex: number
  readonly subSurfaceBlockIndex: number
  readonly treeDensity: number
  readonly heightModifier: number
  readonly baseHeight: number
}

export type TerrainGenerationConfig = {
  readonly seaLevel: number
  readonly lakeLevel: number
}

export type TerrainNoiseSamples = {
  readonly terrainNoise: ArrayLike<number>
  readonly lakeNoise: ArrayLike<number>
  readonly temperatureNoise: ArrayLike<number>
  readonly humidityNoise: ArrayLike<number>
}

export type TerrainNoiseCoordinates = {
  readonly terrainXs: ReadonlyArray<number>
  readonly terrainZs: ReadonlyArray<number>
  readonly lakeXs: ReadonlyArray<number>
  readonly lakeZs: ReadonlyArray<number>
  readonly temperatureXs: ReadonlyArray<number>
  readonly temperatureZs: ReadonlyArray<number>
  readonly humidityXs: ReadonlyArray<number>
  readonly humidityZs: ReadonlyArray<number>
}

type NoiseOctaveParams = {
  readonly octaves: number
  readonly persistence: number
  readonly lacunarity: number
}

const BIOME_PROPERTIES: Readonly<Record<TerrainBiome, TerrainBiomeProperties>> = {
  PLAINS: {
    surfaceBlockIndex: blockTypeToIndex('GRASS'),
    subSurfaceBlockIndex: blockTypeToIndex('DIRT'),
    treeDensity: 0.01,
    heightModifier: 1.0,
    baseHeight: 64,
  },
  DESERT: {
    surfaceBlockIndex: blockTypeToIndex('SAND'),
    subSurfaceBlockIndex: blockTypeToIndex('SAND'),
    treeDensity: 0.0,
    heightModifier: 0.5,
    baseHeight: 64,
  },
  FOREST: {
    surfaceBlockIndex: blockTypeToIndex('GRASS'),
    subSurfaceBlockIndex: blockTypeToIndex('DIRT'),
    treeDensity: 0.3,
    heightModifier: 1.0,
    baseHeight: 64,
  },
  OCEAN: {
    surfaceBlockIndex: blockTypeToIndex('SAND'),
    subSurfaceBlockIndex: blockTypeToIndex('SAND'),
    treeDensity: 0.0,
    heightModifier: 0.3,
    baseHeight: 40,
  },
  MOUNTAINS: {
    surfaceBlockIndex: blockTypeToIndex('STONE'),
    subSurfaceBlockIndex: blockTypeToIndex('STONE'),
    treeDensity: 0.02,
    heightModifier: 3.0,
    baseHeight: 80,
  },
  SNOW: {
    surfaceBlockIndex: blockTypeToIndex('SNOW'),
    subSurfaceBlockIndex: blockTypeToIndex('DIRT'),
    treeDensity: 0.05,
    heightModifier: 1.0,
    baseHeight: 64,
  },
  SWAMP: {
    surfaceBlockIndex: blockTypeToIndex('GRASS'),
    subSurfaceBlockIndex: blockTypeToIndex('DIRT'),
    treeDensity: 0.2,
    heightModifier: 0.5,
    baseHeight: 58,
  },
  JUNGLE: {
    surfaceBlockIndex: blockTypeToIndex('GRASS'),
    subSurfaceBlockIndex: blockTypeToIndex('DIRT'),
    treeDensity: 0.5,
    heightModifier: 1.2,
    baseHeight: 64,
  },
}

const COLUMN_COUNT = CHUNK_SIZE * CHUNK_SIZE
const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const TERRAIN_SCALE = 0.02
const BIOME_SCALE = 0.005
const LAKE_NOISE_SCALE = 0.02
const LAKE_THRESHOLD = 0.70
const LAKE_MAX_DEPTH = 18
const LAKE_MIN_DEPTH = 10
const LAKE_SHORE_WIDTH = 0.04
const HEIGHT_VARIATION = 16

export const BIOME_NOISE_PARAMS: Readonly<NoiseOctaveParams> = {
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
}

export const TERRAIN_NOISE_PARAMS: Readonly<NoiseOctaveParams> = {
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
}

const classifyBiome = (temperature: number, humidity: number): TerrainBiome => {
  const isCold = temperature < 0.3
  const isHot = temperature > 0.7
  const isDry = humidity < 0.3
  const isWet = humidity > 0.6

  if (humidity < 0.15) {
    return isCold ? 'SNOW' : 'DESERT'
  }

  if (humidity > 0.85) {
    return temperature > 0.6 ? 'SWAMP' : 'OCEAN'
  }

  if (isCold) {
    return humidity > 0.4 ? 'MOUNTAINS' : 'SNOW'
  }

  if (isHot) {
    return isWet ? 'JUNGLE' : 'DESERT'
  }

  if (isDry) {
    return 'PLAINS'
  }

  if (isWet) {
    return 'FOREST'
  }

  return 'PLAINS'
}

export const calculateSurfaceHeight = (
  noiseVal: number,
  baseHeight: number,
  heightModifier: number,
  heightVariation: number
): number => {
  const terrainHeight = Math.floor(
    baseHeight + (noiseVal - 0.5) * heightVariation * 2 * heightModifier
  )
  return Math.max(1, Math.min(CHUNK_HEIGHT - 2, terrainHeight))
}

const chunkBlockIndexUnchecked = (x: number, y: number, z: number): number => y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE

const fillColumn = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  surfaceY: number,
  props: { surfaceBlockIndex: number; subSurfaceBlockIndex: number; stoneBlockIndex: number }
): void => {
  let idx = chunkBlockIndexUnchecked(lx, 0, lz)
  for (let y = 0; y <= surfaceY; y++, idx++) {
    blocks[idx] = y === surfaceY
      ? props.surfaceBlockIndex
      : y >= surfaceY - 3
        ? props.subSurfaceBlockIndex
        : props.stoneBlockIndex
  }
}

const shouldPlaceTree = (
  treeDensity: number,
  surfaceY: number,
  wx: number,
  wz: number
): { place: boolean; treeRng: number } => {
  if (treeDensity <= 0 || surfaceY <= 5 || surfaceY >= CHUNK_HEIGHT - 10) {
    return { place: false, treeRng: 0 }
  }

  const treeRng = Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453
  const treeProb = treeRng - Math.floor(treeRng)
  return { place: treeProb < treeDensity, treeRng }
}

const placeTree = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  surfaceY: number,
  treeRng: number,
  woodBlockIndex: number,
  leavesBlockIndex: number,
): void => {
  const trunkHeight = 4 + Math.floor((treeRng * 2) % 3)

  let trunkIdx = chunkBlockIndexUnchecked(lx, surfaceY + 1, lz)
  for (let ty = surfaceY + 1; ty <= surfaceY + trunkHeight; ty++, trunkIdx++) {
    blocks[trunkIdx] = woodBlockIndex
  }

  const leafBase = surfaceY + trunkHeight - 1
  for (let dy = 0; dy <= 2; dy++) {
    for (let dlx = -1; dlx <= 1; dlx++) {
      for (let dlz = -1; dlz <= 1; dlz++) {
        const lx2 = lx + dlx
        const lz2 = lz + dlz
        const ly = leafBase + dy
        if (lx2 < 0 || lx2 >= CHUNK_SIZE || lz2 < 0 || lz2 >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT) continue
        const idx = chunkBlockIndexUnchecked(lx2, ly, lz2)
        if (blocks[idx] === 0) blocks[idx] = leavesBlockIndex
      }
    }
  }
}

const validateSampleLength = (name: string, sample: ArrayLike<number>): void => {
  if (sample.length !== COLUMN_COUNT) {
    throw new Error(`Invalid ${name} length: expected ${COLUMN_COUNT}, got ${sample.length}`)
  }
}

export const createTerrainNoiseCoordinates = (coord: ChunkCoord): TerrainNoiseCoordinates => {
  const baseWorldX = coord.x * CHUNK_SIZE
  const baseWorldZ = coord.z * CHUNK_SIZE

  const terrainXs: number[] = []
  terrainXs.length = COLUMN_COUNT
  const terrainZs: number[] = []
  terrainZs.length = COLUMN_COUNT
  const lakeXs: number[] = []
  lakeXs.length = COLUMN_COUNT
  const lakeZs: number[] = []
  lakeZs.length = COLUMN_COUNT
  const temperatureXs: number[] = []
  temperatureXs.length = COLUMN_COUNT
  const temperatureZs: number[] = []
  temperatureZs.length = COLUMN_COUNT
  const humidityXs: number[] = []
  humidityXs.length = COLUMN_COUNT
  const humidityZs: number[] = []
  humidityZs.length = COLUMN_COUNT

  let index = 0
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const x = baseWorldX + lx
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const z = baseWorldZ + lz
      terrainXs[index] = x * TERRAIN_SCALE
      terrainZs[index] = z * TERRAIN_SCALE
      lakeXs[index] = x * LAKE_NOISE_SCALE + 5000
      lakeZs[index] = z * LAKE_NOISE_SCALE + 5000
      temperatureXs[index] = x * BIOME_SCALE
      temperatureZs[index] = z * BIOME_SCALE
      humidityXs[index] = (x + 10000) * BIOME_SCALE
      humidityZs[index] = (z + 10000) * BIOME_SCALE
      index++
    }
  }

  return {
    terrainXs,
    terrainZs,
    lakeXs,
    lakeZs,
    temperatureXs,
    temperatureZs,
    humidityXs,
    humidityZs,
  }
}

export const generateTerrainBlocks = (
  coord: ChunkCoord,
  samples: TerrainNoiseSamples,
  config: TerrainGenerationConfig,
): Uint8Array => {
  validateSampleLength('terrainNoise', samples.terrainNoise)
  validateSampleLength('lakeNoise', samples.lakeNoise)
  validateSampleLength('temperatureNoise', samples.temperatureNoise)
  validateSampleLength('humidityNoise', samples.humidityNoise)

  const stoneBlockIndex = blockTypeToIndex('STONE')
  const waterBlockIndex = blockTypeToIndex('WATER')
  const sandBlockIndex = blockTypeToIndex('SAND')
  const woodBlockIndex = blockTypeToIndex('WOOD')
  const leavesBlockIndex = blockTypeToIndex('LEAVES')

  const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
  const baseWorldX = coord.x * CHUNK_SIZE
  const baseWorldZ = coord.z * CHUNK_SIZE

  let columnIndex = 0
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseWorldX + lx
      const wz = baseWorldZ + lz

      const biome = classifyBiome(samples.temperatureNoise[columnIndex]!, samples.humidityNoise[columnIndex]!)
      const props = BIOME_PROPERTIES[biome]

      const noiseVal = samples.terrainNoise[columnIndex]!
      const initialSurfaceY = calculateSurfaceHeight(noiseVal, props.baseHeight, props.heightModifier, HEIGHT_VARIATION)

      const lakeNoiseVal = biome !== 'OCEAN' ? samples.lakeNoise[columnIndex]! : 0

      let lakeBasinY: number | null = null
      if (biome !== 'OCEAN' && lakeNoiseVal > LAKE_THRESHOLD && initialSurfaceY >= config.lakeLevel) {
        const t = (lakeNoiseVal - LAKE_THRESHOLD) / (1.0 - LAKE_THRESHOLD)
        const lakeDepth = Math.max(LAKE_MIN_DEPTH, Math.floor(t * LAKE_MAX_DEPTH))
        const depressedY = Math.max(config.seaLevel + 1, initialSurfaceY - lakeDepth)
        if (depressedY < config.lakeLevel) {
          lakeBasinY = depressedY
        }
      }
      const surfaceY = lakeBasinY ?? initialSurfaceY

      const isShore = lakeBasinY === null && lakeNoiseVal > LAKE_THRESHOLD - LAKE_SHORE_WIDTH && surfaceY < config.lakeLevel + 4

      fillColumn(
        blocks,
        lx,
        lz,
        surfaceY,
        lakeBasinY !== null
          ? { surfaceBlockIndex: sandBlockIndex, subSurfaceBlockIndex: sandBlockIndex, stoneBlockIndex }
          : isShore
            ? { surfaceBlockIndex: sandBlockIndex, subSurfaceBlockIndex: props.subSurfaceBlockIndex, stoneBlockIndex }
            : { surfaceBlockIndex: props.surfaceBlockIndex, subSurfaceBlockIndex: props.subSurfaceBlockIndex, stoneBlockIndex },
      )

      if (surfaceY < config.seaLevel) {
        for (let y = surfaceY + 1; y <= config.seaLevel; y++) {
          blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex
        }
      } else if (lakeBasinY !== null) {
        for (let y = surfaceY + 1; y <= config.lakeLevel; y++) {
          blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex
        }
      }

      const { place, treeRng } = shouldPlaceTree(props.treeDensity, surfaceY, wx, wz)
      if (place && lakeBasinY === null) {
        placeTree(blocks, lx, lz, surfaceY, treeRng, woodBlockIndex, leavesBlockIndex)
      }

      columnIndex++
    }
  }

  return blocks
}
