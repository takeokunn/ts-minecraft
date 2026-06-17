import type { FrameAudioServices, FrameGameplayServices, FrameInteractionServices, FrameInventoryServices, FrameLivingServices, FramePresentationServices, FrameWorldServices } from '../frame-service-types'

export type FrameRightClickInteractionServices = Pick<FrameInteractionServices, 'blockService'> &
  Pick<FrameWorldServices, 'chunkManagerService' | 'timeService' | 'netherService'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService' | 'chestService' | 'furnaceService'> &
  Pick<FramePresentationServices, 'inventoryRenderer'> &
  Pick<FrameLivingServices, 'xpService'> &
  Pick<FrameGameplayServices, 'multiplayer'> &
  Pick<FrameAudioServices, 'soundManager'>
