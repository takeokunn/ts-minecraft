import { makeBiomeService, makeBlockService, makeChunkManagerService, makeChunkMeshService, makeCropGrowthService, makeDroppedItemRenderer, makeEquipmentService, makeFluidService, makeHotbarService, makeInventoryService, makeNetherService, makeParticleSystem, makePerfHud, makeWorldRendererService, makeEntityRenderer, makeWeatherService } from '../world'

export const makeWorldServices = () => ({
  blockService: makeBlockService(),
  hotbarService: makeHotbarService(),
  chunkManagerService: makeChunkManagerService(),
  inventoryService: makeInventoryService(),
  equipmentService: makeEquipmentService(),
  worldRendererService: makeWorldRendererService(),
  droppedItemRenderer: makeDroppedItemRenderer(),
  entityRenderer: makeEntityRenderer(),
  chunkMeshService: makeChunkMeshService(),
  particleSystem: makeParticleSystem(),
  weatherService: makeWeatherService(),
  biomeService: makeBiomeService(),
  fluidService: makeFluidService(),
  netherService: makeNetherService(),
  cropGrowthService: makeCropGrowthService(),
  perfHud: makePerfHud(),
})
