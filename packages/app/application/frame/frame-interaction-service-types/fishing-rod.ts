import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameLivingServices } from '../frame-service-types/living'

export type FrameFishingRodInteractionServices = Pick<FrameInventoryServices, 'inventoryService'> &
  Pick<FrameLivingServices, 'fishingService' | 'xpService'>
