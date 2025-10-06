import { describe, expect, it } from '@effect/vitest'
import { Effect, Either, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  decodeSessionIdEither,
  InteractionCommandSchema,
  InteractionError,
  matchInteractionError,
  parseCommand,
  parseEvent,
} from '../../types'
import { fromNumbers } from '../../value_object/vector3'

const propertyConfig: fc.Parameters = { numRuns: 64 }

const identifierCharacters = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  '-',
  '_',
]

const identifier = fc
  .array(fc.constantFrom(...identifierCharacters), { minLength: 1, maxLength: 16 })
  .map((chars) => chars.join(''))

const finiteNumber = fc.float({ min: -1_000, max: 1_000, noDefaultInfinity: true, noNaN: true })

const vectorLiteral = fc.tuple(finiteNumber, finiteNumber, finiteNumber).map(([x, y, z]) => ({ x, y, z }))

const faceLiteral = fc.constantFrom('north', 'south', 'east', 'west', 'up', 'down')

const startBreaking = fc.record({
  _tag: fc.constant<'StartBreaking'>('StartBreaking'),
  playerId: identifier,
  blockId: identifier,
  position: vectorLiteral,
  face: faceLiteral,
})

const continueBreaking = fc.record({
  _tag: fc.constant<'ContinueBreaking'>('ContinueBreaking'),
  sessionId: identifier,
  progressDelta: fc.float({ min: 0, max: 1, noDefaultInfinity: true, noNaN: true }),
})

const completeBreaking = fc.record({
  _tag: fc.constant<'CompleteBreaking'>('CompleteBreaking'),
  sessionId: identifier,
})

const placeBlock = fc.record({
  _tag: fc.constant<'PlaceBlock'>('PlaceBlock'),
  playerId: identifier,
  blockId: identifier,
  position: vectorLiteral,
  playerPosition: vectorLiteral,
  face: faceLiteral,
})

const commandArbitrary = fc.oneof(startBreaking, continueBreaking, completeBreaking, placeBlock)

describe('types', () => {
  it.effect('parses valid commands', () =>
    Effect.gen(function* () {
      const position = yield* fromNumbers(1, 2, 3)
      const event = yield* parseEvent({
        _tag: 'BlockPlaced',
        playerId: 'player-1',
        blockId: 'stone',
        position,
        face: 'north',
        occurredAt: 10,
      })
      expect(event._tag).toBe('BlockPlaced')
    })
  )

  it('rejects malformed session identifiers', () => {
    const result = decodeSessionIdEither(' ') // whitespace invalid
    expect(Either.isLeft(result)).toBe(true)
  })

  it('matches interaction errors via matcher', () => {
    const error = InteractionError.InvalidCommand({ message: 'oops' })
    const message = matchInteractionError(error, {
      invalidCommand: (value) => value.message,
      unknownSession: () => 'unknown',
      invalidProgress: () => 'progress',
      placementRejected: () => 'placement',
    })
    expect(message).toBe('oops')
  })

  it('command schema round-trips (PBT)', () =>
    fc.assert(
      fc.property(commandArbitrary, (command) => {
        const parsed = Effect.runSync(parseCommand(command))
        const encoded = Effect.runSync(Schema.encode(InteractionCommandSchema)(parsed))
        const reparsed = Effect.runSync(parseCommand(encoded))
        expect(reparsed).toStrictEqual(parsed)
      }),
      propertyConfig
    ))
})
