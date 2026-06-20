import { describe,it } from '@effect/vitest'
import type { PlayerId,Position } from '@ts-minecraft/core'
import { PlayerService } from '@ts-minecraft/entity/application/player-service';
import { Effect,Either } from 'effect'
import { expect } from 'vitest'
import { expectSome } from './test-utils'

const testPlayerId = 'player-1' as PlayerId
const testPosition: Position = { x: 0, y: 64, z: 0 }
const TestLayer = PlayerService.Default

describe('PlayerService', () => {
  describe('error details', () => {
    it.effect('PlayerError from create duplicate should have playerId matching input', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* Effect.either(service.create(testPlayerId, { x: 1, y: 2, z: 3 }))
        expect(Either.isLeft(result)).toBe(true)
        const err5 = expectSome(Either.getLeft(result))
        expect(err5.playerId).toBe(testPlayerId)
        expect(err5.reason).toBe('Player already exists')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from getPosition non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getPosition('missing' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        const err6 = expectSome(Either.getLeft(result))
        expect(err6.playerId).toBe('missing')
        expect(err6.reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from updatePosition non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.updatePosition('missing' as PlayerId, { x: 0, y: 0, z: 0 }))
        expect(Either.isLeft(result)).toBe(true)
        const err7 = expectSome(Either.getLeft(result))
        expect(err7.playerId).toBe('missing')
        expect(err7.reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from getVelocity non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getVelocity('missing' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        expect(expectSome(Either.getLeft(result)).reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from getState non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getState('missing' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        expect(expectSome(Either.getLeft(result)).reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
