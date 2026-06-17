import type { FrameGameplayServices, FrameInventoryServices, FrameWorldServices } from '../frame-service-types'

export type FrameCreativePickInteractionServices = Pick<FrameGameplayServices, 'gameMode'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameWorldServices, 'chunkManagerService'>
