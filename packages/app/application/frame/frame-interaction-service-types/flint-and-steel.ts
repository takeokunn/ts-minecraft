import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameGameplayServices } from '../frame-service-types/gameplay'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameLivingServices } from '../frame-service-types/living'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameFlintAndSteelInteractionServices = Pick<FrameInteractionServices, 'blockService'> &
  Pick<FrameWorldServices, 'chunkManagerService' | 'netherService'> &
  Pick<FrameGameplayServices, 'gameState' | 'gameMode'> &
  Pick<FrameLivingServices, 'healthService' | 'hungerService'> &
  Pick<FrameInventoryServices, 'equipmentService' | 'hotbarService' | 'inventoryService'> &
  Pick<FrameAudioServices, 'soundManager'>
