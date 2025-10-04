import { describe, expect, it } from 'vitest'
import {
  HEALTH_CONSTANTS,
  HUNGER_CONSTANTS,
  JUMP_VELOCITY,
  MOVEMENT_SPEEDS,
  PHYSICS_CONSTANTS,
  SATURATION_CONSTANTS,
} from '../constants'

describe('player constants', () => {
  it('移動速度は正の値', () => {
    expect(MOVEMENT_SPEEDS.walk).toBeGreaterThan(0)
    expect(MOVEMENT_SPEEDS.sprint).toBeGreaterThan(MOVEMENT_SPEEDS.walk)
    expect(MOVEMENT_SPEEDS.crouch).toBeLessThan(MOVEMENT_SPEEDS.walk)
  })

  it('ジャンプ速度は正の値', () => {
    expect(JUMP_VELOCITY).toBeGreaterThan(0)
  })

  it('体力・空腹の範囲が整合する', () => {
    expect(HEALTH_CONSTANTS.minimum).toBeLessThanOrEqual(HEALTH_CONSTANTS.critical)
    expect(HEALTH_CONSTANTS.maximum).toBeGreaterThanOrEqual(HEALTH_CONSTANTS.healthy)
    expect(HUNGER_CONSTANTS.maximum).toBeGreaterThanOrEqual(HUNGER_CONSTANTS.replenished)
  })

  it('物理定数が妥当である', () => {
    expect(PHYSICS_CONSTANTS.gravity).toBeLessThan(0)
    expect(PHYSICS_CONSTANTS.drag).toBeGreaterThan(0)
    expect(PHYSICS_CONSTANTS.tickRate).toBe(20)
  })

  it('飽和度の上限・下限が成立する', () => {
    expect(SATURATION_CONSTANTS.maximum).toBeGreaterThanOrEqual(SATURATION_CONSTANTS.minimum)
  })
})
