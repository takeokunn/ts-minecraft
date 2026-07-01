import { describe, expect, it } from 'vitest'
import {
  DEATH_ANIMATION_TICKS,
  DRAGON_DEATH_XP_TOTAL,
  DragonDeathPhase,
  dragonDeathPhaseForProgress,
  tickDragonDeath,
} from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-death'

// ─── dragonDeathPhaseForProgress ─────────────────────────────────────────────
describe('dragonDeathPhaseForProgress', () => {
  it('returns Dying at progress 0', () => {
    expect(dragonDeathPhaseForProgress(0)).toBe(DragonDeathPhase.Dying)
  })

  it('returns Dying up to 79', () => {
    expect(dragonDeathPhaseForProgress(79)).toBe(DragonDeathPhase.Dying)
  })

  it('transitions to Exploding at 80', () => {
    expect(dragonDeathPhaseForProgress(80)).toBe(DragonDeathPhase.Exploding)
  })

  it('transitions to EggSpawn at 120', () => {
    expect(dragonDeathPhaseForProgress(120)).toBe(DragonDeathPhase.EggSpawn)
  })

  it('transitions to PortalActivate at 140', () => {
    expect(dragonDeathPhaseForProgress(140)).toBe(DragonDeathPhase.PortalActivate)
  })

  it('transitions to XPFountain at 160', () => {
    expect(dragonDeathPhaseForProgress(160)).toBe(DragonDeathPhase.XPFountain)
  })

  it('transitions to Complete at DEATH_ANIMATION_TICKS', () => {
    expect(dragonDeathPhaseForProgress(DEATH_ANIMATION_TICKS)).toBe(DragonDeathPhase.Complete)
  })
})

// ─── tickDragonDeath ──────────────────────────────────────────────────────────
describe('tickDragonDeath', () => {
  it('emits Dying event in the first phase', () => {
    const result = tickDragonDeath(0, 0)
    expect(result.phase).toBe(DragonDeathPhase.Dying)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.type).toBe('Dying')
  })

  it('increments progress by 1 each tick', () => {
    expect(tickDragonDeath(0, 0).progress).toBe(1)
    expect(tickDragonDeath(10, 0).progress).toBe(11)
  })

  it('clamps progress at DEATH_ANIMATION_TICKS', () => {
    const result = tickDragonDeath(DEATH_ANIMATION_TICKS, 0)
    expect(result.progress).toBe(DEATH_ANIMATION_TICKS)
  })

  it('emits DragonEggSpawn event at exactly progress 120', () => {
    const result = tickDragonDeath(120, 0)
    expect(result.phase).toBe(DragonDeathPhase.EggSpawn)
    expect(result.events[0]?.type).toBe('DragonEggSpawn')
  })

  it('emits no EggSpawn event at progress 121 (one-shot event)', () => {
    const result = tickDragonDeath(121, 0)
    expect(result.phase).toBe(DragonDeathPhase.EggSpawn)
    expect(result.events).toHaveLength(0)
  })

  it('emits ReturnPortalActivate at exactly progress 140', () => {
    const result = tickDragonDeath(140, 0)
    expect(result.phase).toBe(DragonDeathPhase.PortalActivate)
    expect(result.events[0]?.type).toBe('ReturnPortalActivate')
  })

  it('emits XPFountain events during the XP phase', () => {
    const result = tickDragonDeath(160, 0)
    expect(result.phase).toBe(DragonDeathPhase.XPFountain)
    expect(result.events[0]?.type).toBe('XPFountain')
  })

  it('XP fountain total across all ticks equals DRAGON_DEATH_XP_TOTAL', () => {
    let totalXP = 0
    for (let progress = 160; progress < DEATH_ANIMATION_TICKS; progress++) {
      const result = tickDragonDeath(progress, progress)
      for (const event of result.events) {
        if (event.type === 'XPFountain') {
          totalXP += event.amount
        }
      }
    }
    expect(totalXP).toBeCloseTo(DRAGON_DEATH_XP_TOTAL)
  })

  it('emits Complete event at the end of the animation', () => {
    const result = tickDragonDeath(DEATH_ANIMATION_TICKS, 0)
    expect(result.phase).toBe(DragonDeathPhase.Complete)
    const complete = result.events.find((e) => e.type === 'Complete')
    expect(complete?.type).toBe('Complete')
  })
})
