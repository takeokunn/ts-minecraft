import { describe, expect, it, vi } from 'vitest'
import { Effect, Either, Option } from 'effect'
import {
  loadOrCreateWorld,
  buildRespawnPosition,
  type WorldBootstrap,
} from '@ts-minecraft/app/main/session-world-loader'
import { WorldId, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { StorageError } from '@ts-minecraft/world-state'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeStorageService = (
  overrides?: Partial<{
    loadWorldMetadata: ReturnType<typeof vi.fn>
    saveWorldMetadata: ReturnType<typeof vi.fn>
  }>,
) => ({
  loadWorldMetadata: overrides?.loadWorldMetadata ?? vi.fn(() => Effect.succeed(Option.none())),
  saveWorldMetadata: overrides?.saveWorldMetadata ?? vi.fn(() => Effect.void),
})

const makeNoiseService = () => ({
  setSeed: vi.fn(() => Effect.void),
})

const makeGameModeService = () => ({
  set: vi.fn(() => Effect.void),
})

const makeMetadata = (overrides?: Partial<{
  seed: number
  createdAt: Date
  lastPlayed: Date
  playerSpawn: { x: number; y: number; z: number }
  gameMode: 'survival' | 'creative'
  saveVersion: number
}>) => ({
  seed: 42,
  createdAt: new Date('2024-01-01'),
  lastPlayed: new Date('2024-06-01'),
  playerSpawn: { x: 5, y: 64, z: 5 },
  gameMode: 'survival' as const,
  saveVersion: 1,
  ...overrides,
})

// ---------------------------------------------------------------------------
// loadOrCreateWorld
// ---------------------------------------------------------------------------

describe('loadOrCreateWorld', () => {
  describe('when world exists in storage (onSome path)', () => {
    it('returns a WorldBootstrap with the stored seed and createdAt', async () => {
      const metadata = makeMetadata({ seed: 777, createdAt: new Date('2023-05-15') })
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(Either.isRight(result)).toBe(true)
      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.seed).toBe(777)
      expect(bootstrap.createdAt).toEqual(new Date('2023-05-15'))
    })

    it('restores the playerSpawn from stored metadata as baseSpawnPosition', async () => {
      const metadata = makeMetadata({ playerSpawn: { x: 10, y: 72, z: 20 } })
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.baseSpawnPosition).toEqual({ x: 10, y: 72, z: 20 })
    })

    it('seeds the noise service with the stored seed', async () => {
      const metadata = makeMetadata({ seed: 9999 })
      const noiseService = makeNoiseService()
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(noiseService.setSeed).toHaveBeenCalledWith(9999)
    })

    it('sets game mode service to the stored game mode', async () => {
      const metadata = makeMetadata({ gameMode: 'creative' })
      const gameModeService = makeGameModeService()
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const worldId = WorldId.make('world-1')

      await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(gameModeService.set).toHaveBeenCalledWith('creative')
    })

    it('returns savedPlayerState as none when metadata has no playerState', async () => {
      const metadata = makeMetadata()
      // No playerState field
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isNone(bootstrap.savedPlayerState)).toBe(true)
    })

    it('returns savedPlayerState as some when metadata has a playerState', async () => {
      const playerState = {
        position: { x: 1, y: 64, z: 2 },
        health: 15,
        inventory: { slots: [] as never[] },
        timeOfDay: 0.3,
      }
      const metadata = { ...makeMetadata(), playerState }
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isSome(bootstrap.savedPlayerState)).toBe(true)
      expect(Option.getOrThrow(bootstrap.savedPlayerState).health).toBe(15)
    })

    it('returns savedFurnaceStates as some when metadata has a furnaceStates value', async () => {
      const furnaceStates = [
        { position: { x: 2, y: 64, z: 3 }, input: Option.none(), fuel: Option.none(), output: Option.none(), activeRecipeId: Option.none(), progressSecs: 0 },
      ]
      const metadata = { ...makeMetadata(), furnaceStates }
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isSome(bootstrap.savedFurnaceStates)).toBe(true)
      expect(Option.getOrThrow(bootstrap.savedFurnaceStates)).toEqual(furnaceStates)
    })

    it('falls back to { x:0, y:100, z:0 } when playerSpawn is null/undefined in metadata', async () => {
      const metadata = { ...makeMetadata(), playerSpawn: null as never }
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.baseSpawnPosition).toEqual({ x: 0, y: 100, z: 0 })
    })
  })

  describe('when world does NOT exist in storage (onNone path)', () => {
    it('creates a new world and saves metadata for it', async () => {
      const saveWorldMetadataSpy = vi.fn(() => Effect.void)
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: saveWorldMetadataSpy,
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(saveWorldMetadataSpy).toHaveBeenCalledOnce()
    })

    it('returns a WorldBootstrap with savedPlayerState = none() for a new world', async () => {
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isNone(bootstrap.savedPlayerState)).toBe(true)
      expect(Option.isNone(bootstrap.savedFurnaceStates)).toBe(true)
    })

    it('uses the initialGameMode for the new world', async () => {
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'creative', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.gameMode).toBe('creative')
    })

    it('uses default spawn { x:0, y:100, z:0 } for a new world', async () => {
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.baseSpawnPosition).toEqual({ x: 0, y: 100, z: 0 })
    })

    it('calls noiseService.setSeed with the newly generated seed', async () => {
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(noiseService.setSeed).toHaveBeenCalledOnce()
      // The seed is random, so we just verify it was called with a number
      const calledSeed = noiseService.setSeed.mock.calls[0]?.[0] as number
      expect(typeof calledSeed).toBe('number')
    })
  })

  describe('error handling', () => {
    it('surfaces a StartupError when loadWorldMetadata fails', async () => {
      const storageError = new StorageError({ operation: 'loadWorldMetadata', cause: 'IDB unavailable' })
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.fail(storageError)),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('StartupError')
    })

    it('surfaces a StartupError when saveWorldMetadata fails on a fresh world', async () => {
      const storageError = new StorageError({ operation: 'saveWorldMetadata', cause: 'quota' })
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.fail(storageError)),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      const result = await Effect.runPromise(
        Effect.either(loadOrCreateWorld(worldId, 'survival', storageService as never, noiseService as never, gameModeService as never)),
      )

      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err._tag).toBe('StartupError')
    })
  })
})

// ---------------------------------------------------------------------------
// buildRespawnPosition
// ---------------------------------------------------------------------------

describe('buildRespawnPosition', () => {
  // Chunk block index formula: idx = y + (z * CHUNK_HEIGHT) + (x * CHUNK_HEIGHT * CHUNK_SIZE)
  // For x=0, z=0: idx = y
  const makeChunkWithSurfaceAt = (surfaceY: number) => {
    const blocks = new Uint8Array(CHUNK_HEIGHT * 16 * 16)
    // Block type 1 (non-zero = solid) at the surface Y
    blocks[surfaceY] = 1
    return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
  }

  it('returns a Y position 4 above the highest solid block (surfaceY + 1 + 3)', async () => {
    const chunk = makeChunkWithSurfaceAt(63)
    const chunkManagerService = {
      getChunk: vi.fn(() => Effect.succeed(chunk)),
    }
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    const result = await Effect.runPromise(
      buildRespawnPosition(baseSpawnPosition, chunkManagerService as never),
    )

    // surfaceY = 63 → result.y = 63 + 1 + 3 = 67
    expect(result.y).toBe(67)
  })

  it('preserves the x and z from baseSpawnPosition', async () => {
    const chunk = makeChunkWithSurfaceAt(64)
    const chunkManagerService = {
      getChunk: vi.fn(() => Effect.succeed(chunk)),
    }
    const baseSpawnPosition = { x: 8, y: 100, z: 16 }

    const result = await Effect.runPromise(
      buildRespawnPosition(baseSpawnPosition, chunkManagerService as never),
    )

    expect(result.x).toBe(8)
    expect(result.z).toBe(16)
  })

  it('uses the highest solid Y when multiple blocks are solid at different heights', async () => {
    const blocks = new Uint8Array(CHUNK_HEIGHT * 16 * 16)
    // Solid blocks at y=10, y=50, and y=80 — should find y=80 as the surface
    blocks[10] = 1
    blocks[50] = 1
    blocks[80] = 1
    const chunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
    const chunkManagerService = {
      getChunk: vi.fn(() => Effect.succeed(chunk)),
    }
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    const result = await Effect.runPromise(
      buildRespawnPosition(baseSpawnPosition, chunkManagerService as never),
    )

    // surfaceY = 80 → result.y = 80 + 1 + 3 = 84
    expect(result.y).toBe(84)
  })

  it('falls back to y=68 (64+1+3) when the chunk has no solid blocks', async () => {
    const blocks = new Uint8Array(CHUNK_HEIGHT * 16 * 16) // all zeros = air
    const chunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
    const chunkManagerService = {
      getChunk: vi.fn(() => Effect.succeed(chunk)),
    }
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    const result = await Effect.runPromise(
      buildRespawnPosition(baseSpawnPosition, chunkManagerService as never),
    )

    // fallback surfaceY = 64 → result.y = 64 + 1 + 3 = 68
    expect(result.y).toBe(68)
  })

  it('requests the spawn chunk at { x: 0, z: 0 }', async () => {
    const blocks = new Uint8Array(CHUNK_HEIGHT * 16 * 16)
    blocks[64] = 1
    const chunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
    const getChunkSpy = vi.fn(() => Effect.succeed(chunk))
    const chunkManagerService = { getChunk: getChunkSpy }
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    await Effect.runPromise(
      buildRespawnPosition(baseSpawnPosition, chunkManagerService as never),
    )

    expect(getChunkSpy).toHaveBeenCalledOnce()
    expect(getChunkSpy).toHaveBeenCalledWith({ x: 0, z: 0 })
  })
})
