import { Schema } from 'effect';
export declare const GameModeSchema: Schema.Literal<["survival", "creative"]>;
export type GameMode = Schema.Schema.Type<typeof GameModeSchema>;
export declare const DEFAULT_GAME_MODE: GameMode;
//# sourceMappingURL=game-mode.d.ts.map