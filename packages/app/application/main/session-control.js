import { Deferred, Effect, MutableRef } from 'effect';
// Each entry into sessionProgram gets its own pair so quit-state from a previous session doesn't leak.
export const createSessionControl = Effect.gen(function* () {
    const isPausedRef = MutableRef.make(false);
    const quitToTitleSignal = yield* Deferred.make();
    return { isPausedRef, quitToTitleSignal };
});
// Caller must flush saves BEFORE calling so the session fiber unwinds with persisted state on disk.
// Idempotent: Deferred only fulfills once.
export const requestQuitToTitle = (control) => Deferred.succeed(control.quitToTitleSignal, undefined).pipe(Effect.asVoid);
// Synchronous helpers — allow overlays/menus to pause without holding a reference to the original Ref.
export const setPaused = (control, paused) => {
    MutableRef.set(control.isPausedRef, paused);
};
export const isPaused = (control) => MutableRef.get(control.isPausedRef);
//# sourceMappingURL=../../../../dist/packages/app/application/main/session-control.js.map