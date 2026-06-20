import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'

export type FrameBowInteractionServices = Pick<FrameInteractionServices, 'entityManager' | 'droppedItemService' | 'droppedXpOrbService'> &
  Pick<FrameInventoryServices, 'inventoryService' | 'hotbarService' | 'equipmentService'> &
  Pick<FrameAudioServices, 'soundManager'>
