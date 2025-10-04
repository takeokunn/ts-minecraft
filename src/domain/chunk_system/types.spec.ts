import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Either } from 'effect'
import * as fc from 'effect/FastCheck'
import { randomUUID } from 'node:crypto'
import {
  ChunkActionSchema,
  ChunkIdSchema,
  ChunkPrioritySchema,
  ChunkRequestSchema,
  ChunkSystemError,
  EpochMillisecondsSchema,
  ResourceBudgetSchema,
} from './types.js'

const epochArbitrary = fc.integer({ min: 0, max: 1_000_000 })
const chunkIdArbitrary = fc.string({ minLength: 1, maxLength: 32 }).filter((value) => /^[a-z0-9\-_/]+$/.test(value))
const priorityArbitrary = fc.constantFrom('critical', 'high', 'normal', 'low')
const actionArbitrary = fc.constantFrom('load', 'warmup', 'unload')

const chunkRequestArbitrary = fc.record({
  id: fc.uuid(),
  chunk: chunkIdArbitrary,
  priority: priorityArbitrary,
  action: actionArbitrary,
  createdAt: epochArbitrary,
  deadline: epochArbitrary.map((value) => value + 10),
})

const resourceBudgetArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 32 }),
  strategy: fc.constantFrom('strict', 'adaptive', 'burst'),
  maxConcurrent: fc.integer({ min: 1, max: 16 }),
  maxMemoryMiB: fc.integer({ min: 1, max: 8_192 }),
  maxBandwidthMbps: fc.integer({ min: 1, max: 1_024 }),
})

describe('chunk_system/types', () => {
  it.effect.prop('ChunkRequest schema accepts valid payloads', [chunkRequestArbitrary], ([input]) =>
    Effect.gen(function* () {
      const request = yield* Schema.decodeUnknown(ChunkRequestSchema)(input)
      expect(request.id).toEqual(input.id)
      expect(request.chunk).toEqual(input.chunk)
      expect(request.deadline).toBeGreaterThanOrEqual(request.createdAt)
    })
  )

  it.effect('ChunkRequest schema rejects deadline earlier than createdAt', () =>
    Effect.gen(function* () {
      const invalid = {
        id: randomUUID(),
        chunk: 'chunk-1',
        priority: 'high',
        action: 'load',
        createdAt: 100,
        deadline: 50,
      }
      const exit = yield* Effect.either(Schema.decodeUnknown(ChunkRequestSchema)(invalid))
      expect(Either.isLeft(exit)).toBe(true)
    })
  )

  it.effect.prop('ResourceBudget schema saturates across ranges', [resourceBudgetArbitrary], ([input]) =>
    Effect.gen(function* () {
      const budget = yield* Schema.decodeUnknown(ResourceBudgetSchema)(input)
      expect(budget.maxConcurrent).toBeGreaterThanOrEqual(1)
      expect(budget.maxMemoryMiB).toBeGreaterThan(0)
    })
  )

  it.effect('ChunkSystemError constructors produce tagged values', () =>
    Effect.gen(function* () {
      const request = yield* Schema.decodeUnknown(ChunkRequestSchema)({
        id: randomUUID(),
        chunk: 'chunk-core',
        priority: 'critical',
        action: 'load',
        createdAt: 10,
        deadline: 15,
      })
      const budget = yield* Schema.decodeUnknown(ResourceBudgetSchema)({
        id: 'budget',
        strategy: 'strict',
        maxConcurrent: 1,
        maxMemoryMiB: 256,
        maxBandwidthMbps: 128,
      })
      const error = ChunkSystemError.ResourceBudgetExceeded({ request, budget })
      expect(error._tag).toBe('ResourceBudgetExceeded')
    })
  )

  it.effect.prop('Epoch milliseconds schema filters negatives', [fc.integer({ min: -10, max: -1 })], ([value]) =>
    Effect.gen(function* () {
      const exit = yield* Effect.either(Schema.decodeUnknown(EpochMillisecondsSchema)(value))
      expect(Either.isLeft(exit)).toBe(true)
    })
  )

  it.effect.prop('ChunkId schema enforces allowed characters', [chunkIdArbitrary], ([value]) =>
    Schema.decodeUnknown(ChunkIdSchema)(value).pipe(
      Effect.map((chunkId) => expect(chunkId.startsWith(value)).toBe(true))
    )
  )

  it.effect.prop(
    'Enumerations only accept defined members',
    [priorityArbitrary, actionArbitrary],
    ([priority, action]) =>
      Effect.gen(function* () {
        const decodedPriority = yield* Schema.decodeUnknown(ChunkPrioritySchema)(priority)
        const decodedAction = yield* Schema.decodeUnknown(ChunkActionSchema)(action)
        expect(decodedPriority).toBe(priority)
        expect(decodedAction).toBe(action)
      })
  )
})
