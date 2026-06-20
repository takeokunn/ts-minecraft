import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { PlayerService } from '@ts-minecraft/entity/application/player-service';
import type { PlayerId, Position } from '@ts-minecraft/core'

const testPlayerId = 'player-1' as PlayerId
const testPosition: Position = { x: 0, y: 64, z: 0 }
const TestLayer = PlayerService.Default

describe('PlayerService', () => {
  describe('typed Effect.catchTag handling', () => {
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
