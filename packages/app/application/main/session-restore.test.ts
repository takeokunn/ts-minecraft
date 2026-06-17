import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'

import { restoreSavedState } from './session-restore'

const makeWorldBootstrap = (overrides?: Partial<{
  savedPlayerState: ReturnType<typeof Option.none>
  savedFurnaceStates: ReturnType<typeof Option.none>
  savedChestStates: ReturnType<typeof Option.none>
  savedWeatherState: ReturnType<typeof Option.none>
}>) => ({
  seed: 12345,
  createdAt: new Date('2024-01-01'),
  baseSpawnPosition: { x: 0, y: 64, z: 0 },
  savedPlayerState: Option.none(),
  savedFurnaceStates: Option.none(),
  savedChestStates: Option.none(),
  savedWeatherState: Option.none(),
  gameMode: 'survival' as const,
  ...overrides,
})

const makeSavedPlayerState = (overrides?: Partial<{
  health: number
  hunger: { foodLevel: number; saturation: number }
  totalXP: number
  equipment: Record<string, string>
  cropAges: Record<string, number>
}>) => ({
  position: { x: 0, y: 64, z: 0 },
  health: 20,
  inventory: { slots: [] as never[] },
  timeOfDay: 0.5,
  hunger: { foodLevel: 7, saturation: 1 },
  totalXP: 12,
  equipment: { CHESTPLATE: 'IRON_CHESTPLATE' },
  cropAges: { '0,64,0': 1 },
  ...overrides,
}) as never

const makeServices = () => ({
  inventoryService: { deserialize: vi.fn(() => Effect.void) },
  equipmentService: { deserialize: vi.fn(() => Effect.void) },
  healthService: {
    reset: vi.fn(() => Effect.void),
    getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
    applyDamage: vi.fn(() => Effect.void),
  },
  hungerService: { restore: vi.fn(() => Effect.void) },
  xpService: { setTotalXP: vi.fn(() => Effect.void) },
  chestService: { deserialize: vi.fn(() => Effect.void) },
  furnaceService: { deserialize: vi.fn(() => Effect.void) },
  weatherService: { restore: vi.fn(() => Effect.void) },
  cropGrowthService: { restore: vi.fn(() => Effect.void) },
})

describe('restoreSavedState', () => {
  it('does not touch player services when savedPlayerState is none', async () => {
    const worldBootstrap = makeWorldBootstrap()
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    expect(services.inventoryService.deserialize).not.toHaveBeenCalled()
    expect(services.healthService.reset).not.toHaveBeenCalled()
    expect(services.hungerService.restore).not.toHaveBeenCalled()
    expect(services.xpService.setTotalXP).not.toHaveBeenCalled()
    expect(services.equipmentService.deserialize).not.toHaveBeenCalled()
    expect(services.cropGrowthService.restore).not.toHaveBeenCalled()
  })

  it('restores canonical saved player state through the player services', async () => {
    const worldBootstrap = makeWorldBootstrap({
      savedPlayerState: Option.some(makeSavedPlayerState({
        health: 12,
        hunger: { foodLevel: 9, saturation: 3 },
        totalXP: 42,
        equipment: { CHESTPLATE: 'IRON_CHESTPLATE' },
        cropAges: { '1,64,1': 3 },
      })),
    })
    const services = makeServices()
    services.healthService.getHealth.mockReturnValue(Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 }))

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    expect(services.inventoryService.deserialize).toHaveBeenCalledOnce()
    expect(services.healthService.reset).toHaveBeenCalledOnce()
    expect(services.healthService.applyDamage).toHaveBeenCalledWith(8)
    expect(services.hungerService.restore).toHaveBeenCalledWith(9, 3)
    expect(services.xpService.setTotalXP).toHaveBeenCalledWith(42)
    expect(services.equipmentService.deserialize).toHaveBeenCalledWith({
      HELMET: null,
      CHESTPLATE: 'IRON_CHESTPLATE',
      LEGGINGS: null,
      BOOTS: null,
    })
    expect(services.cropGrowthService.restore).toHaveBeenCalledWith({ '1,64,1': 3 })
  })

  it('calls furnaceService.deserialize when savedFurnaceStates is some', async () => {
    const savedStates = [{ position: { x: 0, y: 64, z: 0 }, input: Option.none(), fuel: Option.none(), output: Option.none(), activeRecipeId: Option.none(), progressSecs: 0 }]
    const worldBootstrap = makeWorldBootstrap({
      savedFurnaceStates: Option.some(savedStates),
    })
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    expect(services.furnaceService.deserialize).toHaveBeenCalledOnce()
    expect(services.furnaceService.deserialize).toHaveBeenCalledWith(savedStates)
  })

  it('calls chestService.deserialize when savedChestStates is some', async () => {
    const savedStates = [{ position: { x: 0, y: 64, z: 0 }, items: [] as never[] }]
    const worldBootstrap = makeWorldBootstrap({
      savedChestStates: Option.some(savedStates),
    })
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    expect(services.chestService.deserialize).toHaveBeenCalledOnce()
    expect(services.chestService.deserialize).toHaveBeenCalledWith(savedStates)
  })

  it('calls weatherService.restore when savedWeatherState is some', async () => {
    const savedWeatherState = { weather: 'rain' as const, remainingSecs: 120 }
    const worldBootstrap = makeWorldBootstrap({
      savedWeatherState: Option.some(savedWeatherState),
    })
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    expect(services.weatherService.restore).toHaveBeenCalledOnce()
    expect(services.weatherService.restore).toHaveBeenCalledWith(savedWeatherState)
  })
})
