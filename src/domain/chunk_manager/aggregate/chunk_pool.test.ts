import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { ChunkIdSchema } from '@domain/chunk/value_object/chunk_id/types'
import {
  makeAutoManagementConfig,
} from '../types/interfaces'
import {
  makeChunkDistance,
  makeMaxActiveChunks,
  makeResourceUsagePercent,
} from '../types/core'
import { makeChunkPool } from './chunk_pool'

const chunkA = Schema.decodeUnknownSync(ChunkIdSchema)('chunk-A')
const chunkB = Schema.decodeUnknownSync(ChunkIdSchema)('chunk-B')

const tightAutoConfig = makeAutoManagementConfig({
  enabled: true,
  activationDistance: makeChunkDistance(8),
  deactivationDistance: makeChunkDistance(10),
  maxActiveChunks: makeMaxActiveChunks(1),
  memoryThreshold: makeResourceUsagePercent(0.6),
  performanceThreshold: makeResourceUsagePercent(0.8),
})

describe('chunk_manager/aggregate/chunk_pool', () => {
  it.effect('activate and deactivate chunk update metrics', () =>
    Effect.gen(function* () {
      const pool = yield* makeChunkPool()
      yield* pool.activate(chunkA)
      const active = yield* pool.getActiveChunks()
      expect(active).toContain(chunkA)

      yield* pool.deactivate(chunkA)
      const metrics = yield* pool.getPoolMetrics()
      expect(metrics.activeChunks).toBe(0)
      expect(metrics.totalChunks).toBeGreaterThanOrEqual(1)
    })
  )

  it.effect('enforces max active chunk constraint', () =>
    Effect.gen(function* () {
      const pool = yield* makeChunkPool({ autoConfig: tightAutoConfig })
      yield* pool.activate(chunkA)
      const result = yield* pool.activate(chunkB).pipe(Effect.exit)
      expect(result._tag).toBe('Failure')
    })
  )

  it.effect('configure updates auto management settings', () =>
    Effect.gen(function* () {
      const pool = yield* makeChunkPool({ autoConfig: tightAutoConfig })
      const relaxed = makeAutoManagementConfig({
        enabled: true,
        activationDistance: makeChunkDistance(4),
        deactivationDistance: makeChunkDistance(6),
        maxActiveChunks: makeMaxActiveChunks(3),
        memoryThreshold: makeResourceUsagePercent(0.7),
        performanceThreshold: makeResourceUsagePercent(0.85),
      })
      yield* pool.configure(relaxed)
      const result = yield* pool.activate(chunkB).pipe(Effect.exit)
      expect(result._tag).toBe('Success')
    })
  )
})
