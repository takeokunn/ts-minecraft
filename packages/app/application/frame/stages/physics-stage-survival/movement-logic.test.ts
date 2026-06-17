import { describe, expect, it } from 'vitest'
import {
  resolveIsSprinting,
  resolveJumpExhaustion,
  resolveMovementExhaustionRate,
  shouldApplyJumpExhaustion,
  shouldApplyMovementExhaustion,
} from './movement-logic'

describe('physics-stage-survival/movement-logic', () => {
  it('only allows sprinting when all sprint conditions are met', () => {
    expect(resolveIsSprinting(true, false, true, false, true)).toBe(true)
    expect(resolveIsSprinting(true, false, true, true, true)).toBe(false)
  })

  it('applies movement exhaustion only when the player actually moved while not sneaking', () => {
    expect(shouldApplyMovementExhaustion(0, false)).toBe(false)
    expect(shouldApplyMovementExhaustion(0.5, false)).toBe(true)
    expect(shouldApplyMovementExhaustion(0.5, true)).toBe(false)
  })

  it('uses sprint-specific exhaustion when sprinting and jump exhaustion only after a grounded fall', () => {
    expect(resolveMovementExhaustionRate(true)).toBeGreaterThan(resolveMovementExhaustionRate(false))
    expect(resolveJumpExhaustion(true)).toBeGreaterThan(resolveJumpExhaustion(false))
    expect(shouldApplyJumpExhaustion(false, true, false)).toBe(true)
    expect(shouldApplyJumpExhaustion(true, true, false)).toBe(false)
  })
})
