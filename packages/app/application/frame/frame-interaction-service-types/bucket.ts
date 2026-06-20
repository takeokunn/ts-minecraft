import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameBucketInteractionServices = Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameInteractionServices, 'blockService' | 'fluidService'> &
  Pick<FrameWorldServices, 'chunkManagerService'> &
  Pick<FrameAudioServices, 'soundManager'>
