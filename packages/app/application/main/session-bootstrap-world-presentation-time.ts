import { Effect } from 'effect'

import { TimeService } from '@ts-minecraft/game'

export type SessionBootstrapWorldPresentationTimeDeps = {
  readonly initialSettings: { readonly dayLengthSeconds: number }
  readonly timeService: TimeService
}

const BOOT_TIME_OF_DAY = 0.5

export const initializeSessionBootstrapWorldPresentationTime = ({
  initialSettings,
  timeService,
}: SessionBootstrapWorldPresentationTimeDeps) =>
  Effect.gen(function* () {
    yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
    yield* timeService.setTimeOfDay(BOOT_TIME_OF_DAY)
  })
