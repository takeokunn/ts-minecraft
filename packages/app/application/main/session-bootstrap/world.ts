import { Effect } from 'effect'
import { BiomeService, ChunkManagerService, BlockService, CropGrowthService, FluidService, NetherService } from '@ts-minecraft/world'

export const buildWorldBootstrapServices = Effect.gen(function* () {
  const chunkManagerService = yield* ChunkManagerService
  const biomeService = yield* BiomeService
  const blockService = yield* BlockService
  const cropGrowthService = yield* CropGrowthService
  const fluidService = yield* FluidService
  const netherService = yield* NetherService

  return {
    chunkManagerService,
    biomeService,
    blockService,
    cropGrowthService,
    fluidService,
    netherService,
  }
})
