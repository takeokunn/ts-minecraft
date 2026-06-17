import type { HealthService, HungerService, XPService, FishingService, EntityManager, MobSpawner, VillageService, RedstoneService } from '@ts-minecraft/entity'

export type SessionEntityBootstrapServices = {
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly fishingService: FishingService
  readonly entityManager: EntityManager
  readonly mobSpawner: MobSpawner
  readonly villageService: VillageService
  readonly redstoneService: RedstoneService
}
