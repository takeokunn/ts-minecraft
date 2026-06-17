import type { BiomeService, ChunkManagerService, BlockService, CropGrowthService, FluidService, NetherService } from '@ts-minecraft/world'

export type SessionWorldBootstrapServices = {
  readonly chunkManagerService: ChunkManagerService
  readonly biomeService: BiomeService
  readonly blockService: BlockService
  readonly cropGrowthService: CropGrowthService
  readonly fluidService: FluidService
  readonly netherService: NetherService
}
