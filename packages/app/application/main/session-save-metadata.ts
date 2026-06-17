import { CURRENT_WORLD_SAVE_VERSION, type WorldMetadata } from '@ts-minecraft/world'

import type { WorldBootstrap } from './session-world-loader-metadata'

export type SessionSaveMetadataInput = {
  readonly worldBootstrap: Pick<WorldBootstrap, 'seed' | 'createdAt' | 'baseSpawnPosition'>
  readonly lastPlayed: Date
  readonly playerState: NonNullable<WorldMetadata['playerState']>
  readonly chestStates: NonNullable<WorldMetadata['chestStates']>
  readonly furnaceStates: NonNullable<WorldMetadata['furnaceStates']>
  readonly weatherState: NonNullable<WorldMetadata['weatherState']>
  readonly gameMode: WorldMetadata['gameMode']
}

export const buildSessionSaveMetadata = (input: SessionSaveMetadataInput): WorldMetadata => {
  const { worldBootstrap, lastPlayed, playerState, chestStates, furnaceStates, weatherState, gameMode } = input

  return {
    seed: worldBootstrap.seed,
    createdAt: worldBootstrap.createdAt,
    lastPlayed,
    playerSpawn: worldBootstrap.baseSpawnPosition,
    playerState,
    chestStates,
    furnaceStates,
    weatherState,
    gameMode,
    saveVersion: CURRENT_WORLD_SAVE_VERSION,
  }
}
