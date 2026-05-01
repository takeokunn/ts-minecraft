import { Deferred, Effect, MutableRef } from 'effect'

/**
 * Session control primitives shared between bootProgram and sessionProgram.
 *
 * These live OUTSIDE the Effect Layer graph because:
 *   - `isPausedRef` must be read synchronously from frame stages (no `yield*`).
 *   - `quitToTitleSignal` is a one-shot rendezvous: when fulfilled, the session
 *     fiber unwinds back to bootProgram which then re-enters mainMenuLoop.
 *
 * Lifecycle:
 *   - `createSessionControl()` runs once per session (re-created each time the
 *     player enters a new world from the menu).
 *   - `requestQuitToTitle(...)` is invoked from the pause-menu "Save & Quit"
 *     button. It triggers a save flush (delegated to caller) and signals the
 *     deferred so the awaiting session fiber returns.
 *   - `awaitQuitToTitle` is consumed by sessionProgram via `Effect.race` against
 *     `Effect.never`, so the session lives until either:
 *       (a) the user requests quit (deferred completes), or
 *       (b) the session scope is interrupted externally (e.g. tab close).
 */
export type SessionControl = {
  /** Synchronous pause flag — read from frame stages without yielding. */
  readonly isPausedRef: MutableRef.MutableRef<boolean>
  /** One-shot signal: fulfilled once when the user requests quit-to-title. */
  readonly quitToTitleSignal: Deferred.Deferred<void, never>
}

/**
 * Allocate a fresh SessionControl for a new world session.
 * Each entry into sessionProgram gets its own pair so quit-state from a
 * previous session doesn't leak into the next.
 */
export const createSessionControl: Effect.Effect<SessionControl, never> = Effect.gen(function* () {
  const isPausedRef = MutableRef.make(false)
  const quitToTitleSignal = yield* Deferred.make<void, never>()
  return { isPausedRef, quitToTitleSignal }
})

/**
 * Signal that the player has requested quit-to-title.
 *
 * This is a pure signal — caller is responsible for triggering save-flush
 * (e.g. `chunkManager.saveDirtyChunks()` + `persistSessionState()`) BEFORE
 * calling this so the session fiber unwinds with persisted state on disk.
 *
 * Idempotent: calling twice is a no-op (Deferred only fulfills once).
 */
export const requestQuitToTitle = (control: SessionControl): Effect.Effect<void, never> =>
  Deferred.succeed(control.quitToTitleSignal, undefined).pipe(Effect.asVoid)

/**
 * Synchronous pause helpers — mirror the existing gamePausedRef API used by
 * frame stages. These exist so other layers (overlays, menus) can pause the
 * game without holding a reference to the original Ref.
 */
export const setPaused = (control: SessionControl, paused: boolean): void => {
  MutableRef.set(control.isPausedRef, paused)
}

export const isPaused = (control: SessionControl): boolean =>
  MutableRef.get(control.isPausedRef)
