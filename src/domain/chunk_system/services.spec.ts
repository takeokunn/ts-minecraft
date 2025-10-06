import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Schema, Stream } from 'effect'
import * as fc from 'effect/FastCheck'
import { randomUUID } from 'node:crypto'
import { ChunkCommand } from './commands'
import { makeInitialState } from './model'
import { memoryRepositoryLayer } from './repository.memory'
import { chunkSystemLayer, ChunkSystemService } from './services'
import { ChunkRequestSchema, ChunkSystemConfigSchema } from './types'

const config = Effect.runSync(
  Schema.decodeUnknown(ChunkSystemConfigSchema)({
    initialBudget: {
      id: 'service-budget',
      strategy: 'adaptive',
      maxConcurrent: 3,
      maxMemoryMiB: 512,
      maxBandwidthMbps: 256,
    },
    initialStrategy: 'service-strategy',
    performanceWindow: {
      windowMs: 1_000,
      rollingAverage: 0,
      percentile95: 0,
    },
  })
)

describe('chunk_system/services', () => {
  it.effect('dispatch persists through repository layer', () =>
    makeInitialState(config).pipe(
      Effect.flatMap((initialState) => {
        const repositoryLayer = memoryRepositoryLayer(initialState)
        const serviceLayer = chunkSystemLayer(config).pipe(Layer.provide(repositoryLayer))

        return Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ChunkSystemService
            const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
              id: randomUUID(),
              chunk: 'chunk-service',
              priority: 'high',
              action: 'load',
              createdAt: 0,
              deadline: 15,
            })
            const transition = yield* service.dispatch(ChunkCommand.Schedule({ request }))
            expect(transition.state.active).toHaveLength(1)
            const current = yield* service.current
            expect(current.active).toHaveLength(1)
            const events = yield* service.events.pipe(Stream.take(1), Stream.runCollect)
            expect(events[0]?._tag).toBe('RequestQueued')
          }).pipe(Effect.provide(serviceLayer))
        )
      })
    )
  )

  it.effect.prop('round-trip schedule/complete via service maintains invariants', [fc.uuid()], ([id]) =>
    makeInitialState(config).pipe(
      Effect.flatMap((initialState) => {
        const repositoryLayer = memoryRepositoryLayer(initialState)
        const serviceLayer = chunkSystemLayer(config).pipe(Layer.provide(repositoryLayer))

        return Effect.scoped(
          Effect.gen(function* () {
            const service = yield* ChunkSystemService
            const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
              id,
              chunk: 'chunk-roundtrip',
              priority: 'normal',
              action: 'load',
              createdAt: 0,
              deadline: 20,
            })
            yield* service.dispatch(ChunkCommand.Schedule({ request }))
            yield* service.dispatch(ChunkCommand.Complete({ requestId: request.id, completedAt: request.deadline + 5 }))
            const current = yield* service.current
            expect(current.active).toHaveLength(0)
          }).pipe(Effect.provide(serviceLayer))
        )
      })
    )
  )
})
