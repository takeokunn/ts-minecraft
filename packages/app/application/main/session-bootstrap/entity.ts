import { Effect } from 'effect'
import { PlayerCameraStateService, FirstPersonCameraService, ThirdPersonCameraService, HealthService, HungerService, XPService, FishingService } from '@ts-minecraft/entity'
import { EntityManager, MobSpawner, VillageService, RedstoneService } from '@ts-minecraft/entity'

export const buildEntityBootstrapServices = Effect.gen(function* () {
  const playerCameraState = yield* PlayerCameraStateService
  const firstPersonCamera = yield* FirstPersonCameraService
  const thirdPersonCamera = yield* ThirdPersonCameraService
  const healthService = yield* HealthService
  const hungerService = yield* HungerService
  const xpService = yield* XPService
  const fishingService = yield* FishingService
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
    entityManager,
    mobSpawner,
    villageService,
    redstoneService,
  }
})
