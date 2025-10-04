import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Either } from 'effect'
import * as fc from 'effect/FastCheck'
import { randomUUID } from 'node:crypto'
import { ChunkEvent, decodeEvent } from './events.js'
import { ChunkRequestSchema } from './types.js'

const chunkRequestArbitrary = fc.record({
  id: fc.uuid(),
  chunk: fc.constantFrom('chunk-a', 'chunk-b', 'chunk-c'),
  priority: fc.constantFrom('critical', 'high', 'normal', 'low'),
  action: fc.constantFrom('load', 'warmup', 'unload'),
  createdAt: fc.integer({ min: 0, max: 1_000 }),
  deadline: fc.integer({ min: 1_000, max: 2_000 }),
})

describe('chunk_system/events', () => {
  it.effect.prop('decodeEvent creates tagged events', [chunkRequestArbitrary], ([request]) =>
    Effect.gen(function* () {
      const parsed = yield* Schema.decodeUnknown(ChunkRequestSchema)(request)
      const event = yield* decodeEvent({ _tag: 'RequestQueued', request: parsed })
      expect(event).toEqual(ChunkEvent.RequestQueued({ request: parsed }))
    })
  )

  it.effect('decodeEvent rejects malformed input', () =>
    Effect.gen(function* () {
      const invalid: unknown = { _tag: 'Unknown', requestId: randomUUID() }
      const exit = yield* Effect.either(decodeEvent(invalid))
      expect(Either.isLeft(exit)).toBe(true)
    })
  )

  it.effect.prop(
    'RequestCompleted roundtrip',
    [fc.uuid(), fc.integer({ min: 0, max: 1_000 })],
    ([requestId, completedAt]) =>
      decodeEvent({ _tag: 'RequestCompleted', requestId, completedAt }).pipe(
        Effect.map((event) => expect(event).toEqual(ChunkEvent.RequestCompleted({ requestId, completedAt })))
      )
  )
})
