import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import { executeCommand } from '../../application_service/session_manager'
import { makeSessionStore } from '../../repository/session_store'
import { InteractionCommand } from '../../types'
import { fromNormalVector } from '../../value_object/block_face'
import { fromNumbers } from '../../value_object/vector3'

describe('session_manager', () => {
  it.effect('starts a breaking session', () =>
    Effect.gen(function* () {
      const store = yield* makeSessionStore
      const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
      const position = yield* fromNumbers(0, 0, 0)
      const command: Extract<InteractionCommand, { readonly _tag: 'StartBreaking' }> = {
        _tag: 'StartBreaking',
        playerId: 'player-1',
        blockId: 'stone',
        position,
        face,
      }

      const events = yield* executeCommand(command, store)
      expect(events.length).toBe(1)

      const sessions = yield* store.list
      expect(sessions.length).toBe(1)
    })
  )

  it.effect('continues and completes a breaking session', () =>
    Effect.gen(function* () {
      const store = yield* makeSessionStore
      const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
      const position = yield* fromNumbers(0, 0, 0)
      const startCommand: Extract<InteractionCommand, { readonly _tag: 'StartBreaking' }> = {
        _tag: 'StartBreaking',
        playerId: 'player-1',
        blockId: 'stone',
        position,
        face,
      }
      yield* executeCommand(startCommand, store)

      const sessions = yield* store.list
      const sessionId = pipe(
        Option.fromNullable(sessions[0]),
        Option.map((session) => session.id)
      )

      const continueCommand = pipe(
        sessionId,
        Option.match({
          onNone: () => Effect.fail(new Error('session not created')),
          onSome: (value) =>
            Effect.succeed<Extract<InteractionCommand, { readonly _tag: 'ContinueBreaking' }>>({
              _tag: 'ContinueBreaking',
              sessionId: value,
              progressDelta: 0.6,
            }),
        })
      )
      const continueEvents = yield* pipe(
        continueCommand,
        Effect.flatMap((command) => executeCommand(command, store))
      )
      expect(continueEvents.length).toBe(1)

      const completeCommand = pipe(
        sessionId,
        Option.match({
          onNone: () => Effect.fail(new Error('session not created')),
          onSome: (value) =>
            Effect.succeed<Extract<InteractionCommand, { readonly _tag: 'CompleteBreaking' }>>({
              _tag: 'CompleteBreaking',
              sessionId: value,
            }),
        })
      )
      const completeEvents = yield* pipe(
        completeCommand,
        Effect.flatMap((command) => executeCommand(command, store))
      )
      expect(completeEvents.length).toBe(2)
    })
  )

  it.effect('places a block after validation', () =>
    Effect.gen(function* () {
      const store = yield* makeSessionStore
      const face = yield* fromNormalVector(yield* fromNumbers(0, 0, 1))
      const blockPosition = yield* fromNumbers(0, 0, 1)
      const playerPosition = yield* fromNumbers(0, 0, 0)

      const command: Extract<InteractionCommand, { readonly _tag: 'PlaceBlock' }> = {
        _tag: 'PlaceBlock',
        playerId: 'player-1',
        blockId: 'stone',
        position: blockPosition,
        playerPosition,
        face,
      }

      const events = yield* executeCommand(command, store)

      expect(events[0]?._tag).toBe('BlockPlaced')
    })
  )
})
