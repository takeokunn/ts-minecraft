import { MutableRef, Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { HUNGER_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import { applyHungerTicks } from './hunger'

describe('physics-stage-survival/hunger', () => {
  it('heals when hunger tick reports regeneration', async () => {
    const heal = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed('regen' as const))
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 18, max: 20 }),
        getStatusEffects: () => Effect.succeed([]),
        heal,
      },
      hungerService: { tick },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: HUNGER_TICK_INTERVAL_SECS, difficulty: 'easy' }, { x: 1, y: 64, z: 1 }, () => Effect.succeed(false))
      }),
    )

    expect(tick).toHaveBeenCalledOnce()
    expect(heal).toHaveBeenCalledWith(1)
  })

  it('applies starvation damage when hunger tick reports starvation', async () => {
    const heal = vi.fn(() => Effect.void)
    const playEffect = vi.fn(() => Effect.void)
    const flash = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed('starve' as const))
    const applyDamage = vi.fn(() => Effect.succeed(true))
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 4, max: 20 }),
        getStatusEffects: () => Effect.succeed([]),
        heal,
      },
      hungerService: { tick },
      soundManager: { playEffect },
      damageOverlay: { flash },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: HUNGER_TICK_INTERVAL_SECS, difficulty: 'hard' }, { x: 1, y: 64, z: 1 }, applyDamage)
      }),
    )

    expect(tick).toHaveBeenCalledOnce()
    expect(applyDamage).toHaveBeenCalled()
    expect(playEffect).toHaveBeenCalledWith('playerHurt', { position: { x: 1, y: 64, z: 1 } })
  })

  it('does nothing when hunger tick reports none', async () => {
    const heal = vi.fn(() => Effect.void)
    const applyDamage = vi.fn(() => Effect.succeed(true))
    const tick = vi.fn(() => Effect.succeed('none' as const))
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 14, max: 20 }),
        getStatusEffects: () => Effect.succeed([]),
        heal,
      },
      hungerService: { tick },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: HUNGER_TICK_INTERVAL_SECS, difficulty: 'normal' }, { x: 1, y: 64, z: 1 }, applyDamage)
      }),
    )

    expect(tick).toHaveBeenCalledOnce()
    expect(heal).not.toHaveBeenCalled()
    expect(applyDamage).not.toHaveBeenCalled()
  })
})

describe('physics-stage-survival/hunger — HUNGER status effect drain', () => {
  it('adds deltaTime-proportional exhaustion while a HUNGER effect is active', async () => {
    const addExhaustion = vi.fn(() => Effect.void)
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 20, max: 20 }),
        getStatusEffects: () =>
          Effect.succeed([{ type: 'HUNGER' as const, amplifier: 1, remainingTicks: 600, elapsedTicks: 0 }]),
        heal: vi.fn(() => Effect.void),
      },
      hungerService: { tick: vi.fn(() => Effect.succeed('none' as const)), addExhaustion },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: 0.5, difficulty: 'normal' }, { x: 0, y: 64, z: 0 }, () => Effect.succeed(false))
      }),
    )

    // Hunger II = 0.2 exhaustion/s × 0.5s.
    expect(addExhaustion).toHaveBeenCalledWith(0.1)
  })

  it('adds no exhaustion when no HUNGER effect is active', async () => {
    const addExhaustion = vi.fn(() => Effect.void)
    const services = {
      healthService: {
        getHealth: () => Effect.succeed({ current: 20, max: 20 }),
        getStatusEffects: () =>
          Effect.succeed([{ type: 'SPEED' as const, amplifier: 0, remainingTicks: 600, elapsedTicks: 0 }]),
        heal: vi.fn(() => Effect.void),
      },
      hungerService: { tick: vi.fn(() => Effect.succeed('none' as const)), addExhaustion },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
    }

    await Effect.runPromise(
      Effect.gen(function* () {
        const refs = { hungerTickAccumulatorRef: MutableRef.make(0) }
        yield* applyHungerTicks(services, refs, { deltaTime: 0.5, difficulty: 'normal' }, { x: 0, y: 64, z: 0 }, () => Effect.succeed(false))
      }),
    )

    expect(addExhaustion).not.toHaveBeenCalled()
  })
})
