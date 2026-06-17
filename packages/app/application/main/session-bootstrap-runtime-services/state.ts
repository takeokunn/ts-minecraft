import { Option } from 'effect'

import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

type SessionRuntimeStateServices = Pick<
  FrameHandlerServices,
  'gameState' | 'settingsService' | 'soundManager' | 'musicManager' | 'perfHud' | 'gameMode' | 'multiplayer'
>

export const buildSessionRuntimeStateServices = ({
  bootCtx,
  services,
}: {
  readonly bootCtx: Pick<BootContext, 'perfHud' | 'settingsService' | 'soundManager' | 'musicManager'>
  readonly services: SessionBootstrapServices
}): SessionRuntimeStateServices => ({
  gameState: services.gameState,
  settingsService: bootCtx.settingsService,
  soundManager: bootCtx.soundManager,
  musicManager: bootCtx.musicManager,
  perfHud: bootCtx.perfHud,
  gameMode: services.gameModeService,
  multiplayer: Option.none(),
})
