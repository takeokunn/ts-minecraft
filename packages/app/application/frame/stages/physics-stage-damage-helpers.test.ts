import { describe, it, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { tryApplyPlayerDamage } from './physics-stage-damage-helpers'

type DamageServices = Parameters<typeof tryApplyPlayerDamage>[2]

const makeServices = (health = { current: 20, max: 20, invincibilityTicks: 0 }) =>
  ({
    healthService: {
      getHealth: vi.fn(() => Effect.succeed(health)),
      applyDamage: vi.fn(() => Effect.void),
    },
    hungerService: {
      addExhaustion: vi.fn(() => Effect.void),
    },
  }) satisfies DamageServices

describe('physics-stage — damage helpers', () => {
  it('returns false without touching services when damage is non-positive', async () => {
    const services = makeServices()

    await expect(Effect.runPromise(tryApplyPlayerDamage(0, false, services))).resolves.toBe(false)
    expect(services.healthService.getHealth).not.toHaveBeenCalled()
    expect(services.healthService.applyDamage).not.toHaveBeenCalled()
    expect(services.hungerService.addExhaustion).not.toHaveBeenCalled()
  })

  it('returns false without touching services in spectator mode', async () => {
    const services = makeServices()

    await expect(Effect.runPromise(tryApplyPlayerDamage(4, true, services))).resolves.toBe(false)
    expect(services.healthService.getHealth).not.toHaveBeenCalled()
    expect(services.healthService.applyDamage).not.toHaveBeenCalled()
    expect(services.hungerService.addExhaustion).not.toHaveBeenCalled()
  })

  it('applies damage and exhaustion when the player is vulnerable', async () => {
    const services = makeServices()

    await expect(Effect.runPromise(tryApplyPlayerDamage(4, false, services))).resolves.toBe(true)
    expect(services.healthService.getHealth).toHaveBeenCalledOnce()
    expect(services.healthService.applyDamage).toHaveBeenCalledOnce()
    expect(services.healthService.applyDamage).toHaveBeenCalledWith(4)
    expect(services.hungerService.addExhaustion).toHaveBeenCalledOnce()
  })

  it('returns false when the player is invincible', async () => {
    const services = makeServices({ current: 15, max: 20, invincibilityTicks: 10 })

    await expect(Effect.runPromise(tryApplyPlayerDamage(4, false, services))).resolves.toBe(false)
    expect(services.healthService.getHealth).toHaveBeenCalledOnce()
    expect(services.healthService.applyDamage).not.toHaveBeenCalled()
    expect(services.hungerService.addExhaustion).not.toHaveBeenCalled()
  })
})
