import { describe, expect, it } from 'vitest'
import {
  SHULKER_CLOSED_ARMOR_POINTS,
  SHULKER_OPENING_TICKS,
  computeShulkerBulletDirection,
  computeShulkerShellDamage,
  getShulkerShellArmorPoints,
  shouldShulkerTeleport,
  tickShulkerShell,
} from '@ts-minecraft/entity/domain/mob/shulker-behavior'

const pos = (x: number, y: number, z: number) => ({ x, y, z })

// ─── getShulkerShellArmorPoints ───────────────────────────────────────────────
describe('getShulkerShellArmorPoints', () => {
  it('returns SHULKER_CLOSED_ARMOR_POINTS when closed', () => {
    expect(getShulkerShellArmorPoints('closed')).toBe(SHULKER_CLOSED_ARMOR_POINTS)
  })

  it('returns 0 armor when opening', () => {
    expect(getShulkerShellArmorPoints('opening')).toBe(0)
  })

  it('returns 0 armor when open', () => {
    expect(getShulkerShellArmorPoints('open')).toBe(0)
  })
})

// ─── computeShulkerShellDamage ────────────────────────────────────────────────
describe('computeShulkerShellDamage', () => {
  it('reduces incoming damage significantly when closed (full armor)', () => {
    const raw = 10
    const reduced = computeShulkerShellDamage(raw, 'closed')
    // 20 armor points = 80% reduction → 10 * 0.2 ≈ 2 (IEEE 754 float)
    expect(reduced).toBeCloseTo(2)
  })

  it('passes full damage when open', () => {
    const raw = 10
    expect(computeShulkerShellDamage(raw, 'open')).toBe(10)
  })
})

// ─── tickShulkerShell ─────────────────────────────────────────────────────────
describe('tickShulkerShell', () => {
  it('stays closed and invulnerable when closed with no target', () => {
    const result = tickShulkerShell('closed', { ticksInState: 0, health: 10, maxHealth: 30, hasTarget: false })
    expect(result.nextState).toBe('closed')
    expect(result.isInvulnerable).toBe(true)
    expect(result.canAttack).toBe(false)
  })

  it('transitions closed→opening when it has a target', () => {
    const result = tickShulkerShell('closed', { ticksInState: 0, health: 10, maxHealth: 30, hasTarget: true })
    expect(result.nextState).toBe('opening')
    expect(result.isInvulnerable).toBe(true)
  })

  it('stays opening until SHULKER_OPENING_TICKS elapsed', () => {
    const result = tickShulkerShell('opening', { ticksInState: SHULKER_OPENING_TICKS - 2, health: 10, maxHealth: 30 })
    expect(result.nextState).toBe('opening')
    expect(result.canAttack).toBe(false)
  })

  it('transitions opening→open once SHULKER_OPENING_TICKS ticks have passed', () => {
    const result = tickShulkerShell('opening', { ticksInState: SHULKER_OPENING_TICKS - 1, health: 10, maxHealth: 30 })
    expect(result.nextState).toBe('open')
  })

  it('open shulker can attack when it has a target', () => {
    const result = tickShulkerShell('open', { ticksInState: 5, health: 10, maxHealth: 30, hasTarget: true })
    expect(result.nextState).toBe('open')
    expect(result.canAttack).toBe(true)
  })

  it('open shulker closes when it has no target', () => {
    const result = tickShulkerShell('open', { ticksInState: 5, health: 10, maxHealth: 30, hasTarget: false })
    expect(result.nextState).toBe('closed')
    expect(result.isInvulnerable).toBe(true)
  })

  it('forces closed if taken damage while below half health', () => {
    const result = tickShulkerShell('open', {
      ticksInState: 5,
      health: 14,
      maxHealth: 30,
      damageTaken: 5,
      hasTarget: true,
    })
    expect(result.nextState).toBe('closed')
    expect(result.isInvulnerable).toBe(true)
  })

  it('forces closed when closeTicksRemaining > 0', () => {
    const result = tickShulkerShell('open', {
      ticksInState: 5,
      health: 20,
      maxHealth: 30,
      closeTicksRemaining: 10,
    })
    expect(result.nextState).toBe('closed')
  })
})

// ─── shouldShulkerTeleport ────────────────────────────────────────────────────
describe('shouldShulkerTeleport', () => {
  const shulker = pos(0, 64, 0)

  it('returns null when damageTaken is 0 or negative', () => {
    const dmg = { amount: 0, currentHealth: 10, maxHealth: 30 }
    expect(shouldShulkerTeleport(shulker, dmg, [pos(1, 64, 0)])).toBeNull()
  })

  it('returns null when above half health', () => {
    const dmg = { amount: 5, currentHealth: 20, maxHealth: 30 }
    expect(shouldShulkerTeleport(shulker, dmg, [pos(1, 64, 0)])).toBeNull()
  })

  it('returns null when no neighbors are within teleport radius', () => {
    const dmg = { amount: 5, currentHealth: 10, maxHealth: 30 }
    expect(shouldShulkerTeleport(shulker, dmg, [pos(100, 64, 0)])).toBeNull()
  })

  it('returns a candidate position when below half health and a neighbor is in range', () => {
    const dmg = { amount: 5, currentHealth: 10, maxHealth: 30 }
    const neighbor = pos(3, 64, 0)
    const result = shouldShulkerTeleport(shulker, dmg, [neighbor])
    expect(result).not.toBeNull()
  })
})

// ─── computeShulkerBulletDirection ───────────────────────────────────────────
describe('computeShulkerBulletDirection', () => {
  it('returns a zero vector when shulker and target are at the same position', () => {
    const dir = computeShulkerBulletDirection(pos(0, 0, 0), pos(0, 0, 0))
    expect(dir.x).toBe(0)
    expect(dir.z).toBe(0)
  })

  it('returns a unit-length vector for a normal target', () => {
    const dir = computeShulkerBulletDirection(pos(0, 0, 0), pos(3, 0, 4))
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z)
    expect(len).toBeCloseTo(1)
  })

  it('adds a slight upward bias (dy += 0.1 before normalization)', () => {
    // Shoot directly along X to isolate Y bias
    const dir = computeShulkerBulletDirection(pos(0, 0, 0), pos(100, 0, 0))
    expect(dir.y).toBeGreaterThan(0)
  })
})
