import { describe, it, expect } from 'vitest'
import {
  dragonBreathAttackRange,
  dragonChargeAttackRange,
  dragonDamageMultiplier,
  shouldUseBreathAttack,
  computeDragonMeleeDamage,
} from './dragon-combat'
import {
  computeCrystalHealing,
  DRAGON_HEAL_RATE,
  CRYSTAL_HEAL_RANGE,
  MAX_DRAGON_HEALTH,
} from './dragon-healing'
import {
  dragonDeathPhaseForProgress,
  tickDragonDeath,
  DragonDeathPhase,
  DEATH_ANIMATION_TICKS,
  DRAGON_DEATH_XP_TOTAL,
  DRAGON_EGG_POSITION,
  RETURN_PORTAL_POSITION,
} from './dragon-death'
import { DragonPhase, tickDragonPhase, type DragonPhaseState, type DragonPhaseInput } from './dragon-phase'

// ─── dragon-combat ───────────────────────────────────────────────────────────

describe('dragonDamageMultiplier', () => {
  it('returns 0.25 when Perched (breath attack mode)', () => {
    expect(dragonDamageMultiplier(DragonPhase.Perched)).toBe(0.25)
  })
  it('returns 1 for all non-Perched phases', () => {
    const other = [
      DragonPhase.Circling, DragonPhase.Strafing, DragonPhase.Landing,
      DragonPhase.Takeoff, DragonPhase.DeathSequence,
    ] as const
    for (const p of other) {
      expect(dragonDamageMultiplier(p)).toBe(1)
    }
  })
})

describe('shouldUseBreathAttack', () => {
  it('returns true when all conditions met (Perched, in range, low roll)', () => {
    expect(shouldUseBreathAttack(DragonPhase.Perched, dragonBreathAttackRange - 1, 0.1)).toBe(true)
  })
  it('returns false when not Perched', () => {
    expect(shouldUseBreathAttack(DragonPhase.Circling, 1, 0.1)).toBe(false)
    expect(shouldUseBreathAttack(DragonPhase.Strafing, 1, 0.1)).toBe(false)
  })
  it('returns false when distance exceeds breath attack range', () => {
    expect(shouldUseBreathAttack(DragonPhase.Perched, dragonBreathAttackRange + 1, 0.1)).toBe(false)
  })
  it('returns false when random roll >= 0.35', () => {
    expect(shouldUseBreathAttack(DragonPhase.Perched, 1, 0.35)).toBe(false)
    expect(shouldUseBreathAttack(DragonPhase.Perched, 1, 0.9)).toBe(false)
  })
  it('attack range constants are positive', () => {
    expect(dragonBreathAttackRange).toBeGreaterThan(0)
    expect(dragonChargeAttackRange).toBeGreaterThan(0)
  })
})

describe('computeDragonMeleeDamage', () => {
  it('returns reduced damage when Perched (0.25x)', () => {
    const full = computeDragonMeleeDamage(10, false, 0, DragonPhase.Circling)
    const perched = computeDragonMeleeDamage(10, false, 0, DragonPhase.Perched)
    expect(perched).toBeCloseTo(full * 0.25)
  })
  it('applies critical multiplier', () => {
    const normal = computeDragonMeleeDamage(10, false, 0, DragonPhase.Strafing)
    const crit = computeDragonMeleeDamage(10, true, 0, DragonPhase.Strafing)
    expect(crit).toBeGreaterThan(normal)
  })
  it('reduces damage with armor', () => {
    const noArmor = computeDragonMeleeDamage(10, false, 0, DragonPhase.Strafing)
    const withArmor = computeDragonMeleeDamage(10, false, 10, DragonPhase.Strafing)
    expect(withArmor).toBeLessThan(noArmor)
  })
})

// ─── dragon-healing ──────────────────────────────────────────────────────────

describe('computeCrystalHealing', () => {
  const dragonPos = { x: 0, y: 64, z: 0 }

  it('heals 0 when no crystals nearby', () => {
    const far = [{ x: 100, y: 64, z: 100 }]
    const { newHealth, crystalsUsed } = computeCrystalHealing(far, dragonPos, 100)
    expect(crystalsUsed).toBe(0)
    expect(newHealth).toBe(100)
  })

  it('heals by DRAGON_HEAL_RATE per nearby crystal', () => {
    const nearby = [{ x: 0, y: 64, z: 0 }, { x: 1, y: 64, z: 0 }]
    const { newHealth, crystalsUsed } = computeCrystalHealing(nearby, dragonPos, 100)
    expect(crystalsUsed).toBe(2)
    expect(newHealth).toBe(100 + 2 * DRAGON_HEAL_RATE)
  })

  it('does not exceed MAX_DRAGON_HEALTH', () => {
    const nearby = Array.from({ length: 10 }, () => ({ x: 0, y: 64, z: 0 }))
    const { newHealth } = computeCrystalHealing(nearby, dragonPos, MAX_DRAGON_HEALTH - 1)
    expect(newHealth).toBe(MAX_DRAGON_HEALTH)
  })

  it('only counts crystals within CRYSTAL_HEAL_RANGE', () => {
    const borderline = [
      { x: CRYSTAL_HEAL_RANGE, y: 64, z: 0 },
      { x: CRYSTAL_HEAL_RANGE + 1, y: 64, z: 0 },
    ]
    const { crystalsUsed } = computeCrystalHealing(borderline, dragonPos, 100)
    expect(crystalsUsed).toBe(1)
  })

  it('returns original health when already at max', () => {
    const nearby = [{ x: 0, y: 64, z: 0 }]
    const { newHealth } = computeCrystalHealing(nearby, dragonPos, MAX_DRAGON_HEALTH)
    expect(newHealth).toBe(MAX_DRAGON_HEALTH)
  })
})

// ─── dragon-death ────────────────────────────────────────────────────────────

describe('dragonDeathPhaseForProgress', () => {
  it('Dying for progress 0-79', () => {
    expect(dragonDeathPhaseForProgress(0)).toBe(DragonDeathPhase.Dying)
    expect(dragonDeathPhaseForProgress(79)).toBe(DragonDeathPhase.Dying)
  })
  it('Exploding for progress 80-119', () => {
    expect(dragonDeathPhaseForProgress(80)).toBe(DragonDeathPhase.Exploding)
    expect(dragonDeathPhaseForProgress(119)).toBe(DragonDeathPhase.Exploding)
  })
  it('EggSpawn for progress 120-139', () => {
    expect(dragonDeathPhaseForProgress(120)).toBe(DragonDeathPhase.EggSpawn)
    expect(dragonDeathPhaseForProgress(139)).toBe(DragonDeathPhase.EggSpawn)
  })
  it('PortalActivate for progress 140-159', () => {
    expect(dragonDeathPhaseForProgress(140)).toBe(DragonDeathPhase.PortalActivate)
    expect(dragonDeathPhaseForProgress(159)).toBe(DragonDeathPhase.PortalActivate)
  })
  it('XPFountain for progress 160-199', () => {
    expect(dragonDeathPhaseForProgress(160)).toBe(DragonDeathPhase.XPFountain)
    expect(dragonDeathPhaseForProgress(199)).toBe(DragonDeathPhase.XPFountain)
  })
  it('Complete at progress 200', () => {
    expect(dragonDeathPhaseForProgress(DEATH_ANIMATION_TICKS)).toBe(DragonDeathPhase.Complete)
  })
})

describe('tickDragonDeath', () => {
  it('increments progress by 1 each tick', () => {
    const tick0 = tickDragonDeath(0, 0)
    expect(tick0.progress).toBe(1)
  })

  it('does not exceed DEATH_ANIMATION_TICKS', () => {
    const tick = tickDragonDeath(DEATH_ANIMATION_TICKS, 0)
    expect(tick.progress).toBe(DEATH_ANIMATION_TICKS)
  })

  it('emits DragonEggSpawn exactly at progress 120', () => {
    const tick = tickDragonDeath(120, 0)
    expect(tick.events).toHaveLength(1)
    expect(tick.events[0]?.type).toBe('DragonEggSpawn')
  })

  it('emits ReturnPortalActivate exactly at progress 140', () => {
    const tick = tickDragonDeath(140, 0)
    expect(tick.events).toHaveLength(1)
    expect(tick.events[0]?.type).toBe('ReturnPortalActivate')
  })

  it('emits Complete events after animation ends', () => {
    const tick = tickDragonDeath(DEATH_ANIMATION_TICKS, 0)
    expect(tick.events.some((e) => e.type === 'Complete')).toBe(true)
  })

  it('XPFountain events include total XP constant', () => {
    const tick = tickDragonDeath(160, 0)
    const xpEvent = tick.events.find((e) => e.type === 'XPFountain')
    expect(xpEvent).toBeDefined()
    if (xpEvent?.type === 'XPFountain') {
      expect(xpEvent.total).toBe(DRAGON_DEATH_XP_TOTAL)
    }
  })

  it('uses provided dragonPosition for events', () => {
    const pos = { x: 10, y: 70, z: -5 }
    const tick = tickDragonDeath(5, 0, pos)
    const dying = tick.events.find((e) => e.type === 'Dying')
    if (dying?.type === 'Dying') {
      expect(dying.position).toEqual(pos)
    }
  })

  it('constants are exported for caller use', () => {
    expect(DRAGON_EGG_POSITION).toEqual({ x: 0, y: 65, z: 0 })
    expect(RETURN_PORTAL_POSITION).toEqual({ x: 0, y: 64, z: 0 })
    expect(DRAGON_DEATH_XP_TOTAL).toBe(12000)
  })
})

// ─── dragon-phase state machine ──────────────────────────────────────────────

const baseState: DragonPhaseState = {
  phase: DragonPhase.Circling,
  phaseTimer: 0,
  phaseProgress: 0,
  perchPosition: null,
  circlingRadius: 20,
  circlingHeight: 80,
  circlingAngle: 0,
}

const baseInput: DragonPhaseInput = {
  dragonPosition: { x: 0, y: 80, z: 0 },
  dragonHealth: 200,
  playerPosition: null,
  portalPosition: { x: 0, y: 64, z: 0 },
  randomValue: 0.5,
  tick: 0,
}

describe('tickDragonPhase', () => {
  it('stays Circling when no player nearby', () => {
    const { nextState } = tickDragonPhase(baseState, baseInput)
    expect(nextState.phase).toBe(DragonPhase.Circling)
  })

  it('increments phaseTimer when staying in same phase', () => {
    const { nextState } = tickDragonPhase(baseState, baseInput)
    expect(nextState.phaseTimer).toBe(1)
  })

  it('resets phaseTimer on phase transition', () => {
    // Force transition to DeathSequence by setting health to 0
    const { nextState } = tickDragonPhase(baseState, { ...baseInput, dragonHealth: 0 })
    expect(nextState.phase).toBe(DragonPhase.DeathSequence)
    expect(nextState.phaseTimer).toBe(0)
  })

  it('transitions to DeathSequence when health <= 0 (any phase)', () => {
    for (const phase of Object.values(DragonPhase)) {
      const { intent } = tickDragonPhase({ ...baseState, phase }, { ...baseInput, dragonHealth: 0 })
      expect(intent.newPhase).toBe(DragonPhase.DeathSequence)
    }
  })

  it('DeathSequence stays DeathSequence regardless of health', () => {
    const state = { ...baseState, phase: DragonPhase.DeathSequence }
    const { nextState } = tickDragonPhase(state, { ...baseInput, dragonHealth: 100 })
    expect(nextState.phase).toBe(DragonPhase.DeathSequence)
  })

  it('intent.healsFromCrystals is false during DeathSequence', () => {
    const state = { ...baseState, phase: DragonPhase.DeathSequence }
    const { intent } = tickDragonPhase(state, baseInput)
    expect(intent.healsFromCrystals).toBe(false)
  })

  it('provides non-zero velocity for Circling phase', () => {
    const { intent } = tickDragonPhase(baseState, baseInput)
    const { x, y, z } = intent.newVelocity
    expect(x * x + y * y + z * z).toBeGreaterThan(0)
  })

  it('advances circlingAngle each Circling tick', () => {
    const { nextState } = tickDragonPhase(baseState, baseInput)
    expect(nextState.circlingAngle).toBeGreaterThan(baseState.circlingAngle)
  })
})
