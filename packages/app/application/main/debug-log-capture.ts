// Global log/defect capture — the missing debugging backbone. Console output
// and uncaught errors were previously write-only (visible in devtools, gone for
// automation): forked-fiber defects surfaced via console.error but nothing kept
// them, and window-level errors had no handler at all. This installs a bounded
// ring buffer over console.error/warn + window error/unhandledrejection so the
// QA API (getCapturedLogsForQA) can assert "no errors happened" after any flow.
export type CapturedLogLevel = 'error' | 'warn' | 'uncaught-error' | 'unhandled-rejection'

export interface CapturedLogEntry {
  readonly timeMs: number
  readonly level: CapturedLogLevel
  readonly message: string
}

export const MAX_CAPTURED_LOGS = 500

type ConsoleLike = {
  error: (...args: ReadonlyArray<unknown>) => void
  warn: (...args: ReadonlyArray<unknown>) => void
}

type ErrorEventLike = { readonly message?: string; readonly error?: unknown }
type RejectionEventLike = { readonly reason?: unknown }

type WindowLike = {
  addEventListener: ((type: 'error', listener: (ev: ErrorEventLike) => void) => void) &
    ((type: 'unhandledrejection', listener: (ev: RejectionEventLike) => void) => void)
}

// Circular-safe, BigInt-safe stringify. Console args are usually strings or
// Errors; the JSON path is a best-effort fallback so a weird object can never
// break the console wrapper (worst case it degrades to Object.prototype.toString).
const safeStringify = (value: object): string => {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (_key, v: unknown) => {
      if (typeof v === 'bigint') return `${v}n`
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]'
        seen.add(v)
      }
      return v
    }) ?? String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

export const formatLogArg = (arg: unknown): string => {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`
  if (typeof arg === 'object' && arg !== null) return safeStringify(arg)
  return String(arg)
}

export const formatLogArgs = (args: ReadonlyArray<unknown>): string => args.map(formatLogArg).join(' ')

export interface DebugLogCapture {
  readonly getEntries: () => ReadonlyArray<CapturedLogEntry>
  readonly clear: () => void
}

// Factory over injected console/window targets so tests can drive it with fakes.
// Wrapped console methods always call the original FIRST; capture failures are
// swallowed so logging can never be broken by the capture layer itself.
export const createDebugLogCapture = (
  consoleLike: ConsoleLike,
  windowLike: WindowLike | null,
  now: () => number,
): DebugLogCapture => {
  const entries: CapturedLogEntry[] = []

  const push = (level: CapturedLogLevel, message: string): void => {
    entries.push({ timeMs: Math.round(now()), level, message })
    if (entries.length > MAX_CAPTURED_LOGS) entries.splice(0, entries.length - MAX_CAPTURED_LOGS)
  }

  const capture = (level: CapturedLogLevel, args: ReadonlyArray<unknown>): void => {
    try {
      push(level, formatLogArgs(args))
    } catch {
      // Never let capture break the caller.
    }
  }

  const originalError = consoleLike.error.bind(consoleLike)
  const originalWarn = consoleLike.warn.bind(consoleLike)
  consoleLike.error = (...args: ReadonlyArray<unknown>) => {
    originalError(...args)
    capture('error', args)
  }
  consoleLike.warn = (...args: ReadonlyArray<unknown>) => {
    originalWarn(...args)
    capture('warn', args)
  }

  if (windowLike !== null) {
    windowLike.addEventListener('error', (ev: ErrorEventLike) => {
      capture('uncaught-error', [ev.error ?? ev.message ?? 'unknown error'])
    })
    windowLike.addEventListener('unhandledrejection', (ev: RejectionEventLike) => {
      capture('unhandled-rejection', [ev.reason ?? 'unknown rejection'])
    })
  }

  return {
    getEntries: () => [...entries],
    clear: () => {
      entries.length = 0
    },
  }
}

// Boot-time singleton: src/main.ts installs once; the QA API reads through the
// accessor. Idempotent so a hot-reload double boot doesn't double-wrap console.
let globalCapture: DebugLogCapture | null = null

export const installGlobalDebugLogCapture = (): DebugLogCapture => {
  if (globalCapture !== null) return globalCapture
  const windowLike = typeof window === 'undefined' ? null : (window as unknown as WindowLike)
  globalCapture = createDebugLogCapture(
    console,
    windowLike,
    typeof performance === 'undefined' ? () => 0 : () => performance.now(),
  )
  return globalCapture
}

export const getGlobalDebugLogCapture = (): DebugLogCapture | null => globalCapture
