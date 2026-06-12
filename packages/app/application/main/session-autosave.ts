import { Cause, Effect } from 'effect'

// One autosave tick: persist dirty chunks and session state together, swallowing
// (and logging) ANY failure so the surrounding `Effect.repeat` daemon survives a
// transient save error (e.g. a momentary IndexedDB quota/transaction failure) and
// keeps autosaving for the rest of the session.
//
// CRITICAL: the catchAllCause MUST stay INSIDE this tick, not outside the repeat.
// `Effect.repeat(effect, schedule)` re-runs `effect` only while it succeeds — if a
// failure escaped the repeated effect, the repetition would stop and autosave would
// silently die after the first transient error, losing every later edit on a crash.
// Catching here makes each tick total (`Effect<void, never>`), so repeat never stops.
//
// Both saves run concurrently (awaiting each drops their results). `catchAllCause`
// (not `catchAll`) is deliberate: it catches EVERYTHING — typed failures, AND defects
// (a thrown exception inside a save surfaces as `Cause.Die`, which `catchAll` would
// miss and let escape, killing the daemon). Whatever cause results — a single failure,
// a parallel cause when both fail, or a defect — is logged on one line and recovered,
// keeping the tick total. (`Effect.all` is fail-fast, so it does not wait to combine
// both errors; the caught cause reflects the first failure plus any interruption.)
export const performAutoSaveTick = <E1, E2>(
  saveDirtyChunks: Effect.Effect<void, E1>,
  persistSessionState: Effect.Effect<void, E2>,
): Effect.Effect<void, never> =>
  saveDirtyChunks.pipe(
    Effect.flatMap(() => persistSessionState),
    Effect.catchAllCause((cause) => Effect.logError(`Auto-save error: ${Cause.pretty(cause)}`)),
  )
