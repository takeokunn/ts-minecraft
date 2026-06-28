import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { SessionRenderingResources } from '@ts-minecraft/app/main/session-runtime-types'

type SessionRuntimeWorldServices = Pick<
  FrameHandlerServices,
  | 'chunkManagerService'
  | 'timeService'
  | 'worldRendererService'
  | 'droppedItemRenderer'
  | 'droppedXpOrbRenderer'
  | 'entityRenderer'
  | 'chunkMeshService'
  | 'particleSystem'
  | 'remotePlayerRenderer'
  | 'weatherService'
  | 'biomeService'
  | 'redstoneService'
  | 'cropGrowthService'
  | 'fluidService'
  | 'chestService'
  | 'furnaceService'
  | 'netherService'
>

export const buildSessionRuntimeWorldServices = ({
  rendering,
  services,
}: {
  readonly rendering: Pick<SessionRenderingResources, 'remotePlayerRenderer'>
  readonly services: SessionBootstrapServices
}): SessionRuntimeWorldServices => ({
  chunkManagerService: services.chunkManagerService,
  timeService: services.timeService,
  worldRendererService: services.worldRendererService,
  droppedItemRenderer: services.droppedItemRenderer,
  droppedXpOrbRenderer: services.droppedXpOrbRenderer,
  entityRenderer: services.entityRenderer,
  chunkMeshService: services.chunkMeshService,
  particleSystem: services.particleSystem,
  remotePlayerRenderer: rendering.remotePlayerRenderer,
  weatherService: services.weatherService,
  biomeService: services.biomeService,
  redstoneService: services.redstoneService,
  cropGrowthService: services.cropGrowthService,
  fluidService: services.fluidService,
  chestService: services.chestService,
  furnaceService: services.furnaceService,
  netherService: services.netherService,
})
