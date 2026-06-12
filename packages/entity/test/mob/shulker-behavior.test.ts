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

  it('stays in opening state when ticks < SHULKER_OPENING_TICKS', () => {
    const stillOpening = tickShulkerShell('opening', { ticksInState: 10, health: 30, maxHealth: 30 })
    expect(stillOpening).toEqual({ nextState: 'opening', isInvulnerable: false, canAttack: false })
  })

  it('stays closed when there is no target', () => {
    const result = tickShulkerShell('closed', { ticksInState: 0, health: 30, maxHealth: 30, hasTarget: false })
    expect(result).toEqual({ nextState: 'closed', isInvulnerable: true, canAttack: false })
  })

  it('closes immediately when closeTicksRemaining > 0 regardless of state', () => {
    const fromOpen = tickShulkerShell('open', { ticksInState: 5, health: 30, maxHealth: 30, closeTicksRemaining: 10 })
    expect(fromOpen).toEqual({ nextState: 'closed', isInvulnerable: true, canAttack: false })
  })

  it('open state closes when target disappears', () => {
    const result = tickShulkerShell('open', { ticksInState: 0, health: 30, maxHealth: 30, hasTarget: false })
    expect(result).toEqual({ nextState: 'closed', isInvulnerable: true, canAttack: false })
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

  it('returns null when no candidates are within the teleport radius (9 blocks out)', () => {
    const farPositions = [{ x: 9, y: 64, z: 0 }] // 9 > SHULKER_TELEPORT_RADIUS=8
    const result = shouldShulkerTeleport(shulkerPos, { amount: 2, currentHealth: 14, maxHealth: 30 }, farPositions)
    expect(result).toBeNull()
  })

  it('returns null when the neighbors array is empty', () => {
    const result = shouldShulkerTeleport(shulkerPos, { amount: 2, currentHealth: 14, maxHealth: 30 }, [])
    expect(result).toBeNull()
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

  it('applies a +0.1 upward Y bias: same-pos target fires straight up (not zero vector)', () => {
    // dx=0, dz=0, dy=0+0.1=0.1 → normalized to {x:0,y:1,z:0}
    const origin = { x: 5, y: 64, z: 5 }
    const dir = computeShulkerBulletDirection(origin, origin)
    expect(dir.y).toBeCloseTo(1)
    expect(dir.x).toBeCloseTo(0)
    expect(dir.z).toBeCloseTo(0)
  })
})
