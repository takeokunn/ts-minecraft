import type { FrameAudioServices, FrameInteractionServices, FrameInventoryServices } from '../frame-service-types'

export type FrameAnimalInteractionServices = Pick<FrameInteractionServices, 'entityManager'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameAudioServices, 'soundManager'>
