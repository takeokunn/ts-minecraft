import { describe, expect, it } from '@effect/vitest'
import { Clock, Effect, Schema, Stream } from 'effect'
import { randomUUID } from 'node:crypto'
import { ChunkCommand } from './commands'
import { applyCommand, makeInitialState } from './model'
import { ChunkSystemRepository } from './repository'
import { indexedDbRepositoryLayer } from './repository.indexeddb'
import { ChunkRequestSchema, ChunkSystemConfigSchema } from './types'

const config = Effect.runSync(
  Schema.decodeUnknown(ChunkSystemConfigSchema)({
    initialBudget: {
      id: 'indexed-budget',
      strategy: 'adaptive',
      maxConcurrent: 3,
      maxMemoryMiB: 512,
      maxBandwidthMbps: 256,
    },
    initialStrategy: 'indexed-strategy',
    performanceWindow: {
      windowMs: 1_000,
      rollingAverage: 0,
      percentile95: 0,
    },
  })
)

describe('chunk_system/repository.indexeddb', () => {
  it.effect('persists state with latency and streams events', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const initial = yield* makeInitialState(config)
        const layer = indexedDbRepositoryLayer(initial)
        const repository = yield* Effect.service(ChunkSystemRepository).pipe(Effect.provide(layer))
        const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
          id: randomUUID(),
          chunk: 'chunk-idb',
          priority: 'normal',
          action: 'load',
          createdAt: 0,
          deadline: 20,
        })
        const transition = yield* applyCommand(initial, ChunkCommand.Schedule({ request }))
        const start = yield* Clock.currentTimeMillis
        yield* repository.save(transition.state, transition.events)
        const end = yield* Clock.currentTimeMillis
        expect(end - start).toBeGreaterThanOrEqual(2)
        const roundTrip = yield* repository.load
        expect(roundTrip.active).toHaveLength(1)
        const events = yield* repository.observe.pipe(Stream.take(1), Stream.runCollect)
        expect(events[0]?._tag).toBe('RequestQueued')
      })
    )
  )
})
