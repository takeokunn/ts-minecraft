// Frame stages must never raise — every stage wraps its work in `logErrors`
// to convert typed errors and defects into log lines, preserving the
// `Effect.Effect<A, never>` contract that the frame orchestrator depends on.
import { Cause, Effect } from 'effect';
export const logErrors = (eff, label) => eff.pipe(Effect.catchAllCause((cause) => Effect.logError(`${label}: ${Cause.pretty(cause)}`)));
//# sourceMappingURL=../../../../dist/packages/app/application/frame/error-logging.js.map