import { Array as Arr, Effect, MutableHashMap, Option } from 'effect'
import { blockTypeToIndex, CHUNK_SIZE, CHUNK_HEIGHT, LAKE_LEVEL } from '@ts-minecraft/core'
import { computeColumnYFromValues } from '../density-function'
import { peaksAndValleysFromWeirdness } from '../biome-classifier'
import {
  LAKE_NOISE_SCALE,
  LAKE_THRESHOLD,
  LAKE_SHORE_WIDTH,
  VARIANT_THRESHOLD,
  OVERHANG_NOISE_SCALE,
  OVERHANG_BAND_HEIGHT,
  OVERHANG_THRESHOLD,
} from './constants'
import { computeRuggedness, chunkBlockIndexUnchecked } from './math'
import { computeLakeBasin, resolveSurfaceY, fillWaterForColumn } from './lake-generator'
import { resolveSurfaceProfile, fillColumn } from './surface-resolver'
import { TREE_CANOPY_MARGIN, shouldPlaceTree, placeTree } from './tree-placer'
import { createTreeColumnKey, supportsTreeAtSurface } from './generator-coordinates'
import type {
  TreeColumnContext,
  ColumnState,
  OverhangTarget,
  TreeColumnContextResolverDeps,
  ColumnStateBuildArgs,
} from './generator-types'

export const buildColumnStates = ({
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
  columnStates.length = CHUNK_SIZE * CHUNK_SIZE

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const columnIndex = lx * CHUNK_SIZE + lz
      const terrainIndex = lz * CHUNK_SIZE + lx
      const wx = baseWorldX + lx
      const wz = baseWorldZ + lz
      const { biome, props } = biomeColumns[columnIndex]!
      const initialSurfaceY = initialSurfaceYs[columnIndex]!
      const lakeNoiseVal = biome !== 'OCEAN' ? lakeNoiseVals[columnIndex]! : 0
      const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY)
      const surfaceY = resolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
      /* c8 ignore next 3 */
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

      // Flood oceans, lakes, and rivers with WATER from surfaceY+1 up to the water level.
      // Runs after the solid fill but before cave carving / overhangs / trees: cave-carver
      // protects WATER, overhang/tree passes skip non-air blocks, so water is preserved.
      fillWaterForColumn(blocks, lx, lz, biome, surfaceY, lakeBasinY, blockIndices.waterBlockIndex)

      /* c8 ignore next */
      const surfaceBlock = blocks[chunkBlockIndexUnchecked(lx, surfaceY, lz)] ?? blockIndices.airBlockIndex
      MutableHashMap.set(treeColumnContextCache, createTreeColumnKey(wx, wz), {
        biome,
        props,
        surfaceY,
        hasLakeBasin: Option.isSome(lakeBasinY),
        supportsTree: supportsTreeAtSurface(surfaceBlock, biome, blockIndices),
      })

      columnStates[columnIndex] = { biome, props, surfaceY, lakeBasinY, ruggedness }
    }
  }

  return columnStates
}

export const collectOverhangTargets = (
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
      const columnIndex = lx * CHUNK_SIZE + lz
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
          neighborMaxSurface = Math.max(neighborMaxSurface, columnStates[nx * CHUNK_SIZE + nz]!.surfaceY)
        }
      }

      const supportCeiling = biome === 'MOUNTAINS'
        ? Math.max(neighborMaxSurface + 2, surfaceY + 6)
        : neighborMaxSurface + 2
      /* c8 ignore next */
      if (supportCeiling <= surfaceY + 1) continue

      const bandTop = Math.min(CHUNK_HEIGHT - 2, surfaceY + OVERHANG_BAND_HEIGHT)
      for (let y = surfaceY + 2; y <= bandTop; y++) {
        if (y > supportCeiling) continue
        const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
        if (blocks[blockIndex] !== airBlockIndex) continue
        overhangTargets.push({ lx, lz, y })
        overhangXs.push((baseWorldX + lx) * OVERHANG_NOISE_SCALE)
        overhangYs.push(y * OVERHANG_NOISE_SCALE)
        overhangZs.push((baseWorldZ + lz) * OVERHANG_NOISE_SCALE)
      }
    }
  }

  return { overhangXs, overhangYs, overhangZs, overhangTargets }
}

export const applyOverhangNoise = (
  blocks: Uint8Array,
  overhangTargets: ReadonlyArray<OverhangTarget>,
  overhangNoiseVals: ReadonlyArray<number>,
  columnStates: ReadonlyArray<ColumnState>,
  stoneBlockIndex: number,
  airBlockIndex: number,
): void => {
  Arr.forEach(overhangTargets, ({ lx, lz, y }, index) => {
    const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
    /* c8 ignore next */
    if (blocks[blockIndex] !== airBlockIndex) return

    const { biome, surfaceY } = columnStates[lx * CHUNK_SIZE + lz]!
    const heightFactor = 1 - (y - surfaceY) / OVERHANG_BAND_HEIGHT
    const baseThreshold = biome === 'MOUNTAINS' ? OVERHANG_THRESHOLD - 0.08 : OVERHANG_THRESHOLD
    const threshold = baseThreshold - heightFactor * 0.14
    if (overhangNoiseVals[index]! <= threshold) return

    // Connectivity guard: only place an overhang voxel if it is anchored to existing
    // solid terrain — a solid block directly below OR a solid horizontal neighbor.
    // Without this, the noise filled isolated single voxels in mid-air (the band starts
    // at surfaceY+2, so surfaceY+1 below is always air) → 'floating blocks'. Targets are
    // iterated bottom-up within a column, so a voxel placed at y becomes the support for
    // y+1 (connected overhang columns still grow); the base anchor is the taller cliff
    // neighbor's solid terrain. Chunk edges count as supported to avoid cross-chunk seams.
    const solidAt = (sx: number, sy: number, sz: number): boolean => {
      if (sx < 0 || sx >= CHUNK_SIZE || sz < 0 || sz >= CHUNK_SIZE || sy < 0 || sy >= CHUNK_HEIGHT) return true
      return blocks[chunkBlockIndexUnchecked(sx, sy, sz)] !== airBlockIndex
    }
    const supported =
      solidAt(lx, y - 1, lz) ||
      solidAt(lx - 1, y, lz) || solidAt(lx + 1, y, lz) ||
      solidAt(lx, y, lz - 1) || solidAt(lx, y, lz + 1)
    if (supported) {
      blocks[blockIndex] = stoneBlockIndex
    }
  })
}

export const createTreeColumnContextResolver = ({
  biomeService,
  noiseService,
  treeColumnContextCache,
  blockIndices,
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

    // computeColumnYFromValues expects Minecraft's peaks-and-valleys channel, not raw weirdness.
    const pv = peaksAndValleysFromWeirdness(weirdness)
    const initialSurfaceY = computeColumnYFromValues(continentalness, erosion, pv, jaggedness)
    const lakeBasinY = computeLakeBasin(biome, lakeNoiseVal, initialSurfaceY)
    const surfaceY = resolveSurfaceY(biome, initialSurfaceY, lakeBasinY)
    /* c8 ignore next 3 */
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

    MutableHashMap.set(treeColumnContextCache, cacheKey, context)
    return context
  })
}

export const placeChunkTrees = (
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
