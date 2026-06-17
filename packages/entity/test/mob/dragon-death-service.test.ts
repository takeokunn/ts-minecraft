import { describe, expect, it } from 'vitest'
import { tickDragonDeathSequence } from '../../application/mob/dragon-death-service'
import { DragonDeathPhase } from '../../domain/mob/ender-dragon/dragon-death'

describe('tickDragonDeathSequence', () => {
  it('advances from the supplied progress and exposes the current phase', () => {
    const state = tickDragonDeathSequence({ progress: 79.8 }, 80, { x: 8, y: 72, z: -4 })

    expect(state).toEqual({
      progress: 80,
      phase: DragonDeathPhase.Dying,
      events: [{
        type: 'Dying',
        liftTowardSky: true,
        flashes: true,
        position: { x: 8, y: 72, z: -4 },
      }],
    })
  })

  it('forwards one-time portal activation events from the domain sequence', () => {
    const state = tickDragonDeathSequence({ progress: 140 }, 140, { x: 3, y: 85, z: 9 })

    expect(state.progress).toBe(141)
    expect(state.phase).toBe(DragonDeathPhase.PortalActivate)
    expect(state.events).toEqual([{
      type: 'ReturnPortalActivate',
      blockType: 'END_PORTAL',
      position: { x: 0, y: 64, z: 0 },
      emissive: true,
      canEnter: true,
    }])
  })
})
