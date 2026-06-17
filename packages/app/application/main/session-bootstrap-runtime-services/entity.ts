import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

type SessionRuntimeEntityServices = Pick<
  FrameHandlerServices,
  'debugFeatureFlags' | 'entityManager' | 'mobSpawner' | 'villageService' | 'tradingPresentation'
>

export const buildSessionRuntimeEntityServices = ({
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeEntityServices => ({
  debugFeatureFlags: services.debugFeatureFlags,
  entityManager: services.entityManager,
  mobSpawner: services.mobSpawner,
  villageService: services.villageService,
  tradingPresentation: services.tradingPresentation,
})
