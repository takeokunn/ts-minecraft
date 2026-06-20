import type { HealthService } from '@ts-minecraft/entity/application/health-service'
import type { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'
import type { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import type { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service'
import type { DroppedXpOrbService } from '@ts-minecraft/entity/application/dropped-xp-orb-service'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import type { MobSpawner } from '@ts-minecraft/entity/application/mob/spawner'
import type { VillageService } from '@ts-minecraft/entity/application/village/village-service'
import type { RedstoneService } from '@ts-minecraft/entity/application/redstone/redstone-service'
import type { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import type { FirstPersonCameraService } from '@ts-minecraft/entity/application/first-person-camera-service'
import type { ThirdPersonCameraService } from '@ts-minecraft/entity/application/third-person-camera-service'

export type SessionEntityBootstrapServices = {
  readonly playerCameraState: PlayerCameraStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly thirdPersonCamera: ThirdPersonCameraService
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly fishingService: FishingService
  readonly droppedItemService: DroppedItemService
  readonly droppedXpOrbService: DroppedXpOrbService
  readonly entityManager: EntityManager
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly redstoneService: RedstoneService
}
