import type { FrameInventoryServices } from '../frame-service-types/inventory'

export type FrameArmorEquipInteractionServices = Pick<FrameInventoryServices, 'inventoryService' | 'equipmentService'>
