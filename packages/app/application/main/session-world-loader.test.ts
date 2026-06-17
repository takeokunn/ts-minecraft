import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Either, Option } from 'effect'
import {
  buildRespawnPosition,
  loadOrCreateWorld,
} from './session-world-loader'
import { type SavedFurnaceStates, type SavedPlayerState, type SavedWeatherState } from './session-world-loader-metadata'
import { GameModeService, type GameMode } from '../../../game'
import { WorldId, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { NoiseService } from '@ts-minecraft/world/application/noise-service'
import { StorageError } from '@ts-minecraft/world/domain/errors'
import { CHUNK_COLUMN_SAMPLE_COUNT, CURRENT_WORLD_SAVE_VERSION } from '@ts-minecraft/world'
import {
  StorageService,
  type WorldMetadata,
} from '@ts-minecraft/world/infrastructure/storage-service'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeStorageService = (overrides: Partial<StorageService> = {}): StorageService =>
  StorageService.of({
    _tag: '@minecraft/infrastructure/storage/StorageService' as const,
    initialize: Effect.void,
    saveChunk: (_worldId, _chunkCoord, _data) => Effect.void,
    loadChunk: (_worldId, _chunkCoord) => Effect.succeed(Option.none()),
    saveWorldMetadata: (_worldId, _metadata) => Effect.void,
    loadWorldMetadata: (_worldId) => Effect.succeed(Option.none()),
    deleteWorld: (_worldId) => Effect.void,
    listWorldMetadata: Effect.succeed({ valid: [], corrupt: [] }),
    ...overrides,
  })

const makeNoiseService = (overrides: Partial<NoiseService> = {}): NoiseService =>
  NoiseService.of({
    _tag: '@minecraft/infrastructure/noise/NoiseService' as const,
    noise2D: (_x, _z) => Effect.succeed(0),
    octaveNoise2D: (_x, _z, _octaves, _persistence, _lacunarity) => Effect.succeed(0),
    getSeed: Effect.succeed(0),
    setSeed: (_seed) => Effect.void,
    noise3D: (_x, _y, _z) => Effect.succeed(0),
    noise3DBatchXYZ: (_xs, _ys, _zs) => Effect.succeed([]),
    octaveNoise2DBatch: (_points, _octaves, _persistence, _lacunarity) => Effect.succeed([]),
    noise2DBatch: (_points) => Effect.succeed([]),
    octaveNoise2DBatchXY: (_xs, _zs, _octaves, _persistence, _lacunarity) => Effect.succeed([]),
    noise2DBatchXY: (_xs, _zs) => Effect.succeed([]),
    continentalness: (_x, _z) => Effect.succeed(0),
    erosion: (_x, _z) => Effect.succeed(0),
    weirdness: (_x, _z) => Effect.succeed(0),
    jaggedness: (_x, _z) => Effect.succeed(0),
    sampleTerrainChannels: (_xStart, _zStart) =>
      Effect.succeed({
        continentalness: new Float64Array(),
        erosion: new Float64Array(),
        pv: new Float64Array(),
        jaggedness: new Float64Array(),
      }),
    ...overrides,
  })

type TerrainChannelTestSamples = Readonly<{
  readonly continentalness: Float64Array
  readonly erosion: Float64Array
  readonly pv: Float64Array
  readonly jaggedness: Float64Array
}>

const makeTerrainChannelSamples = (
  defaults: Partial<{
    readonly continentalness: number
    readonly erosion: number
    readonly pv: number
    readonly jaggedness: number
  }> = {},
): TerrainChannelTestSamples => {
  const makeChannel = (value: number | undefined): Float64Array => {
    const channel = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    if (value !== undefined) {
      channel.fill(value)
    }
    return channel
  }

  return {
    continentalness: makeChannel(defaults.continentalness),
    erosion: makeChannel(defaults.erosion),
    pv: makeChannel(defaults.pv),
    jaggedness: makeChannel(defaults.jaggedness),
  }
}

const makeGameModeService = (overrides: Partial<GameModeService> = {}): GameModeService =>
  GameModeService.of({
    _tag: '@minecraft/application/GameModeService' as const,
    get: () => Effect.succeed('survival'),
    set: (_mode) => Effect.void,
    isCreative: () => Effect.succeed(false),
    isSurvival: () => Effect.succeed(true),
    isSpectator: () => Effect.succeed(false),
    ...overrides,
  })

const makeChunkWithSurfaceAt = (
  surfaceY: number,
  options: {
    readonly coord?: { readonly x: number; readonly z: number }
    readonly lx?: number
    readonly lz?: number
    readonly blockId?: number
  } = {},
) => {
  const blocks = new Uint8Array(CHUNK_HEIGHT * 16 * 16)
  const lx = options.lx ?? 0
  const lz = options.lz ?? 0
  blocks[surfaceY + (lz * CHUNK_HEIGHT) + (lx * CHUNK_HEIGHT * 16)] = options.blockId ?? 1
  return { coord: options.coord ?? { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

const WATER_BLOCK_ID = 6

const makeChunkManagerService = (overrides: Partial<ChunkManagerService> = {}): ChunkManagerService =>
  ChunkManagerService.of({
    _tag: '@minecraft/application/ChunkManagerService' as const,
    setActiveWorldId: (_worldId) => Effect.void,
    setActiveDimension: (_dimension) => Effect.void,
    getChunk: (_coord): Effect.Effect<ReturnType<typeof makeChunkWithSurfaceAt>, never> =>
      Effect.succeed(makeChunkWithSurfaceAt(64)),
    loadChunksAroundPlayer: (_playerPos, _renderDistance) => Effect.succeed(false),
    getLoadedChunks: () => Effect.succeed([]),
    drainRenderDirtyChunks: () => Effect.succeed([]),
    drainRenderDirtyChunkEntries: () => Effect.succeed([]),
    markChunkDirty: (_coord) => Effect.void,
    saveDirtyChunks: () => Effect.void,
    unloadChunk: (_coord) => Effect.void,
    ...overrides,
  })

const makeMetadata = (overrides: Partial<WorldMetadata> = {}): WorldMetadata => ({
  seed: 42,
  createdAt: new Date('2024-01-01'),
  lastPlayed: new Date('2024-06-01'),
  playerSpawn: { x: 5, y: 64, z: 5 },
  gameMode: 'survival' as const,
  saveVersion: CURRENT_WORLD_SAVE_VERSION,
  ...overrides,
})

const runLoad = (
  worldId: WorldId,
  initialGameMode: GameMode,
  storageService: StorageService,
  noiseService: NoiseService,
  gameModeService: GameModeService,
) => Effect.runPromise(Effect.either(loadOrCreateWorld(worldId, initialGameMode, storageService, noiseService, gameModeService)))

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

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

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

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.baseSpawnPosition).toEqual({ x: 10, y: 72, z: 20 })
    })

    it('seeds the noise service with the stored seed', async () => {
      const metadata = makeMetadata({ seed: 9999 })
      const setSeed = vi.fn().mockImplementation((_seed: number) => Effect.void)
      const noiseService = makeNoiseService({ setSeed })
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      expect(setSeed).toHaveBeenCalledWith(9999)
    })

    it('sets game mode service to the stored game mode', async () => {
      const metadata = makeMetadata({ gameMode: 'creative' })
      const setGameMode = vi.fn((_: GameMode) => Effect.void)
      const gameModeService = makeGameModeService({ set: setGameMode })
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const worldId = WorldId.make('world-1')

      await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      expect(setGameMode).toHaveBeenCalledWith('creative')
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

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isNone(bootstrap.savedPlayerState)).toBe(true)
    })

    it('returns savedPlayerState as some when metadata has a playerState', async () => {
      const playerState: SavedPlayerState = {
        position: { x: 1, y: 64, z: 2 },
        health: 15,
        inventory: { slots: [] },
        timeOfDay: 0.3,
        hunger: { foodLevel: 20, saturation: 5 },
        totalXP: 0,
        equipment: {},
      }
      const metadata = { ...makeMetadata(), playerState }
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isSome(bootstrap.savedPlayerState)).toBe(true)
      expect(Option.getOrThrow(bootstrap.savedPlayerState).health).toBe(15)
    })

    it('returns savedFurnaceStates as some when metadata has a furnaceStates value', async () => {
      const furnaceStates: SavedFurnaceStates = [
        { position: { x: 2, y: 64, z: 3 }, input: Option.none(), fuel: Option.none(), output: Option.none(), activeRecipeId: Option.none(), progressSecs: 0 },
      ]
      const metadata = { ...makeMetadata(), furnaceStates }
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isSome(bootstrap.savedFurnaceStates)).toBe(true)
      expect(Option.getOrThrow(bootstrap.savedFurnaceStates)).toEqual(furnaceStates)
    })

    it('returns savedWeatherState as some when metadata has a weatherState value', async () => {
      const weatherState: SavedWeatherState = { weather: 'thunder', remainingSecs: 12 }
      const metadata = { ...makeMetadata(), weatherState }
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.some(metadata))),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-1')

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isSome(bootstrap.savedWeatherState)).toBe(true)
      expect(Option.getOrThrow(bootstrap.savedWeatherState)).toEqual(weatherState)
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

      await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

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

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(Option.isNone(bootstrap.savedPlayerState)).toBe(true)
      expect(Option.isNone(bootstrap.savedFurnaceStates)).toBe(true)
      expect(Option.isNone(bootstrap.savedWeatherState)).toBe(true)
    })

    it('uses the initialGameMode for the new world', async () => {
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      const noiseService = makeNoiseService()
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      const result = await runLoad(worldId, 'creative', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.gameMode).toBe('creative')
    })

    it('prefers inland land over a nearer shoreline column for a new world', async () => {
      const terrainByChunk = new Map<string, ReturnType<typeof makeTerrainChannelSamples>>([
        ['0:0', makeTerrainChannelSamples({ continentalness: 0.11, erosion: 0.9, pv: 1, jaggedness: 1 })],
        [`${CHUNK_SIZE}:0`, makeTerrainChannelSamples({ continentalness: 0.35, erosion: 0.8, pv: 0.8, jaggedness: 0.4 })],
      ])
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      const noiseService = makeNoiseService({
        sampleTerrainChannels: (xStart: number, zStart: number) =>
          Effect.succeed(terrainByChunk.get(`${xStart}:${zStart}`) ?? makeTerrainChannelSamples()),
      })
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      const bootstrap = Option.getOrThrow(Either.getRight(result))
      expect(bootstrap.baseSpawnPosition).toEqual({ x: CHUNK_SIZE, y: 100, z: 0 })
    })

    it('calls noiseService.setSeed with the newly generated seed', async () => {
      const storageService = makeStorageService({
        loadWorldMetadata: vi.fn(() => Effect.succeed(Option.none())),
        saveWorldMetadata: vi.fn(() => Effect.void),
      })
      let calledSeed: number | undefined
      const setSeed = vi.fn().mockImplementation((seed: number) => {
        calledSeed = seed
        return Effect.void
      })
      const noiseService = makeNoiseService({ setSeed })
      const gameModeService = makeGameModeService()
      const worldId = WorldId.make('world-new')

      await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

      expect(setSeed).toHaveBeenCalledOnce()
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

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

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

      const result = await runLoad(worldId, 'survival', storageService, noiseService, gameModeService)

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
  const chunkKey = (coord: { readonly x: number; readonly z: number }) => `${coord.x}:${coord.z}`
  const makeEmptyChunk = (coord: { readonly x: number; readonly z: number }) => ({
    coord,
    blocks: new Uint8Array(CHUNK_HEIGHT * 16 * 16),
    fluid: Option.none(),
  })
  const makeChunkLookupService = (chunks: ReadonlyArray<ReturnType<typeof makeChunkWithSurfaceAt>>) => {
    const chunksByKey = new Map(chunks.map((chunk) => [chunkKey(chunk.coord), chunk]))
    return makeChunkManagerService({
      getChunk: (coord): Effect.Effect<ReturnType<typeof makeChunkWithSurfaceAt>, never> =>
        Effect.succeed(chunksByKey.get(chunkKey(coord)) ?? makeEmptyChunk(coord)),
    })
  }

  it('returns a Y position above the highest safe block (surface + 1 + PLAYER_HALF_HEIGHT)', async () => {
    const chunk = makeChunkWithSurfaceAt(63)
    const chunkManagerService = makeChunkLookupService([chunk])
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    const result = await Effect.runPromise(buildRespawnPosition(baseSpawnPosition, chunkManagerService))

    expect(result).toEqual({ x: 0.5, y: 64.9, z: 0.5 })
  })

  it('uses the nearest safe column across nearby spawn chunks', async () => {
    const chunk = makeChunkWithSurfaceAt(64, { coord: { x: 0, z: 1 }, lx: 8, lz: 0 })
    const chunkManagerService = makeChunkLookupService([chunk])
    const baseSpawnPosition = { x: 8, y: 100, z: 16 }

    const result = await Effect.runPromise(buildRespawnPosition(baseSpawnPosition, chunkManagerService))

    expect(result).toEqual({ x: 8.5, y: 65.9, z: 16.5 })
  })

  it('uses the highest safe Y when multiple blocks are solid at different heights', async () => {
    const blocks = new Uint8Array(CHUNK_HEIGHT * 16 * 16)
    blocks[10] = 1
    blocks[50] = 1
    blocks[80] = 1
    const chunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
    const chunkManagerService = makeChunkLookupService([chunk])
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    const result = await Effect.runPromise(buildRespawnPosition(baseSpawnPosition, chunkManagerService))

    expect(result).toEqual({ x: 0.5, y: 81.9, z: 0.5 })
  })

  it('ignores water surfaces and picks nearby land instead', async () => {
    const waterChunk = makeChunkWithSurfaceAt(64, { blockId: WATER_BLOCK_ID })
    const landChunk = makeChunkWithSurfaceAt(65, { coord: { x: 1, z: 0 } })
    const chunkManagerService = makeChunkLookupService([waterChunk, landChunk])
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    const result = await Effect.runPromise(buildRespawnPosition(baseSpawnPosition, chunkManagerService))

    expect(result).toEqual({ x: 16.5, y: 66.9, z: 0.5 })
  })

  it('falls back to y=65.9 (64+1+PLAYER_HALF_HEIGHT) when no nearby chunk has a safe surface', async () => {
    const chunkManagerService = makeChunkLookupService([])
    const baseSpawnPosition = { x: 7, y: 100, z: -9 }

    const result = await Effect.runPromise(buildRespawnPosition(baseSpawnPosition, chunkManagerService))

    expect(result).toEqual({ x: 7, y: 67.9, z: -9 })
  })

  it('requests a bounded square of chunks around the base spawn chunk', async () => {
    const chunk = makeChunkWithSurfaceAt(64)
    const getChunkSpy = vi.fn((coord: { x: number; z: number }) => Effect.succeed(
      coord.x === 0 && coord.z === 0 ? chunk : makeEmptyChunk(coord),
    ))
    const chunkManagerService = makeChunkManagerService({
      getChunk: (coord): Effect.Effect<ReturnType<typeof makeChunkWithSurfaceAt>, never> => getChunkSpy(coord),
    })
    const baseSpawnPosition = { x: 0, y: 100, z: 0 }

    await Effect.runPromise(buildRespawnPosition(baseSpawnPosition, chunkManagerService))

    expect(getChunkSpy).toHaveBeenCalledTimes(25)
    expect(getChunkSpy).toHaveBeenCalledWith({ x: -2, z: -2 })
    expect(getChunkSpy).toHaveBeenCalledWith({ x: 0, z: 0 })
    expect(getChunkSpy).toHaveBeenCalledWith({ x: 2, z: 2 })
  })
})
