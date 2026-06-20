import type { FrameGameplayServices } from '../frame-service-types/gameplay'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameCreativePickInteractionServices = Pick<FrameGameplayServices, 'gameMode'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService'> &
  Pick<FrameWorldServices, 'chunkManagerService'>
