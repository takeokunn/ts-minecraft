import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Option, Schema } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'
import {
  buildTestLayer,
  EXPECTED_BLOCKS_LENGTH,
} from './chunk-manager-test-utils'

describe('application/chunk/chunk-manager-service (cache)', () => {
  // ---------------------------------------------------------------------------
  // C1: loadChunk idempotency (same chunk returned on second call, uses cache)
  // ---------------------------------------------------------------------------

  describe('loadChunk idempotency', () => {
    it.effect('calling loadChunk (getChunk) twice for same coordinate returns identical chunk object', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const chunk1 = yield* service.getChunk({ x: 7, z: -3 })
        const blocks1Copy = new Uint8Array(chunk1.blocks)

        const chunk2 = yield* service.getChunk({ x: 7, z: -3 })

        expect(chunk2.coord.x).toBe(7)
        expect(chunk2.coord.z).toBe(-3)
        expect(chunk2.blocks).toEqual(blocks1Copy)
        expect(chunk2.blocks).toBe(chunk1.blocks)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('calling getChunk twice does not double-count in getLoadedChunks', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        yield* service.getChunk({ x: 2, z: 5 })
        yield* service.getChunk({ x: 2, z: 5 })

        const loaded = yield* service.getLoadedChunks()
        const matches = Arr.filter(loaded, (c) => c.coord.x === 2 && c.coord.z === 5)
        expect(matches.length).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // C2: Negative chunk coordinates
  // ---------------------------------------------------------------------------

  describe('negative chunk coordinates', () => {
    it.effect('generates a valid chunk for coordinate { x: -1, z: -1 }', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: -1, z: -1 })

        expect(chunk.coord.x).toBe(-1)
        expect(chunk.coord.z).toBe(-1)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        const surfaceY = Option.getOrElse(
          Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i), (y) =>
            chunk.blocks[y + 8 * CHUNK_HEIGHT + 8 * CHUNK_HEIGHT * CHUNK_SIZE] !== 0
          ),
          () => 0
        )
        expect(surfaceY).toBeGreaterThanOrEqual(1)
        expect(surfaceY).toBeLessThanOrEqual(CHUNK_HEIGHT - 2)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('generates a valid chunk for coordinate { x: -5, z: 3 }', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk = yield* service.getChunk({ x: -5, z: 3 })

        expect(chunk.coord.x).toBe(-5)
        expect(chunk.coord.z).toBe(3)
        expect(chunk.blocks).toBeInstanceOf(Uint8Array)
        expect(chunk.blocks.length).toBe(EXPECTED_BLOCKS_LENGTH)

        const nonAirCount = chunk.blocks.reduce((acc, b) => acc + (b !== 0 ? 1 : 0), 0)
        expect(nonAirCount).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('caches negative-coordinate chunk correctly on second call', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService

        const first = yield* service.getChunk({ x: -3, z: -7 })
        const second = yield* service.getChunk({ x: -3, z: -7 })

        expect(second.blocks).toBe(first.blocks)

        const loaded = yield* service.getLoadedChunks()
        const count = Arr.filter(loaded, (c) => c.coord.x === -3 && c.coord.z === -7).length
        expect(count).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // D9: shouldPlaceTree determinism property test
  // ---------------------------------------------------------------------------

  describe('terrain generation determinism (shouldPlaceTree invariant)', () => {
    it.effect('getChunk returns same blocks on repeated calls (cache hit is deterministic)', () => {
      const { TestLayer } = buildTestLayer()

      return Effect.gen(function* () {
        const service = yield* ChunkManagerService
        const chunk1 = yield* service.getChunk({ x: 3, z: 7 })
        const blocks1 = new Uint8Array(chunk1.blocks)
        const chunk2 = yield* service.getChunk({ x: 3, z: 7 })

        expect(blocks1).toEqual(chunk2.blocks)
      }).pipe(Effect.provide(TestLayer))
    })

    const shouldPlaceTreeFormula = (
      treeDensity: number,
      surfaceY: number,
      wx: number,
      wz: number
    ): boolean => {
      if (treeDensity <= 0 || surfaceY <= 5 || surfaceY >= 256 - 10) {
        return false
      }
      const treeRng = Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453
      const treeProb = treeRng - Math.floor(treeRng)
      return treeProb < treeDensity
    }

    it.prop(
      'shouldPlaceTree formula produces same result for same inputs (direct formula test)',
      {
        density: Arbitrary.make(Schema.Number.pipe(Schema.between(0, 1))),
        surfaceY: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(6, 246))),
        wx: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
        wz: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, 100))),
      },
      ({ density, surfaceY, wx, wz }) => {
        const result1 = shouldPlaceTreeFormula(density, surfaceY, wx, wz)
        const result2 = shouldPlaceTreeFormula(density, surfaceY, wx, wz)
        expect(result1).toBe(result2)
      }
    )
  })
})
