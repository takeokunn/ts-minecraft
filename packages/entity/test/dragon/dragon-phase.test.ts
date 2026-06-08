import { describe, expect, it } from 'vitest'
import { DragonPhase, tickDragonPhase, type DragonPhaseInput, type DragonPhaseState } from '../../domain/mob/ender-dragon/dragon-phase'

const baseState: DragonPhaseState = {
  phase: DragonPhase.Circling,
  phaseTimer: 0,
  phaseProgress: 0,
  perchPosition: null,
  circlingRadius: 20,
  circlingHeight: 84,
  circlingAngle: 0,
}

const input = (overrides: Partial<DragonPhaseInput> = {}): DragonPhaseInput => ({
  dragonPosition: { x: 0, y: 84, z: 0 },
  dragonHealth: 200,
  playerPosition: { x: 10, y: 64, z: 0 },
  portalPosition: { x: 0, y: 64, z: 0 },
  randomValue: 0.5,
  tick: 1,
  ...overrides,
})

describe('tickDragonPhase transitions', () => {
  it('moves from circling to strafing after one full circle with a nearby player', () => {
    const step = tickDragonPhase({ ...baseState, circlingAngle: Math.PI * 2 + 0.01 }, input())
    expect(step.nextState.phase).toBe(DragonPhase.Strafing)
    expect(step.intent.newPhase).toBe(DragonPhase.Strafing)
    expect(step.intent.newVelocity.x).toBeGreaterThan(0)
  })

  it('stays circling without a nearby player and advances the circle angle', () => {
    const step = tickDragonPhase(baseState, input({ playerPosition: null }))
    expect(step.nextState.phase).toBe(DragonPhase.Circling)
    expect(step.nextState.circlingAngle).toBeCloseTo(0.05)
  })

  it('moves from strafing to landing below 50% health near the portal platform', () => {
    const state = { ...baseState, phase: DragonPhase.Strafing }
    const step = tickDragonPhase(state, input({ dragonPosition: { x: 2, y: 69, z: 2 }, dragonHealth: 99 }))
    expect(step.nextState.phase).toBe(DragonPhase.Landing)
    expect(step.intent.newVelocity.y).toBeLessThan(0)
  })

  it('moves from landing to perched on the portal platform', () => {
    const state = { ...baseState, phase: DragonPhase.Landing }
    const step = tickDragonPhase(state, input({ dragonPosition: { x: 0, y: 64, z: 0 } }))
    expect(step.nextState.phase).toBe(DragonPhase.Perched)
    expect(step.nextState.perchPosition).toEqual({ x: 0, y: 64, z: 0 })
    expect(step.intent.damageMultiplier).toBe(0.25)
  })

  it('moves from perched to takeoff after 100 ticks or below 10% health', () => {
    const perched = { ...baseState, phase: DragonPhase.Perched, phaseTimer: 100 }
    expect(tickDragonPhase(perched, input()).nextState.phase).toBe(DragonPhase.Takeoff)
    expect(tickDragonPhase({ ...perched, phaseTimer: 0 }, input({ dragonHealth: 19 })).nextState.phase).toBe(DragonPhase.Takeoff)
  })

  it('moves from takeoff to circling above y=80', () => {
    const state = { ...baseState, phase: DragonPhase.Takeoff }
    const step = tickDragonPhase(state, input({ dragonPosition: { x: 0, y: 81, z: 0 } }))
    expect(step.nextState.phase).toBe(DragonPhase.Circling)
  })

  it('moves from any phase to death sequence at zero health', () => {
    const state = { ...baseState, phase: DragonPhase.Perched }
    const step = tickDragonPhase(state, input({ dragonHealth: 0 }))
    expect(step.nextState.phase).toBe(DragonPhase.DeathSequence)
    expect(step.intent.healsFromCrystals).toBe(false)
    expect(step.intent.newVelocity).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('requests breath attack while perched and the roll succeeds', () => {
    const state = { ...baseState, phase: DragonPhase.Perched }
    const step = tickDragonPhase(state, input({
      dragonPosition: { x: 0, y: 64, z: 0 },
      playerPosition: { x: 4, y: 64, z: 0 },
      randomValue: 0.1,
    }))
    expect(step.intent.wantsBreathAttack).toBe(true)
  })
})
