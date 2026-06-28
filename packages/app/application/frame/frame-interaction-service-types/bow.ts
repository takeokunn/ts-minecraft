import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FramePresentationServices } from '../frame-service-types/presentation'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameBowInteractionServices = Pick<FrameInteractionServices, 'entityManager' | 'droppedItemService' | 'droppedXpOrbService'> &
  Pick<FrameInventoryServices, 'inventoryService' | 'hotbarService' | 'equipmentService'> &
  Pick<FramePresentationServices, 'crosshair'> &
  Pick<FrameWorldServices, 'chunkManagerService'> &
  Pick<FrameAudioServices, 'soundManager'>
