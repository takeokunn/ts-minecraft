import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import { buildSessionRuntimeStateServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/state'
import { buildSessionRuntimeCameraServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/camera'
import { buildSessionRuntimeInteractionServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/interaction'
import { buildSessionRuntimeProgressServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/progress'
import { buildSessionRuntimeWorldServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/world'
import { buildSessionRuntimeEntityServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/entity'

export const buildSessionRuntimeServices = ({
  bootCtx,
  services,
}: {
  readonly bootCtx: Pick<BootContext, 'perfHud' | 'settingsService' | 'soundManager' | 'musicManager'>
  readonly services: SessionBootstrapServices
}): FrameHandlerServices => ({
  ...buildSessionRuntimeStateServices({ bootCtx, services }),
  ...buildSessionRuntimeCameraServices({ services }),
  ...buildSessionRuntimeInteractionServices({ services }),
  ...buildSessionRuntimeProgressServices({ services }),
  ...buildSessionRuntimeWorldServices({ services }),
  ...buildSessionRuntimeEntityServices({ services }),
})
