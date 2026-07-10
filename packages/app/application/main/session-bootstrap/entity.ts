import { Effect } from 'effect'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import { FirstPersonCameraService } from '@ts-minecraft/entity/application/first-person-camera-service'
import { ThirdPersonCameraService } from '@ts-minecraft/entity/application/third-person-camera-service'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import { StatisticsService } from '@ts-minecraft/entity/application/statistics-service'
import { AchievementService } from '@ts-minecraft/entity/application/achievement-service'
import { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service'
import { ParkedVehicleService } from '@ts-minecraft/entity/application/parked-vehicle-service'
import { DroppedXpOrbService } from '@ts-minecraft/entity/application/dropped-xp-orb-service'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { MobSpawner } from '@ts-minecraft/entity/application/mob/spawner'
import { VillageService } from '@ts-minecraft/entity/application/village/village-service'
import { RedstoneService } from '@ts-minecraft/entity/application/redstone/redstone-service'

export const buildEntityBootstrapServices = Effect.gen(function* () {
  const [
    playerCameraState,
    firstPersonCamera,
    thirdPersonCamera,
    healthService,
    hungerService,
    xpService,
    fishingService,
    statisticsService,
    achievementService,
    droppedItemService,
    parkedVehicleService,
    droppedXpOrbService,
    entityManager,
    mobSpawner,
    villageService,
    redstoneService,
  ] = yield* Effect.all([
    PlayerCameraStateService,
    FirstPersonCameraService,
    ThirdPersonCameraService,
    HealthService,
    HungerService,
    XPService,
    FishingService,
    StatisticsService,
    AchievementService,
    DroppedItemService,
    ParkedVehicleService,
    DroppedXpOrbService,
    EntityManager,
    MobSpawner,
    VillageService,
    RedstoneService,
  ], { concurrency: 'unbounded' })

  return {
    playerCameraState,
    firstPersonCamera,
    thirdPersonCamera,
    healthService,
    hungerService,
    xpService,
    fishingService,
    statisticsService,
    achievementService,
    droppedItemService,
    parkedVehicleService,
    droppedXpOrbService,
    entityManager,
    mobSpawner,
    villageService,
    redstoneService,
  }
})
