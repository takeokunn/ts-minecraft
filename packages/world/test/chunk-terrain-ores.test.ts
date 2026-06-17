import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet, Layer, MutableRef } from 'effect'
import { StorageServicePort, NoiseServicePort, NoiseService, BiomeService, ChunkManagerService } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import {
  LightEngineNoopLayer,
  makeInMemoryStorage,
  buildInlineTerrainPoolLayer,
} from './chunk-manager-test-utils'
import { makeTerrainChannelSamples } from './terrain-channel-test-utils'

describe('terrain/chunk-terrain-ores', () => {
  describe('Phase 1.4 — depth-based ore vein generation', () => {
    const AIR = 0
    const DIRT = 1
    const GRASS = 4
    const SAND = 5
    const WATER = 6
    const COAL_ORE = 19
    const IRON_ORE = 20
    const GOLD_ORE = 21
    const DIAMOND_ORE = 22
    const REDSTONE_ORE = 23
    const LAPIS_ORE = 24
    const EMERALD_ORE = 25
    const DEEPSLATE_COAL_ORE = 26
    const DEEPSLATE_DIAMOND_ORE = 29
    const DEEPSLATE_EMERALD_ORE = 32

    const REGULAR_ORES = [COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, REDSTONE_ORE, LAPIS_ORE, EMERALD_ORE]
    const DEEPSLATE_ORES = [26, 27, 28, 29, 30, 31, 32]
    const ALL_ORES_SET = HashSet.fromIterable(Arr.appendAll(REGULAR_ORES, DEEPSLATE_ORES))
    const REGULAR_ORES_SET = HashSet.fromIterable(REGULAR_ORES)
    const DEEPSLATE_ORES_SET = HashSet.fromIterable(DEEPSLATE_ORES)

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

    const isOre = (b: number | undefined): boolean => b !== undefined && HashSet.has(ALL_ORES_SET, b)

    const scanAllBlocks = (blocks: Uint8Array, fn: (lx: number, lz: number, y: number, b: number) => void): void =>
      Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
        Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) =>
          Arr.forEach(Arr.makeBy(CHUNK_HEIGHT, (y) => y), (y) =>
            fn(lx, lz, y, blocks[idx(lx, y, lz)]!)
          )
        )
      )

    const buildOreTestLayer = () => {
      const OreNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.5),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.5)),
          noise2DBatchXY: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 0.5)),
          // noise3D = 1.0 keeps |interpolated| above CAVE_BASE_THRESHOLD=0.18 → no carving.
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (xs: ReadonlyArray<number>) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0),
          erosion: (_x: number, _z: number) => Effect.succeed(0),
          weirdness: (_x: number, _z: number) => Effect.succeed(0),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0),
          sampleTerrainChannels: (_cx: number, _cz: number) => Effect.succeed(makeTerrainChannelSamples()),
        }),
      )

      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
      const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(OreNoise))

      const TestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(OreNoise),
        Layer.provide(NoiseService.Default),
        Layer.provide(buildInlineTerrainPoolLayer(
          Layer.mergeAll(ChunkService.Default, BiomeTestLayer, OreNoise),
        )),
        Layer.provide(LightEngineNoopLayer),
      )

      return { TestLayer, storage }
    }

    it.effect('ores never overwrite BEDROCK layer (y<=4)', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = [
          { x: 0, z: 0 },
          { x: 1, z: 2 },
          { x: -3, z: 4 },
        ]

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
                  Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) =>
                    Arr.forEach(Arr.makeBy(5, (y) => y), (y) =>
                      expect(isOre(chunk.blocks[idx(lx, y, lz)])).toBe(false)
                    )
                  )
                )
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('ores never overwrite AIR / WATER / DIRT / GRASS / SAND anywhere in chunk', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = [
          { x: 0, z: 0 },
          { x: 2, z: -1 },
          { x: -1, z: 3 },
        ]

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    let surfY = -1
                    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      if (b !== AIR && b !== WATER) { surfY = y; break }
                    }
                    for (let y = surfY + 1; y < CHUNK_HEIGHT; y++) {
                      const b = chunk.blocks[idx(lx, y, lz)]
                      expect(isOre(b)).toBe(false)
                    }
                    if (surfY >= 0) {
                      const start = Math.max(5, surfY - 3)
                      for (let y = start; y <= surfY; y++) {
                        const b = chunk.blocks[idx(lx, y, lz)]
                        if (b === DIRT || b === GRASS || b === SAND) {
                          expect(isOre(b)).toBe(false)
                        }
                      }
                    }
                  }
                }
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('DIAMOND only appears at y <= 16', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = Arr.flatMap(Arr.makeBy(3, (i) => i - 1), (x) =>
          Arr.map(Arr.makeBy(3, (i) => i - 1), (z) => ({ x, z })),
        )

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                scanAllBlocks(chunk.blocks, (_lx, _lz, y, b) => {
                  if (b === DIAMOND_ORE || b === DEEPSLATE_DIAMOND_ORE) {
                    expect(y).toBeLessThanOrEqual(16)
                  }
                })
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('DEEPSLATE_*_ORE used below y=16; regular *_ORE used at y >= 16', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = Arr.flatMap(Arr.makeBy(3, (i) => i), (x) =>
          Arr.map(Arr.makeBy(3, (i) => i), (z) => ({ x, z })),
        )

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                scanAllBlocks(chunk.blocks, (_lx, _lz, y, b) => {
                  if (HashSet.has(REGULAR_ORES_SET, b)) {
                    expect(y).toBeGreaterThanOrEqual(16)
                  }
                  if (HashSet.has(DEEPSLATE_ORES_SET, b)) {
                    expect(y).toBeLessThan(16)
                  }
                })
              })
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 })

    it.effect('common ores (COAL/IRON) appear across a multi-chunk scan', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = Arr.flatMap(Arr.makeBy(3, (i) => i), (x) =>
          Arr.map(Arr.makeBy(3, (i) => i), (z) => ({ x, z })),
        )
        const coalCountRef = MutableRef.make(0)
        const ironCountRef = MutableRef.make(0)

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                scanAllBlocks(chunk.blocks, (_lx, _lz, _y, b) => {
                  if (b === COAL_ORE || b === DEEPSLATE_COAL_ORE) MutableRef.update(coalCountRef, n => n + 1)
                  if (b === IRON_ORE || b === 27 /* DEEPSLATE_IRON_ORE */) MutableRef.update(ironCountRef, n => n + 1)
                })
              })
            }),
          { concurrency: 1 },
        )

        expect(MutableRef.get(coalCountRef)).toBeGreaterThan(100)
        expect(MutableRef.get(ironCountRef)).toBeGreaterThan(50)
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 })

    it.effect('ore placement is deterministic — same coord yields identical ore layout', () => {
      const layer1 = buildOreTestLayer().TestLayer
      const layer2 = buildOreTestLayer().TestLayer

      return Effect.gen(function* () {
        const chunkA = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 7, z: -2 })
        }).pipe(Effect.provide(layer1))

        const chunkB = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 7, z: -2 })
        }).pipe(Effect.provide(layer2))

        const oresA = Array.from(chunkA.blocks).filter(isOre).length
        const oresB = Array.from(chunkB.blocks).filter(isOre).length
        expect(oresA).toBe(oresB)
        expect(oresA).toBeGreaterThan(0)
        expect(chunkA.blocks).toEqual(chunkB.blocks)
      })
    })

    it.effect('EMERALD appears across a multi-chunk scan (rare but non-zero)', () => {
      const { TestLayer } = buildOreTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const coords = Arr.flatMap(Arr.makeBy(3, (i) => i), (x) =>
          Arr.map(Arr.makeBy(3, (i) => i), (z) => ({ x, z })),
        )
        const emeraldCountRef = MutableRef.make(0)

        yield* Effect.forEach(
          coords,
          (coord) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk(coord)
              yield* Effect.sync(() => {
                scanAllBlocks(chunk.blocks, (_lx, _lz, _y, b) => {
                  if (b === EMERALD_ORE || b === DEEPSLATE_EMERALD_ORE) MutableRef.update(emeraldCountRef, n => n + 1)
                })
              })
            }),
          { concurrency: 1 },
        )

        expect(MutableRef.get(emeraldCountRef)).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    }, { timeout: 30_000 })
  })
})
