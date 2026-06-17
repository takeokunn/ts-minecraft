import { MutableRef, Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { applyHungerTicks } from './hunger'

describe('physics-stage-survival/hunger', () => {
  it('heals when hunger tick reports regeneration', async () => {
    const heal = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed('regen' as const))
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 18, max: 20 }),
        heal,
      },
      hungerService: { tick },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: 0.05, difficulty: 'easy' }, { x: 1, y: 64, z: 1 }, () => Effect.succeed(false))
      }),
    )

    expect(tick).toHaveBeenCalledOnce()
    expect(heal).toHaveBeenCalledWith(1)
  })

  it('applies starvation damage when hunger tick reports starvation', async () => {
    const heal = vi.fn(() => Effect.void)
    const playEffect = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed('starve' as const))
    const applyDamage = vi.fn(() => Effect.succeed(true))
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 4, max: 20 }),
        heal,
      },
      hungerService: { tick },
      soundManager: { playEffect },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: 0.05, difficulty: 'hard' }, { x: 1, y: 64, z: 1 }, applyDamage)
      }),
    )

    expect(tick).toHaveBeenCalledOnce()
    expect(applyDamage).toHaveBeenCalled()
    expect(playEffect).toHaveBeenCalledWith('playerHurt', { position: { x: 1, y: 64, z: 1 } })
  })
})
