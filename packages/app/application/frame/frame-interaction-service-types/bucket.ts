import type { FrameAudioServices, FrameInteractionServices, FrameInventoryServices, FrameWorldServices } from '../frame-service-types'

export type FrameBucketInteractionServices = Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameInteractionServices, 'blockService' | 'fluidService'> &
  Pick<FrameWorldServices, 'chunkManagerService'> &
  Pick<FrameAudioServices, 'soundManager'>
