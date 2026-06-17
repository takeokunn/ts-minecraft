import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableRef } from 'effect'
import { StorageServicePort } from '@ts-minecraft/world'
import { NoiseServicePort, NoiseService, BiomeService, ChunkManagerService } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import {
  buildTestLayer,
  LightEngineNoopLayer,
  makeInMemoryStorage,
  buildInlineTerrainPoolLayer,
} from './chunk-manager-test-utils'
import { makeTerrainChannelSamples } from './terrain-channel-test-utils'

describe('terrain/chunk-terrain-underground', () => {
  describe('Phase 1.2 — bedrock layer, deepslate, stone variants', () => {
    const AIR = 0
    const DIRT = 1
    const STONE = 2
    const GRANITE = 12
    const DIORITE = 13
    const ANDESITE = 14
    const BEDROCK = 16

    const idx = (lx: number, y: number, lz: number): number =>
      y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

    it.effect('y=0 is ALWAYS BEDROCK across every (lx, lz) column', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 0, z: 0 })

        yield* Effect.forEach(
          Arr.makeBy(CHUNK_SIZE, (i) => i),
          (lx) =>
            Effect.forEach(
              Arr.makeBy(CHUNK_SIZE, (i) => i),
              (lz) =>
                Effect.sync(() => {
                  expect(chunk.blocks[idx(lx, 0, lz)]).toBe(BEDROCK)
                }),
              { concurrency: 1 },
            ),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('y<16 in the deep-stone region is DEEPSLATE, never STONE', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        yield* Effect.forEach(
          Arr.makeBy(3, (i) => i),
          (cx) =>
            Effect.gen(function* () {
              const chunk = yield* service.getChunk({ x: cx, z: 0 })
              yield* Effect.forEach(
                Arr.makeBy(CHUNK_SIZE, (i) => i),
                (lx) =>
                  Effect.forEach(
                    Arr.makeBy(CHUNK_SIZE, (i) => i),
                    (lz) =>
                      Effect.forEach(
                        Arr.makeBy(11, (i) => i + 5),
                        (y) =>
                          Effect.sync(() => {
                            const b = chunk.blocks[idx(lx, y, lz)]
                            expect(b).not.toBe(STONE)
                          }),
                        { concurrency: 1 },
                      ),
                    { concurrency: 1 },
                  ),
                { concurrency: 1 },
              )
            }),
          { concurrency: 1 },
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('stone variants only replace STONE/DEEPSLATE — never AIR/DIRT/BEDROCK', () => {
      const HighVariantNoise = Layer.succeed(
        NoiseServicePort,
        NoiseServicePort.of({
          _tag: '@minecraft/application/noise/NoiseServicePort' as const,
          noise2D: (_x: number, _z: number) => Effect.succeed(0.95),
          octaveNoise2D: (_x: number, _z: number, _o: number, _p: number, _l: number) => Effect.succeed(0.5),
          setSeed: (_seed: number) => Effect.void,
          getSeed: Effect.succeed(0),
          octaveNoise2DBatch: (
            points: ReadonlyArray<readonly [number, number]>,
            _o: number,
            _p: number,
            _l: number,
          ) => Effect.succeed(points.map(() => 0.5)),
          octaveNoise2DBatchXY: (
            xs: ReadonlyArray<number>,
            _zs: ReadonlyArray<number>,
            _o: number,
            _p: number,
            _l: number,
          ) => Effect.succeed(xs.map(() => 0.5)),
          noise2DBatch: (points: ReadonlyArray<readonly [number, number]>) =>
            Effect.succeed(points.map(() => 0.95)),
          noise2DBatchXY: (xs: ReadonlyArray<number>, _zs: ReadonlyArray<number>) =>
            Effect.succeed(xs.map(() => 0.95)),
          noise3D: (_x: number, _y: number, _z: number) => Effect.succeed(1.0),
          noise3DBatchXYZ: (
            xs: ReadonlyArray<number>,
            _ys: ReadonlyArray<number>,
            _zs: ReadonlyArray<number>,
          ) => Effect.succeed(xs.map(() => 1.0)),
          continentalness: (_x: number, _z: number) => Effect.succeed(0),
          erosion: (_x: number, _z: number) => Effect.succeed(0),
          weirdness: (_x: number, _z: number) => Effect.succeed(0),
          jaggedness: (_x: number, _z: number) => Effect.succeed(0),
          sampleTerrainChannels: (_cx: number, _cz: number) => Effect.succeed(makeTerrainChannelSamples()),
        }),
      )

      const storage = makeInMemoryStorage()
      const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
      const BiomeTestLayer = BiomeService.Default.pipe(Layer.provide(HighVariantNoise))

      const HighVariantTestLayer = ChunkManagerService.Default.pipe(
        Layer.provide(ChunkService.Default),
        Layer.provide(StorageTestLayer),
        Layer.provide(BiomeTestLayer),
        Layer.provide(HighVariantNoise),
        Layer.provide(NoiseService.Default),
        Layer.provide(buildInlineTerrainPoolLayer(
          Layer.mergeAll(ChunkService.Default, BiomeTestLayer, HighVariantNoise),
        )),
        Layer.provide(LightEngineNoopLayer),
      )

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: 0, z: 0 })

        const variantBlockCountRef = MutableRef.make(0)
        const bedrockLayerVariantsRef = MutableRef.make(0)
        const variantsAdjacentToAirRef = MutableRef.make(0)

        yield* Effect.sync(() => {
          Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) =>
            Arr.forEach(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) =>
              Arr.forEach(Arr.makeBy(CHUNK_HEIGHT, (y) => y), (y) => {
                const b = chunk.blocks[idx(lx, y, lz)]
                const isVariant = b === GRANITE || b === DIORITE || b === ANDESITE
                if (!isVariant) return
                MutableRef.update(variantBlockCountRef, n => n + 1)
                if (y <= 4) MutableRef.update(bedrockLayerVariantsRef, n => n + 1)
                const above = y + 1 < CHUNK_HEIGHT ? chunk.blocks[idx(lx, y + 1, lz)] : AIR
                if (above === AIR) MutableRef.update(variantsAdjacentToAirRef, n => n + 1)
              })
            )
          )
        })

        expect(MutableRef.get(variantBlockCountRef)).toBeGreaterThan(0)
        expect(MutableRef.get(bedrockLayerVariantsRef)).toBe(0)
        expect(MutableRef.get(variantsAdjacentToAirRef)).toBe(0)

        const WATER = 6
        let landSurfaceY = -1
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const b = chunk.blocks[idx(8, y, 8)]
          if (b !== AIR && b !== WATER) {
            landSurfaceY = y
            break
          }
        }
        expect(landSurfaceY).toBeGreaterThan(4)
        const subSurfaceBlock = chunk.blocks[idx(8, landSurfaceY - 1, 8)]
        expect(
          subSurfaceBlock === GRANITE || subSurfaceBlock === DIORITE || subSurfaceBlock === ANDESITE,
        ).toBe(false)
        expect([DIRT, 5 /* SAND */, STONE]).toContain(subSurfaceBlock)
      }).pipe(Effect.provide(HighVariantTestLayer))
    })

    it.effect('terrain generation is deterministic — same coord yields identical blocks on fresh service', () => {
      const layer1 = buildTestLayer().TestLayer
      const layer2 = buildTestLayer().TestLayer

      return Effect.gen(function* () {
        const chunkA = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 2, z: -4 })
        }).pipe(Effect.provide(layer1))

        const chunkB = yield* Effect.gen(function* () {
          const svc = yield* ChunkManagerService
          return yield* svc.getChunk({ x: 2, z: -4 })
        }).pipe(Effect.provide(layer2))

        expect(chunkA.blocks).toEqual(chunkB.blocks)
      })
    })
  })
})
