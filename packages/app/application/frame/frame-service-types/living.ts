import type { AchievementService } from '@ts-minecraft/entity/application/achievement-service'
import type { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import type { HealthService } from '@ts-minecraft/entity/application/health-service'
import type { HungerService } from '@ts-minecraft/entity/application/hunger-service'
import type { StatisticsService } from '@ts-minecraft/entity/application/statistics-service'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'

export type FrameLivingServices = {
  readonly healthService: HealthService
  readonly hungerService: HungerService
  readonly xpService: XPService
  readonly fishingService: FishingService
  readonly statisticsService: StatisticsService
  readonly achievementService: AchievementService
}
