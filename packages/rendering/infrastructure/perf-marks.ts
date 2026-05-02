// Activated by `?debug=perf` URL query. `markEffect` wraps Effect-typed boundaries
// with `performance.mark`+`performance.measure` for browser DevTools timeline and Playwright
// `browser_console_messages` capture. No-op when the flag is absent.
import { Effect } from 'effect'

const PERF_ENABLED =
  typeof window !== 'undefined' &&
  typeof performance !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === 'perf'

export const isPerfEnabled = (): boolean => PERF_ENABLED

export const markEffect = <A, E, R>(
  name: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  if (!PERF_ENABLED) return effect
  const startMark = `${name}:start`
  const endMark = `${name}:end`
  return Effect.acquireUseRelease(
    Effect.sync(() => performance.mark(startMark)),
    () => effect,
    () =>
      Effect.sync(() => {
        performance.mark(endMark)
        performance.measure(name, startMark, endMark)
      }),
  )
}
