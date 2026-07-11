import { Option } from 'effect'
import { CURRENT_WORLD_SAVE_VERSION, type WorldMetadata } from '@ts-minecraft/world'
import type { GameMode } from '@ts-minecraft/game'

export type SavedPlayerState = NonNullable<WorldMetadata['playerState']>
export type SavedChestStates = NonNullable<WorldMetadata['chestStates']>
export type SavedFurnaceStates = NonNullable<WorldMetadata['furnaceStates']>
export type SavedWeatherState = NonNullable<WorldMetadata['weatherState']>
export type SavedEntityStates = NonNullable<WorldMetadata['entityStates']>
export type SavedStatistics = NonNullable<WorldMetadata['statistics']>
export type SavedUnlockedAchievements = NonNullable<WorldMetadata['unlockedAchievements']>
export type SavedActiveDimension = NonNullable<WorldMetadata['activeDimension']>
export type SavedPortals = NonNullable<WorldMetadata['portals']>
export type SavedParkedVehicles = NonNullable<WorldMetadata['parkedVehicles']>

export type WorldBootstrap = {
  readonly seed: number
  readonly createdAt: Date
  readonly baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number }
  readonly savedPlayerState: Option.Option<SavedPlayerState>
  readonly savedChestStates: Option.Option<SavedChestStates>
  readonly savedFurnaceStates: Option.Option<SavedFurnaceStates>
  readonly savedWeatherState: Option.Option<SavedWeatherState>
  readonly savedEntityStates: Option.Option<SavedEntityStates>
  readonly savedStatistics: Option.Option<SavedStatistics>
  readonly savedUnlockedAchievements: Option.Option<SavedUnlockedAchievements>
  readonly savedActiveDimension: Option.Option<SavedActiveDimension>
  readonly savedPortals: Option.Option<SavedPortals>
  readonly savedParkedVehicles: Option.Option<SavedParkedVehicles>
  readonly gameMode: GameMode
}

export type FreshWorldMetadataInput = {
  readonly displayName: string
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
  readonly savedEntityStates: Option.Option<SavedEntityStates>
  readonly savedStatistics: Option.Option<SavedStatistics>
  readonly savedUnlockedAchievements: Option.Option<SavedUnlockedAchievements>
  readonly savedActiveDimension: Option.Option<SavedActiveDimension>
  readonly savedPortals: Option.Option<SavedPortals>
  readonly savedParkedVehicles: Option.Option<SavedParkedVehicles>
  readonly gameMode: GameMode
}): WorldBootstrap => ({
  seed: input.seed,
  createdAt: input.createdAt,
  baseSpawnPosition: input.baseSpawnPosition,
  savedPlayerState: input.savedPlayerState,
  savedChestStates: input.savedChestStates,
  savedFurnaceStates: input.savedFurnaceStates,
  savedWeatherState: input.savedWeatherState,
  savedEntityStates: input.savedEntityStates,
  savedStatistics: input.savedStatistics,
  savedUnlockedAchievements: input.savedUnlockedAchievements,
  savedActiveDimension: input.savedActiveDimension,
  savedPortals: input.savedPortals,
  savedParkedVehicles: input.savedParkedVehicles,
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
    savedEntityStates: Option.fromNullable(metadata.entityStates),
    savedStatistics: Option.fromNullable(metadata.statistics),
    savedUnlockedAchievements: Option.fromNullable(metadata.unlockedAchievements),
    savedActiveDimension: Option.fromNullable(metadata.activeDimension),
    savedPortals: Option.fromNullable(metadata.portals),
    savedParkedVehicles: Option.fromNullable(metadata.parkedVehicles),
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
    savedEntityStates: Option.none<SavedEntityStates>(),
    savedStatistics: Option.none<SavedStatistics>(),
    savedUnlockedAchievements: Option.none<SavedUnlockedAchievements>(),
    savedActiveDimension: Option.none<SavedActiveDimension>(),
    savedPortals: Option.none<SavedPortals>(),
    savedParkedVehicles: Option.none<SavedParkedVehicles>(),
    gameMode: input.gameMode,
  })

  return {
    metadata: {
      displayName: input.displayName,
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
