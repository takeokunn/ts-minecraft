import { Effect } from 'effect'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { toggleGameplayHudVisibility } from '@ts-minecraft/presentation'
import type { InputServices } from './input-stage-types'

export const handleHudToggle = (
  services: Pick<InputServices, 'inputService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const pressed = yield* services.inputService.consumeKeyPress(KeyMappings.HUD_TOGGLE)
    if (pressed) {
      yield* Effect.sync(() => {
        toggleGameplayHudVisibility()
      })
    }
  })
