import { describe, expect, it } from 'vitest'
import { MATERIAL_FRICTION, PHYSICS_CONSTANTS } from '../constants'

describe('Physics constants', () => {
  it('provides gravity vector', () => {
    expect(PHYSICS_CONSTANTS.gravity.y).toBeLessThan(0)
  })

  it('material friction values stay within bounds', () => {
    for (const value of Object.values(MATERIAL_FRICTION)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
