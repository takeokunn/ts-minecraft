import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { InputState } from '@/domain/components'
import { World, WorldLive } from '@/runtime/world'
import { playerMovementSystem, calculateHorizontalVelocity, calculateVerticalVelocity, applyDeceleration } from '../player-movement'
import { JUMP_FORCE, PLAYER_SPEED } from '@/domain/world-constants'
import { playerQuery } from '@/domain/queries'

const setupWorld = (inputState: Partial<InputState>, isGrounded: boolean) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* _(world.addArchetype(playerArchetype))
    const fullInputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false,
      isLocked: false,
      ...inputState,
    }
    yield* _(world.updateComponent(playerId, 'inputState', new InputState(fullInputState)))
    yield* _(world.updateComponent(playerId, 'player', { isGrounded }))
    return { playerId }
  })

describe('playerMovementSystem', () => {
  describe('pure functions', () => {
    it('calculateHorizontalVelocity', () => {
      const input = { forward: true, backward: false, left: false, right: false, sprint: false }
      const camera = { yaw: 0 }
      const { dx, dz } = calculateHorizontalVelocity(input, camera)
      expect(dz).toBeCloseTo(-PLAYER_SPEED)
      expect(dx).toBeCloseTo(0)
    })

    it('calculateVerticalVelocity', () => {
      const { newDy, newIsGrounded } = calculateVerticalVelocity(true, true, 0)
      expect(newDy).toBeCloseTo(JUMP_FORCE)
      expect(newIsGrounded).toBe(false)
    })

    it('applyDeceleration', () => {
      const { dx, dz } = applyDeceleration({ dx: 10, dz: 10 })
      expect(dx).toBeLessThan(10)
      expect(dz).toBeLessThan(10)
    })
  })

  describe('system', () => {
    it('should update velocity based on input', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        yield* _(setupWorld({ forward: true }, false))

        yield* _(playerMovementSystem)

        const player = (yield* _(world.query(playerQuery)))[0]!
        expect(player.velocity.dz).toBeCloseTo(-PLAYER_SPEED)
      })

      await Effect.runPromise(Effect.provide(program, WorldLive))
    })

    it('should handle jumping', async () => {
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        yield* _(setupWorld({ jump: true }, true))

        yield* _(playerMovementSystem)

        const player = (yield* _(world.query(playerQuery)))[0]!
        expect(player.velocity.dy).toBeCloseTo(JUMP_FORCE)
        expect(player.player.isGrounded).toBe(false)
      })

      await Effect.runPromise(Effect.provide(program, WorldLive))
    })
  })
})