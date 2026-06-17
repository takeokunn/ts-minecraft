import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export type PhysicsStageServices = Pick<
  FrameHandlerServices,
  'gameState' | 'healthService' | 'hungerService' | 'xpService' | 'equipmentService' | 'fishingService' | 'inventoryService' | 'hotbarService' | 'soundManager' | 'entityManager' | 'gameMode' | 'chunkManagerService' | 'netherService' | 'blockService' | 'inputService'
>
