import type {
  EntityManager,
  MobSpawner,
  RedstoneService,
  VillageService,
} from '@ts-minecraft/entity'
import type { BlockService, CropGrowthService, FluidService } from '@ts-minecraft/world'
import type { TradingPresentationService } from '@ts-minecraft/presentation'

export type FrameInteractionServices = {
  readonly blockService: BlockService
  readonly entityManager: EntityManager
  readonly redstoneService: RedstoneService
  readonly cropGrowthService: CropGrowthService
  readonly fluidService: FluidService
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly tradingPresentation: TradingPresentationService
}
