import { Cause, Duration, Effect, Fiber, Schedule } from 'effect'

export type AutoSaveStatus = 'saving' | 'saved' | 'error'

export type AutoSaveStatusReporter = (status: AutoSaveStatus) => Effect.Effect<void, unknown>

export const AUTO_SAVE_STATUS_ELEMENT_ID = 'autosave-status'

const noopAutoSaveStatusReporter: AutoSaveStatusReporter = () => Effect.void

const AUTO_SAVE_STATUS_MESSAGES = {
  saving: 'Saving world...',
  saved: 'World saved',
  error: 'Save failed',
} satisfies Record<AutoSaveStatus, string>

const AUTO_SAVE_STATUS_BASE_STYLE = [
  'position:fixed',
  'right:16px',
  'bottom:16px',
  'z-index:2147483647',
  'pointer-events:none',
  'border-radius:999px',
  'border:1px solid rgba(255,255,255,0.22)',
  'box-shadow:0 14px 40px rgba(0,0,0,0.28)',
  'font:600 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  'letter-spacing:0.04em',
  'text-transform:uppercase',
  'padding:8px 12px',
  'backdrop-filter:blur(10px)',
  'transition:opacity 160ms ease, transform 160ms ease, background-color 160ms ease',
  'opacity:0.92',
].join(';')

const AUTO_SAVE_STATUS_STATE_STYLE = {
  saving: 'background:rgba(22,59,94,0.9);color:#d7f5ff;transform:translateY(0)',
  saved: 'background:rgba(19,82,57,0.9);color:#dfffe8;transform:translateY(0)',
  error: 'background:rgba(110,35,35,0.92);color:#ffe2dc;transform:translateY(0)',
} satisfies Record<AutoSaveStatus, string>

const getDefaultDocument = (): Document | undefined => {
  if (typeof document === 'undefined') return undefined
  return document
}

const reportAutoSaveStatus = (
  reportStatus: AutoSaveStatusReporter,
  status: AutoSaveStatus,
): Effect.Effect<void, never> =>
  reportStatus(status).pipe(Effect.catchAllCause(() => Effect.void))

export const createBrowserAutoSaveStatusReporter = (
  doc: Document | undefined = getDefaultDocument(),
): AutoSaveStatusReporter => {
  if (doc === undefined) return noopAutoSaveStatusReporter

  let element: HTMLDivElement | null = null

  const ensureElement = (): HTMLDivElement | null => {
    if (element?.isConnected === true) return element

    const existing = doc.getElementById(AUTO_SAVE_STATUS_ELEMENT_ID)
    if (existing !== null) {
      element = existing as HTMLDivElement
      return element
    }

    if (doc.body === null) return null

    const next = doc.createElement('div')
    next.id = AUTO_SAVE_STATUS_ELEMENT_ID
    next.setAttribute('role', 'status')
    next.setAttribute('aria-live', 'polite')
    next.setAttribute('aria-atomic', 'true')
    next.style.cssText = AUTO_SAVE_STATUS_BASE_STYLE
    doc.body.appendChild(next)
    element = next
    return element
  }

  return (status) =>
    Effect.sync(() => {
      const statusElement = ensureElement()
      if (statusElement === null) return

      statusElement.textContent = AUTO_SAVE_STATUS_MESSAGES[status]
      statusElement.dataset['status'] = status
      statusElement.style.cssText = `${AUTO_SAVE_STATUS_BASE_STYLE};${AUTO_SAVE_STATUS_STATE_STYLE[status]}`
    }).pipe(Effect.catchAllCause(() => Effect.void))
}

// One autosave tick: persist dirty chunks and session state together, swallowing
// (and logging) ANY persistence/status failure so the surrounding `Effect.repeat`
// daemon survives a transient save error (e.g. a momentary IndexedDB
// quota/transaction failure) and keeps autosaving for the rest of the session.
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
// results — a failure or a defect — is logged on one line and recovered, keeping
// the tick total.
export const performAutoSaveTick = <E1, E2>(
  saveDirtyChunks: Effect.Effect<void, E1>,
  persistSessionState: Effect.Effect<void, E2>,
  reportStatus: AutoSaveStatusReporter = noopAutoSaveStatusReporter,
): Effect.Effect<void, never> =>
  reportAutoSaveStatus(reportStatus, 'saving').pipe(
    Effect.flatMap(() =>
      saveDirtyChunks.pipe(
        Effect.flatMap(() => persistSessionState),
        Effect.tap(() => reportAutoSaveStatus(reportStatus, 'saved')),
        Effect.catchAllCause((cause) =>
          reportAutoSaveStatus(reportStatus, 'error').pipe(
            Effect.zipRight(Effect.logError(`Auto-save error: ${Cause.pretty(cause)}`)),
          ),
        ),
      ),
    ),
  )

export const AUTO_SAVE_INTERVAL = Duration.seconds(5)

export const startSessionAutoSaveDaemon = <E1, E2>(
  saveDirtyChunks: Effect.Effect<void, E1>,
  persistSessionState: Effect.Effect<void, E2>,
  interval: Duration.Duration = AUTO_SAVE_INTERVAL,
  reportStatus: AutoSaveStatusReporter = createBrowserAutoSaveStatusReporter(),
): Effect.Effect<Fiber.RuntimeFiber<number, never>, never> =>
  Effect.forkDaemon(
    Effect.repeat(
      performAutoSaveTick(saveDirtyChunks, persistSessionState, reportStatus),
      Schedule.spaced(interval),
    ),
  )
