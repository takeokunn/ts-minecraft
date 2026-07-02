import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameGameplayServices } from '../frame-service-types/gameplay'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameRenderingServices } from '../frame-service-types/rendering'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameEnderEyeInteractionServices = Pick<FrameInteractionServices, 'blockService'> &
  Pick<FrameWorldServices, 'chunkManagerService' | 'netherService'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameRenderingServices, 'particleSystem'> &
  Pick<FrameGameplayServices, 'multiplayer'> &
  Pick<FrameAudioServices, 'soundManager'>
