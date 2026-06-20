import { Effect } from 'effect'

import type { Settings } from '@ts-minecraft/game'
import { resolvePreset } from '@ts-minecraft/game/application/settings-service.config'
import type { BootContext } from '@ts-minecraft/app/main/boot'
import { createSessionControl } from '@ts-minecraft/app/main/session-control'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'

export type SessionBootstrapStartupState = {
  readonly control: SessionControl
  readonly initialSettings: Settings
  readonly initialGraphics: ReturnType<typeof resolvePreset>
}

export const buildSessionBootstrapStartupState = ({
  settingsService,
}: Pick<BootContext, 'settingsService'>) =>
  Effect.gen(function* () {
    const control = yield* createSessionControl
    const initialSettings = yield* settingsService.getSettings()
    const initialGraphics = yield* Effect.sync(() => resolvePreset(initialSettings.graphicsQuality))

    return {
      control,
      initialSettings,
      initialGraphics,
    } satisfies SessionBootstrapStartupState
  })
