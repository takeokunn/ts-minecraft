import { Array as Arr, Clock, Duration, Effect, Option, Random } from 'effect'
import { StartupError } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { NoiseService, computeColumnY } from '@ts-minecraft/world'
import { GameModeService, type GameMode } from '@ts-minecraft/game'
import { StorageService, type WorldMetadata } from '@ts-minecraft/world'
import { CHUNK_SIZE, SEA_LEVEL, WorldId } from '@ts-minecraft/core'
import { MAX_SEED_VALUE } from '@ts-minecraft/app/main.config'
import { selectSurfaceSpawn, type SpawnSelection } from '@ts-minecraft/app/main/spawn-selection'

export type SavedPlayerState = NonNullable<WorldMetadata['playerState']>
export type SavedFurnaceStates = NonNullable<WorldMetadata['furnaceStates']>
export type WorldBootstrap = {
  readonly seed: number
  readonly createdAt: Date
  readonly baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number }
  readonly savedPlayerState: Option.Option<SavedPlayerState>
  readonly savedFurnaceStates: Option.Option<SavedFurnaceStates>
  readonly gameMode: GameMode
}

const SPAWN_SEARCH_CHUNK_RADIUS = 2

// New worlds: ~60% of seeds put OCEAN at the world origin (median surface y≈56 < SEA_LEVEL),
// so spawning at (0,0) drops the player into open water. Land is almost always within a few
// chunks, though — search expanding rings of terrain-channel grids outward from origin and
// return the nearest column whose surface is clearly above sea level (dry land).
const SPAWN_LAND_MARGIN = 4
const SPAWN_LAND_SEARCH_CHUNK_RADIUS = 10

const findLandSpawnXZ = (
  noiseService: NoiseService,
): Effect.Effect<{ readonly x: number; readonly z: number }, never> =>
  Effect.gen(function* () {
    let best: { x: number; z: number; distSq: number } | null = null
    for (let ring = 0; ring <= SPAWN_LAND_SEARCH_CHUNK_RADIUS && best === null; ring++) {
      for (let cx = -ring; cx <= ring; cx++) {
        for (let cz = -ring; cz <= ring; cz++) {
          // Only the perimeter of each ring (inner rings were already scanned).
          if (Math.max(Math.abs(cx), Math.abs(cz)) !== ring) continue
          const channels = yield* noiseService.sampleTerrainChannels(cx * CHUNK_SIZE, cz * CHUNK_SIZE)
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
              if (computeColumnY(channels, lx, lz) < SEA_LEVEL + SPAWN_LAND_MARGIN) continue
              const wx = cx * CHUNK_SIZE + lx
              const wz = cz * CHUNK_SIZE + lz
              const distSq = wx * wx + wz * wz
              if (best === null || distSq < best.distSq) best = { x: wx, z: wz, distSq }
            }
          }
        }
      }
    }
    return best === null ? { x: 0, z: 0 } : { x: best.x, z: best.z }
  })

export type { SpawnSelection }

const chunkCoordFromWorld = (coord: number): number => Math.floor(coord / CHUNK_SIZE)

const spawnSearchChunkCoords = (
  baseSpawnPosition: { readonly x: number; readonly z: number },
): ReadonlyArray<{ readonly x: number; readonly z: number }> => {
  const baseChunkX = chunkCoordFromWorld(baseSpawnPosition.x)
  const baseChunkZ = chunkCoordFromWorld(baseSpawnPosition.z)
  const diameter = SPAWN_SEARCH_CHUNK_RADIUS * 2 + 1

  return Arr.flatMap(Arr.makeBy(diameter, (xOffset: number) => baseChunkX - SPAWN_SEARCH_CHUNK_RADIUS + xOffset), (x: number) =>
    Arr.map(Arr.makeBy(diameter, (zOffset: number) => baseChunkZ - SPAWN_SEARCH_CHUNK_RADIUS + zOffset), (z: number) => ({ x, z }))
  )
}

export const loadOrCreateWorld = (
  worldId: WorldId,
  initialGameMode: GameMode,
  storageService: StorageService,
  noiseService: NoiseService,
  gameModeService: GameModeService,
): Effect.Effect<WorldBootstrap, StartupError> =>
  Effect.gen(function* () {
    const existingMetadata = yield* Effect.raceFirst(
      storageService.loadWorldMetadata(worldId),
      Effect.delay(
        Effect.fail(new Error('Timed out while loading world metadata')),
        Duration.seconds(10),
      ),
    ).pipe(
      Effect.mapError((cause) => new StartupError({ reason: 'Failed to load world metadata', cause })),
    )

    const metadata = Option.getOrNull(existingMetadata)
    if (metadata !== null) {
      yield* noiseService.setSeed(metadata.seed)
      yield* gameModeService.set(metadata.gameMode)
      yield* Effect.log(
        `Loaded world '${worldId}' with seed ${metadata.seed} (gameMode=${metadata.gameMode}, saveVersion=${metadata.saveVersion})`,
      )
      return {
        seed: metadata.seed,
        createdAt: metadata.createdAt,
        baseSpawnPosition: metadata.playerSpawn ?? { x: 0, y: 100, z: 0 },
        savedPlayerState: Option.fromNullable(metadata.playerState),
        savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
        gameMode: metadata.gameMode,
      }
    }

    const seed = yield* Random.nextIntBetween(0, MAX_SEED_VALUE)
    const nowMs = yield* Clock.currentTimeMillis
    const now = new Date(nowMs)
    yield* noiseService.setSeed(seed)
    // Pick a dry-land spawn column instead of the fixed origin (often open ocean).
    const land = yield* findLandSpawnXZ(noiseService)
    const pos = { x: land.x, y: 100, z: land.z }
    yield* Effect.raceFirst(
      storageService.saveWorldMetadata(worldId, {
        seed,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: pos,
        gameMode: initialGameMode,
        saveVersion: 1,
      }),
      Effect.delay(
        Effect.fail(new Error('Timed out while saving world metadata')),
        Duration.seconds(10),
      ),
    ).pipe(
      Effect.mapError((cause) => new StartupError({ reason: 'Failed to save fresh world metadata', cause })),
    )
    yield* Effect.log(`Created new world '${worldId}' with seed ${seed} (gameMode=${initialGameMode})`)
    return {
      seed,
      createdAt: now,
      baseSpawnPosition: pos,
      savedPlayerState: Option.none<SavedPlayerState>(),
      savedFurnaceStates: Option.none<SavedFurnaceStates>(),
      gameMode: initialGameMode,
    }
  })

export const buildSpawnSelection = (
  baseSpawnPosition: { x: number; y: number; z: number },
  chunkManagerService: ChunkManagerService,
) => Effect.gen(function* () {
  const chunks = yield* Effect.forEach(
    spawnSearchChunkCoords(baseSpawnPosition),
    (coord) => chunkManagerService.getChunk(coord),
    { concurrency: 4 },
  )
  return selectSurfaceSpawn(chunks, baseSpawnPosition)
})

export const buildRespawnPosition = (
  baseSpawnPosition: { x: number; y: number; z: number },
  chunkManagerService: ChunkManagerService,
) =>
  Effect.gen(function* () {
    const spawn = yield* buildSpawnSelection(baseSpawnPosition, chunkManagerService)
    return spawn.position
  })
