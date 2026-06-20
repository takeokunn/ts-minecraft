import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

type SessionRuntimeEntityServices = Pick<
  FrameHandlerServices,
  'debugFeatureFlags' | 'droppedItemService' | 'droppedXpOrbService' | 'entityManager' | 'mobSpawner' | 'villageService' | 'tradingPresentation'
>

export const buildSessionRuntimeEntityServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeEntityServices => ({
  debugFeatureFlags: services.debugFeatureFlags,
  droppedItemService: services.droppedItemService,
  droppedXpOrbService: services.droppedXpOrbService,
  entityManager: services.entityManager,
  mobSpawner: services.mobSpawner,
  villageService: services.villageService,
  tradingPresentation: services.tradingPresentation,
})
