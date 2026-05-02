import { Deferred, Effect, MutableRef } from 'effect'

// Session control primitives shared between bootProgram and sessionProgram.
// Lives OUTSIDE the Effect Layer graph because isPausedRef must be read synchronously from frame stages.
// quitToTitleSignal is a one-shot rendezvous: when fulfilled, the session fiber unwinds to bootProgram.
export type SessionControl = {
  // Synchronous pause flag — read from frame stages without yielding.
  readonly isPausedRef: MutableRef.MutableRef<boolean>
  // One-shot signal: fulfilled once when the user requests quit-to-title.
  readonly quitToTitleSignal: Deferred.Deferred<void, never>
}

// Each entry into sessionProgram gets its own pair so quit-state from a previous session doesn't leak.
export const createSessionControl: Effect.Effect<SessionControl, never> = Effect.gen(function* () {
  const isPausedRef = MutableRef.make(false)
  const quitToTitleSignal = yield* Deferred.make<void, never>()
  return { isPausedRef, quitToTitleSignal }
})

// Caller must flush saves BEFORE calling so the session fiber unwinds with persisted state on disk.
// Idempotent: Deferred only fulfills once.
export const requestQuitToTitle = (control: SessionControl): Effect.Effect<void, never> =>
  Deferred.succeed(control.quitToTitleSignal, undefined).pipe(Effect.asVoid)

// Synchronous helpers — allow overlays/menus to pause without holding a reference to the original Ref.
export const setPaused = (control: SessionControl, paused: boolean): void => {
  MutableRef.set(control.isPausedRef, paused)
}

export const isPaused = (control: SessionControl): boolean =>
  MutableRef.get(control.isPausedRef)
