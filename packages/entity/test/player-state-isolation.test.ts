import { describe, it } from '@effect/vitest'
import { expect, it as plainIt } from 'vitest'
import { Effect, Schema } from 'effect'
import { PlayerService, PlayerStateSchema } from '@ts-minecraft/entity'
import type { PlayerId, Position } from '@ts-minecraft/core'

const TestLayer = PlayerService.Default

describe('PlayerService', () => {
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
})
