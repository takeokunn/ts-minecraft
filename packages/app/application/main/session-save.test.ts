import { describe, expect, it, vi } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { buildPersistSessionState, restoreSavedState } from '@ts-minecraft/app/main/session-save'
import { WorldId } from '@ts-minecraft/kernel'
import { StorageError } from '@ts-minecraft/world-state'

// ---------------------------------------------------------------------------
// Minimal mock factories
// ---------------------------------------------------------------------------

const makeWorldBootstrap = (overrides?: Partial<{
  seed: number
  createdAt: Date
  baseSpawnPosition: { x: number; y: number; z: number }
  savedPlayerState: ReturnType<typeof Option.none>
  savedFurnaceStates: ReturnType<typeof Option.none>
  gameMode: 'survival' | 'creative'
}>) => ({
  seed: 12345,
  createdAt: new Date('2024-01-01'),
  baseSpawnPosition: { x: 0, y: 64, z: 0 },
  savedPlayerState: Option.none(),
  savedFurnaceStates: Option.none(),
  gameMode: 'survival' as const,
  ...overrides,
})

const makeEmptyInventory = () => ({ slots: [] as never[] })

const makeDeps = (overrides?: {
  saveWorldMetadataSpy?: ReturnType<typeof vi.fn>
}) => {
  const saveWorldMetadataSpy = overrides?.saveWorldMetadataSpy ?? vi.fn(() => Effect.void)

  const gameState = {
    getPlayerPosition: vi.fn(() => Effect.succeed({ x: 10, y: 64, z: 20 })),
  }
  const inventoryService = {
    serialize: vi.fn(() => Effect.succeed(makeEmptyInventory())),
    deserialize: vi.fn(() => Effect.void),
  }
  const healthService = {
    getHealth: vi.fn(() => Effect.succeed({ current: 18, max: 20, invincibilityTicks: 0 })),
    reset: vi.fn(() => Effect.void),
    applyDamage: vi.fn(() => Effect.void),
  }
  const timeService = {
    getTimeOfDay: vi.fn(() => Effect.succeed(0.5)),
  }
  const furnaceService = {
    serialize: vi.fn(() => Effect.succeed([])),
    deserialize: vi.fn(() => Effect.void),
  }
  const gameModeService = {
    get: vi.fn(() => Effect.succeed('survival' as const)),
  }
  const storageService = {
    saveWorldMetadata: saveWorldMetadataSpy,
  }
  const worldBootstrap = makeWorldBootstrap()
  const worldId = WorldId.make('world-1')

  return {
    spies: { gameState, inventoryService, healthService, timeService, furnaceService, gameModeService, storageService },
    deps: {
      gameState,
      inventoryService,
      healthService,
      timeService,
      furnaceService,
      gameModeService,
      storageService,
      worldBootstrap,
      worldId,
    } as never,
  }
}

// ---------------------------------------------------------------------------
// buildPersistSessionState
// ---------------------------------------------------------------------------

describe('buildPersistSessionState', () => {
  it('calls saveWorldMetadata once with the current world state on the happy path', async () => {
    const { deps, spies } = makeDeps()
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    expect(spies.storageService.saveWorldMetadata).toHaveBeenCalledOnce()
    expect(spies.furnaceService.serialize).toHaveBeenCalledOnce()
    expect(spies.gameModeService.get).toHaveBeenCalledOnce()
    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { furnaceStates: unknown; gameMode: string }]
    expect(metadata.furnaceStates).toEqual([])
    expect(metadata.gameMode).toBe('survival')
  })

  it('includes the player position retrieved from gameState', async () => {
    const { deps, spies } = makeDeps()
    spies.gameState.getPlayerPosition.mockReturnValue(Effect.succeed({ x: 5, y: 70, z: 15 }))
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { playerState: { position: unknown } }]
    expect(metadata.playerState?.position).toEqual({ x: 5, y: 70, z: 15 })
  })

  it('includes the current health value in playerState', async () => {
    const { deps, spies } = makeDeps()
    spies.healthService.getHealth.mockReturnValue(Effect.succeed({ current: 12, max: 20, invincibilityTicks: 0 }))
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { playerState: { health: number } }]
    expect(metadata.playerState?.health).toBe(12)
  })

  it('includes the timeOfDay value in playerState', async () => {
    const { deps, spies } = makeDeps()
    spies.timeService.getTimeOfDay.mockReturnValue(Effect.succeed(0.25))
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { playerState: { timeOfDay: number } }]
    expect(metadata.playerState?.timeOfDay).toBe(0.25)
  })

  it('passes worldBootstrap seed and createdAt to saveWorldMetadata', async () => {
    const { deps, spies } = makeDeps()
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [savedWorldId, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [string, { seed: number; createdAt: Date }]
    expect(savedWorldId).toBe('world-1')
    expect(metadata.seed).toBe(12345)
    expect(metadata.createdAt).toEqual(new Date('2024-01-01'))
  })

  it('surfaces StorageError when saveWorldMetadata fails', async () => {
    const storageError = new StorageError({ operation: 'saveWorldMetadata', cause: 'disk full' })
    const { deps } = makeDeps({
      saveWorldMetadataSpy: vi.fn(() => Effect.fail(storageError)),
    })
    const persistFn = buildPersistSessionState(deps)

    const result = await Effect.runPromise(Effect.either(persistFn()))

    expect(Either.isLeft(result)).toBe(true)
    const err = Option.getOrThrow(Either.getLeft(result))
    expect(err._tag).toBe('StorageError')
  })

  it('save version is set to 1', async () => {
    const { deps, spies } = makeDeps()
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { saveVersion: number }]
    expect(metadata.saveVersion).toBe(1)
  })

  it('collects serialized inventory from inventoryService', async () => {
    const { deps, spies } = makeDeps()
    const fakeInventory = { slots: [] as never[] }
    spies.inventoryService.serialize.mockReturnValue(Effect.succeed(fakeInventory))
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    expect(spies.inventoryService.serialize).toHaveBeenCalledOnce()
    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { playerState: { inventory: typeof fakeInventory } }]
    expect(metadata.playerState?.inventory).toEqual(fakeInventory)
  })
})

// ---------------------------------------------------------------------------
// restoreSavedState
// ---------------------------------------------------------------------------

describe('restoreSavedState', () => {
  it('does NOT call deserialize when savedPlayerState is Option.none()', async () => {
    const worldBootstrap = makeWorldBootstrap({ savedPlayerState: Option.none() })
    const inventoryService = { deserialize: vi.fn(() => Effect.void) }
    const healthService = { reset: vi.fn(() => Effect.void), getHealth: vi.fn(), applyDamage: vi.fn() }
    const furnaceService = { deserialize: vi.fn(() => Effect.void) }

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, { inventoryService, healthService, furnaceService } as never))

    expect(inventoryService.deserialize).not.toHaveBeenCalled()
    expect(healthService.reset).not.toHaveBeenCalled()
  })

  it('calls inventoryService.deserialize and healthService.reset when savedPlayerState is some', async () => {
    const savedInventory = { slots: [] as never[] }
    const worldBootstrap = makeWorldBootstrap({
      savedPlayerState: Option.some({
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        inventory: savedInventory,
        timeOfDay: 0.5,
      }),
    })
    const inventoryService = { deserialize: vi.fn(() => Effect.void) }
    const healthService = {
      reset: vi.fn(() => Effect.void),
      getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
      applyDamage: vi.fn(() => Effect.void),
    }
    const furnaceService = { deserialize: vi.fn(() => Effect.void) }

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, { inventoryService, healthService, furnaceService } as never))

    expect(inventoryService.deserialize).toHaveBeenCalledOnce()
    expect(inventoryService.deserialize).toHaveBeenCalledWith(savedInventory)
    expect(healthService.reset).toHaveBeenCalledOnce()
  })

  it('applies damage equal to (resetHealth - savedHealth) when savedHealth is lower than max', async () => {
    const worldBootstrap = makeWorldBootstrap({
      savedPlayerState: Option.some({
        position: { x: 0, y: 64, z: 0 },
        health: 12,
        inventory: { slots: [] as never[] },
        timeOfDay: 0.5,
      }),
    })
    const applyDamageSpy = vi.fn(() => Effect.void)
    const healthService = {
      reset: vi.fn(() => Effect.void),
      // After reset the player is at full health (20)
      getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
      applyDamage: applyDamageSpy,
    }
    const inventoryService = { deserialize: vi.fn(() => Effect.void) }
    const furnaceService = { deserialize: vi.fn(() => Effect.void) }

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, { inventoryService, healthService, furnaceService } as never))

    // damageToApply = max(0, resetHealth - savedHealth) = max(0, 20 - 12) = 8
    expect(applyDamageSpy).toHaveBeenCalledOnce()
    expect(applyDamageSpy).toHaveBeenCalledWith(8)
  })

  it('does NOT call applyDamage when saved health equals the reset health', async () => {
    const worldBootstrap = makeWorldBootstrap({
      savedPlayerState: Option.some({
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        inventory: { slots: [] as never[] },
        timeOfDay: 0.5,
      }),
    })
    const applyDamageSpy = vi.fn(() => Effect.void)
    const healthService = {
      reset: vi.fn(() => Effect.void),
      getHealth: vi.fn(() => Effect.succeed({ current: 20, max: 20, invincibilityTicks: 0 })),
      applyDamage: applyDamageSpy,
    }
    const inventoryService = { deserialize: vi.fn(() => Effect.void) }
    const furnaceService = { deserialize: vi.fn(() => Effect.void) }

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, { inventoryService, healthService, furnaceService } as never))

    expect(applyDamageSpy).not.toHaveBeenCalled()
  })

  it('calls furnaceService.deserialize when savedFurnaceStates is some', async () => {
    const savedStates = [{ position: { x: 0, y: 64, z: 0 }, input: Option.none(), fuel: Option.none(), output: Option.none(), activeRecipeId: Option.none(), progressSecs: 0 }]
    const worldBootstrap = makeWorldBootstrap({
      savedFurnaceStates: Option.some(savedStates),
    })
    const furnaceDeserializeSpy = vi.fn(() => Effect.void)
    const inventoryService = { deserialize: vi.fn(() => Effect.void) }
    const healthService = { reset: vi.fn(), getHealth: vi.fn(), applyDamage: vi.fn() }
    const furnaceService = { deserialize: furnaceDeserializeSpy }

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, { inventoryService, healthService, furnaceService } as never))

    expect(furnaceDeserializeSpy).toHaveBeenCalledOnce()
    expect(furnaceDeserializeSpy).toHaveBeenCalledWith(savedStates)
  })

  it('does NOT call furnaceService.deserialize when savedFurnaceStates is none', async () => {
    const worldBootstrap = makeWorldBootstrap({ savedFurnaceStates: Option.none() })
    const furnaceDeserializeSpy = vi.fn(() => Effect.void)
    const inventoryService = { deserialize: vi.fn(() => Effect.void) }
    const healthService = { reset: vi.fn(), getHealth: vi.fn(), applyDamage: vi.fn() }
    const furnaceService = { deserialize: furnaceDeserializeSpy }

    await Effect.runPromise(restoreSavedState(worldBootstrap as never, { inventoryService, healthService, furnaceService } as never))

    expect(furnaceDeserializeSpy).not.toHaveBeenCalled()
  })
})
