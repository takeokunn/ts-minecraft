import type { FrameAudioServices, FrameGameplayServices, FrameInteractionServices, FrameInventoryServices, FrameLivingServices, FrameWorldServices } from '../frame-service-types'

export type FrameFlintAndSteelInteractionServices = Pick<FrameInteractionServices, 'blockService'> &
  Pick<FrameWorldServices, 'chunkManagerService' | 'netherService'> &
  Pick<FrameGameplayServices, 'gameState' | 'gameMode'> &
  Pick<FrameLivingServices, 'healthService' | 'hungerService'> &
  Pick<FrameInventoryServices, 'equipmentService'> &
  Pick<FrameAudioServices, 'soundManager'>
