import type {
  DroppedItemService,
} from '@ts-minecraft/entity/application/dropped-item-service'
import type {
  DroppedXpOrbService,
} from '@ts-minecraft/entity/application/dropped-xp-orb-service'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import type { MobSpawner } from '@ts-minecraft/entity/application/mob/spawner'
import type { RedstoneService } from '@ts-minecraft/entity/application/redstone/redstone-service'
import type { VillageService } from '@ts-minecraft/entity/application/village/village-service'
import type { BlockService, CropGrowthService, FluidService } from '@ts-minecraft/world'
import type { TradingPresentationService } from '@ts-minecraft/presentation'

export type FrameInteractionServices = {
  readonly blockService: BlockService
  readonly droppedItemService: DroppedItemService
  readonly droppedXpOrbService: DroppedXpOrbService
  readonly entityManager: EntityManager
  readonly redstoneService: RedstoneService
  readonly cropGrowthService: CropGrowthService
  readonly fluidService: FluidService
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly tradingPresentation: TradingPresentationService
}
