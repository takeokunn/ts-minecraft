import { describe, it } from 'vitest'
import { expect } from 'vitest'
import {
  MIN_SPAWN_DISTANCE,
  MAX_SPAWN_DISTANCE,
  MAX_ENTITY_COUNT,
  SPAWN_INTERVAL_FRAMES,
} from '../../domain/mob/spawner-config'

describe('spawner-config — constants', () => {
  it('MIN_SPAWN_DISTANCE < MAX_SPAWN_DISTANCE', () => {
    expect(MIN_SPAWN_DISTANCE).toBeLessThan(MAX_SPAWN_DISTANCE)
  })

  it('MIN_SPAWN_DISTANCE is 16', () => {
    expect(MIN_SPAWN_DISTANCE).toBe(16)
  })

  it('MAX_SPAWN_DISTANCE is 40', () => {
    expect(MAX_SPAWN_DISTANCE).toBe(40)
  })

  it('MAX_ENTITY_COUNT is 24', () => {
    expect(MAX_ENTITY_COUNT).toBe(24)
  })

  it('MAX_ENTITY_COUNT is positive', () => {
    expect(MAX_ENTITY_COUNT).toBeGreaterThan(0)
  })

  it('SPAWN_INTERVAL_FRAMES is 6', () => {
    expect(SPAWN_INTERVAL_FRAMES).toBe(6)
  })

  it('SPAWN_INTERVAL_FRAMES is positive', () => {
    expect(SPAWN_INTERVAL_FRAMES).toBeGreaterThan(0)
  })

  it('spawn distance band is at least 8 blocks wide', () => {
    expect(MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE).toBeGreaterThanOrEqual(8)
  })
})
