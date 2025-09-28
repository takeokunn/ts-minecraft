import { PlayerStats, PlayerAbilities } from './types'

// デフォルト値定義
export const DEFAULT_PLAYER_STATS: PlayerStats = {
  health: 20,
  maxHealth: 20,
  hunger: 20,
  saturation: 20,
  experience: 0,
  level: 0,
  armor: 0,
}

export const DEFAULT_PLAYER_ABILITIES: PlayerAbilities = {
  canFly: false,
  isFlying: false,
  canBreakBlocks: true,
  canPlaceBlocks: true,
  invulnerable: false,
  walkSpeed: 4.317, // Minecraft default walk speed (blocks/second)
  flySpeed: 10.92, // Minecraft default fly speed
}
