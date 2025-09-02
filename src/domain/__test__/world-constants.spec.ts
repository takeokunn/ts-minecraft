import { describe, it, expect } from 'vitest'
import * as WorldConstants from '../world-constants'

describe('WorldConstants', () => {
  it('should export constants', () => {
    expect(WorldConstants.CHUNK_SIZE).toBeDefined()
    expect(WorldConstants.CHUNK_HEIGHT).toBeDefined()
    expect(WorldConstants.WATER_LEVEL).toBeDefined()
    expect(WorldConstants.WORLD_DEPTH).toBeDefined()
    expect(WorldConstants.MIN_WORLD_Y).toBeDefined()
    expect(WorldConstants.Y_OFFSET).toBeDefined()
    expect(WorldConstants.PLAYER_SPEED).toBeDefined()
    expect(WorldConstants.SPRINT_MULTIPLIER).toBeDefined()
    expect(WorldConstants.JUMP_FORCE).toBeDefined()
    expect(WorldConstants.TERMINAL_VELOCITY).toBeDefined()
    expect(WorldConstants.FRICTION).toBeDefined()
    expect(WorldConstants.GRAVITY).toBeDefined()
    expect(WorldConstants.DECELERATION).toBeDefined()
    expect(WorldConstants.MIN_VELOCITY_THRESHOLD).toBeDefined()
    expect(WorldConstants.RENDER_DISTANCE).toBeDefined()
  })
})
