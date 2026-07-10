import { describe, it } from '@effect/vitest'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
import { expect, vi } from 'vitest'
import { Effect, Option } from 'effect'

import { restoreSavedState } from './session-restore'

const makeWorldBootstrap = (overrides?: Partial<{
  savedPlayerState: ReturnType<typeof Option.none>
  savedFurnaceStates: ReturnType<typeof Option.none>
  savedChestStates: ReturnType<typeof Option.none>
  savedWeatherState: ReturnType<typeof Option.none>
  savedEntityStates: ReturnType<typeof Option.none>
}>) => ({
  seed: 12345,
  createdAt: new Date('2024-01-01'),
  baseSpawnPosition: { x: 0, y: 64, z: 0 },
  savedPlayerState: Option.none(),
  savedFurnaceStates: Option.none(),
  savedChestStates: Option.none(),
  savedWeatherState: Option.none(),
  savedEntityStates: Option.none(),
  savedStatistics: Option.none(),
  savedUnlockedAchievements: Option.none(),
  savedActiveDimension: Option.none(),
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
  inventoryService: { deserialize: vi.fn(() => Effect.void), clear: vi.fn(() => Effect.void) },
  equipmentService: { deserialize: vi.fn(() => Effect.void), reset: vi.fn(() => Effect.void) },
  healthService: {
    reset: vi.fn(() => Effect.void),
    getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
    applyDamage: vi.fn(() => Effect.void),
  },
  hungerService: { restore: vi.fn(() => Effect.void), reset: vi.fn(() => Effect.void) },
  xpService: { setTotalXP: vi.fn(() => Effect.void), reset: vi.fn(() => Effect.void) },
  statisticsService: { reset: vi.fn(() => Effect.void), deserialize: vi.fn(() => Effect.void) },
  achievementService: { reset: vi.fn(() => Effect.void), deserialize: vi.fn(() => Effect.void) },
  chestService: { deserialize: vi.fn(() => Effect.void) },
  furnaceService: { deserialize: vi.fn(() => Effect.void) },
  weatherService: { restore: vi.fn(() => Effect.void), setWeather: vi.fn(() => Effect.void) },
  cropGrowthService: { restore: vi.fn(() => Effect.void) },
  entityManager: { applyEntitySnapshot: vi.fn(() => Effect.succeed('created' as const)), clear: vi.fn(() => Effect.void), setActiveDimension: vi.fn(() => Effect.void) },
  netherService: { setDimension: vi.fn(() => Effect.void) },
  chunkManagerService: { setActiveDimension: vi.fn(() => Effect.void) },
  gameState: { enterBoat: vi.fn(() => Effect.void), enterMinecart: vi.fn(() => Effect.void) },
})

describe('restoreSavedState', () => {
  it('resets per-world state to defaults (no restore) when savedPlayerState is none', async () => {
    const worldBootstrap = makeWorldBootstrap()
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    // A brand-new world must START CLEAN: these services are app-scoped
    // singletons reused across worlds, so the reset-to-defaults runs even with
    // no saved state (otherwise the new world inherits the prior world's
    // inventory/XP/gear/mobs — verified live before this fix).
    expect(services.inventoryService.clear).toHaveBeenCalledOnce()
    expect(services.equipmentService.reset).toHaveBeenCalledOnce()
    expect(services.xpService.reset).toHaveBeenCalledOnce()
    expect(services.healthService.reset).toHaveBeenCalledOnce()
    expect(services.hungerService.reset).toHaveBeenCalledOnce()
    expect(services.entityManager.clear).toHaveBeenCalledOnce()
    expect(services.chestService.deserialize).toHaveBeenCalledWith([])
    expect(services.furnaceService.deserialize).toHaveBeenCalledWith([])
    expect(services.weatherService.setWeather).toHaveBeenCalledWith('clear')

    // But the RESTORE paths (which apply saved values) must NOT run.
    expect(services.inventoryService.deserialize).not.toHaveBeenCalled()
    expect(services.hungerService.restore).not.toHaveBeenCalled()
    expect(services.xpService.setTotalXP).not.toHaveBeenCalled()
    expect(services.equipmentService.deserialize).not.toHaveBeenCalled()
    expect(services.cropGrowthService.restore).not.toHaveBeenCalled()
    expect(services.entityManager.applyEntitySnapshot).not.toHaveBeenCalled()
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
    // reset() runs twice for a saved world: once in the clean-slate reset block,
    // once inside restoreSavedPlayerState before applying the saved health delta.
    expect(services.healthService.reset).toHaveBeenCalledTimes(2)
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

    // deserialize runs twice: [] in the clean-slate reset, then the saved states.
    expect(services.furnaceService.deserialize).toHaveBeenCalledTimes(2)
    expect(services.furnaceService.deserialize).toHaveBeenLastCalledWith(savedStates)
  })

  it('calls chestService.deserialize when savedChestStates is some', async () => {
    const savedStates = [{ position: { x: 0, y: 64, z: 0 }, items: [] as never[] }]
    const worldBootstrap = makeWorldBootstrap({
      savedChestStates: Option.some(savedStates),
    })
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    // deserialize runs twice: [] in the clean-slate reset, then the saved states.
    expect(services.chestService.deserialize).toHaveBeenCalledTimes(2)
    expect(services.chestService.deserialize).toHaveBeenLastCalledWith(savedStates)
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

  it('restores saved entity states into entityManager', async () => {
    const entityStates = [
      {
        entityId: 'mob-42',
        position: { x: 8, y: 64, z: 12 },
        velocity: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
        health: 14,
        type: 'Zombie' as const,
        isBaby: true,
        fuseSecs: 2.5,
        fireSecs: 4,
      },
    ]
    const worldBootstrap = makeWorldBootstrap({
      savedEntityStates: Option.some(entityStates) as never,
    })
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    expect(services.entityManager.applyEntitySnapshot).toHaveBeenCalledOnce()
    expect(services.entityManager.applyEntitySnapshot).toHaveBeenCalledWith({
      entityId: EntityId.make('mob-42'),
      entityType: 'Zombie',
      position: { x: 8, y: 64, z: 12 },
      health: 14,
      alive: true,
      velocity: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
      isBaby: true,
      fuseSecs: 2.5,
      fireSecs: 4,
    })
  })

  it('rebuilds per-dimension entity pools and lands in the saved dimension', async () => {
    const base = {
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      health: 10,
    }
    const entityStates = [
      { ...base, entityId: 'cow-1', type: 'Cow' as const, dimension: 'overworld' as const },
      { ...base, entityId: 'blaze-1', type: 'Blaze' as const, dimension: 'nether' as const },
    ]
    const worldBootstrap = makeWorldBootstrap({
      savedEntityStates: Option.some(entityStates) as never,
      savedActiveDimension: Option.some('nether') as never,
    })
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    // Each populated dimension is selected before its snapshots apply; the
    // FINAL selection is the dimension the world was saved in.
    const dimCalls = services.entityManager.setActiveDimension.mock.calls.map((c) => c[0])
    expect(dimCalls).toEqual(['overworld', 'nether', 'nether'])
    expect(services.entityManager.applyEntitySnapshot).toHaveBeenCalledTimes(2)
    // World-level dimension services re-enter the saved dimension too.
    expect(services.netherService.setDimension).toHaveBeenLastCalledWith('nether')
    expect(services.chunkManagerService.setActiveDimension).toHaveBeenLastCalledWith('nether')
  })

  it('a world saved without dimension info lands in the overworld', async () => {
    const worldBootstrap = makeWorldBootstrap()
    const services = makeServices()

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, services as never))

    // Reset puts every dimension-aware service back to overworld; with no
    // saved dimension there must be no nether/end re-entry afterwards.
    expect(services.netherService.setDimension).toHaveBeenCalledWith('overworld')
    expect(services.netherService.setDimension).not.toHaveBeenCalledWith('nether')
    expect(services.entityManager.setActiveDimension).toHaveBeenLastCalledWith('overworld')
  })
})
