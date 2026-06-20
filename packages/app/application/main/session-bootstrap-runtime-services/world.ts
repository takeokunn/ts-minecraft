import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

type SessionRuntimeWorldServices = Pick<
  FrameHandlerServices,
  | 'chunkManagerService'
  | 'timeService'
  | 'worldRendererService'
  | 'droppedItemRenderer'
  | 'entityRenderer'
  | 'chunkMeshService'
  | 'particleSystem'
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
  services,
}: {
  readonly services: SessionBootstrapServices
}): SessionRuntimeWorldServices => ({
  chunkManagerService: services.chunkManagerService,
  timeService: services.timeService,
  worldRendererService: services.worldRendererService,
  droppedItemRenderer: services.droppedItemRenderer,
  entityRenderer: services.entityRenderer,
  chunkMeshService: services.chunkMeshService,
  particleSystem: services.particleSystem,
  weatherService: services.weatherService,
  biomeService: services.biomeService,
  redstoneService: services.redstoneService,
  cropGrowthService: services.cropGrowthService,
  fluidService: services.fluidService,
  chestService: services.chestService,
  furnaceService: services.furnaceService,
  netherService: services.netherService,
})
