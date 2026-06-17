import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { applySurvivalFootstepEffects } from './environment-footstep'

describe('physics-stage-survival/environment-footstep', () => {
  it('plays the resolved footstep sound and advances the accumulator', async () => {
    const playEffect = vi.fn(() => Effect.void)
    const services = {
      soundManager: { playEffect },
    }
    const refs = {
      footstepDistanceAccumulatorRef: MutableRef.make(0.3),
    }
    const refreshedPos = { x: 4, y: 65, z: -2 }

    await Effect.runPromise(
      applySurvivalFootstepEffects(
        services as never,
        refs as never,
        refreshedPos,
        {
          distanceMoved: 0.5,
          inCreative: false,
          isGrounded: true,
          isSneaking: false,
          isSprinting: false,
        },
        'STONE',
      ),
    )

    expect(playEffect).toHaveBeenCalledOnce()
    expect(playEffect).toHaveBeenCalledWith('footstepStone', {
      position: refreshedPos,
      gainScale: 1,
    })
    expect(MutableRef.get(refs.footstepDistanceAccumulatorRef)).toBeCloseTo(0.08)
  })
})
