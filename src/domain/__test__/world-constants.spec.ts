import { describe, it, assert } from '@effect/vitest'
import * as WorldConstants from '../world-constants'
import { Effect } from 'effect'

describe('WorldConstants', () => {
  it.effect('should export constants', () =>
    Effect.sync(() => {
      assert.isDefined(WorldConstants.CHUNK_SIZE)
      assert.isDefined(WorldConstants.CHUNK_HEIGHT)
      assert.isDefined(WorldConstants.WATER_LEVEL)
      assert.isDefined(WorldConstants.WORLD_DEPTH)
      assert.isDefined(WorldConstants.MIN_WORLD_Y)
      assert.isDefined(WorldConstants.Y_OFFSET)
      assert.isDefined(WorldConstants.PLAYER_SPEED)
      assert.isDefined(WorldConstants.SPRINT_MULTIPLIER)
      assert.isDefined(WorldConstants.JUMP_FORCE)
      assert.isDefined(WorldConstants.TERMINAL_VELOCITY)
      assert.isDefined(WorldConstants.FRICTION)
      assert.isDefined(WorldConstants.GRAVITY)
      assert.isDefined(WorldConstants.DECELERATION)
      assert.isDefined(WorldConstants.MIN_VELOCITY_THRESHOLD)
      assert.isDefined(WorldConstants.RENDER_DISTANCE)
      assert.isDefined(WorldConstants.PLAYER_COLLIDER)
      assert.isDefined(WorldConstants.BLOCK_COLLIDER)
    }),
  )
})
