import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Either, MutableRef, Option } from 'effect'

import { buildPersistSessionState } from './session-persist'
import { WorldId } from '@ts-minecraft/core'
import { StorageError } from '@ts-minecraft/world'

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
  const hungerService = {
    getHunger: vi.fn(() => Effect.succeed({ foodLevel: 15, saturation: 2, exhaustion: 0 })),
    restore: vi.fn(() => Effect.void),
  }
  const xpService = {
    getXP: vi.fn(() => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })),
    setTotalXP: vi.fn(() => Effect.void),
  }
  const equipmentService = {
    serialize: vi.fn(() => Effect.succeed({})),
    deserialize: vi.fn(() => Effect.void),
  }
  const timeService = {
    getTimeOfDay: vi.fn(() => Effect.succeed(0.5)),
  }
  const furnaceService = {
    serialize: vi.fn(() => Effect.succeed([])),
    deserialize: vi.fn(() => Effect.void),
  }
  const chestService = {
    serialize: vi.fn(() => Effect.succeed([])),
    deserialize: vi.fn(() => Effect.void),
  }
  const gameModeService = {
    get: vi.fn(() => Effect.succeed('survival' as const)),
  }
  const weatherService = {
    serialize: vi.fn(() => Effect.succeed({ weather: 'clear' as const, remainingSecs: 600 })),
    restore: vi.fn(() => Effect.void),
  }
  const storageService = {
    saveWorldMetadata: saveWorldMetadataSpy,
  }
  const cropGrowthService = {
    serialize: vi.fn(() => Effect.succeed({} as Record<string, number>)),
    restore: vi.fn(() => Effect.void),
  }
  const worldBootstrap = makeWorldBootstrap()
  const worldId = WorldId.make('world-1')

  return {
    spies: { gameState, inventoryService, healthService, hungerService, xpService, equipmentService, timeService, chestService, furnaceService, gameModeService, weatherService, storageService, cropGrowthService },
    deps: {
      gameState,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      timeService,
      chestService,
      furnaceService,
      gameModeService,
      weatherService,
      storageService,
      cropGrowthService,
      worldBootstrap,
      worldId,
      respawnPositionRef: MutableRef.make({ x: 0, y: 64, z: 0 }),
    } as never,
  }
}

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

  it('includes the current hunger (foodLevel + saturation) in playerState', async () => {
    const { deps, spies } = makeDeps()
    spies.hungerService.getHunger.mockReturnValue(Effect.succeed({ foodLevel: 13, saturation: 4, exhaustion: 1.5 }))
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { playerState: { hunger: { foodLevel: number; saturation: number } } }]
    expect(metadata.playerState?.hunger).toEqual({ foodLevel: 13, saturation: 4 })
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

  it('persists the bed-set respawn point from respawnPositionRef (FR-4)', async () => {
    const { deps, spies } = makeDeps()
    MutableRef.set((deps as { respawnPositionRef: MutableRef.MutableRef<{ x: number; y: number; z: number }> }).respawnPositionRef, { x: 100, y: 70, z: -42 })
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [string, { playerState: { respawnPosition: { x: number; y: number; z: number } } }]
    expect(metadata.playerState.respawnPosition).toEqual({ x: 100, y: 70, z: -42 })
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

  it('includes cropAges from cropGrowthService.serialize in playerState', async () => {
    const { deps, spies } = makeDeps()
    const cropAges = { '5,64,3': 1, '6,64,3': 2 }
    spies.cropGrowthService.serialize.mockReturnValue(Effect.succeed(cropAges))
    const persistFn = buildPersistSessionState(deps)

    await Effect.runPromise(persistFn())

    expect(spies.cropGrowthService.serialize).toHaveBeenCalledOnce()
    const [, metadata] = spies.storageService.saveWorldMetadata.mock.calls[0] as [unknown, { playerState: { cropAges: Record<string, number> } }]
    expect(metadata.playerState?.cropAges).toEqual(cropAges)
  })
})
