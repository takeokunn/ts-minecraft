import { Effect, Option } from 'effect'

import { TimeService } from '@ts-minecraft/game'

export type SessionBootstrapWorldPresentationTimeDeps = {
  readonly initialSettings: { readonly dayLengthSeconds: number }
  readonly timeService: TimeService
  // Persisted time-of-day from the world save. None for fresh worlds — they
  // start mid-morning. Saves used to be silently reset to noon on every load
  // because this value was written by session-persist but never read back.
  readonly savedTimeOfDay: Option.Option<number>
}

// Fresh worlds begin mid-morning (0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk):
// past the sunrise twilight band, hostile spawning off, most of day one left —
// the vanilla new-world experience. A noon start reached dusk in 100s at the
// default day length, dropping brand-new players into the night-mob roster.
const NEW_WORLD_TIME_OF_DAY = 0.3

export const initializeSessionBootstrapWorldPresentationTime = ({
  initialSettings,
  timeService,
  savedTimeOfDay,
}: SessionBootstrapWorldPresentationTimeDeps) =>
  Effect.gen(function* () {
    yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
    yield* timeService.setTimeOfDay(Option.getOrElse(savedTimeOfDay, () => NEW_WORLD_TIME_OF_DAY))
  })
