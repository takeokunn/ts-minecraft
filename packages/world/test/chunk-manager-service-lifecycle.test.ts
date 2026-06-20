import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option, TestClock, TestContext } from 'effect'
import {
  ChunkManagerService,
  RENDER_DISTANCE,
  MAX_CACHED_CHUNKS,
  getChunksInRenderDistance,
} from '@ts-minecraft/world'
import { CHUNK_SIZE, DEFAULT_WORLD_ID, WorldId } from '@ts-minecraft/core'
import {
  EXPECTED_BLOCKS_LENGTH,
  buildTestLayer,
  buildTestLayerWithStoredChunks,
  buildTestLayerWithStoredChunksAndTerrainPool,
} from './chunk-manager-test-utils'
import { Layer } from 'effect'
import { TerrainWorkerPoolPort } from '@ts-minecraft/worker'

describe('application/chunk/chunk-manager-service', () => {
  describe('unloadChunk', () => {
    it.effect('removes chunk from loaded set after unload', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 5, z: 5 })

        const beforeUnload = yield* service.getLoadedChunks()
        expect(Arr.some(beforeUnload, (c) => c.coord.x === 5 && c.coord.z === 5)).toBe(true)

        yield* service.unloadChunk({ x: 5, z: 5 })

        const afterUnload = yield* service.getLoadedChunks()
        expect(Arr.some(afterUnload, (c) => c.coord.x === 5 && c.coord.z === 5)).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('auto-saves dirty chunk to storage on unload', () => {
      const { TestLayer, storage } = buildTestLayer()
      const customWorldId = WorldId.make('world-2')

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        yield* service.setActiveWorldId(customWorldId)

        yield* service.getChunk({ x: 4, z: 4 })
        yield* service.markChunkDirty({ x: 4, z: 4 })
        yield* service.unloadChunk({ x: 4, z: 4 })

        const customStored = yield* storage.loadChunk(customWorldId, { x: 4, z: 4 })
        const defaultStored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 4, z: 4 })
        expect(Option.isSome(customStored)).toBe(true)
        expect(Option.isNone(defaultStored)).toBe(true)

        yield* service.setActiveWorldId(DEFAULT_WORLD_ID)
      }).pipe(Effect.provide(TestLayer))
    })
    it.effect('is a no-op when chunk is not loaded', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.unloadChunk({ x: 99, z: 99 })

        const loaded = yield* service.getLoadedChunks()
        expect(loaded.length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('removes unloaded chunks from the render-dirty drain set', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 6, z: 6 })
        yield* service.markChunkDirty({ x: 6, z: 6 })
        yield* service.unloadChunk({ x: 6, z: 6 })

        const renderDirtyChunks = yield* service.drainRenderDirtyChunks()
        expect(renderDirtyChunks).toEqual([])
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('loadChunksAroundPlayer', () => {
    it.live('loads chunks within render distance of player position', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, RENDER_DISTANCE)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 })

        const loaded = yield* service.getLoadedChunks()

        expect(loaded.length).toBeGreaterThan(0)

        const rdSquared = RENDER_DISTANCE * RENDER_DISTANCE
        Arr.forEach(loaded, (chunk) => {
          const dx = chunk.coord.x
          const dz = chunk.coord.z
          expect(dx * dx + dz * dz).toBeLessThanOrEqual(rdSquared)
        })
      }).pipe(Effect.provide(TestLayer))
    }, 20_000)

    it.live('honors a custom render distance when loading chunks', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, 2)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, 2)

        const loaded = yield* service.getLoadedChunks()
        expect(loaded.length).toBe(13)

        const rdSquared = 2 * 2
        Arr.forEach(loaded, (chunk) => {
          const dx = chunk.coord.x
          const dz = chunk.coord.z
          expect(dx * dx + dz * dz).toBeLessThanOrEqual(rdSquared)
        })
      }).pipe(Effect.provide(TestLayer))
    }, 35_000)

    it.effect('does not cap loading at the old unload radius', () => {
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, 11)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        let completed = yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, 11)
        for (let i = 0; i < preloadCoords.length; i += 1) {
          if (completed) break
          yield* TestClock.adjust('200 millis')
          completed = yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, 11)
        }

        const loaded = yield* service.getLoadedChunks()
        expect(completed).toBe(true)
        expect(Arr.some(loaded, (chunk) => chunk.coord.x === 11 && chunk.coord.z === 0)).toBe(true)
      }).pipe(
        Effect.provide(TestLayer),
        Effect.provide(TestContext.TestContext),
      )
    }, 35_000)

    it.effect('is throttled: second immediate call does not reload chunks', () => {
      const renderDistance = 2
      const preloadCoords = getChunksInRenderDistance({ x: 0, z: 0 }, renderDistance)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        const firstLoaded = yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, renderDistance)
        const afterFirst = yield* service.getLoadedChunks()
        const countFirst = afterFirst.length

        const secondLoaded = yield* service.loadChunksAroundPlayer({ x: 0, y: 64, z: 0 }, renderDistance)
        const afterSecond = yield* service.getLoadedChunks()
        const countSecond = afterSecond.length

        expect(firstLoaded).toBe(true)
        expect(secondLoaded).toBe(false)
        expect(countFirst).toBe(countSecond)
      }).pipe(Effect.provide(TestLayer))
    }, 20_000)

    it.effect('streams large render distances in small throttled batches', () => {
      const renderDistance = 3
      const center = { x: 64, z: 64 }
      const preloadCoords = getChunksInRenderDistance(center, renderDistance)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)
      const playerPos = { x: center.x * CHUNK_SIZE, y: 64, z: center.z * CHUNK_SIZE }

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService
        const beforeFirst = yield* service.getLoadedChunks()

        const firstLoaded = yield* service.loadChunksAroundPlayer(playerPos, renderDistance)
        const afterFirst = yield* service.getLoadedChunks()
        const firstDelta = afterFirst.length - beforeFirst.length

        const immediateSecondLoaded = yield* service.loadChunksAroundPlayer(playerPos, renderDistance)
        const afterImmediateSecond = yield* service.getLoadedChunks()
        const immediateSecondDelta = afterImmediateSecond.length - afterFirst.length

        let completed = firstLoaded
        for (let i = 0; i < preloadCoords.length; i += 1) {
          if (completed) break
          yield* TestClock.adjust('200 millis')
          completed = yield* service.loadChunksAroundPlayer(playerPos, renderDistance)
        }

        const afterStreaming = yield* service.getLoadedChunks()

        expect(firstDelta).toBeGreaterThan(0)
        expect(immediateSecondLoaded).toBe(false)
        expect(immediateSecondDelta).toBe(0)
        expect(completed).toBe(true)
        Arr.forEach(preloadCoords, (coord) => {
          expect(Arr.some(afterStreaming, (chunk) => chunk.coord.x === coord.x && chunk.coord.z === coord.z)).toBe(true)
        })
      }).pipe(
        Effect.provide(TestLayer),
        Effect.provide(TestContext.TestContext),
      )
    }, 20_000)

    it.effect('eager loading bypasses streaming throttle and loads the full render distance', () => {
      const renderDistance = 3
      const center = { x: 64, z: 64 }
      const preloadCoords = getChunksInRenderDistance(center, renderDistance)
      const { TestLayer, seedStorage } = buildTestLayerWithStoredChunks(preloadCoords)
      const playerPos = { x: center.x * CHUNK_SIZE, y: 64, z: center.z * CHUNK_SIZE }

      return Effect.gen(function* () {
        yield* seedStorage
        const service = yield* ChunkManagerService

        const completed = yield* service.loadChunksAroundPlayer(playerPos, renderDistance, { eager: true })
        const loaded = yield* service.getLoadedChunks()

        expect(completed).toBe(true)
        Arr.forEach(preloadCoords, (coord) => {
          expect(Arr.some(loaded, (chunk) => chunk.coord.x === coord.x && chunk.coord.z === coord.z)).toBe(true)
        })
      }).pipe(
        Effect.provide(TestLayer),
        Effect.provide(TestContext.TestContext),
      )
    }, 20_000)

    it.effect('forwards custom terrain levels to terrain generation when eager loading', () => {
      const seenOptions: Array<{ readonly seaLevel: number; readonly lakeLevel: number; readonly seed: number; readonly dimension?: 'overworld' | 'nether' | 'end' }> = []
      const terrainPoolLayer = Layer.succeed(
        TerrainWorkerPoolPort,
        TerrainWorkerPoolPort.of({
          _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
          generateTerrain: (_coord, options) =>
            Effect.sync(() => {
              seenOptions.push(options)
              return {
                blocks: new Uint8Array(EXPECTED_BLOCKS_LENGTH),
                skyLight: new Uint8Array(EXPECTED_BLOCKS_LENGTH),
                blockLight: new Uint8Array(EXPECTED_BLOCKS_LENGTH),
              }
            }),
        }),
      )
      const { TestLayer } = buildTestLayerWithStoredChunksAndTerrainPool([], { terrainPoolLayer })
      const terrainLevels = { seaLevel: 61, lakeLevel: 31 }

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const completed = yield* service.loadChunksAroundPlayer(
          { x: 0, y: 64, z: 0 },
          0,
          { eager: true, terrainLevels },
        )

        expect(completed).toBe(true)
        expect(seenOptions).toHaveLength(1)
        expect(seenOptions[0].seaLevel).toBe(61)
        expect(seenOptions[0].lakeLevel).toBe(31)
        const loaded = yield* service.getLoadedChunks()
        expect(loaded).toHaveLength(1)
      }).pipe(Effect.provide(TestLayer))
    }, 20_000)
  })

  describe('RENDER_DISTANCE constant', () => {
    it('is defined as a positive integer', () => {
      expect(RENDER_DISTANCE).toBeTypeOf('number')
      expect(RENDER_DISTANCE).toBeGreaterThan(0)
      expect(Number.isInteger(RENDER_DISTANCE)).toBe(true)
    }, 25_000)
  })

  describe('MAX_CACHED_CHUNKS constant', () => {
    it('is defined as a positive integer', () => {
      expect(MAX_CACHED_CHUNKS).toBeTypeOf('number')
      expect(MAX_CACHED_CHUNKS).toBeGreaterThan(0)
      expect(Number.isInteger(MAX_CACHED_CHUNKS)).toBe(true)
    })
  })
})
