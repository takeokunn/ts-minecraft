import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { applyArmorReduction } from '../../domain/combat'
import {
  computeShulkerBulletDirection,
  computeShulkerShellDamage,
  getShulkerShellArmorPoints,
  SHULKER_CLOSED_ARMOR_POINTS,
  shouldShulkerTeleport,
  tickShulkerShell,
} from '../../domain/mob/shulker-behavior'

describe('Shulker shell behavior', () => {
  it('transitions closed → opening → open when a target is present', () => {
    const opening = tickShulkerShell('closed', {
      ticksInState: 0,
      health: 30,
      maxHealth: 30,
      hasTarget: true,
    })
    expect(opening).toEqual({ nextState: 'opening', isInvulnerable: true, canAttack: false })

    const open = tickShulkerShell('opening', {
      ticksInState: 19,
      health: 30,
      maxHealth: 30,
    })
    expect(open).toEqual({ nextState: 'open', isInvulnerable: false, canAttack: false })
  })

  it('stays open for attacks and closes when damaged below 50% HP', () => {
    const attacking = tickShulkerShell('open', {
      ticksInState: 0,
      health: 30,
      maxHealth: 30,
      hasTarget: true,
    })
    expect(attacking).toEqual({ nextState: 'open', isInvulnerable: false, canAttack: true })

    const closed = tickShulkerShell('open', {
      ticksInState: 0,
      health: 14,
      maxHealth: 30,
      damageTaken: 3,
    })
    expect(closed).toEqual({ nextState: 'closed', isInvulnerable: true, canAttack: false })
  })

  it('applies closed-shell armor through the existing combat model', () => {
    expect(getShulkerShellArmorPoints('closed')).toBe(SHULKER_CLOSED_ARMOR_POINTS)
    expect(getShulkerShellArmorPoints('open')).toBe(0)
    expect(computeShulkerShellDamage(10, 'closed')).toBeCloseTo(applyArmorReduction(10, 20))
    expect(computeShulkerShellDamage(10, 'open')).toBe(10)
  })
})

describe('Shulker teleport behavior', () => {
  const shulkerPos = { x: 0, y: 64, z: 0 }
  const surfacePositions = [
    { x: 4, y: 64, z: 0 },
    { x: 9, y: 64, z: 0 },
  ]

  it('does not teleport without damage or while at/above half health', () => {
    expect(shouldShulkerTeleport(shulkerPos, { amount: 0, currentHealth: 10, maxHealth: 30 }, surfacePositions)).toBeNull()
    expect(shouldShulkerTeleport(shulkerPos, { amount: 2, currentHealth: 15, maxHealth: 30 }, surfacePositions)).toBeNull()
  })

  it('teleports to a surface position within 8 blocks when damaged below half health', () => {
    const result = shouldShulkerTeleport(shulkerPos, { amount: 2, currentHealth: 14, maxHealth: 30 }, surfacePositions)
    expect(result).toEqual({ x: 4, y: 64, z: 0 })
  })
})

describe('Shulker bullet behavior', () => {
  it('computes a normalized homing direction toward the target', () => {
    const dir = computeShulkerBulletDirection({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 })

    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1)
    expect(dir.x).toBeGreaterThan(0)
    expect(dir.y).toBeGreaterThan(0)
    expect(dir.z).toBeGreaterThan(0)
  })
})
