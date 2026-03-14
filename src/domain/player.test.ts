import { describe, it, expect } from 'vitest'
import { it as effectIt } from '@effect/vitest'
import { Effect, Either, Schema } from 'effect'
import { PlayerService, PlayerStateSchema } from '@/domain/player'
import { PlayerError } from '@/domain/errors'
import type { PlayerId, Position } from '@/shared/kernel'

const testPlayerId = 'player-1' as PlayerId
const testPosition: Position = { x: 0, y: 64, z: 0 }
const TestLayer = PlayerService.Default

const runPlayerTest = <A>(program: Effect.Effect<A, PlayerError, PlayerService>) =>
  Effect.runSync(program.pipe(Effect.provide(TestLayer)))

describe('PlayerService', () => {
  describe('service structure', () => {
    it('should provide all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        expect(typeof service.create).toBe('function')
        expect(typeof service.updatePosition).toBe('function')
        expect(typeof service.getPosition).toBe('function')
        expect(typeof service.getVelocity).toBe('function')
        expect(typeof service.getState).toBe('function')
        return { success: true }
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(result.success).toBe(true)
    })
  })

  describe('create', () => {
    it('should create a player without error', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return { success: true }
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(result.success).toBe(true)
    })

    it('should fail with PlayerError when creating the same player twice', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return yield* Effect.either(service.create(testPlayerId, testPosition))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('PlayerError')
        expect(result.left.reason).toContain('already exists')
      }
    })

    it('should succeed creating multiple players with different ids', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create('player-a' as PlayerId, { x: 0, y: 64, z: 0 })
        yield* service.create('player-b' as PlayerId, { x: 10, y: 64, z: 10 })
        yield* service.create('player-c' as PlayerId, { x: -10, y: 64, z: -10 })
        return { success: true }
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(result.success).toBe(true)
    })
  })

  describe('getPosition', () => {
    it('should return the initial position after create', () => {
      const position: Position = { x: 10, y: 64, z: -5 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, position)
        return yield* service.getPosition(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result).toEqual(position)
    })

    it('should fail with PlayerError for a non-existent player', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getPosition('nonexistent' as PlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('PlayerError')
        expect(result.left.reason).toContain('not found')
      }
    })

    it('should return position with correct x, y, z values', () => {
      const position: Position = { x: 100, y: 70, z: -200 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, position)
        return yield* service.getPosition(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result.x).toBe(100)
      expect(result.y).toBe(70)
      expect(result.z).toBe(-200)
    })
  })

  describe('updatePosition', () => {
    it('should update position so getPosition returns the new position', () => {
      const initialPos: Position = { x: 0, y: 64, z: 0 }
      const newPos: Position = { x: 50, y: 80, z: 30 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, initialPos)
        yield* service.updatePosition(testPlayerId, newPos)
        return yield* service.getPosition(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result).toEqual(newPos)
    })

    it('should fail with PlayerError when updating position for non-existent player', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(
          service.updatePosition('ghost' as PlayerId, { x: 1, y: 2, z: 3 })
        )
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('PlayerError')
      }
    })

    it('should use the last position after multiple updates', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, { x: 0, y: 64, z: 0 })
        yield* service.updatePosition(testPlayerId, { x: 10, y: 65, z: 10 })
        yield* service.updatePosition(testPlayerId, { x: 20, y: 66, z: 20 })
        const finalPos: Position = { x: 30, y: 67, z: 30 }
        yield* service.updatePosition(testPlayerId, finalPos)
        return yield* service.getPosition(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result).toEqual({ x: 30, y: 67, z: 30 })
    })

    it('should not affect other players when updating one player\'s position', () => {
      const idA = 'player-a' as PlayerId
      const idB = 'player-b' as PlayerId
      const posA: Position = { x: 0, y: 64, z: 0 }
      const posB: Position = { x: 100, y: 64, z: 100 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)
        yield* service.updatePosition(idA, { x: 999, y: 999, z: 999 })
        return yield* service.getPosition(idB)
      })
      const result = runPlayerTest(program)
      expect(result).toEqual(posB)
    })
  })

  describe('getVelocity', () => {
    it('should return zero vector {x:0,y:0,z:0} for a newly created player', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return yield* service.getVelocity(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('should fail with PlayerError for a non-existent player', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getVelocity('nonexistent' as PlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('PlayerError')
        expect(result.left.reason).toContain('not found')
      }
    })

    it('should have velocity x=0, y=0, z=0 individually', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return yield* service.getVelocity(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
      expect(result.z).toBe(0)
    })
  })

  describe('getState', () => {
    it('should return complete state with id, position, velocity, and rotation after create', () => {
      const position: Position = { x: 5, y: 70, z: -3 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, position)
        return yield* service.getState(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result.id).toBe(testPlayerId)
      expect(result.position).toEqual(position)
      expect(result).toHaveProperty('velocity')
      expect(result).toHaveProperty('rotation')
    })

    it('should have initial velocity as zero vector {x:0,y:0,z:0}', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return yield* service.getState(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result.velocity).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('should have initial rotation as identity quaternion {x:0,y:0,z:0,w:1}', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return yield* service.getState(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    })

    it('should fail with PlayerError for a non-existent player', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getState('ghost' as PlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('PlayerError')
        expect(result.left.reason).toContain('not found')
      }
    })

    it('should reflect updated position in state after updatePosition', () => {
      const newPos: Position = { x: 99, y: 100, z: -50 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        yield* service.updatePosition(testPlayerId, newPos)
        return yield* service.getState(testPlayerId)
      })
      const result = runPlayerTest(program)
      expect(result.position).toEqual(newPos)
    })
  })

  describe('PlayerError properties', () => {
    it('should have _tag === "PlayerError"', () => {
      const err = new PlayerError({ playerId: 'test-player', reason: 'test reason' })
      expect(err._tag).toBe('PlayerError')
    })

    it('should include playerId in message', () => {
      const err = new PlayerError({ playerId: 'test-player-123', reason: 'not found' })
      expect(err.message).toContain('test-player-123')
    })

    it('should include reason in message', () => {
      const err = new PlayerError({ playerId: 'p1', reason: 'Player already exists' })
      expect(err.message).toContain('Player already exists')
    })

    it('should produce a non-empty message string', () => {
      const err = new PlayerError({ playerId: 'any-id', reason: 'some reason' })
      expect(typeof err.message).toBe('string')
      expect(err.message.length).toBeGreaterThan(0)
    })

    it('should include playerId from caught error in Effect.either', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getPosition(testPlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe('PlayerError')
        expect(result.left.message).toContain(testPlayerId)
      }
    })
  })

  describe('Effect.catchTag compatibility', () => {
    effectIt.effect('should catch PlayerError with catchTag on getPosition for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.getPosition('nonexistent' as PlayerId).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.playerId}`))
        )
        expect(result).toBe('caught: nonexistent')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch PlayerError with catchTag on create duplicate', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        const result = yield* service.create(testPlayerId, testPosition).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.reason}`))
        )
        expect(result).toBe('caught: Player already exists')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch PlayerError with catchTag on updatePosition for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.updatePosition('ghost' as PlayerId, { x: 0, y: 0, z: 0 }).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.reason}`))
        )
        expect(result).toBe('caught: Player not found')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch PlayerError with catchTag on getVelocity for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* PlayerService
        const result = yield* service.getVelocity('ghost' as PlayerId).pipe(
          Effect.catchTag('PlayerError', (e) => Effect.succeed(`caught: ${e.playerId}`))
        )
        expect(result).toBe('caught: ghost')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch PlayerError with catchTag on getState for non-existent player', () =>
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
    it('should isolate position between two players', () => {
      const idA = 'player-alpha' as PlayerId
      const idB = 'player-beta' as PlayerId
      const posA: Position = { x: 10, y: 64, z: 20 }
      const posB: Position = { x: -100, y: 30, z: -50 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)

        const retrievedA = yield* service.getPosition(idA)
        const retrievedB = yield* service.getPosition(idB)

        expect(retrievedA).toEqual(posA)
        expect(retrievedB).toEqual(posB)
      })
      Effect.runSync(program.pipe(Effect.provide(TestLayer)))
    })

    it('should isolate velocity between two players', () => {
      const idA = 'player-alpha' as PlayerId
      const idB = 'player-beta' as PlayerId
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(idA, { x: 0, y: 64, z: 0 })
        yield* service.create(idB, { x: 10, y: 64, z: 10 })

        const velA = yield* service.getVelocity(idA)
        const velB = yield* service.getVelocity(idB)

        expect(velA).toEqual({ x: 0, y: 0, z: 0 })
        expect(velB).toEqual({ x: 0, y: 0, z: 0 })
      })
      Effect.runSync(program.pipe(Effect.provide(TestLayer)))
    })

    it('should isolate state between two players', () => {
      const idA = 'player-alpha' as PlayerId
      const idB = 'player-beta' as PlayerId
      const posA: Position = { x: 1, y: 2, z: 3 }
      const posB: Position = { x: 4, y: 5, z: 6 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)

        const stateA = yield* service.getState(idA)
        const stateB = yield* service.getState(idB)

        expect(stateA.id).toBe(idA)
        expect(stateB.id).toBe(idB)
        expect(stateA.position).toEqual(posA)
        expect(stateB.position).toEqual(posB)
      })
      Effect.runSync(program.pipe(Effect.provide(TestLayer)))
    })

    it('updating one player should not affect the other', () => {
      const idA = 'player-alpha' as PlayerId
      const idB = 'player-beta' as PlayerId
      const posA: Position = { x: 0, y: 64, z: 0 }
      const posB: Position = { x: 50, y: 64, z: 50 }
      const newPosA: Position = { x: 999, y: 999, z: 999 }
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(idA, posA)
        yield* service.create(idB, posB)
        yield* service.updatePosition(idA, newPosA)

        const stateA = yield* service.getState(idA)
        const stateB = yield* service.getState(idB)

        expect(stateA.position).toEqual(newPosA)
        expect(stateB.position).toEqual(posB)
      })
      Effect.runSync(program.pipe(Effect.provide(TestLayer)))
    })
  })

  describe('PlayerStateSchema', () => {
    it('should decode a valid player state', () => {
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

    it('should reject player state with missing fields', () => {
      expect(() =>
        Schema.decodeUnknownSync(PlayerStateSchema)({ id: 'player-1' })
      ).toThrow()
    })

    it('should reject player state with NaN position', () => {
      expect(() =>
        Schema.decodeUnknownSync(PlayerStateSchema)({
          id: 'player-1',
          position: { x: NaN, y: 64, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        })
      ).toThrow()
    })

    it('should reject player state with Infinity velocity', () => {
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
    it('PlayerError from create duplicate should have playerId matching input', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        yield* service.create(testPlayerId, testPosition)
        return yield* Effect.either(service.create(testPlayerId, { x: 1, y: 2, z: 3 }))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.playerId).toBe(testPlayerId)
        expect(result.left.reason).toBe('Player already exists')
      }
    })

    it('PlayerError from getPosition non-existent should have correct reason', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getPosition('missing' as PlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.playerId).toBe('missing')
        expect(result.left.reason).toBe('Player not found')
      }
    })

    it('PlayerError from updatePosition non-existent should have correct reason', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.updatePosition('missing' as PlayerId, { x: 0, y: 0, z: 0 }))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.playerId).toBe('missing')
        expect(result.left.reason).toBe('Player not found')
      }
    })

    it('PlayerError from getVelocity non-existent should have correct reason', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getVelocity('missing' as PlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.reason).toBe('Player not found')
      }
    })

    it('PlayerError from getState non-existent should have correct reason', () => {
      const program = Effect.gen(function* () {
        const service = yield* PlayerService
        return yield* Effect.either(service.getState('missing' as PlayerId))
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.reason).toBe('Player not found')
      }
    })
  })
})
