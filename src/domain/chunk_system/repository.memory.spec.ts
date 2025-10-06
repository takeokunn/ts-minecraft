import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema, Stream } from 'effect'
import { randomUUID } from 'node:crypto'
import { ChunkCommand } from './commands'
import { applyCommand, makeInitialState } from './model'
import { ChunkSystemRepository } from './repository'
import { memoryRepositoryLayer } from './repository.memory'
import { ChunkRequestSchema, ChunkSystemConfigSchema } from './types'

const config = Effect.runSync(
  Schema.decodeUnknown(ChunkSystemConfigSchema)({
    initialBudget: {
      id: 'memory-budget',
      strategy: 'strict',
      maxConcurrent: 2,
      maxMemoryMiB: 256,
      maxBandwidthMbps: 128,
    },
    initialStrategy: 'memory-strategy',
    performanceWindow: {
      windowMs: 1_000,
      rollingAverage: 0,
      percentile95: 0,
    },
  })
)

describe('chunk_system/repository.memory', () => {
  it.effect('persists state and replays events', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const initial = yield* makeInitialState(config)
        const layer = memoryRepositoryLayer(initial)
        const repository = yield* Effect.service(ChunkSystemRepository).pipe(Effect.provide(layer))
        const loaded = yield* repository.load
        expect(loaded.strategy).toBe(config.initialStrategy)
        const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
          id: randomUUID(),
          chunk: 'chunk-memory',
          priority: 'high',
          action: 'load',
          createdAt: 0,
          deadline: 10,
        })
        const transition = yield* applyCommand(loaded, ChunkCommand.Schedule({ request }))
        yield* repository.save(transition.state, transition.events)
        const replay = yield* repository.load
        expect(replay.active).toHaveLength(1)
        const events = yield* repository.observe.pipe(Stream.take(1), Stream.runCollect)
        expect(events.length).toBe(1)
        expect(events[0]?._tag).toBe('RequestQueued')
      })
    )
  )
})
