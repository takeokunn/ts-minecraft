/**
 * Per-stage error logging helper.
 *
 * Frame stages must never raise — every stage wraps its work in `logErrors`
 * to convert typed errors and defects into log lines, preserving the
 * `Effect.Effect<A, never>` contract that the frame orchestrator depends on.
 */
import { Cause, Effect } from 'effect'

export const logErrors = <A, E, R>(
  eff: Effect.Effect<A, E, R>,
  label: string,
): Effect.Effect<A | void, never, R> =>
  eff.pipe(Effect.catchAllCause((cause) => Effect.logError(`${label}: ${Cause.pretty(cause)}`)))
