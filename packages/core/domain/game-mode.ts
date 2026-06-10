import { Schema } from 'effect'

// 'spectator' (FR R2): noclip free-fly observer — no collision, no damage, no
// world interaction. Reachable via the main-menu game-mode toggle.
export const GameModeSchema = Schema.Literal('survival', 'creative', 'spectator')
export type GameMode = Schema.Schema.Type<typeof GameModeSchema>
export const DEFAULT_GAME_MODE: GameMode = 'survival'
