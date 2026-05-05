import { Effect, Ref } from 'effect';
import { GameModeSchema, DEFAULT_GAME_MODE } from '@ts-minecraft/kernel';
export { GameModeSchema, DEFAULT_GAME_MODE };
// Canonical source of truth lives on WorldMetadata; sessionProgram pulls from storage
// at session start and seeds this service via set().
// Stateless across sessions: sessionProgram owns write-on-load + write-on-mode-change.
export class GameModeService extends Effect.Service()('@minecraft/application/GameModeService', {
    effect: Ref.make(DEFAULT_GAME_MODE).pipe(Effect.map((modeRef) => ({
        get: () => Ref.get(modeRef),
        set: (mode) => Ref.set(modeRef, mode),
        isCreative: () => Ref.get(modeRef).pipe(Effect.map((mode) => mode === 'creative')),
        isSurvival: () => Ref.get(modeRef).pipe(Effect.map((mode) => mode === 'survival')),
    }))),
}) {
}
export const GameModeServiceLive = GameModeService.Default;
//# sourceMappingURL=game-mode-service.js.map