// Player experience (XP) system — Minecraft Java Edition vanilla formula.
// XP is accumulated as raw points; level is computed from the running total.
//
// Computation functions (xpToNextLevel, levelFromXP, xpAtLevelStart,
// buildPlayerXP, addXPToPlayer) live in player-xp-calc.ts.
import { buildPlayerXP } from './player-xp-calc'

export type PlayerXP = {
  readonly totalXP: number
  readonly level: number
  readonly xpIntoLevel: number       // XP accumulated since last level-up
  readonly xpRequiredForNext: number // XP needed to reach the next level
}

// Re-export calc functions so callers can import from a single location.
export {
  xpToNextLevel,
  levelFromXP,
  xpAtLevelStart,
  buildPlayerXP,
  addXPToPlayer,
} from './player-xp-calc'

export const INITIAL_PLAYER_XP: PlayerXP = buildPlayerXP(0)
