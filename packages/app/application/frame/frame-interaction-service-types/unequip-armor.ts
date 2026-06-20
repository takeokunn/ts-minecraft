import type { FrameInventoryServices } from '../frame-service-types/inventory'

export type FrameUnequipArmorInteractionServices = Pick<FrameInventoryServices, 'equipmentService' | 'inventoryService'>
