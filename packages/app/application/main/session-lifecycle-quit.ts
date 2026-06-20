import { Duration, Effect } from 'effect'

export const SAVE_FLUSH_TIMEOUT = Duration.seconds(5)
export const QUIT_CLEANUP_TIMEOUT = Duration.seconds(2)

export const runBestEffortQuitStep = (
  effect: Effect.Effect<void, unknown, never>,
  timeout: Duration.Duration,
): Effect.Effect<void, never> =>
  Effect.raceFirst(
    effect.pipe(
      Effect.disconnect,
      Effect.catchAllCause(() => Effect.void),
    ),
    Effect.sleep(timeout),
  )
