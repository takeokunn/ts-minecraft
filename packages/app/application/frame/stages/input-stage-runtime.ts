import { Effect, MutableRef, Ref } from 'effect'
import type { InputDeps, InputRefs, InputServices } from './input-stage-types'

export const reconcileModalPause = (
  deps: InputDeps,
  services: Pick<InputServices, 'inventoryRenderer' | 'playerListPanel' | 'settingsOverlay' | 'pauseMenu' | 'tradingPresentation'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const invOpen = yield* services.inventoryRenderer.isOpen()
    const playerListOpen = yield* services.playerListPanel.isOpen()
    const tradeOpen = yield* services.tradingPresentation.isOpen()
    const settingsOpen = yield* services.settingsOverlay.isOpen()
    const pauseOpen = yield* services.pauseMenu.isOpen()
    yield* Ref.set(deps.gamePausedRef, invOpen || playerListOpen || tradeOpen || settingsOpen || pauseOpen)
  })

export const syncDayLength = (
  services: Pick<InputServices, 'timeService'>,
  refs: InputRefs,
  dayLengthSeconds: number,
): Effect.Effect<void, never> => {
  if (MutableRef.get(refs.lastSyncedDayLengthSecondsRef) === dayLengthSeconds) {
    return Effect.void
  }
  return services.timeService.setDayLength(dayLengthSeconds).pipe(
    Effect.tap(() => Effect.sync(() => {
      MutableRef.set(refs.lastSyncedDayLengthSecondsRef, dayLengthSeconds)
    })),
  )
}
