import { Array as Arr, Effect, Metric, MetricBoundaries, Option } from 'effect'
import { ChunkService, Chunk, ChunkCoord, blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'
import { BiomeService } from '@/application/biome/biome-service'
import type { BiomeType, BiomeProperties } from '@/application/biome/biome-service'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { SEA_LEVEL, LAKE_LEVEL } from '@/application/constants'
import { computeColumnY, computeColumnYFromValues } from '@/application/terrain/density-function'
import {
  LAKE_NOISE_SCALE,
  LAKE_THRESHOLD,
  LAKE_MAX_DEPTH,
  LAKE_MIN_DEPTH,
  LAKE_SHORE_WIDTH,
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
  ORE_REGULAR_INDICES,
  ORE_DEEPSLATE_INDICES,
  OVERHANG_NOISE_SCALE,
  OVERHANG_BAND_HEIGHT,
  OVERHANG_THRESHOLD,
} from './constants'
import { computeRuggedness, chunkBlockIndexUnchecked } from './math'
import { carveCaves } from './cave-carver'
import { placeOres } from './ore-generator'
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

    // Build flattened noise coordinate arrays for batch sampling (row-major: lx outer, lz inner)
    const columnCoords = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.makeBy(CHUNK_SIZE, lz => {
        const x = baseWorldX + lx
        const z = baseWorldZ + lz
        return {
          lakeX:    x * LAKE_NOISE_SCALE + 5000,
          lakeZ:    z * LAKE_NOISE_SCALE + 5000,
          graniteX: x * VARIANT_NOISE_SCALE + GRANITE_OFFSET_X,
          graniteZ: z * VARIANT_NOISE_SCALE + GRANITE_OFFSET_Z,
          dioriteX: x * VARIANT_NOISE_SCALE + DIORITE_OFFSET_X,
          dioriteZ: z * VARIANT_NOISE_SCALE + DIORITE_OFFSET_Z,
          andesiteX: x * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_X,
          andesiteZ: z * VARIANT_NOISE_SCALE + ANDESITE_OFFSET_Z,
        }
      })
    )
    const lakeNoiseXs    = Arr.map(columnCoords, c => c.lakeX)
    const lakeNoiseZs    = Arr.map(columnCoords, c => c.lakeZ)
    const graniteNoiseXs = Arr.map(columnCoords, c => c.graniteX)
    const graniteNoiseZs = Arr.map(columnCoords, c => c.graniteZ)
    const dioriteNoiseXs = Arr.map(columnCoords, c => c.dioriteX)
    const dioriteNoiseZs = Arr.map(columnCoords, c => c.dioriteZ)
    const andesiteNoiseXs = Arr.map(columnCoords, c => c.andesiteX)
    const andesiteNoiseZs = Arr.map(columnCoords, c => c.andesiteZ)

    const biomeColumns = yield* biomeService.getBiomesAndPropertiesForChunk(coord.x, coord.z)
    const terrainChannels = yield* noiseService.sampleTerrainChannels(baseWorldX, baseWorldZ)
    const lakeNoiseVals = yield* noiseService.noise2DBatchXY(lakeNoiseXs, lakeNoiseZs)
    const graniteNoiseVals = yield* noiseService.noise2DBatchXY(graniteNoiseXs, graniteNoiseZs)
    const dioriteNoiseVals = yield* noiseService.noise2DBatchXY(dioriteNoiseXs, dioriteNoiseZs)
    const andesiteNoiseVals = yield* noiseService.noise2DBatchXY(andesiteNoiseXs, andesiteNoiseZs)

    const initialSurfaceYs = Arr.flatMap(Arr.makeBy(CHUNK_SIZE, lx => lx), lx =>
      Arr.makeBy(CHUNK_SIZE, lz => computeColumnY(terrainChannels, lx, lz))
    )

    const caveSX = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
    const caveSZ = Math.floor(CHUNK_SIZE / CAVE_SAMPLE_STRIDE) + 1
    const caveSY = Math.floor(CHUNK_HEIGHT / CAVE_SAMPLE_STRIDE) + 1

    // Cave grid: sy (Y-fastest outer) → sz → sx (X-fastest inner) to match carveCaves stride order
    const caveGridPoints = Arr.flatMap(Arr.makeBy(caveSY, sy => sy), sy =>
      Arr.flatMap(Arr.makeBy(caveSZ, sz => sz), sz =>
        Arr.makeBy(caveSX, sx => ({
          x: (baseWorldX + sx * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
          y: sy * CAVE_SAMPLE_STRIDE * CAVE_NOISE_SCALE,
          z: (baseWorldZ + sz * CAVE_SAMPLE_STRIDE) * CAVE_NOISE_SCALE,
        }))
      )
    )
    const caveXs = Arr.map(caveGridPoints, p => p.x)
    const caveYs = Arr.map(caveGridPoints, p => p.y)
    const caveZs = Arr.map(caveGridPoints, p => p.z)
    const caveSampleVals = yield* noiseService.noise3DBatchXYZ(caveXs, caveYs, caveZs)

    const stoneBlockIndex = blockTypeToIndex('STONE')
    const waterBlockIndex = blockTypeToIndex('WATER')
    const sandBlockIndex = blockTypeToIndex('SAND')
    const gravelBlockIndex = blockTypeToIndex('GRAVEL')
    const bedrockBlockIndex = blockTypeToIndex('BEDROCK')
    const deepslateBlockIndex = blockTypeToIndex('DEEPSLATE')
    const graniteBlockIndex = blockTypeToIndex('GRANITE')
    const dioriteBlockIndex = blockTypeToIndex('DIORITE')
    const andesiteBlockIndex = blockTypeToIndex('ANDESITE')
    const airBlockIndex = AIR_BLOCK_INDEX

    const columnSurfaceY: number[] = []
    const columnLakeBasin: Array<Option.Option<number>> = []
    const columnTreeDensity: number[] = []
    const columnRuggedness: number[] = []
    const columnBiome: BiomeType[] = []
    const treeColumnContextCache = new Map<string, TreeColumnContext>()

    let columnIndex = 0
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = baseWorldX + lx
        const wz = baseWorldZ + lz
        const terrainIndex = lz * CHUNK_SIZE + lx

        const { biome, props } = biomeColumns[columnIndex]!
        const defaultSurfaceBlockIndex = blockTypeToIndex(props.surfaceBlock)
        const defaultSubSurfaceBlockIndex = blockTypeToIndex(props.subSurfaceBlock)
        const initialSurfaceY = initialSurfaceYs[columnIndex]!

        const lakeNoiseVal = biome !== 'OCEAN' ? lakeNoiseVals[columnIndex]! : 0

        const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY)
        const surfaceY = Option.getOrElse(lakeBasinY, () => initialSurfaceY)

        const isShore = Option.isNone(lakeBasinY)
          && lakeNoiseVal > LAKE_THRESHOLD - LAKE_SHORE_WIDTH
          && surfaceY < LAKE_LEVEL + 4

        const graniteFlag = graniteNoiseVals[columnIndex]! > VARIANT_THRESHOLD
        const dioriteFlag = !graniteFlag && dioriteNoiseVals[columnIndex]! > VARIANT_THRESHOLD
        const andesiteFlag = !graniteFlag && !dioriteFlag && andesiteNoiseVals[columnIndex]! > VARIANT_THRESHOLD
        const ruggedness = computeRuggedness(
          terrainChannels.erosion[terrainIndex]!,
          terrainChannels.jaggedness[terrainIndex]!,
        )
        const surfaceProfile = resolveSurfaceProfile({
          biome,
          defaultSurfaceBlockIndex,
          defaultSubSurfaceBlockIndex,
          surfaceY,
          ruggedness,
          hasLakeBasin: Option.isSome(lakeBasinY),
          isShore,
          sandBlockIndex,
          gravelBlockIndex,
          stoneBlockIndex,
        })

        fillColumn(
          blocks,
          lx,
          lz,
          wx,
          wz,
          surfaceY,
          {
            ...surfaceProfile,
            stoneBlockIndex,
            bedrockBlockIndex,
            deepslateBlockIndex,
            graniteBlockIndex,
            dioriteBlockIndex,
            andesiteBlockIndex,
            graniteFlag,
            dioriteFlag,
            andesiteFlag,
          },
        )

        if (surfaceY < SEA_LEVEL) {
          for (let y = surfaceY + 1; y <= SEA_LEVEL; y++) {
            blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex
          }
        } else if (Option.isSome(lakeBasinY)) {
          for (let y = surfaceY + 1; y <= LAKE_LEVEL; y++) {
            blocks[chunkBlockIndexUnchecked(lx, y, lz)] = waterBlockIndex
          }
        }

        columnSurfaceY[columnIndex] = surfaceY
        columnLakeBasin[columnIndex] = lakeBasinY
        columnTreeDensity[columnIndex] = props.treeDensity
        columnRuggedness[columnIndex] = ruggedness
        columnBiome[columnIndex] = biome
        const surfaceIdx = chunkBlockIndexUnchecked(lx, surfaceY, lz)
        const surfaceBlock = blocks[surfaceIdx]
        const supportsTree = surfaceBlock !== airBlockIndex
          && surfaceBlock !== waterBlockIndex
          && surfaceBlock !== sandBlockIndex
          && surfaceBlock !== gravelBlockIndex
          && (surfaceBlock !== stoneBlockIndex || biome === 'MOUNTAINS' || biome === 'SNOW')
        treeColumnContextCache.set(createTreeColumnKey(wx, wz), {
          biome,
          props,
          surfaceY,
          hasLakeBasin: Option.isSome(lakeBasinY),
          supportsTree,
        })
        columnIndex++
      }
    }

    const overhangXs: number[] = []
    const overhangYs: number[] = []
    const overhangZs: number[] = []
    const overhangTargets: Array<{ readonly lx: number; readonly lz: number; readonly y: number }> = []

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const i = lz * CHUNK_SIZE + lx
        const biome = columnBiome[i]!
        const ruggedness = columnRuggedness[i]!
        const surfaceY = columnSurfaceY[i]!
        const eligible = biome === 'MOUNTAINS' || ruggedness >= 0.58
        if (!eligible) continue

        let neighborMaxSurface = surfaceY
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) continue
            const nx = lx + dx
            const nz = lz + dz
            if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue
            neighborMaxSurface = Math.max(neighborMaxSurface, columnSurfaceY[nz * CHUNK_SIZE + nx]!)
          }
        }

        const supportCeiling = biome === 'MOUNTAINS'
          ? Math.max(neighborMaxSurface + 2, surfaceY + 6)
          : neighborMaxSurface + 2
        if (supportCeiling <= surfaceY + 1) continue

        const bandTop = Math.min(CHUNK_HEIGHT - 2, surfaceY + OVERHANG_BAND_HEIGHT)
        for (let y = surfaceY + 2; y <= bandTop; y++) {
          if (y > supportCeiling) continue
          const idx = chunkBlockIndexUnchecked(lx, y, lz)
          if (blocks[idx] !== airBlockIndex) continue
          overhangXs.push((baseWorldX + lx) * OVERHANG_NOISE_SCALE)
          overhangYs.push(y * OVERHANG_NOISE_SCALE)
          overhangZs.push((baseWorldZ + lz) * OVERHANG_NOISE_SCALE)
          overhangTargets.push({ lx, lz, y })
        }
      }
    }

    carveCaves(blocks, caveSampleVals, airBlockIndex, waterBlockIndex, bedrockBlockIndex)

    if (overhangTargets.length > 0) {
      const overhangNoiseVals = yield* noiseService.noise3DBatchXYZ(overhangXs, overhangYs, overhangZs)
      Arr.forEach(overhangTargets, ({ lx, lz, y }, index) => {
        const idx = chunkBlockIndexUnchecked(lx, y, lz)
        if (blocks[idx] !== airBlockIndex) return

        const surfaceY = columnSurfaceY[lz * CHUNK_SIZE + lx]!
        const heightFactor = 1 - (y - surfaceY) / OVERHANG_BAND_HEIGHT
        const baseThreshold = columnBiome[lz * CHUNK_SIZE + lx]! === 'MOUNTAINS' ? OVERHANG_THRESHOLD - 0.08 : OVERHANG_THRESHOLD
        const threshold = baseThreshold - heightFactor * 0.14
        if (overhangNoiseVals[index]! > threshold) {
          blocks[idx] = stoneBlockIndex
        }
      })
    }

    placeOres(blocks, baseWorldX, baseWorldZ, {
      stoneBlockIndex,
      deepslateBlockIndex,
      regular: ORE_REGULAR_INDICES,
      deepslate: ORE_DEEPSLATE_INDICES,
    })

    const resolveTreeColumnContext = (wx: number, wz: number): Effect.Effect<TreeColumnContext, never> =>
      Effect.gen(function* () {
        const cached = treeColumnContextCache.get(createTreeColumnKey(wx, wz))
        if (cached) return cached

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
        const surfaceY = Option.getOrElse(lakeBasinY, () => initialSurfaceY)
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
          sandBlockIndex,
          gravelBlockIndex,
          stoneBlockIndex,
        })
        const supportsTree = surfaceProfile.surfaceBlockIndex !== airBlockIndex
          && surfaceProfile.surfaceBlockIndex !== waterBlockIndex
          && surfaceProfile.surfaceBlockIndex !== sandBlockIndex
          && surfaceProfile.surfaceBlockIndex !== gravelBlockIndex
          && (surfaceProfile.surfaceBlockIndex !== stoneBlockIndex || biome === 'MOUNTAINS' || biome === 'SNOW')

        const context: TreeColumnContext = {
          biome,
          props,
          surfaceY,
          hasLakeBasin: Option.isSome(lakeBasinY),
          supportsTree,
        }
        treeColumnContextCache.set(createTreeColumnKey(wx, wz), context)
        return context
      })

    yield* Effect.forEach(
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

    return { ...chunk, blocks }
  })
