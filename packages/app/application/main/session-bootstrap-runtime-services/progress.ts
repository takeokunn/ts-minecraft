import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

type SessionRuntimeProgressServices = Pick<
  FrameHandlerServices,
  'inventoryRenderer' | 'inventoryService' | 'equipmentService' | 'fpsCounter' | 'healthService' | 'hungerService' | 'xpService' | 'fishingService'
>

export const buildSessionRuntimeProgressServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeProgressServices => ({
  inventoryRenderer: services.inventoryRenderer,
  inventoryService: services.inventoryService,
  equipmentService: services.equipmentService,
  fpsCounter: services.fpsCounter,
  healthService: services.healthService,
  hungerService: services.hungerService,
  xpService: services.xpService,
  fishingService: services.fishingService,
})
