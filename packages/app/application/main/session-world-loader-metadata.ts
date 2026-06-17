import { Option } from 'effect'
import { CURRENT_WORLD_SAVE_VERSION, type WorldMetadata } from '@ts-minecraft/world'
import type { GameMode } from '@ts-minecraft/game'

export type SavedPlayerState = NonNullable<WorldMetadata['playerState']>
export type SavedChestStates = NonNullable<WorldMetadata['chestStates']>
export type SavedFurnaceStates = NonNullable<WorldMetadata['furnaceStates']>
export type SavedWeatherState = NonNullable<WorldMetadata['weatherState']>

export type WorldBootstrap = {
  readonly seed: number
  readonly createdAt: Date
  readonly baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number }
  readonly savedPlayerState: Option.Option<SavedPlayerState>
  readonly savedChestStates: Option.Option<SavedChestStates>
  readonly savedFurnaceStates: Option.Option<SavedFurnaceStates>
  readonly savedWeatherState: Option.Option<SavedWeatherState>
  readonly gameMode: GameMode
}

export type FreshWorldMetadataInput = {
  readonly seed: number
  readonly createdAt: Date
  readonly baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number }
  readonly gameMode: GameMode
}

export type FreshWorldState = {
  readonly metadata: WorldMetadata
  readonly bootstrap: WorldBootstrap
}

const buildWorldBootstrap = (input: {
  readonly seed: number
  readonly createdAt: Date
  readonly baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number }
  readonly savedPlayerState: Option.Option<SavedPlayerState>
  readonly savedChestStates: Option.Option<SavedChestStates>
  readonly savedFurnaceStates: Option.Option<SavedFurnaceStates>
  readonly savedWeatherState: Option.Option<SavedWeatherState>
  readonly gameMode: GameMode
}): WorldBootstrap => ({
  seed: input.seed,
  createdAt: input.createdAt,
  baseSpawnPosition: input.baseSpawnPosition,
  savedPlayerState: input.savedPlayerState,
  savedChestStates: input.savedChestStates,
  savedFurnaceStates: input.savedFurnaceStates,
  savedWeatherState: input.savedWeatherState,
  gameMode: input.gameMode,
})

export const buildLoadedWorldBootstrap = (metadata: WorldMetadata): WorldBootstrap =>
  buildWorldBootstrap({
    seed: metadata.seed,
    createdAt: metadata.createdAt,
    baseSpawnPosition: metadata.playerSpawn ?? { x: 0, y: 100, z: 0 },
    savedPlayerState: Option.fromNullable(metadata.playerState),
    savedChestStates: Option.fromNullable(metadata.chestStates),
    savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
    savedWeatherState: Option.fromNullable(metadata.weatherState),
    gameMode: metadata.gameMode,
  })

export const buildFreshWorldState = (input: FreshWorldMetadataInput): FreshWorldState => {
  const bootstrap = buildWorldBootstrap({
    seed: input.seed,
    createdAt: input.createdAt,
    baseSpawnPosition: input.baseSpawnPosition,
    savedPlayerState: Option.none<SavedPlayerState>(),
    savedChestStates: Option.none<SavedChestStates>(),
    savedFurnaceStates: Option.none<SavedFurnaceStates>(),
    savedWeatherState: Option.none<SavedWeatherState>(),
    gameMode: input.gameMode,
  })

  return {
    metadata: {
      seed: input.seed,
      createdAt: input.createdAt,
      lastPlayed: input.createdAt,
      playerSpawn: input.baseSpawnPosition,
      gameMode: input.gameMode,
      saveVersion: CURRENT_WORLD_SAVE_VERSION,
    },
    bootstrap,
  }
}
