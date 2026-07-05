import { Effect } from 'effect'
import type { SettingsOverlayService } from '@ts-minecraft/presentation'

// Deterministically opens the settings overlay via the real openOverlay path —
// which seeds every control from persisted settings (syncFromSettings) — without
// depending on either the floating gear (#settings-gear-btn, deliberately
// display:none during pointer-lock gameplay for vanilla parity) or the
// Escape->pause-menu route. Idempotent: a no-op when already open; returns the
// resulting open state so callers can assert the overlay actually surfaced.
export const openSettingsForQA = (settingsOverlay: SettingsOverlayService): Promise<boolean> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const alreadyOpen = yield* settingsOverlay.isOpen()
      if (!alreadyOpen) {
        yield* settingsOverlay.toggle()
      }
      return yield* settingsOverlay.isOpen()
    }),
  )
