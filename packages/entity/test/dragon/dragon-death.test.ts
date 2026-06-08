import { describe, expect, it } from 'vitest'
import {
  DEATH_ANIMATION_TICKS,
  DRAGON_DEATH_XP_TOTAL,
  DRAGON_EGG_POSITION,
  DragonDeathPhase,
  RETURN_PORTAL_POSITION,
  tickDragonDeath,
} from '../../domain/mob/ender-dragon/dragon-death'

describe('tickDragonDeath', () => {
  it('progresses through the complete death phase timeline', () => {
    expect(tickDragonDeath(0, 1).phase).toBe(DragonDeathPhase.Dying)
    expect(tickDragonDeath(79, 79).phase).toBe(DragonDeathPhase.Dying)
    expect(tickDragonDeath(80, 80).phase).toBe(DragonDeathPhase.Exploding)
    expect(tickDragonDeath(119, 119).phase).toBe(DragonDeathPhase.Exploding)
    expect(tickDragonDeath(120, 120).phase).toBe(DragonDeathPhase.EggSpawn)
    expect(tickDragonDeath(140, 140).phase).toBe(DragonDeathPhase.PortalActivate)
    expect(tickDragonDeath(160, 160).phase).toBe(DragonDeathPhase.XPFountain)
    expect(tickDragonDeath(DEATH_ANIMATION_TICKS, 200).phase).toBe(DragonDeathPhase.Complete)
  })

  it('spawns the dragon egg once at the return portal crown', () => {
    const step = tickDragonDeath(120, 120)

    expect(step.events).toEqual([{
      type: 'DragonEggSpawn',
      blockType: 'DRAGON_EGG',
      position: DRAGON_EGG_POSITION,
    }])
    expect(tickDragonDeath(121, 121).events).toEqual([])
  })

  it('activates the return portal as emissive and enterable', () => {
    const event = tickDragonDeath(140, 140).events[0]

    expect(event).toEqual({
      type: 'ReturnPortalActivate',
      blockType: 'END_PORTAL',
      position: RETURN_PORTAL_POSITION,
      emissive: true,
      canEnter: true,
    })
  })

  it('emits the full 12000 XP total across the fountain phase', () => {
    const total = Array.from({ length: 40 }, (_, index) => 160 + index)
      .flatMap((progress) => tickDragonDeath(progress, progress, { x: 4, y: 80, z: -3 }).events)
      .filter((event) => event.type === 'XPFountain')
      .reduce((sum, event) => sum + event.amount, 0)

    expect(total).toBe(DRAGON_DEATH_XP_TOTAL)
    expect(tickDragonDeath(160, 160).events[0]).toMatchObject({
      type: 'XPFountain',
      total: DRAGON_DEATH_XP_TOTAL,
    })
  })

  it('marks the dragon removable when complete', () => {
    expect(tickDragonDeath(200, 200)).toEqual({
      phase: DragonDeathPhase.Complete,
      progress: DEATH_ANIMATION_TICKS,
      events: [{ type: 'Complete', removeDragon: true }],
    })
  })
})
