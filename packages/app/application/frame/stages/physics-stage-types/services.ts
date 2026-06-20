import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type PhysicsStageServices = Pick<
  FrameHandlerServices,
  'gameState' | 'healthService' | 'hungerService' | 'xpService' | 'equipmentService' | 'fishingService' | 'inventoryService' | 'hotbarService' | 'soundManager' | 'entityManager' | 'gameMode' | 'chunkManagerService' | 'netherService' | 'blockService' | 'inputService' | 'weatherService'
>
