import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameLivingServices } from '../frame-service-types/living'

export type FrameFoodConsumptionInteractionServices = Pick<FrameInventoryServices, 'hotbarService' | 'inventoryService' | 'equipmentService'> &
  Pick<FrameLivingServices, 'hungerService' | 'fishingService' | 'xpService' | 'healthService'>
