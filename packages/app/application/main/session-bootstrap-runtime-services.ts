import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { SessionRenderingResources } from '@ts-minecraft/app/main/session-runtime-types'
import { buildSessionRuntimeStateServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/state'
import { buildSessionRuntimeCameraServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/camera'
import { buildSessionRuntimeInteractionServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/interaction'
import { buildSessionRuntimeProgressServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/progress'
import { buildSessionRuntimeWorldServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/world'
import { buildSessionRuntimeEntityServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/entity'
import { buildSessionRuntimePresentationServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services/presentation'

export const buildSessionRuntimeServices = ({
  bootCtx,
  rendering,
  services,
}: {
  readonly bootCtx: Pick<BootContext, 'perfHud' | 'settingsService' | 'soundManager' | 'musicManager'>
  readonly rendering: Pick<SessionRenderingResources, 'remotePlayerRenderer' | 'vehicleVisual'>
  readonly services: SessionBootstrapServices
}): FrameHandlerServices => ({
  ...buildSessionRuntimeStateServices({ bootCtx, services }),
  ...buildSessionRuntimeCameraServices({ services }),
  ...buildSessionRuntimeInteractionServices({ services }),
  ...buildSessionRuntimeProgressServices({ services }),
  ...buildSessionRuntimePresentationServices({ services }),
  ...buildSessionRuntimeWorldServices({ services, rendering }),
  ...buildSessionRuntimeEntityServices({ services }),
})
