import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

type SessionRuntimeWorldServices = Pick<
  FrameHandlerServices,
  | 'chunkManagerService'
  | 'timeService'
  | 'worldRendererService'
  | 'entityRenderer'
  | 'chunkMeshService'
  | 'particleSystem'
  | 'weatherService'
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
  entityRenderer: services.entityRenderer,
  chunkMeshService: services.chunkMeshService,
  particleSystem: services.particleSystem,
  weatherService: services.weatherService,
  redstoneService: services.redstoneService,
  cropGrowthService: services.cropGrowthService,
  fluidService: services.fluidService,
  chestService: services.chestService,
  furnaceService: services.furnaceService,
  netherService: services.netherService,
})
