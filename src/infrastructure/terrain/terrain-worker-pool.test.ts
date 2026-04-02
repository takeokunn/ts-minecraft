import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@/domain/chunk'
import { NoiseServiceLive } from '@/infrastructure/noise/noise-service'
import { TerrainWorkerPool, TerrainWorkerPoolLive } from './terrain-worker-pool'

const TerrainPoolTestLayer = TerrainWorkerPoolLive.pipe(
  Layer.provide(NoiseServiceLive),
)

describe('infrastructure/terrain/terrain-worker-pool', () => {
  it.effect('falls back to synchronous terrain generation when Worker is unavailable', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool
      expect(pool.workerCount).toBe(0)

      const blocks = yield* pool.generateTerrain(
        { x: 0, z: 0 },
        { seaLevel: 48, lakeLevel: 62 },
      )

      expect(blocks).toBeInstanceOf(Uint8Array)
      expect(blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const nonAirCount = blocks.reduce((count, block) => count + (block !== 0 ? 1 : 0), 0)
      expect(nonAirCount).toBeGreaterThan(0)
    }).pipe(Effect.provide(TerrainPoolTestLayer)),
  )

  it.effect('returns deterministic blocks for the same coordinate and config', () =>
    Effect.gen(function* () {
      const pool = yield* TerrainWorkerPool

      const first = yield* pool.generateTerrain(
        { x: 7, z: -3 },
        { seaLevel: 48, lakeLevel: 62 },
      )
      const second = yield* pool.generateTerrain(
        { x: 7, z: -3 },
        { seaLevel: 48, lakeLevel: 62 },
      )

      expect(second).toEqual(first)
    }).pipe(Effect.provide(TerrainPoolTestLayer)),
  )
})
