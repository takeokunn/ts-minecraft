import { Effect, MutableHashMap } from 'effect'
import { ChunkService } from '../../application/chunk-service'
import type { Chunk } from '../chunk'
import { ChunkCoord, CHUNK_SIZE } from '@ts-minecraft/kernel'
import type { BiomeGeneratorPort } from '../biome-generator-port'
import { NoiseServicePort } from '../noise-service-port'
import { computeColumnY } from '../density-function'
import { carveCaves } from './cave-carver'
import { ORE_REGULAR_INDICES, ORE_DEEPSLATE_INDICES, placeOres } from './ore-generator'
import type { TreeColumnContext } from './generator-types'
import {
  createColumnNoiseCoordinateArrays,
  createCaveGridCoordinateArrays,
  createBlockIndices,
} from './generator-coordinates'
import {
  buildColumnStates,
  collectOverhangTargets,
  applyOverhangNoise,
  createTreeColumnContextResolver,
  placeChunkTrees,
} from './generator-pipeline'

export const generateTerrain = (
  chunkService: ChunkService,
  biomeService: BiomeGeneratorPort,
  noiseService: NoiseServicePort,
  coord: ChunkCoord
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    const blocks = chunk.blocks
    const baseWorldX = coord.x * CHUNK_SIZE
    const baseWorldZ = coord.z * CHUNK_SIZE
    const columnCoords = createColumnNoiseCoordinateArrays(baseWorldX, baseWorldZ)
    const caveGridPoints = createCaveGridCoordinateArrays(baseWorldX, baseWorldZ)
    const blockIndices = createBlockIndices()
    const treeColumnContextCache = MutableHashMap.empty<string, TreeColumnContext>()

    const biomeColumns = yield* biomeService.getBiomesAndPropertiesForChunk(coord.x, coord.z)
    const terrainChannels = yield* noiseService.sampleTerrainChannels(baseWorldX, baseWorldZ)
    const lakeNoiseVals = yield* noiseService.noise2DBatchXY(
      columnCoords.lakeXs,
      columnCoords.lakeZs,
    )
    const graniteNoiseVals = yield* noiseService.noise2DBatchXY(
      columnCoords.graniteXs,
      columnCoords.graniteZs,
    )
    const dioriteNoiseVals = yield* noiseService.noise2DBatchXY(
      columnCoords.dioriteXs,
      columnCoords.dioriteZs,
    )
    const andesiteNoiseVals = yield* noiseService.noise2DBatchXY(
      columnCoords.andesiteXs,
      columnCoords.andesiteZs,
    )
    const initialSurfaceYs = new Int32Array(CHUNK_SIZE * CHUNK_SIZE)
    let surfaceIndex = 0
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        initialSurfaceYs[surfaceIndex] = computeColumnY(terrainChannels, lx, lz)
        surfaceIndex++
      }
    }
    const caveSampleVals = yield* noiseService.noise3DBatchXYZ(
      caveGridPoints.caveXs,
      caveGridPoints.caveYs,
      caveGridPoints.caveZs,
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
