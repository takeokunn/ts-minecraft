import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'

export type FrameAnimalInteractionServices = Pick<FrameInteractionServices, 'entityManager'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameAudioServices, 'soundManager'>
