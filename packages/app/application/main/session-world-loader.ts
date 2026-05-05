import { Array as Arr, Clock, Effect, Option, Random } from 'effect'
import { StartupError } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { NoiseService } from '@ts-minecraft/terrain'
import { GameModeService, type GameMode } from '@ts-minecraft/game'
import { StorageService, type WorldMetadata } from '@ts-minecraft/world-state'
import { CHUNK_HEIGHT, blockIndex } from '@ts-minecraft/kernel'
import { WorldId } from '@ts-minecraft/kernel'
import { MAX_SEED_VALUE } from '@ts-minecraft/app/main.config'

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

export const loadOrCreateWorld = (
  worldId: WorldId,
  initialGameMode: GameMode,
  storageService: StorageService,
  noiseService: NoiseService,
  gameModeService: GameModeService,
): Effect.Effect<WorldBootstrap, StartupError> =>
  storageService.loadWorldMetadata(worldId).pipe(
    Effect.mapError((cause) => new StartupError({ reason: 'Failed to load world metadata', cause })),
    Effect.flatMap((existingMetadata) =>
      Option.match(existingMetadata, {
        onSome: (metadata): Effect.Effect<WorldBootstrap, StartupError, never> =>
          noiseService.setSeed(metadata.seed).pipe(
            Effect.andThen(gameModeService.set(metadata.gameMode)),
            Effect.andThen(
              Effect.log(
                `Loaded world '${worldId}' with seed ${metadata.seed} (gameMode=${metadata.gameMode}, saveVersion=${metadata.saveVersion})`,
              ),
            ),
            Effect.as({
              seed: metadata.seed,
              createdAt: metadata.createdAt,
              baseSpawnPosition: Option.getOrElse(Option.fromNullable(metadata.playerSpawn), () => ({ x: 0, y: 100, z: 0 })),
              savedPlayerState: Option.fromNullable(metadata.playerState),
              savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
              gameMode: metadata.gameMode,
            }),
          ),
        onNone: (): Effect.Effect<WorldBootstrap, StartupError, never> =>
          Effect.all(
            [Random.nextIntBetween(0, MAX_SEED_VALUE), Clock.currentTimeMillis],
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.flatMap(([seed, nowMs]) => {
              const pos = { x: 0, y: 100, z: 0 }
              const now = new Date(nowMs)
              return noiseService.setSeed(seed).pipe(
                Effect.andThen(
                  storageService.saveWorldMetadata(worldId, {
                    seed,
                    createdAt: now,
                    lastPlayed: now,
                    playerSpawn: pos,
                    gameMode: initialGameMode,
                    saveVersion: 1,
                  }),
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
          ),
      }),
    ),
  )

export const buildRespawnPosition = (
  baseSpawnPosition: { x: number; y: number; z: number },
  chunkManagerService: ChunkManagerService,
) => Effect.gen(function* () {
  const spawnChunk = yield* chunkManagerService.getChunk({ x: 0, z: 0 })
  const spawnBlocks: Readonly<Uint8Array> = spawnChunk.blocks
  const surfaceY = Option.getOrElse(
    Arr.findFirst(
      Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i),
      (y) =>
        Option.match(blockIndex(0, y, 0), {
          onNone: () => false,
          onSome: (idx) => spawnBlocks[idx] !== 0,
        }),
    ),
    () => 64,
  )
  return { ...baseSpawnPosition, y: surfaceY + 1 + 3 }
})
