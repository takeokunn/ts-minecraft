import { describe, it } from '@effect/vitest'
import { expect, it as plainIt } from 'vitest'
import { Effect, Either, Option, Schema } from 'effect'
import { PlayerService, PlayerStateSchema } from '@/application/player/player-state'
import { PlayerError } from '@/domain/errors'
import type { PlayerId, Position } from '@/shared/kernel'

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
        const errCreate = Option.getOrThrow(Either.getLeft(result))
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
        const err1 = Option.getOrThrow(Either.getLeft(result))
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
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('PlayerError')
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
        const err2 = Option.getOrThrow(Either.getLeft(result))
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
        const err3 = Option.getOrThrow(Either.getLeft(result))
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

  describe('multiple players isolation', () => {
    it.effect('should isolate position between two players', () =>
      Effect.gen(function* () {
        const idA = 'player-alpha' as PlayerId
        const idB = 'player-beta' as PlayerId
        const posA: Position = { x: 10, y: 64, z: 20 }
        const posB: Position = { x: -100, y: 30, z: -50 }
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)

        const retrievedA = yield* service.getPosition(idA)
        const retrievedB = yield* service.getPosition(idB)

        expect(retrievedA).toEqual(posA)
        expect(retrievedB).toEqual(posB)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should isolate velocity between two players', () =>
      Effect.gen(function* () {
        const idA = 'player-alpha' as PlayerId
        const idB = 'player-beta' as PlayerId
        const service = yield* PlayerService
        yield* service.create(idA, { x: 0, y: 64, z: 0 })
        yield* service.create(idB, { x: 10, y: 64, z: 10 })

        const velA = yield* service.getVelocity(idA)
        const velB = yield* service.getVelocity(idB)

        expect(velA).toEqual({ x: 0, y: 0, z: 0 })
        expect(velB).toEqual({ x: 0, y: 0, z: 0 })
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should isolate state between two players', () =>
      Effect.gen(function* () {
        const idA = 'player-alpha' as PlayerId
        const idB = 'player-beta' as PlayerId
        const posA: Position = { x: 1, y: 2, z: 3 }
        const posB: Position = { x: 4, y: 5, z: 6 }
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)

        const stateA = yield* service.getState(idA)
        const stateB = yield* service.getState(idB)

        expect(stateA.id).toBe(idA)
        expect(stateB.id).toBe(idB)
        expect(stateA.position).toEqual(posA)
        expect(stateB.position).toEqual(posB)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('updating one player should not affect the other', () =>
      Effect.gen(function* () {
        const idA = 'player-alpha' as PlayerId
        const idB = 'player-beta' as PlayerId
        const posA: Position = { x: 0, y: 64, z: 0 }
        const posB: Position = { x: 50, y: 64, z: 50 }
        const newPosA: Position = { x: 999, y: 999, z: 999 }
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)
        yield* service.updatePosition(idA, newPosA)

        const stateA = yield* service.getState(idA)
        const stateB = yield* service.getState(idB)

        expect(stateA.position).toEqual(newPosA)
        expect(stateB.position).toEqual(posB)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('PlayerStateSchema', () => {
    plainIt('should decode a valid player state', () => {
      const data = {
        id: 'player-1',
        position: { x: 0, y: 64, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      }
      const result = Schema.decodeUnknownSync(PlayerStateSchema)(data)
      expect(result.id).toBe('player-1')
      expect(result.position).toEqual({ x: 0, y: 64, z: 0 })
      expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 })
      expect(result.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    })

    plainIt('should reject player state with missing fields', () => {
      expect(() =>
        Schema.decodeUnknownSync(PlayerStateSchema)({ id: 'player-1' })
      ).toThrow()
    })

    plainIt('should reject player state with NaN position', () => {
      expect(() =>
        Schema.decodeUnknownSync(PlayerStateSchema)({
          id: 'player-1',
          position: { x: NaN, y: 64, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        })
      ).toThrow()
    })

    plainIt('should reject player state with Infinity velocity', () => {
      expect(() =>
        Schema.decodeUnknownSync(PlayerStateSchema)({
          id: 'player-1',
          position: { x: 0, y: 64, z: 0 },
          velocity: { x: Infinity, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        })
      ).toThrow()
    })
  })

  describe('error details', () => {
    it.effect('PlayerError from create duplicate should have playerId matching input', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* Effect.either(service.create(testPlayerId, { x: 1, y: 2, z: 3 }))
        expect(Either.isLeft(result)).toBe(true)
        const err5 = Option.getOrThrow(Either.getLeft(result))
        expect(err5.playerId).toBe(testPlayerId)
        expect(err5.reason).toBe('Player already exists')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from getPosition non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getPosition('missing' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        const err6 = Option.getOrThrow(Either.getLeft(result))
        expect(err6.playerId).toBe('missing')
        expect(err6.reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from updatePosition non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.updatePosition('missing' as PlayerId, { x: 0, y: 0, z: 0 }))
        expect(Either.isLeft(result)).toBe(true)
        const err7 = Option.getOrThrow(Either.getLeft(result))
        expect(err7.playerId).toBe('missing')
        expect(err7.reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from getVelocity non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getVelocity('missing' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result)).reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('PlayerError from getState non-existent should have correct reason', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* Effect.either(service.getState('missing' as PlayerId))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result)).reason).toBe('Player not found')
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
