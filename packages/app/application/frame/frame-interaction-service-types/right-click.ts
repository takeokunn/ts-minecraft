import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameGameplayServices } from '../frame-service-types/gameplay'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameLivingServices } from '../frame-service-types/living'
import type { FramePresentationServices } from '../frame-service-types/presentation'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameRightClickInteractionServices = Pick<FrameInteractionServices, 'blockService' | 'redstoneService'> &
  Pick<FrameWorldServices, 'chunkManagerService' | 'timeService' | 'netherService'> &
  Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService' | 'equipmentService' | 'chestService' | 'furnaceService'> &
  Pick<FramePresentationServices, 'inventoryRenderer'> &
  Pick<FrameLivingServices, 'healthService' | 'hungerService' | 'xpService'> &
  Pick<FrameGameplayServices, 'gameState' | 'gameMode' | 'multiplayer'> &
  Pick<FrameAudioServices, 'soundManager'>
