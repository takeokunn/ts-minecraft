import { Effect } from 'effect'
import { BiomeService, ChunkManagerService, BlockService, CropGrowthService, FluidService, NetherService } from '@ts-minecraft/world'

export const buildWorldBootstrapServices = Effect.gen(function* () {
  const [
    chunkManagerService,
    biomeService,
    blockService,
    cropGrowthService,
    fluidService,
    netherService,
  ] = yield* Effect.all([
    ChunkManagerService,
    BiomeService,
    BlockService,
    CropGrowthService,
    FluidService,
    NetherService,
  ], { concurrency: 'unbounded' })

  return {
    chunkManagerService,
    biomeService,
    blockService,
    cropGrowthService,
    fluidService,
    netherService,
  }
})
