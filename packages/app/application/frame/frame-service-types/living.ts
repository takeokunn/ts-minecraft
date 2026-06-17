import type { FishingService, HealthService, HungerService, XPService } from '@ts-minecraft/entity'

export type FrameLivingServices = {
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly fishingService: FishingService
}
