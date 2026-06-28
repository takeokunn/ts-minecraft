import { Cause, Duration, Effect, Fiber, Schedule } from 'effect'

export type AutoSaveStatus = 'saving' | 'saved' | 'error'

export type AutoSaveStatusReporter = (status: AutoSaveStatus) => Effect.Effect<void, never>

const reportAutoSaveStatus = (
  statusReporter: AutoSaveStatusReporter | undefined,
  status: AutoSaveStatus,
): Effect.Effect<void, never> =>
  statusReporter === undefined
    ? Effect.void
    : statusReporter(status).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError(`Auto-save status error: ${Cause.pretty(cause)}`),
        ),
      )

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
// `catchAllCause` (not `catchAll`) is deliberate: it catches EVERYTHING — typed
// failures, AND defects (a thrown exception inside a save surfaces as `Cause.Die`,
// which `catchAll` would miss and let escape, killing the daemon). Whatever cause
// results is logged on one line and recovered, keeping the tick total. Status
// reporting is also total so UI defects never block persistence.
export const performAutoSaveTick = <E1, E2>(
  saveDirtyChunks: Effect.Effect<void, E1>,
  persistSessionState: Effect.Effect<void, E2>,
  statusReporter?: AutoSaveStatusReporter,
): Effect.Effect<void, never> =>
  reportAutoSaveStatus(statusReporter, 'saving').pipe(
    Effect.zipRight(
      saveDirtyChunks.pipe(
        Effect.flatMap(() => persistSessionState),
        Effect.zipLeft(reportAutoSaveStatus(statusReporter, 'saved')),
      ),
    ),
    Effect.catchAllCause((cause) =>
      Effect.logError(`Auto-save error: ${Cause.pretty(cause)}`).pipe(
        Effect.zipRight(reportAutoSaveStatus(statusReporter, 'error')),
      ),
    ),
  )

export const AUTO_SAVE_INTERVAL = Duration.seconds(5)

export const startSessionAutoSaveDaemon = <E1, E2>(
  saveDirtyChunks: Effect.Effect<void, E1>,
  persistSessionState: Effect.Effect<void, E2>,
  interval: Duration.Duration = AUTO_SAVE_INTERVAL,
  statusReporter?: AutoSaveStatusReporter,
): Effect.Effect<Fiber.RuntimeFiber<number, never>, never> =>
  Effect.forkDaemon(
    Effect.repeat(
      performAutoSaveTick(saveDirtyChunks, persistSessionState, statusReporter),
      Schedule.spaced(interval),
    ),
  )
