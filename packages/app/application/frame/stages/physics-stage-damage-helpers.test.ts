import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { applyExplosionBlockDamage, tryApplyPlayerDamage } from './physics-stage-damage-helpers'

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

  it('forwards the damage cause when provided', async () => {
    const services = makeServices()

    await expect(Effect.runPromise(tryApplyPlayerDamage(4, false, services, { kind: 'fall' }))).resolves.toBe(true)
    expect(services.healthService.applyDamage).toHaveBeenCalledWith(4, { kind: 'fall' })
  })

  it('returns false when the player is invincible', async () => {
    const services = makeServices({ current: 15, max: 20, invincibilityTicks: 10 })

    await expect(Effect.runPromise(tryApplyPlayerDamage(4, false, services))).resolves.toBe(false)
    expect(services.healthService.getHealth).toHaveBeenCalledOnce()
    expect(services.healthService.applyDamage).not.toHaveBeenCalled()
    expect(services.hungerService.addExhaustion).not.toHaveBeenCalled()
  })
})

describe('applyExplosionBlockDamage co-op replication', () => {
  const explosion = { position: { x: 10, y: 64, z: -5 }, power: 2 } as never

  it('replicates each broken crater voxel via sendBlockBreak when connected', async () => {
    const forceSetBlock = vi.fn(() => Effect.void)
    const sendBlockBreak = vi.fn(() => Effect.void)
    const services = {
      blockService: { forceSetBlock },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
      multiplayer: Option.some({ sendBlockBreak } as never),
    } as never

    await Effect.runPromise(applyExplosionBlockDamage(services, explosion))

    expect(forceSetBlock.mock.calls.length).toBeGreaterThan(0)
    expect(sendBlockBreak.mock.calls.length).toBe(forceSetBlock.mock.calls.length)
  })

  it('skips replication when no multiplayer service is wired', async () => {
    const forceSetBlock = vi.fn(() => Effect.void)
    const services = {
      blockService: { forceSetBlock },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
      multiplayer: Option.none(),
    } as never

    await expect(Effect.runPromise(applyExplosionBlockDamage(services, explosion))).resolves.toBeUndefined()
    expect(forceSetBlock.mock.calls.length).toBeGreaterThan(0)
  })
})
