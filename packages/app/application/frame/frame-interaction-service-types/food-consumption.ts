import type { FrameInventoryServices, FrameLivingServices } from '../frame-service-types'

export type FrameFoodConsumptionInteractionServices = Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService' | 'equipmentService'> &
  Pick<FrameLivingServices, 'hungerService' | 'fishingService' | 'xpService' | 'healthService'>
