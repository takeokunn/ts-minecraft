import type { FrameInventoryServices, FrameLivingServices } from '../frame-service-types'

export type FrameFishingRodInteractionServices = Pick<FrameInventoryServices, 'inventoryService'> &
  Pick<FrameLivingServices, 'fishingService' | 'xpService'>
