import { describe, expect, it } from '@effect/vitest'
import { Effect, Either, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { randomUUID } from 'node:crypto'
import { ChunkCommand } from './commands'
import { applyCommand, makeInitialState } from './model'
import { ChunkRequestSchema, ChunkSystemConfig, ChunkSystemConfigSchema } from './types'

const config: ChunkSystemConfig = Effect.runSync(
  Schema.decodeUnknown(ChunkSystemConfigSchema)({
    initialBudget: {
      id: 'budget-main',
      strategy: 'strict',
      maxConcurrent: 2,
      maxMemoryMiB: 512,
      maxBandwidthMbps: 256,
    },
    initialStrategy: 'primary-strategy',
    performanceWindow: {
      windowMs: 1_000,
      rollingAverage: 0,
      percentile95: 0,
    },
  })
)

const requestArbitrary = fc.record({
  id: fc.uuid(),
  chunk: fc.constantFrom('chunk-1', 'chunk-2', 'chunk-3'),
  priority: fc.constantFrom('critical', 'high', 'normal', 'low'),
  action: fc.constantFrom('load', 'warmup', 'unload'),
  createdAt: fc.integer({ min: 0, max: 100 }),
  deadline: fc.integer({ min: 200, max: 400 }),
})

describe('chunk_system/model', () => {
  it.effect('schedule command enqueues active request and emits event', () =>
    Effect.gen(function* () {
      const state = yield* makeInitialState(config)
      const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
        id: randomUUID(),
        chunk: 'chunk-main',
        priority: 'critical',
        action: 'load',
        createdAt: 10,
        deadline: 500,
      })
      const result = yield* applyCommand(state, ChunkCommand.Schedule({ request }))
      expect(result.state.active).toHaveLength(1)
      expect(result.events[0]?._tag).toBe('RequestQueued')
    })
  )

  it.effect('capacity limit triggers ResourceBudgetExceeded', () =>
    Effect.gen(function* () {
      const initial = yield* makeInitialState({
        ...config,
        initialBudget: {
          ...config.initialBudget,
          maxConcurrent: 1,
        },
      })
      const firstRequest = yield* Schema.decodeUnknown(ChunkRequestSchema)({
        id: randomUUID(),
        chunk: 'chunk-a',
        priority: 'high',
        action: 'load',
        createdAt: 0,
        deadline: 100,
      })
      const secondRequest = yield* Schema.decodeUnknown(ChunkRequestSchema)({
        id: randomUUID(),
        chunk: 'chunk-b',
        priority: 'high',
        action: 'load',
        createdAt: 0,
        deadline: 100,
      })
      const consumed = yield* applyCommand(initial, ChunkCommand.Schedule({ request: firstRequest }))
      const exit = yield* Effect.either(applyCommand(consumed.state, ChunkCommand.Schedule({ request: secondRequest })))
      expect(Either.isLeft(exit)).toBe(true)
      if (Either.isLeft(exit)) {
        expect(exit.left._tag).toBe('ResourceBudgetExceeded')
      }
    })
  )

  it.effect.prop('schedule followed by completion returns to empty active set', [requestArbitrary], ([raw]) =>
    Effect.gen(function* () {
      const state = yield* makeInitialState(config)
      const request = yield* Schema.decodeUnknown(ChunkRequestSchema)(raw)
      const scheduled = yield* applyCommand(state, ChunkCommand.Schedule({ request }))
      const completed = yield* applyCommand(
        scheduled.state,
        ChunkCommand.Complete({
          requestId: request.id,
          completedAt: request.deadline + 1,
        })
      )
      expect(completed.state.active).toHaveLength(0)
    })
  )

  it.effect('failed request removes from queues and records event', () =>
    Effect.gen(function* () {
      const state = yield* makeInitialState(config)
      const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
        id: randomUUID(),
        chunk: 'chunk-fail',
        priority: 'normal',
        action: 'load',
        createdAt: 0,
        deadline: 1,
      })
      const scheduled = yield* applyCommand(state, ChunkCommand.Schedule({ request }))
      const failed = yield* applyCommand(
        scheduled.state,
        ChunkCommand.Fail({
          requestId: request.id,
          occurredAt: request.deadline + 2,
          reason: 'timeout',
        })
      )
      expect(failed.state.active).toHaveLength(0)
      expect(failed.events[0]?._tag).toBe('RequestFailed')
    })
  )

  it.effect('switch strategy only emits event when strategy changes', () =>
    Effect.gen(function* () {
      const state = yield* makeInitialState(config)
      const unchanged = yield* applyCommand(
        state,
        ChunkCommand.SwitchStrategy({ strategy: config.initialStrategy, decidedAt: 20 })
      )
      expect(unchanged.events).toHaveLength(0)
      const changed = yield* applyCommand(state, ChunkCommand.SwitchStrategy({ strategy: 'alternate', decidedAt: 30 }))
      expect(changed.events[0]?._tag).toBe('StrategyShifted')
    })
  )
})
