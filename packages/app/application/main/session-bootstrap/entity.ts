import { Effect } from 'effect'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { FirstPersonCameraService } from '@ts-minecraft/entity/application/first-person-camera-service'
import { ThirdPersonCameraService } from '@ts-minecraft/entity/application/third-person-camera-service'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service'
import { DroppedXpOrbService } from '@ts-minecraft/entity/application/dropped-xp-orb-service'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { MobSpawner } from '@ts-minecraft/entity/application/mob/spawner'
import { VillageService } from '@ts-minecraft/entity/application/village/village-service'
import { RedstoneService } from '@ts-minecraft/entity/application/redstone/redstone-service'

export const buildEntityBootstrapServices = Effect.gen(function* () {
  const playerCameraState = yield* PlayerCameraStateService
  const firstPersonCamera = yield* FirstPersonCameraService
  const thirdPersonCamera = yield* ThirdPersonCameraService
  const healthService = yield* HealthService
  const hungerService = yield* HungerService
  const xpService = yield* XPService
  const fishingService = yield* FishingService
  const droppedItemService = yield* DroppedItemService
  const droppedXpOrbService = yield* DroppedXpOrbService
  const entityManager = yield* EntityManager
  const mobSpawner = yield* MobSpawner
  const villageService = yield* VillageService
  const redstoneService = yield* RedstoneService

  return {
    playerCameraState,
    firstPersonCamera,
    thirdPersonCamera,
    healthService,
    hungerService,
    xpService,
    fishingService,
    droppedItemService,
    droppedXpOrbService,
    entityManager,
    mobSpawner,
    villageService,
    redstoneService,
  }
})
