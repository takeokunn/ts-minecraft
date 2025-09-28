import { GameMode, PlayerAbilities } from './types'
import { DEFAULT_PLAYER_ABILITIES } from './constants'

export const getAbilitiesForGameMode = (gameMode: GameMode): PlayerAbilities => {
  switch (gameMode) {
    case 'creative':
      return {
        ...DEFAULT_PLAYER_ABILITIES,
        canFly: true,
        invulnerable: true,
      }
    case 'spectator':
      return {
        ...DEFAULT_PLAYER_ABILITIES,
        canFly: true,
        isFlying: true,
        canBreakBlocks: false,
        canPlaceBlocks: false,
        invulnerable: true,
      }
    case 'adventure':
      return {
        ...DEFAULT_PLAYER_ABILITIES,
        canBreakBlocks: false,
      }
    case 'survival':
    default:
      return DEFAULT_PLAYER_ABILITIES
  }
}
