import { Schema } from 'effect'

export const GameModeSchema = Schema.Literal('survival', 'creative')
export type GameMode = Schema.Schema.Type<typeof GameModeSchema>
export const DEFAULT_GAME_MODE: GameMode = 'survival'
