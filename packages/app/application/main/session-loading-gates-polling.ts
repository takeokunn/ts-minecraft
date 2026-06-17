import { Duration, Effect } from 'effect'

export const waitForPollingGate = ({
  step,
  pollMs,
  timeoutMs,
}: {
  readonly step: () => Effect.Effect<boolean, never>
  readonly pollMs: number
  readonly timeoutMs: number
}): Effect.Effect<boolean, never> =>
  Effect.raceFirst(
    Effect.gen(function* () {
      while (true) {
        const settled = yield* step()
        if (settled) return true
        yield* Effect.sleep(Duration.millis(pollMs))
      }
    }),
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(timeoutMs))
      return false
    }),
  )
