import { describe, it, assert } from '@effect/vitest'
import { Effect } from 'effect'
import {
  playerMovementSystem,
  calculateHorizontalVelocity,
  calculateVerticalVelocity,
  applyDeceleration,
} from '../player-movement'
import { World } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'
import { JUMP_FORCE, PLAYER_SPEED, DECELERATION } from '@/domain/world-constants'
import { toFloat } from '@/core/common'

const TestLayer = WorldLive

describe('player-movement pure functions', () => {
  it('calculateHorizontalVelocity should return zero velocity when no input', () => {
    const input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false,
      isLocked: false,
    }
    const camera = { pitch: toFloat(0), yaw: toFloat(0) }
    
    const { dx, dz } = calculateHorizontalVelocity(input, camera)
    
    assert.strictEqual(dx, 0)
    assert.strictEqual(dz, 0)
  })

  it('calculateHorizontalVelocity should return non-zero velocity when moving forward', () => {
    const input = {
      forward: true,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false,
      isLocked: false,
    }
    const camera = { pitch: toFloat(0), yaw: toFloat(0) }
    
    const { dx, dz } = calculateHorizontalVelocity(input, camera)
    
    const magnitude = Math.sqrt(dx * dx + dz * dz)
    assert.closeTo(magnitude, PLAYER_SPEED, 1e-6)
  })

  it('calculateVerticalVelocity should return jump force when jumping', () => {
    const isGrounded = true
    const jumpPressed = true
    const currentDy = toFloat(0)
    const result = calculateVerticalVelocity(isGrounded, jumpPressed, currentDy)
    assert.strictEqual(result.newDy, JUMP_FORCE)
    assert.strictEqual(result.newIsGrounded, false)
  })

  it('calculateVerticalVelocity should return current velocity when not jumping', () => {
    const isGrounded = true
    const jumpPressed = false
    const currentDy = toFloat(5)
    const result = calculateVerticalVelocity(isGrounded, jumpPressed, currentDy)
    assert.strictEqual(result.newDy, currentDy)
    assert.strictEqual(result.newIsGrounded, true)
  })

  it('applyDeceleration should reduce velocity', () => {
    const velocity = { dx: toFloat(10), dy: toFloat(0), dz: toFloat(10) }
    const result = applyDeceleration(velocity)
    
    assert.isTrue(Math.abs(result.dx) < Math.abs(velocity.dx))
    assert.isTrue(Math.abs(result.dz) < Math.abs(velocity.dz))
  })
})

describe('playerMovementSystem', () => {
  it.effect('should run without errors', () =>
    Effect.gen(function* (_) {
      // Simply test that the system runs without throwing errors
      yield* _(playerMovementSystem)
      assert.isOk(true)
    }).pipe(Effect.provide(TestLayer))
  )
})