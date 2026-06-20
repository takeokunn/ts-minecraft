import type { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import type { HealthService } from '@ts-minecraft/entity/application/health-service'
import type { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'

export type FrameLivingServices = {
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly fishingService: FishingService
}
