import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { ChunkIdSchema } from '@domain/chunk/value_object/chunk_id/types'
import { createChunkLifecycleProvider } from './lifecycle-manager'

describe('chunk_manager/domain_service/lifecycle_manager', () => {
  it.effect('createChunkLifecycleProvider wires aggregate operations', () =>
    Effect.gen(function* () {
      const provider = yield* createChunkLifecycleProvider()
      const chunkId = Schema.decodeUnknownSync(ChunkIdSchema)('service-chunk')

      yield* provider.activateChunk(chunkId)
      const active = yield* provider.getActiveChunks()
      expect(active).toContain(chunkId)

      yield* provider.deactivateChunk(chunkId)
      const stats = yield* provider.getLifecycleStats()
      expect(stats.totalActivations).toBeGreaterThanOrEqual(1)
    })
  )
})
