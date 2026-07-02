import { describe, expect, it } from 'vitest'
import {
  DRAGON_CIRCLING_HEIGHT,
  DRAGON_CIRCLING_RADIUS,
  DragonPhase,
  initialDragonPhaseState,
  tickDragonPhase,
} from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-phase'
import { MAX_DRAGON_HEALTH } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-healing'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const PORTAL = { x: 0, y: 64, z: 0 }
const DRAGON_POS = { x: 40, y: 80, z: 0 }

const makeInput = (overrides: Partial<Parameters<typeof tickDragonPhase>[1]> = {}) => ({
  dragonPosition: DRAGON_POS,
  dragonHealth: MAX_DRAGON_HEALTH,
  playerPosition: null,
  portalPosition: PORTAL,
  randomValue: 0.5,
  tick: 0,
  ...overrides,
})

// ─── initialDragonPhaseState ──────────────────────────────────────────────────
describe('initialDragonPhaseState', () => {
  it('starts in Circling phase', () => {
    expect(initialDragonPhaseState(80).phase).toBe(DragonPhase.Circling)
  })

  it('uses DRAGON_CIRCLING_RADIUS', () => {
    expect(initialDragonPhaseState(80).circlingRadius).toBe(DRAGON_CIRCLING_RADIUS)
  })

  it('uses max(DRAGON_CIRCLING_HEIGHT, spawnY) for circlingHeight', () => {
    expect(initialDragonPhaseState(100).circlingHeight).toBe(100)
    expect(initialDragonPhaseState(50).circlingHeight).toBe(DRAGON_CIRCLING_HEIGHT)
  })

  it('initializes phaseTimer and angle to 0', () => {
    const state = initialDragonPhaseState(80)
    expect(state.phaseTimer).toBe(0)
    expect(state.circlingAngle).toBe(0)
  })
})

// ─── tickDragonPhase — DeathSequence ─────────────────────────────────────────
describe('tickDragonPhase — DeathSequence', () => {
  it('transitions to DeathSequence when health reaches 0', () => {
    const state = initialDragonPhaseState(80)
    const result = tickDragonPhase(state, makeInput({ dragonHealth: 0 }))
    expect(result.nextState.phase).toBe(DragonPhase.DeathSequence)
  })

  it('stays in DeathSequence once entered', () => {
    const state = { ...initialDragonPhaseState(80), phase: DragonPhase.DeathSequence as const }
    const result = tickDragonPhase(state, makeInput({ dragonHealth: 100 }))
    expect(result.nextState.phase).toBe(DragonPhase.DeathSequence)
  })

  it('does not heal from crystals while in DeathSequence', () => {
    const state = { ...initialDragonPhaseState(80), phase: DragonPhase.DeathSequence as const }
    const result = tickDragonPhase(state, makeInput())
    expect(result.intent.healsFromCrystals).toBe(false)
  })
})

// ─── tickDragonPhase — Circling ───────────────────────────────────────────────
describe('tickDragonPhase — Circling', () => {
  it('stays Circling when player is null', () => {
    const state = initialDragonPhaseState(80)
    const result = tickDragonPhase(state, makeInput({ playerPosition: null }))
    expect(result.nextState.phase).toBe(DragonPhase.Circling)
  })

  it('increments circlingAngle each Circling tick', () => {
    const state = initialDragonPhaseState(80)
    const result = tickDragonPhase(state, makeInput())
    expect(result.nextState.circlingAngle).toBeGreaterThan(state.circlingAngle)
  })

  it('increments phaseTimer while in same phase', () => {
    const state = initialDragonPhaseState(80)
    const result = tickDragonPhase(state, makeInput())
    expect(result.nextState.phaseTimer).toBe(1)
  })

  it('heals from crystals while Circling', () => {
    const state = initialDragonPhaseState(80)
    const result = tickDragonPhase(state, makeInput())
    expect(result.intent.healsFromCrystals).toBe(true)
  })
})

// ─── tickDragonPhase — Strafing ───────────────────────────────────────────────
describe('tickDragonPhase — Strafing', () => {
  it('transitions Strafing→Landing when at half health and below y=70', () => {
    const state = { ...initialDragonPhaseState(80), phase: DragonPhase.Strafing as const }
    const result = tickDragonPhase(state, makeInput({
      dragonHealth: MAX_DRAGON_HEALTH * 0.4, // below 50%
      dragonPosition: { x: 40, y: 60, z: 0 },  // below LOW_ALTITUDE_Y=70
    }))
    expect(result.nextState.phase).toBe(DragonPhase.Landing)
  })

  it('stays Strafing when health is above 50% despite low altitude', () => {
    const state = { ...initialDragonPhaseState(80), phase: DragonPhase.Strafing as const }
    const result = tickDragonPhase(state, makeInput({
      dragonHealth: MAX_DRAGON_HEALTH * 0.6,
      dragonPosition: { x: 40, y: 60, z: 0 },
    }))
    expect(result.nextState.phase).toBe(DragonPhase.Strafing)
  })
})

// ─── tickDragonPhase — Perched ────────────────────────────────────────────────
describe('tickDragonPhase — Perched', () => {
  it('records the portalPosition as perchPosition when transitioning to Perched', () => {
    const state = { ...initialDragonPhaseState(80), phase: DragonPhase.Landing as const }
    const result = tickDragonPhase(state, makeInput({
      dragonPosition: { x: 0, y: 64, z: 0 }, // at portal y
    }))
    expect(result.nextState.phase).toBe(DragonPhase.Perched)
    expect(result.nextState.perchPosition).toEqual(PORTAL)
  })

  it('transitions to Takeoff when phaseTimer reaches PERCHED_TAKEOFF_TICKS', () => {
    // resolveNextPhase checks state.phaseTimer >= 100 (current timer, not next)
    const state = {
      ...initialDragonPhaseState(80),
      phase: DragonPhase.Perched as const,
      phaseTimer: 100, // at or above the threshold → Takeoff
    }
    const result = tickDragonPhase(state, makeInput())
    expect(result.nextState.phase).toBe(DragonPhase.Takeoff)
  })
})
