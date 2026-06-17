import type { FrameAudioServices, FrameInventoryServices, FrameLivingServices } from '../frame-service-types'

export type FrameEnchantingTableInteractionServices = Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameLivingServices, 'xpService'> &
  Pick<FrameAudioServices, 'soundManager'>
