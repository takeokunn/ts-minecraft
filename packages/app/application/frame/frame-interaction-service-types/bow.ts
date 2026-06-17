import type { FrameAudioServices, FrameInteractionServices, FrameInventoryServices, FrameLivingServices } from '../frame-service-types'

export type FrameBowInteractionServices = Pick<FrameInteractionServices, 'entityManager'> &
  Pick<FrameInventoryServices, 'inventoryService' | 'hotbarService' | 'equipmentService'> &
  Pick<FrameLivingServices, 'xpService'> &
  Pick<FrameAudioServices, 'soundManager'>
