import { describe, it } from '@effect/vitest'
import { expect, it as plainIt } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { PlayerService } from '@ts-minecraft/player'
import { PlayerError } from '../domain/errors'
import type { PlayerId, Position } from '@ts-minecraft/kernel'

const testPlayerId = 'player-1' as PlayerId
const testPosition: Position = { x: 0, y: 64, z: 0 }
const TestLayer = PlayerService.Default

describe('PlayerService', () => {
  describe('PlayerError properties', () => {
    plainIt('should have _tag === "PlayerError"', () => {
      const err = new PlayerError({ playerId: 'test-player', reason: 'test reason' })
      expect(err._tag).toBe('PlayerError')
    })

    plainIt('should include playerId in message', () => {
      const err = new PlayerError({ playerId: 'test-player-123', reason: 'not found' })
      expect(err.message).toContain('test-player-123')
    })

    plainIt('should include reason in message', () => {
      const err = new PlayerError({ playerId: 'p1', reason: 'Player already exists' })
      expect(err.message).toContain('Player already exists')
    })

    plainIt('should produce a non-empty message string', () => {
      const err = new PlayerError({ playerId: 'any-id', reason: 'some reason' })
      expect(typeof err.message).toBe('string')
      expect(err.message.length).toBeGreaterThan(0)
    })

    it.effect('should include playerId from caught error in Effect.either', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getPosition(testPlayerId))
        expect(Either.isLeft(result)).toBe(true)
        const err4 = Option.getOrThrow(Either.getLeft(result))
        expect(err4._tag).toBe('PlayerError')
        expect(err4.message).toContain(testPlayerId)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Effect.catchTag compatibility', () => {
    it.effect('should catch PlayerError with catchTag on getPosition for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.getPosition('nonexistent' as PlayerId).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.playerId}`))
        )
        expect(result).toBe('caught: nonexistent')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should catch PlayerError with catchTag on create duplicate', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* service.create(testPlayerId, testPosition).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.reason}`))
        )
        expect(result).toBe('caught: Player already exists')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should catch PlayerError with catchTag on updatePosition for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.updatePosition('ghost' as PlayerId, { x: 0, y: 0, z: 0 }).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.reason}`))
        )
        expect(result).toBe('caught: Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should catch PlayerError with catchTag on getVelocity for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.getVelocity('ghost' as PlayerId).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.playerId}`))
        )
        expect(result).toBe('caught: ghost')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should catch PlayerError with catchTag on getState for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.getState('ghost' as PlayerId).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.playerId}`))
        )
        expect(result).toBe('caught: ghost')
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
