import { Effect, MutableHashMap, Option } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE } from '@ts-minecraft/core'
import { computeColumnYFromValues } from '../density-function'
import { peaksAndValleysFromWeirdness } from '../biome-classifier'
import { LAKE_NOISE_SCALE } from './constants'
import { computeLakeBasin, resolveSurfaceY } from './lake-generator'
import { createTreeColumnKey, supportsTreeAtSurface } from './generator-coordinates'
import { DEFAULT_TERRAIN_LEVELS, type TerrainLevels } from './generator-types'
import type { TreeColumnContext, TreeColumnContextResolverDeps } from './generator-types'
import { isLakeShoreColumn } from './generator-pipeline-model'
import { computeRuggedness } from './math'
import { resolveSurfaceProfile } from './surface-resolver'
import { TREE_CANOPY_MARGIN, placeTree, shouldPlaceTree } from './tree-placer'

const buildTreeColumnContext = (
  biome: TreeColumnContext['biome'],
  props: TreeColumnContext['props'],
  surfaceY: number,
  lakeBasinY: ReturnType<typeof computeLakeBasin>,
  lakeNoiseVal: number,
  hasLakeBasin: boolean,
  blockIndices: TreeColumnContextResolverDeps['blockIndices'],
  ruggedness: number,
  terrainLevels: TerrainLevels,
): TreeColumnContext => {
  const surfaceProfile = resolveSurfaceProfile({
    biome,
    defaultSurfaceBlockIndex: blockTypeToIndex(props.surfaceBlock),
    defaultSubSurfaceBlockIndex: blockTypeToIndex(props.subSurfaceBlock),
    surfaceY,
    ruggedness,
    hasLakeBasin,
    isShore: isLakeShoreColumn(lakeBasinY, lakeNoiseVal, surfaceY, terrainLevels),
    sandBlockIndex: blockIndices.sandBlockIndex,
    gravelBlockIndex: blockIndices.gravelBlockIndex,
    stoneBlockIndex: blockIndices.stoneBlockIndex,
    terrainLevels,
  })

  return {
    biome,
    props,
    surfaceY,
    hasLakeBasin,
    supportsTree: supportsTreeAtSurface(surfaceProfile.surfaceBlockIndex, biome, blockIndices),
  }
}

export const createTreeColumnContextResolver = ({
  biomeService,
  noiseService,
  treeColumnContextCache,
  blockIndices,
  terrainLevels = DEFAULT_TERRAIN_LEVELS,
}: TreeColumnContextResolverDeps) => (wx: number, wz: number): Effect.Effect<TreeColumnContext, never> => {
  const cacheKey = createTreeColumnKey(wx, wz)
  const cached = Option.getOrNull(MutableHashMap.get(treeColumnContextCache, cacheKey))
  if (cached !== null) return Effect.succeed(cached)
  return Effect.gen(function* () {
    const biome = yield* biomeService.getBiome(wx, wz)
    const props = yield* biomeService.getBiomeProperties(biome)
    const continentalness = yield* noiseService.continentalness(wx, wz)
    const erosion = yield* noiseService.erosion(wx, wz)
    const weirdness = yield* noiseService.weirdness(wx, wz)
    const jaggedness = yield* noiseService.jaggedness(wx, wz)
    const lakeNoiseVal = yield* noiseService.noise2D(wx * LAKE_NOISE_SCALE + 5000, wz * LAKE_NOISE_SCALE + 5000)

    const pv = peaksAndValleysFromWeirdness(weirdness)
    const initialSurfaceY = computeColumnYFromValues(continentalness, erosion, pv, jaggedness)
    const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY, terrainLevels)
    const surfaceY = resolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
    const ruggedness = computeRuggedness(erosion, jaggedness, continentalness, pv)
    const context = buildTreeColumnContext(
      biome,
      props,
      surfaceY,
      lakeBasinY,
      lakeNoiseVal,
      Option.isSome(lakeBasinY),
      blockIndices,
      ruggedness,
      terrainLevels,
    )

    MutableHashMap.set(treeColumnContextCache, cacheKey, context)
    return context
  })
}

export const placeChunkTrees = (
  blocks: Uint8Array,
  baseWorldX: number,
  baseWorldZ: number,
  resolveTreeColumnContext: (wx: number, wz: number) => Effect.Effect<TreeColumnContext, never>,
  terrainLevels: TerrainLevels = DEFAULT_TERRAIN_LEVELS,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const minOrigin = -TREE_CANOPY_MARGIN
    const maxOrigin = CHUNK_SIZE + TREE_CANOPY_MARGIN
    for (let originLx = minOrigin; originLx < maxOrigin; originLx++) {
      for (let originLz = minOrigin; originLz < maxOrigin; originLz++) {
        const wx = baseWorldX + originLx
        const wz = baseWorldZ + originLz
        const context = yield* resolveTreeColumnContext(wx, wz)
        const { place, treeRng } = shouldPlaceTree(context.props.treeDensity, context.surfaceY, wx, wz, terrainLevels)
        if (place && !context.hasLakeBasin && context.supportsTree) {
          placeTree(blocks, originLx, originLz, context.surfaceY, context.biome, treeRng, terrainLevels)
        }
      }
    }
  })
