import { describe, it, expect } from 'vitest'
import {
  canBeSheared,
  shearWoolCount,
  tickWoolRegrowth,
  SHEAR_WOOL_MIN,
  SHEAR_WOOL_MAX,
  WOOL_REGROWTH_TICKS,
} from './shearing'
import {
  shouldEndermanTeleport,
  computeEndermanTeleportTarget,
  TELEPORT_MIN_RANGE,
  TELEPORT_MAX_RANGE,
  TELEPORT_ATTEMPTS,
} from './enderman-teleport'

// ─── Shearing ────────────────────────────────────────────────────────────────

describe('canBeSheared', () => {
  it('returns true when regrowth timer is 0 (woolly)', () => {
    expect(canBeSheared(0)).toBe(true)
  })
  it('returns false when regrowth timer is > 0 (still regrowing)', () => {
    expect(canBeSheared(1)).toBe(false)
    expect(canBeSheared(WOOL_REGROWTH_TICKS)).toBe(false)
  })
  it('returns true for negative timer (treated as 0)', () => {
    expect(canBeSheared(-1)).toBe(true)
  })
})

describe('shearWoolCount', () => {
  it('always returns a value in [SHEAR_WOOL_MIN, SHEAR_WOOL_MAX]', () => {
    for (let hash = 0; hash < 100; hash++) {
      const count = shearWoolCount(hash)
      expect(count).toBeGreaterThanOrEqual(SHEAR_WOOL_MIN)
      expect(count).toBeLessThanOrEqual(SHEAR_WOOL_MAX)
    }
  })
  it('is deterministic: same hash always gives same count', () => {
    expect(shearWoolCount(42)).toBe(shearWoolCount(42))
    expect(shearWoolCount(7)).toBe(shearWoolCount(7))
  })
  it('hash=0 → SHEAR_WOOL_MIN', () => {
    expect(shearWoolCount(0)).toBe(SHEAR_WOOL_MIN)
  })
})

describe('tickWoolRegrowth', () => {
  it('decrements positive regrowth timer by 1', () => {
    expect(tickWoolRegrowth(5)).toBe(4)
    expect(tickWoolRegrowth(1)).toBe(0)
  })
  it('clamps at 0 (does not go negative)', () => {
    expect(tickWoolRegrowth(0)).toBe(0)
  })
  it('after WOOL_REGROWTH_TICKS ticks from freshly-sheared, returns 0', () => {
    let ticks = WOOL_REGROWTH_TICKS
    for (let i = 0; i < WOOL_REGROWTH_TICKS; i++) {
      ticks = tickWoolRegrowth(ticks)
    }
    expect(ticks).toBe(0)
  })
})

// ─── Enderman teleport ───────────────────────────────────────────────────────

describe('shouldEndermanTeleport', () => {
  it('teleports when damaged and roll < 0.3', () => {
    expect(shouldEndermanTeleport(true, 0, 0.0)).toBe(true)
    expect(shouldEndermanTeleport(true, 0, 0.29)).toBe(true)
  })
  it('does not teleport when damaged and roll >= 0.3', () => {
    expect(shouldEndermanTeleport(true, 0, 0.3)).toBe(false)
    expect(shouldEndermanTeleport(true, 0, 1.0)).toBe(false)
  })
  it('teleports when stuck beyond the stuck threshold', () => {
    expect(shouldEndermanTeleport(false, 41, 1.0)).toBe(true)
  })
  it('does not chase-teleport most of the time (low probability)', () => {
    expect(shouldEndermanTeleport(false, 0, 0.99)).toBe(false)
  })
  it('chase-teleports when roll < 0.05 and not stuck', () => {
    expect(shouldEndermanTeleport(false, 0, 0.04)).toBe(true)
  })
})

describe('computeEndermanTeleportTarget', () => {
  const origin = { x: 0, y: 64, z: 0 }

  it('returns null when random attempts array is too short', () => {
    const result = computeEndermanTeleportTarget(origin, origin, [])
    expect(result).toBeNull()
  })

  it('returns a position within teleport range when valid rolls given', () => {
    // Roll of 0.5 → offset 0 → candidate = origin → distance = 0 → invalid
    // Roll of 0.9 → offset = 0.9*32*2-32 = 57.6-32=25.6 → distance > MIN_RANGE (8)
    const validRolls = Array.from({ length: TELEPORT_ATTEMPTS * 2 }, () => 0.9)
    const result = computeEndermanTeleportTarget(origin, origin, validRolls)
    if (result !== null) {
      const dx = result.x - origin.x
      const dz = result.z - origin.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      expect(dist).toBeGreaterThanOrEqual(TELEPORT_MIN_RANGE)
      expect(dist).toBeLessThanOrEqual(TELEPORT_MAX_RANGE)
    }
  })

  it('teleport constants are sane', () => {
    expect(TELEPORT_MIN_RANGE).toBeGreaterThan(0)
    expect(TELEPORT_MAX_RANGE).toBeGreaterThan(TELEPORT_MIN_RANGE)
    expect(TELEPORT_ATTEMPTS).toBeGreaterThan(0)
  })
})

// ─── getMobDefinition completeness ───────────────────────────────────────────

describe('getMobDefinition', () => {
  it('returns a definition for every entity type', async () => {
    const { getMobDefinition } = await import('./mobs/index')
    const { EntityType } = await import('./entity')
    for (const type of Object.values(EntityType)) {
      const def = getMobDefinition(type)
      expect(def).toBeDefined()
      expect(def.maxHealth).toBeGreaterThan(0)
    }
  })
})
