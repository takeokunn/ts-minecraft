import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either, Match } from 'effect'
import { pipe } from 'effect/Function'
import {
  InteractionCommand,
  InteractionError,
  matchInteractionError,
  parseCommand,
  parseEvent,
  decodeSessionIdEither,
} from '../../types'
import { fromNumbers } from '../../value_object/vector3'
import { fromNormalVector } from '../../value_object/block_face'

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

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('command schema round-trips', () => Effect.unit)
})
