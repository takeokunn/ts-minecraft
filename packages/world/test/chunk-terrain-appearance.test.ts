import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { StorageServicePort } from '@ts-minecraft/world'
import { NoiseServicePort, NoiseService, BiomeService, type BiomeType, ChunkManagerService } from '@ts-minecraft/world'
import type { BiomeProperties } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import {
  makeInMemoryStorage,
  LightEngineNoopLayer,
  buildInlineTerrainPoolLayer,
} from './chunk-manager-test-utils'
import { makeChunkColumnArray, makeTerrainChannelSamples } from './terrain-channel-test-utils'

describe('terrain/chunk-terrain-appearance', () => {
  describe('terrain appearance polish', () => {
    const AIR = 0
    const DIRT = 1
    const STONE = 2
    const WOOD = 3
    const GRASS = 4
    const SAND = 5
    const WATER = 6
    const LEAVES = 7
    const GRAVEL = 10
    const DEFAULT_TREE_PV = 0.2
    // Inverse on the ascending PV branch; keeps point-sampled weirdness aligned with terrainChannels.pv.
    const DEFAULT_TREE_WEIRDNESS = (DEFAULT_TREE_PV + 1) / 3

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    const columnIndex = (lx: number, lz: number): number => lx * CHUNK_SIZE + lz
    const terrainIndex = (lx: number, lz: number): number => lz * CHUNK_SIZE + lx

    const makeBiomeColumn = (biome: BiomeType, treeDensity = 0) => {
      switch (biome) {
        case 'SNOW':
          return {
            biome,
            props: { surfaceBlock: 'SNOW', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.1, humidity: 0.5 },
          } as const
        case 'JUNGLE':
          return {
            biome,
            props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.9, humidity: 0.8 },
          } as const
        case 'FOREST':
          return {
            biome,
            props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.5, humidity: 0.6 },
          } as const
        case 'BEACH':
          return {
            biome,
            props: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity, temperature: 0.7, humidity: 0.55 },
          } as const
        case 'OCEAN':
          return {
            biome,
            props: { surfaceBlock: 'SAND', subSurfaceBlock: 'SAND', treeDensity, temperature: 0.5, humidity: 0.9 },
          } as const
        default:
          return {
            biome,
            props: { surfaceBlock: 'GRASS', subSurfaceBlock: 'DIRT', treeDensity, temperature: 0.5, humidity: 0.3 },
          } as const
      }
    }

    const makeBiomeColumns = (biome: BiomeType, treeDensity = 0): Array<ReturnType<typeof makeBiomeColumn>> =>
      makeChunkColumnArray(() => makeBiomeColumn(biome, treeDensity))

    const makeTerrainChannels = () =>
      makeTerrainChannelSamples({
        continentalness: 0.7,
        erosion: 0.8,
        pv: DEFAULT_TREE_PV,
      })

    const buildCustomTerrainLayer = (
      biomeColumns: ReadonlyArray<{
        biome: BiomeType
        props: BiomeProperties
      }>,
      terrainChannels: {
        continentalness: Float64Array
        erosion: Float64Array
        pv: Float64Array
        jaggedness: Float64Array
      },
    ) => {
      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
      const CustomBiomeLayer = Layer.succeed(
        BiomeService,
        BiomeService.of({
          _tag: '@minecraft/application/BiomeService' as const,
          getBiome: (_x: number, _z: number) => Effect.succeed('PLAINS' as const),
          getBiomeProperties: (biome: BiomeType) => Effect.succeed(makeBiomeColumn(biome).props),
          getTemperature: (_x: number, _z: number) => Effect.succeed(0.5),
          getHumidity: (_x: number, _z: number) => Effect.succeed(0.5),
          getBiomesAndPropertiesForChunk: (_chunkX: number, _chunkZ: number) => Effect.succeed(biomeColumns),
        }),
      )
      const CustomNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.0),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.0)),
          noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.0)),
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0.0),
          erosion: (_x: number, _z: number) => Effect.succeed(0.0),
          weirdness: (_x: number, _z: number) => Effect.succeed(DEFAULT_TREE_WEIRDNESS),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0.0),
          sampleTerrainChannels: (_cx: number, _cz: number) => Effect.succeed(terrainChannels),
        }),
      )

      const TestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(CustomBiomeLayer),
        Layer.provide(CustomNoise),
        Layer.provide(NoiseService.Default),
        Layer.provide(buildInlineTerrainPoolLayer(
          Layer.mergeAll(ChunkService.Default, CustomBiomeLayer, CustomNoise),
        )),
        Layer.provide(LightEngineNoopLayer),
      )

      return { TestLayer, storage }
    }

    const loadChunk = Effect.gen(function* () {
      const service = yield* ChunkManagerService
      return yield* service.getChunk({ x: 0, z: 0 })
    })

    const getGroundY = (blocks: Uint8Array, lx: number, lz: number): number =>
      Option.getOrElse(
        Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i), (y) => {
          const block = blocks[idx(lx, y, lz)]!
          return block !== AIR && block !== WATER && block !== WOOD && block !== LEAVES
        }),
        () => -1,
      )

    const analyzeTree = (blocks: Uint8Array, lx: number, lz: number) => {
      let woodCount = 0
      let leafCount = 0
      let topWoodY = -1
      for (let x = Math.max(0, lx - 2); x <= Math.min(CHUNK_SIZE - 1, lx + 2); x++) {
        for (let z = Math.max(0, lz - 2); z <= Math.min(CHUNK_SIZE - 1, lz + 2); z++) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            const block = blocks[idx(x, y, z)]
            if (block === WOOD) {
              woodCount++
              topWoodY = Math.max(topWoodY, y)
            }
            if (block === LEAVES) {
              leafCount++
            }
          }
        }
      }
      const groundY = getGroundY(blocks, lx, lz)
      return {
        woodCount,
        leafCount,
        trunkHeight: topWoodY - groundY,
      }
    }

    const getSurfaceBlock = (blocks: Uint8Array, lx: number, lz: number): { y: number; block: number } =>
      Option.getOrElse(
        Option.map(
          Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i), (y) => {
            const block = blocks[idx(lx, y, lz)]!
            return block !== AIR && block !== WATER
          }),
          (y) => ({ y, block: blocks[idx(lx, y, lz)]! }),
        ),
        () => ({ y: -1, block: AIR }),
      )

    it('uses biome-driven tree archetypes deterministically', () => {
      const biomeColumns = makeBiomeColumns('PLAINS', 0)
      biomeColumns[columnIndex(3, 3)] = makeBiomeColumn('PLAINS', 1)
      biomeColumns[columnIndex(8, 8)] = makeBiomeColumn('SNOW', 1)
      biomeColumns[columnIndex(12, 12)] = makeBiomeColumn('JUNGLE', 1)
      const terrainChannels = makeTerrainChannels()

      const { TestLayer: layerA } = buildCustomTerrainLayer(biomeColumns, terrainChannels)
      const { TestLayer: layerB } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunkA = yield* loadChunk.pipe(Effect.provide(layerA))
        const chunkB = yield* loadChunk.pipe(Effect.provide(layerB))

        expect(chunkA.blocks).toEqual(chunkB.blocks)

        const oak = analyzeTree(chunkA.blocks, 3, 3)
        const spruce = analyzeTree(chunkA.blocks, 8, 8)
        const jungle = analyzeTree(chunkA.blocks, 12, 12)

        expect(oak.trunkHeight).toBeGreaterThanOrEqual(4)
        expect(oak.trunkHeight).toBeLessThanOrEqual(6)
        expect(spruce.trunkHeight).toBeGreaterThanOrEqual(7)
        expect(jungle.trunkHeight).toBeGreaterThanOrEqual(8)
        expect(spruce.trunkHeight).toBeGreaterThan(oak.trunkHeight)
        expect(jungle.leafCount).toBeGreaterThan(oak.leafCount)
      }))
    })

    it('generates seamless tree canopies across chunk borders instead of suppressing edge trees', () => {
      const biomeColumns = makeBiomeColumns('DESERT', 0)
      biomeColumns[columnIndex(15, 8)] = makeBiomeColumn('FOREST', 1)
      const terrainChannels = makeTerrainChannels()
      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
      const SeamBiomeLayer = Layer.succeed(
        BiomeService,
        BiomeService.of({
          _tag: '@minecraft/application/BiomeService' as const,
          getBiome: (x: number, z: number) => Effect.succeed(x === 15 && z === 8 ? 'FOREST' as const : 'DESERT' as const),
          getBiomeProperties: (biome: BiomeType) => Effect.succeed(makeBiomeColumn(biome, biome === 'FOREST' ? 1 : 0).props),
          getTemperature: (_x: number, _z: number) => Effect.succeed(0.5),
          getHumidity: (_x: number, _z: number) => Effect.succeed(0.5),
          getBiomesAndPropertiesForChunk: (chunkX: number, _chunkZ: number) =>
            Effect.succeed(chunkX === 0 ? biomeColumns : makeBiomeColumns('DESERT', 0)),
        }),
      )
      const SeamNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.0),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) => Effect.succeed(points.map(() => 0.0)),
          noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.0)),
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0.7),
          erosion: (_x: number, _z: number) => Effect.succeed(0.8),
          weirdness: (_x: number, _z: number) => Effect.succeed(DEFAULT_TREE_WEIRDNESS),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0.0),
          sampleTerrainChannels: (_cx: number, _cz: number) => Effect.succeed(terrainChannels),
        }),
      )
      const TestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(SeamBiomeLayer),
        Layer.provide(SeamNoise),
        Layer.provide(NoiseService.Default),
        Layer.provide(buildInlineTerrainPoolLayer(
          Layer.mergeAll(ChunkService.Default, SeamBiomeLayer, SeamNoise),
        )),
        Layer.provide(LightEngineNoopLayer),
      )

      return Effect.runPromise(Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const leftChunk = yield* service.getChunk({ x: 0, z: 0 })
        const rightChunk = yield* service.getChunk({ x: 1, z: 0 })

        const rightBorderTreeBlocks = Arr.filter(Arr.makeBy(CHUNK_HEIGHT, (y) => rightChunk.blocks[idx(0, y, 8)]!), (block) => block === WOOD || block === LEAVES)
        const leftOriginTree = analyzeTree(leftChunk.blocks, 15, 8)

        expect(leftOriginTree.woodCount).toBeGreaterThan(0)
        expect(rightBorderTreeBlocks.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer)))
    })

    it('adds rocky surface variation on rugged highland columns while gentle forest stays grassy', () => {
      const biomeColumns = makeBiomeColumns('FOREST', 0)
      const terrainChannels = makeTerrainChannels()

      terrainChannels.continentalness[terrainIndex(6, 6)] = 0.8
      terrainChannels.erosion[terrainIndex(6, 6)] = -0.8
      terrainChannels.pv[terrainIndex(6, 6)] = 0.9
      terrainChannels.jaggedness[terrainIndex(6, 6)] = 1.0

      terrainChannels.continentalness[terrainIndex(9, 9)] = 0.8
      terrainChannels.erosion[terrainIndex(9, 9)] = 0.9
      terrainChannels.pv[terrainIndex(9, 9)] = 0.5
      terrainChannels.jaggedness[terrainIndex(9, 9)] = 0.0

      const { TestLayer } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunk = yield* loadChunk.pipe(Effect.provide(TestLayer))

        const roughSurface = getSurfaceBlock(chunk.blocks, 6, 6)
        const gentleSurface = getSurfaceBlock(chunk.blocks, 9, 9)

        expect(roughSurface.y).toBeGreaterThan(0)
        expect(gentleSurface.y).toBeGreaterThan(0)
        expect([STONE, GRAVEL]).toContain(roughSurface.block)
        expect(gentleSurface.block).toBe(GRASS)
        expect(chunk.blocks[idx(9, gentleSurface.y - 1, 9)]).toBe(DIRT)
      }))
    })

    it('renders BEACH columns with sand surface and sand sub-surface', () => {
      const biomeColumns = makeBiomeColumns('BEACH', 0)
      const terrainChannels = makeTerrainChannels()
      const { TestLayer } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunk = yield* loadChunk.pipe(Effect.provide(TestLayer))

        const beachSurface = getSurfaceBlock(chunk.blocks, 7, 7)

        expect(beachSurface.y).toBeGreaterThan(0)
        expect(beachSurface.block).toBe(SAND)
        expect(chunk.blocks[idx(7, beachSurface.y - 1, 7)]).toBe(SAND)
      }))
    })

    it('renders OCEAN columns with sand surface and sand sub-surface', () => {
      const biomeColumns = makeBiomeColumns('OCEAN', 0)
      const terrainChannels = makeTerrainChannels()
      const { TestLayer } = buildCustomTerrainLayer(biomeColumns, terrainChannels)

      return Effect.runPromise(Effect.gen(function* () {
        const chunk = yield* loadChunk.pipe(Effect.provide(TestLayer))

        const oceanSurface = getSurfaceBlock(chunk.blocks, 7, 7)

        expect(oceanSurface.y).toBeGreaterThan(0)
        expect(oceanSurface.block).toBe(SAND)
        expect(chunk.blocks[idx(7, oceanSurface.y - 1, 7)]).toBe(SAND)
      }))
    })

  })
})
