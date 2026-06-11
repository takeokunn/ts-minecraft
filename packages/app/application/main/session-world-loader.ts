import { Array as Arr, Clock, Duration, Effect, Option, Random } from 'effect'
import { StartupError } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { NoiseService } from '@ts-minecraft/world'
import { GameModeService, type GameMode } from '@ts-minecraft/game'
import { StorageService, type WorldMetadata } from '@ts-minecraft/world'
import { CHUNK_SIZE, WorldId } from '@ts-minecraft/core'
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
  Effect.raceFirst(
    storageService.loadWorldMetadata(worldId),
    Effect.sleep(Duration.seconds(10)).pipe(
      Effect.flatMap(() => Effect.fail(new Error('Timed out while loading world metadata'))),
    ),
  ).pipe(
    Effect.mapError((cause) => new StartupError({ reason: 'Failed to load world metadata', cause })),
    Effect.flatMap((existingMetadata): Effect.Effect<WorldBootstrap, StartupError, never> => {
      const metadata = Option.getOrNull(existingMetadata)
      if (metadata !== null) {
        return noiseService.setSeed(metadata.seed).pipe(
          Effect.andThen(gameModeService.set(metadata.gameMode)),
          Effect.andThen(
            Effect.log(
              `Loaded world '${worldId}' with seed ${metadata.seed} (gameMode=${metadata.gameMode}, saveVersion=${metadata.saveVersion})`,
            ),
          ),
          Effect.as({
            seed: metadata.seed,
            createdAt: metadata.createdAt,
            baseSpawnPosition: metadata.playerSpawn ?? { x: 0, y: 100, z: 0 },
            savedPlayerState: Option.fromNullable(metadata.playerState),
            savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
            gameMode: metadata.gameMode,
          }),
        )
      }
      return (
          Effect.all(
            [Random.nextIntBetween(0, MAX_SEED_VALUE), Clock.currentTimeMillis],
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.flatMap(([seed, nowMs]) => {
              const pos = { x: 0, y: 100, z: 0 }
              const now = new Date(nowMs)
              return noiseService.setSeed(seed).pipe(
                Effect.andThen(
                  Effect.raceFirst(
                    storageService.saveWorldMetadata(worldId, {
                      seed,
                      createdAt: now,
                      lastPlayed: now,
                      playerSpawn: pos,
                      gameMode: initialGameMode,
                      saveVersion: 1,
                    }),
                    Effect.sleep(Duration.seconds(10)).pipe(
                      Effect.flatMap(() => Effect.fail(new Error('Timed out while saving world metadata'))),
                    ),
                  ),
                ),
                Effect.andThen(
                  Effect.log(`Created new world '${worldId}' with seed ${seed} (gameMode=${initialGameMode})`),
                ),
                Effect.as({
                  seed,
                  createdAt: now,
                  baseSpawnPosition: pos,
                  savedPlayerState: Option.none(),
                  savedFurnaceStates: Option.none(),
                  gameMode: initialGameMode,
                }),
                Effect.mapError((cause) => new StartupError({ reason: 'Failed to save fresh world metadata', cause })),
              )
            }),
          )
      )
    }),
  )

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
) => Effect.map(buildSpawnSelection(baseSpawnPosition, chunkManagerService), (spawn) => spawn.position)
