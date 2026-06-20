import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameLivingServices } from '../frame-service-types/living'

export type FrameEnchantingTableInteractionServices = Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameLivingServices, 'xpService'> &
  Pick<FrameAudioServices, 'soundManager'>
