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
  describe('service structure', () => {
    it.effect('should provide all required methods', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        expect(typeof service.create).toBe('function')
        expect(typeof service.updatePosition).toBe('function')
        expect(typeof service.getPosition).toBe('function')
        expect(typeof service.getVelocity).toBe('function')
        expect(typeof service.getState).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('create', () => {
    it.effect('should create a player without error', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail with PlayerError when creating the same player twice', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* Effect.either(service.create(testPlayerId, testPosition))
        expect(Either.isLeft(result)).toBe(true)
        const errCreate = expectSome(Either.getLeft(result))
        expect(errCreate._tag).toBe('PlayerError')
        expect(errCreate.reason).toContain('already exists')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should succeed creating multiple players with different ids', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create('player-a' as PlayerId, { x: 0, y: 64, z: 0 })
        yield* service.create('player-b' as PlayerId, { x: 10, y: 64, z: 10 })
        yield* service.create('player-c' as PlayerId, { x: -10, y: 64, z: -10 })
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('getPosition', () => {
    it.effect('should return the initial position after create', () =>
      Effect.gen(function* () {
        const position: Position = { x: 10, y: 64, z: -5 }
        const service = yield* PlayerService
        yield* service.create(testPlayerId, position)
        const result = yield* service.getPosition(testPlayerId)
        expect(result).toEqual(position)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail with PlayerError for a non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getPosition('nonexistent' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        const err1 = expectSome(Either.getLeft(result))
        expect(err1._tag).toBe('PlayerError')
        expect(err1.reason).toContain('not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return position with correct x, y, z values', () =>
      Effect.gen(function* () {
        const position: Position = { x: 100, y: 70, z: -200 }
        const service = yield* PlayerService
        yield* service.create(testPlayerId, position)
        const result = yield* service.getPosition(testPlayerId)
        expect(result.x).toBe(100)
        expect(result.y).toBe(70)
        expect(result.z).toBe(-200)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('updatePosition', () => {
    it.effect('should update position so getPosition returns the new position', () =>
      Effect.gen(function* () {
        const initialPos: Position = { x: 0, y: 64, z: 0 }
        const newPos: Position = { x: 50, y: 80, z: 30 }
        const service = yield* PlayerService
        yield* service.create(testPlayerId, initialPos)
        yield* service.updatePosition(testPlayerId, newPos)
        const result = yield* service.getPosition(testPlayerId)
        expect(result).toEqual(newPos)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail with PlayerError when updating position for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(
          service.updatePosition('ghost' as PlayerId, { x: 1, y: 2, z: 3 })
        )
        expect(Either.isLeft(result)).toBe(true)
        expect(expectSome(Either.getLeft(result))._tag).toBe('PlayerError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should use the last position after multiple updates', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, { x: 0, y: 64, z: 0 })
        yield* service.updatePosition(testPlayerId, { x: 10, y: 65, z: 10 })
        yield* service.updatePosition(testPlayerId, { x: 20, y: 66, z: 20 })
        const finalPos: Position = { x: 30, y: 67, z: 30 }
        yield* service.updatePosition(testPlayerId, finalPos)
        const result = yield* service.getPosition(testPlayerId)
        expect(result).toEqual({ x: 30, y: 67, z: 30 })
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("should not affect other players when updating one player's position", () =>
      Effect.gen(function* () {
        const idA = 'player-a' as PlayerId
        const idB = 'player-b' as PlayerId
        const posA: Position = { x: 0, y: 64, z: 0 }
        const posB: Position = { x: 100, y: 64, z: 100 }
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)
        yield* service.updatePosition(idA, { x: 999, y: 999, z: 999 })
        const result = yield* service.getPosition(idB)
        expect(result).toEqual(posB)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('updateVelocity', () => {
    it.effect('should update velocity so getVelocity returns the new velocity', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        yield* service.updateVelocity(testPlayerId, { x: 1, y: -2, z: 3 })
        const result = yield* service.getVelocity(testPlayerId)
        expect(result).toEqual({ x: 1, y: -2, z: 3 })
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail with PlayerError when updating velocity for a non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(
          service.updateVelocity('ghost-velocity' as PlayerId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        const err = expectSome(Either.getLeft(result))
        expect(err._tag).toBe('PlayerError')
        expect(err.reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should reflect updated velocity in getState after updateVelocity', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        yield* service.updateVelocity(testPlayerId, { x: 5, y: 0, z: -5 })
        const state = yield* service.getState(testPlayerId)
        expect(state.velocity).toEqual({ x: 5, y: 0, z: -5 })
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('getVelocity', () => {
    it.effect('should return zero vector {x:0,y:0,z:0} for a newly created player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* service.getVelocity(testPlayerId)
        expect(result).toEqual({ x: 0, y: 0, z: 0 })
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail with PlayerError for a non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getVelocity('nonexistent' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        const err2 = expectSome(Either.getLeft(result))
        expect(err2._tag).toBe('PlayerError')
        expect(err2.reason).toContain('not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should have velocity x=0, y=0, z=0 individually', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* service.getVelocity(testPlayerId)
        expect(result.x).toBe(0)
        expect(result.y).toBe(0)
        expect(result.z).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('getState', () => {
    it.effect('should return complete state with id, position, velocity, and rotation after create', () =>
      Effect.gen(function* () {
        const position: Position = { x: 5, y: 70, z: -3 }
        const service = yield* PlayerService
        yield* service.create(testPlayerId, position)
        const result = yield* service.getState(testPlayerId)
        expect(result.id).toBe(testPlayerId)
        expect(result.position).toEqual(position)
        expect(result).toHaveProperty('velocity')
        expect(result).toHaveProperty('rotation')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should have initial velocity as zero vector {x:0,y:0,z:0}', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* service.getState(testPlayerId)
        expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 })
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should have initial rotation as identity quaternion {x:0,y:0,z:0,w:1}', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* service.getState(testPlayerId)
        expect(result.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail with PlayerError for a non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getState('ghost' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        const err3 = expectSome(Either.getLeft(result))
        expect(err3._tag).toBe('PlayerError')
        expect(err3.reason).toContain('not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should reflect updated position in state after updatePosition', () =>
      Effect.gen(function* () {
        const newPos: Position = { x: 99, y: 100, z: -50 }
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        yield* service.updatePosition(testPlayerId, newPos)
        const result = yield* service.getState(testPlayerId)
        expect(result.position).toEqual(newPos)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
