import { Array as Arr, Effect, Metric, MetricBoundaries, Option } from 'effect'
import { ChunkService, Chunk, ChunkCoord, blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/domain'
import { BiomeService } from '@ts-minecraft/biome-classifier'
import type { BiomeType, BiomeProperties } from '@ts-minecraft/biome-classifier'
import { NoiseServicePort } from '@ts-minecraft/noise-generator'
import { SEA_LEVEL, LAKE_LEVEL } from '@ts-minecraft/kernel'
import { computeColumnY, computeColumnYFromValues } from '../density-function'
import {
  LAKE_NOISE_SCALE,
  LAKE_THRESHOLD,
  LAKE_MAX_DEPTH,
  LAKE_MIN_DEPTH,
  LAKE_SHORE_WIDTH,
  RIVER_MAX_CUT,
  RIVER_MIN_CUT,
  RIVER_WATER_LEVEL,
  VARIANT_NOISE_SCALE,
  GRANITE_OFFSET_X,
  GRANITE_OFFSET_Z,
  DIORITE_OFFSET_X,
  DIORITE_OFFSET_Z,
  ANDESITE_OFFSET_X,
  ANDESITE_OFFSET_Z,
  VARIANT_THRESHOLD,
  CAVE_NOISE_SCALE,
  CAVE_SAMPLE_STRIDE,
  OVERHANG_NOISE_SCALE,
  OVERHANG_BAND_HEIGHT,
  OVERHANG_THRESHOLD,
} from './constants'
import { computeRuggedness, chunkBlockIndexUnchecked } from './math'
import { carveCaves } from './cave-carver'
import { ORE_REGULAR_INDICES, ORE_DEEPSLATE_INDICES, placeOres } from './ore-generator'
import { AIR_BLOCK_INDEX, resolveSurfaceProfile, fillColumn } from './surface-resolver'
import { TREE_CANOPY_MARGIN, shouldPlaceTree, placeTree } from './tree-placer'

type TreeColumnContext = {
  readonly biome: BiomeType
  readonly props: BiomeProperties
  readonly surfaceY: number
  readonly hasLakeBasin: boolean
  readonly supportsTree: boolean
}

/**
 * Histogram metric for chunk load duration (generation + storage load) in milliseconds.
 * Buckets: 20 linear buckets from 0ms to 1000ms (width=50ms each).
 */
export const chunkLoadHistogram = Metric.histogram(
  'chunk_load_ms',
  MetricBoundaries.linear({ start: 0, width: 50, count: 20 }),
  'Chunk load duration in milliseconds'
)

const createTreeColumnKey = (wx: number, wz: number): string => `${wx},${wz}`

/**
 * Compute the depressed surface Y for an inland lake basin, or Option.none() if no lake forms.
 *
 * A lake basin requires: non-OCEAN biome, noise above threshold, terrain high enough to depress,
 * and the resulting depression must actually dip below LAKE_LEVEL.
 */
const computeLakeBasin = (
  biome: BiomeType,
  lakeNoiseVal: number,
  initialSurfaceY: number
): Option.Option<number> => {
  if (biome === 'OCEAN' || lakeNoiseVal <= LAKE_THRESHOLD || initialSurfaceY < LAKE_LEVEL) {
    return Option.none()
  }
  const t = (lakeNoiseVal - LAKE_THRESHOLD) / (1.0 - LAKE_THRESHOLD)
  const lakeDepth = Math.max(LAKE_MIN_DEPTH, Math.floor(t * LAKE_MAX_DEPTH))
  const depressedY = Math.max(SEA_LEVEL + 1, initialSurfaceY - lakeDepth)
  return depressedY < LAKE_LEVEL ? Option.some(depressedY) : Option.none()
}

/**
 * Generate terrain for a chunk using noise-based heightmap.
 *
 * Height range: 48-80 blocks (sea level 64)
 * Block assignment:
 *   y > height: AIR
 *   y == height: biome surface block (GRASS, SAND, STONE, etc.)
 *   height-1 >= y >= height-3: biome subsurface block (DIRT, SAND, etc.)
 *   y < height-3: STONE
 *   y == 0: STONE (bedrock-like)
 */
type ColumnNoiseCoordinates = {
  readonly lakeX: number
  readonly lakeZ: number
  readonly graniteX: number
  readonly graniteZ: number
  readonly dioriteX: number
  readonly dioriteZ: number
  readonly andesiteX: number
  readonly andesiteZ: number
}

type CaveGridPoint = {
  readonly x: number
  readonly y: number
  readonly z: number
}

type BlockIndices = {
  readonly stoneBlockIndex: number
  readonly waterBlockIndex: number
  readonly lavaBlockIndex: number
  readonly sandBlockIndex: number
  readonly gravelBlockIndex: number
  readonly bedrockBlockIndex: number
  readonly deepslateBlockIndex: number
  readonly graniteBlockIndex: number
  readonly dioriteBlockIndex: number
  readonly andesiteBlockIndex: number
  readonly airBlockIndex: number
}

type ColumnState = {
  readonly biome: BiomeType
  readonly props: BiomeProperties
  readonly surfaceY: number
  readonly lakeBasinY: Option.Option<number>
  readonly ruggedness: number
}

type OverhangTarget = {
  readonly lx: number
  readonly lz: number
  readonly y: number
}

type TreeColumnContextResolverDeps = {
  readonly biomeService: BiomeService
  readonly noiseService: NoiseServicePort
  readonly treeColumnContextCache: Map<string, TreeColumnContext>
  readonly blockIndices: BlockIndices
}

type ColumnStateBuildArgs = {
  readonly blocks: Uint8Array
  readonly baseWorldX: number
  readonly baseWorldZ: number
  readonly biomeColumns: ReadonlyArray<{ readonly biome: BiomeType; readonly props: BiomeProperties }>
  readonly terrainChannels: Parameters<typeof computeColumnY>[0]
  readonly initialSurfaceYs: ReadonlyArray<number>
  readonly lakeNoiseVals: ReadonlyArray<number>
  readonly graniteNoiseVals: ReadonlyArray<number>
  readonly dioriteNoiseVals: ReadonlyArray<number>
  readonly andesiteNoiseVals: ReadonlyArray<number>
  readonly treeColumnContextCache: Map<string, TreeColumnContext>
  readonly blockIndices: BlockIndices
}

const createColumnNoiseCoordinates = (baseWorldX: number, baseWorldZ: number): ReadonlyArray<ColumnNoiseCoordinates> =>
  Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
    Arr.makeBy(CHUNK_SIZE, (lz) => {
      const x = baseWorldX + lx
      const z = baseWorldZ + lz
      return {
        lakeX: x * LAKE_NOISE_SCALE + 5000,
        lakeZ: z * LAKE_NOISE_SCALE + 5000,
        graniteX: x * VARIANT_NOISE_SCALE + GRANITE_OFFSET_X,
        graniteZ: z * VARIANT_NOISE_SCALE + GRANITE_OFFSET_Z,
        dioriteX: x * VARIANT_NOISE_SCALE + DIORITE_OFFSET_X,
        dioriteZ: z * VARIANT_NOISE_SCALE + DIORITE_OFFSET_Z,
        andesiteX: x * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_X,
        andesiteZ: z * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_Z,
      }
    })
  )

const createCaveGridPoints = (baseWorldX: number, baseWorldZ: number): ReadonlyArray<CaveGridPoint> => {
  const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
  const caveSY = Math.floor(CHUNK_HEIGHT / CAVE_SAMPLE_STRIDE) + 1

  return Arr.flatMap(Arr.makeBy(caveSY, (sy) => sy), (sy) =>
    Arr.flatMap(Arr.makeBy(caveSZ, (sz) => sz), (sz) =>
      Arr.makeBy(caveSX, (sx) => ({
        x: (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
        y: sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE,
        z: (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
      }))
    )
  )
}

const createBlockIndices = (): BlockIndices => ({
  stoneBlockIndex: blockTypeToIndex('STONE'),
  waterBlockIndex: blockTypeToIndex('WATER'),
  lavaBlockIndex: blockTypeToIndex('LAVA'),
  sandBlockIndex: blockTypeToIndex('SAND'),
  gravelBlockIndex: blockTypeToIndex('GRAVEL'),
  bedrockBlockIndex: blockTypeToIndex('BEDROCK'),
  deepslateBlockIndex: blockTypeToIndex('DEEPSLATE'),
  graniteBlockIndex: blockTypeToIndex('GRANITE'),
  dioriteBlockIndex: blockTypeToIndex('DIORITE'),
  andesiteBlockIndex: blockTypeToIndex('ANDESITE'),
  airBlockIndex: AIR_BLOCK_INDEX,
})

const resolveSurfaceY = (biome: BiomeType, initialSurfaceY: number, lakeBasinY: Option.Option<number>): number => {
  const riverCut = biome === 'RIVER'
    ? Math.max(RIVER_MIN_CUT, Math.min(RIVER_MAX_CUT, initialSurfaceY - RIVER_WATER_LEVEL + 1))
    : 0
  const riverSurfaceY = biome === 'RIVER'
    ? Math.max(RIVER_WATER_LEVEL - 1, initialSurfaceY - riverCut)
    : initialSurfaceY

  return Option.getOrElse(lakeBasinY, () => riverSurfaceY)
}

const supportsTreeAtSurface = (
  surfaceBlock: number,
  biome: BiomeType,
  blockIndices: BlockIndices,
): boolean =>
  surfaceBlock !== blockIndices.airBlockIndex
  && surfaceBlock !== blockIndices.waterBlockIndex
  && surfaceBlock !== blockIndices.sandBlockIndex
  && surfaceBlock !== blockIndices.gravelBlockIndex
  && (surfaceBlock !== blockIndices.stoneBlockIndex || biome === 'MOUNTAINS' || biome === 'SNOW')

const fillWaterForColumn = (
  blocks: Uint8Array,
  lx: number,
  lz: number,
  biome: BiomeType,
  surfaceY: number,
  lakeBasinY: Option.Option<number>,
  waterBlockIndex: number,
): void => {
  const waterTopY = biome === 'RIVER'
    ? RIVER_WATER_LEVEL
    : surfaceY < SEA_LEVEL
      ? SEA_LEVEL
      : Option.isSome(lakeBasinY)
        ? LAKE_LEVEL
        : null

  if (waterTopY === null) {
    return
  }

  for (let y = surfaceY + 1; y <= waterTopY; y++) {
    blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex
  }
}

const buildColumnStates = ({
  blocks,
  baseWorldX,
  baseWorldZ,
  biomeColumns,
  terrainChannels,
  initialSurfaceYs,
  lakeNoiseVals,
  graniteNoiseVals,
  dioriteNoiseVals,
  andesiteNoiseVals,
  treeColumnContextCache,
  blockIndices,
}: ColumnStateBuildArgs): ReadonlyArray<ColumnState> => {
  const columnStates: ColumnState[] = []
  let columnIndex = 0

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseWorldX + lx
      const wz = baseWorldZ + lz
      const terrainIndex = lz * CHUNK_SIZE + lx
      const { biome, props } = biomeColumns[columnIndex]!
      const initialSurfaceY = initialSurfaceYs[columnIndex]!
      const lakeNoiseVal = biome !== 'OCEAN' ? lakeNoiseVals[columnIndex]! : 0
      const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY)
      const surfaceY = resolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
      const isShore = Option.isNone(lakeBasinY)
        && lakeNoiseVal > LAKE_THRESHOLD - LAKE_SHORE_WIDTH
        && surfaceY < LAKE_LEVEL + 4
      const ruggedness = computeRuggedness(
        terrainChannels.erosion[terrainIndex]!,
        terrainChannels.jaggedness[terrainIndex]!,
      )
      const graniteFlag = graniteNoiseVals[columnIndex]! > VARIANT_THRESHOLD
      const dioriteFlag = !graniteFlag && dioriteNoiseVals[columnIndex]! > VARIANT_THRESHOLD
      const andesiteFlag = !graniteFlag && !dioriteFlag && andesiteNoiseVals[columnIndex]! > VARIANT_THRESHOLD
      const surfaceProfile = resolveSurfaceProfile({
        biome,
        defaultSurfaceBlockIndex: blockTypeToIndex(props.surfaceBlock),
        defaultSubSurfaceBlockIndex: blockTypeToIndex(props.subSurfaceBlock),
        surfaceY,
        ruggedness,
        hasLakeBasin: Option.isSome(lakeBasinY),
        isShore,
        sandBlockIndex: blockIndices.sandBlockIndex,
        gravelBlockIndex: blockIndices.gravelBlockIndex,
        stoneBlockIndex: blockIndices.stoneBlockIndex,
      })

      fillColumn(blocks, lx, lz, wx, wz, surfaceY, {
        ...surfaceProfile,
        stoneBlockIndex: blockIndices.stoneBlockIndex,
        bedrockBlockIndex: blockIndices.bedrockBlockIndex,
        deepslateBlockIndex: blockIndices.deepslateBlockIndex,
        graniteBlockIndex: blockIndices.graniteBlockIndex,
        dioriteBlockIndex: blockIndices.dioriteBlockIndex,
        andesiteBlockIndex: blockIndices.andesiteBlockIndex,
        graniteFlag,
        dioriteFlag,
        andesiteFlag,
      })

      fillWaterForColumn(blocks, lx, lz, biome, surfaceY, lakeBasinY, blockIndices.waterBlockIndex)

      const surfaceBlock = blocks[chunkBlockIndexUnchecked(lx, surfaceY, lz)] ?? blockIndices.airBlockIndex
      treeColumnContextCache.set(createTreeColumnKey(wx, wz), {
        biome,
        props,
        surfaceY,
        hasLakeBasin: Option.isSome(lakeBasinY),
        supportsTree: supportsTreeAtSurface(surfaceBlock, biome, blockIndices),
      })

      columnStates.push({
        biome,
        props,
        surfaceY,
        lakeBasinY,
        ruggedness,
      })

      columnIndex++
    }
  }

  return columnStates
}

const collectOverhangTargets = (
  blocks: Uint8Array,
  baseWorldX: number,
  baseWorldZ: number,
  columnStates: ReadonlyArray<ColumnState>,
  airBlockIndex: number,
): {
  readonly overhangXs: ReadonlyArray<number>
  readonly overhangYs: ReadonlyArray<number>
  readonly overhangZs: ReadonlyArray<number>
  readonly overhangTargets: ReadonlyArray<OverhangTarget>
} => {
  const overhangXs: number[] = []
  const overhangYs: number[] = []
  const overhangZs: number[] = []
  const overhangTargets: OverhangTarget[] = []

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const columnIndex = lz * CHUNK_SIZE + lx
      const { biome, ruggedness, surfaceY } = columnStates[columnIndex]!
      const eligible = biome === 'MOUNTAINS' || ruggedness >= 0.58
      if (!eligible) continue

      let neighborMaxSurface = surfaceY
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0) continue
          const nx = lx + dx
          const nz = lz + dz
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue
          neighborMaxSurface = Math.max(neighborMaxSurface, columnStates[nz * CHUNK_SIZE + nx]!.surfaceY)
        }
      }

      const supportCeiling = biome === 'MOUNTAINS'
        ? Math.max(neighborMaxSurface + 2, surfaceY + 6)
        : neighborMaxSurface + 2
      if (supportCeiling <= surfaceY + 1) continue

      const bandTop = Math.min(CHUNK_HEIGHT - 2, surfaceY + OVERHANG_BAND_HEIGHT)
      for (let y = surfaceY + 2; y <= bandTop; y++) {
        if (y > supportCeiling) continue
        const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
        if (blocks[blockIndex] !== airBlockIndex) continue
        overhangXs.push((baseWorldX + lx) * OVERHANG_NOISE_SCALE)
        overhangYs.push(y * OVERHANG_NOISE_SCALE)
        overhangZs.push((baseWorldZ + lz) * OVERHANG_NOISE_SCALE)
        overhangTargets.push({ lx, lz, y })
      }
    }
  }

  return { overhangXs, overhangYs, overhangZs, overhangTargets }
}

const applyOverhangNoise = (
  blocks: Uint8Array,
  overhangTargets: ReadonlyArray<OverhangTarget>,
  overhangNoiseVals: ReadonlyArray<number>,
  columnStates: ReadonlyArray<ColumnState>,
  stoneBlockIndex: number,
  airBlockIndex: number,
): void => {
  Arr.forEach(overhangTargets, ({ lx, lz, y }, index) => {
    const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
    if (blocks[blockIndex] !== airBlockIndex) return

    const { biome, surfaceY } = columnStates[lz * CHUNK_SIZE + lx]!
    const heightFactor = 1 - (y - surfaceY) / OVERHANG_BAND_HEIGHT
    const baseThreshold = biome === 'MOUNTAINS' ? OVERHANG_THRESHOLD - 0.08 : OVERHANG_THRESHOLD
    const threshold = baseThreshold - heightFactor * 0.14
    if (overhangNoiseVals[index]! > threshold) {
      blocks[blockIndex] = stoneBlockIndex
    }
  })
}

const createTreeColumnContextResolver = ({
  biomeService,
  noiseService,
  treeColumnContextCache,
  blockIndices,
}: TreeColumnContextResolverDeps) => (wx: number, wz: number): Effect.Effect<TreeColumnContext, never> =>
  Effect.gen(function* () {
    const cacheKey = createTreeColumnKey(wx, wz)
    const cached = treeColumnContextCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const [biome, props, continentalness, erosion, pv, jaggedness, lakeNoiseVal] = yield* Effect.all([
      biomeService.getBiome(wx, wz),
      biomeService.getBiome(wx, wz).pipe(Effect.flatMap((resolvedBiome) => biomeService.getBiomeProperties(resolvedBiome))),
      noiseService.continentalness(wx, wz),
      noiseService.erosion(wx, wz),
      noiseService.weirdness(wx, wz),
      noiseService.jaggedness(wx, wz),
      noiseService.noise2D(wx * LAKE_NOISE_SCALE + 5000, wz * LAKE_NOISE_SCALE + 5000),
    ], { concurrency: 'unbounded' })

    const initialSurfaceY = computeColumnYFromValues(continentalness, erosion, pv, jaggedness)
    const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY)
    const surfaceY = resolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
    const isShore = Option.isNone(lakeBasinY)
      && lakeNoiseVal > LAKE_THRESHOLD - LAKE_SHORE_WIDTH
      && surfaceY < LAKE_LEVEL + 4
    const ruggedness = computeRuggedness(erosion, jaggedness)
    const surfaceProfile = resolveSurfaceProfile({
      biome,
      defaultSurfaceBlockIndex: blockTypeToIndex(props.surfaceBlock),
      defaultSubSurfaceBlockIndex: blockTypeToIndex(props.subSurfaceBlock),
      surfaceY,
      ruggedness,
      hasLakeBasin: Option.isSome(lakeBasinY),
      isShore,
      sandBlockIndex: blockIndices.sandBlockIndex,
      gravelBlockIndex: blockIndices.gravelBlockIndex,
      stoneBlockIndex: blockIndices.stoneBlockIndex,
    })

    const context: TreeColumnContext = {
      biome,
      props,
      surfaceY,
      hasLakeBasin: Option.isSome(lakeBasinY),
      supportsTree: supportsTreeAtSurface(surfaceProfile.surfaceBlockIndex, biome, blockIndices),
    }

    treeColumnContextCache.set(cacheKey, context)
    return context
  })

const placeChunkTrees = (
  blocks: Uint8Array,
  baseWorldX: number,
  baseWorldZ: number,
  resolveTreeColumnContext: (wx: number, wz: number) => Effect.Effect<TreeColumnContext, never>,
): Effect.Effect<void, never> =>
  Effect.forEach(
    Arr.makeBy(CHUNK_SIZE + TREE_CANOPY_MARGIN * 2, (index) => index - TREE_CANOPY_MARGIN),
    (originLx) =>
      Effect.forEach(
        Arr.makeBy(CHUNK_SIZE + TREE_CANOPY_MARGIN * 2, (index) => index - TREE_CANOPY_MARGIN),
        (originLz) =>
          Effect.gen(function* () {
            const wx = baseWorldX + originLx
            const wz = baseWorldZ + originLz
            const context = yield* resolveTreeColumnContext(wx, wz)
            const { place, treeRng } = shouldPlaceTree(context.props.treeDensity, context.surfaceY, wx, wz)
            if (place && !context.hasLakeBasin && context.supportsTree) {
              placeTree(blocks, originLx, originLz, context.surfaceY, context.biome, treeRng)
            }
          }),
        { concurrency: 1 },
      ),
    { concurrency: 1 },
  )
export const generateTerrain = (
  chunkService: ChunkService,
  biomeService: BiomeService,
  noiseService: NoiseServicePort,
  coord: ChunkCoord
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    const blocks = new Uint8Array(chunk.blocks)
    const baseWorldX = coord.x * CHUNK_SIZE
    const baseWorldZ = coord.z * CHUNK_SIZE
    const columnCoords = createColumnNoiseCoordinates(baseWorldX, baseWorldZ)
    const caveGridPoints = createCaveGridPoints(baseWorldX, baseWorldZ)
    const blockIndices = createBlockIndices()
    const treeColumnContextCache = new Map<string, TreeColumnContext>()

    const biomeColumns = yield* biomeService.getBiomesAndPropertiesForChunk(coord.x, coord.z)
    const terrainChannels = yield* noiseService.sampleTerrainChannels(baseWorldX, baseWorldZ)
    const lakeNoiseVals = yield* noiseService.noise2DBatchXY(
      Arr.map(columnCoords, (column) => column.lakeX),
      Arr.map(columnCoords, (column) => column.lakeZ),
    )
    const graniteNoiseVals = yield* noiseService.noise2DBatchXY(
      Arr.map(columnCoords, (column) => column.graniteX),
      Arr.map(columnCoords, (column) => column.graniteZ),
    )
    const dioriteNoiseVals = yield* noiseService.noise2DBatchXY(
      Arr.map(columnCoords, (column) => column.dioriteX),
      Arr.map(columnCoords, (column) => column.dioriteZ),
    )
    const andesiteNoiseVals = yield* noiseService.noise2DBatchXY(
      Arr.map(columnCoords, (column) => column.andesiteX),
      Arr.map(columnCoords, (column) => column.andesiteZ),
    )
    const initialSurfaceYs = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
      Arr.makeBy(CHUNK_SIZE, (lz) => computeColumnY(terrainChannels, lx, lz))
    )
    const caveSampleVals = yield* noiseService.noise3DBatchXYZ(
      Arr.map(caveGridPoints, (point) => point.x),
      Arr.map(caveGridPoints, (point) => point.y),
      Arr.map(caveGridPoints, (point) => point.z),
    )

    const columnStates = buildColumnStates({
      blocks,
      baseWorldX,
      baseWorldZ,
      biomeColumns,
      terrainChannels,
      initialSurfaceYs,
      lakeNoiseVals,
      graniteNoiseVals,
      dioriteNoiseVals,
      andesiteNoiseVals,
      treeColumnContextCache,
      blockIndices,
    })

    const { overhangXs, overhangYs, overhangZs, overhangTargets } = collectOverhangTargets(
      blocks,
      baseWorldX,
      baseWorldZ,
      columnStates,
      blockIndices.airBlockIndex,
    )

    carveCaves(
      blocks,
      caveSampleVals,
      blockIndices.airBlockIndex,
      blockIndices.waterBlockIndex,
      blockIndices.bedrockBlockIndex,
      blockIndices.lavaBlockIndex,
    )

    if (overhangTargets.length > 0) {
      const overhangNoiseVals = yield* noiseService.noise3DBatchXYZ(overhangXs, overhangYs, overhangZs)
      applyOverhangNoise(
        blocks,
        overhangTargets,
        overhangNoiseVals,
        columnStates,
        blockIndices.stoneBlockIndex,
        blockIndices.airBlockIndex,
      )
    }

    placeOres(blocks, baseWorldX, baseWorldZ, {
      stoneBlockIndex: blockIndices.stoneBlockIndex,
      deepslateBlockIndex: blockIndices.deepslateBlockIndex,
      regular: ORE_REGULAR_INDICES,
      deepslate: ORE_DEEPSLATE_INDICES,
    })

    const resolveTreeColumnContext = createTreeColumnContextResolver({
      biomeService,
      noiseService,
      treeColumnContextCache,
      blockIndices,
    })

    yield* placeChunkTrees(blocks, baseWorldX, baseWorldZ, resolveTreeColumnContext)

    return { ...chunk, blocks }
  })
