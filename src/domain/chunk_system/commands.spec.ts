import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either } from 'effect'
import { randomUUID } from 'node:crypto'
import { ChunkCommand, decodeCommand } from './commands.js'
import { ChunkRequestSchema } from './types.js'
import { Schema } from '@effect/schema'

const chunkRequestArbitrary = fc.record({
  id: fc.uuid(),
  chunk: fc.constantFrom('chunk-a', 'chunk-b', 'chunk-c'),
  priority: fc.constantFrom('critical', 'high', 'normal', 'low'),
  action: fc.constantFrom('load', 'warmup', 'unload'),
  createdAt: fc.integer({ min: 0, max: 1_000 }),
  deadline: fc.integer({ min: 1_000, max: 2_000 }),
})

describe('chunk_system/commands', () => {
  it.effect.prop('decodeCommand yields ChunkCommand instances', [chunkRequestArbitrary], ([request]) =>
    Effect.gen(function* () {
      const parsedRequest = yield* Schema.decodeUnknown(ChunkRequestSchema)(request)
      const command = yield* decodeCommand({ _tag: 'Schedule', request: parsedRequest })
      expect(command._tag).toBe('Schedule')
      expect(command.request.id).toBe(parsedRequest.id)
    })
  )

  it.effect('decodeCommand rejects invalid payloads', () =>
    Effect.gen(function* () {
      const invalid: unknown = { _tag: 'Schedule', request: { id: randomUUID() } }
      const exit = yield* Effect.either(decodeCommand(invalid))
      expect(Either.isLeft(exit)).toBe(true)
    })
  )

  it.effect.prop('SwitchStrategy commands carry strategy id', [fc.string({ minLength: 1, maxLength: 5 })], ([strategy]) =>
    Effect.gen(function* () {
      const decoded = yield* decodeCommand({
        _tag: 'SwitchStrategy',
        strategy,
        decidedAt: 100,
      })
      expect(decoded).toEqual(ChunkCommand.SwitchStrategy({ strategy, decidedAt: 100 }))
    })
  )
})
