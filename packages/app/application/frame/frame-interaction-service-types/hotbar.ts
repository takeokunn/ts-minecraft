import type { FrameHudServices } from '../frame-service-types/hud'
import type { FrameInventoryServices } from '../frame-service-types/inventory'

export type FrameHotbarInputServices = Pick<FrameInventoryServices, 'hotbarService'>

export type FrameHotbarHudServices = Pick<FrameInventoryServices, 'hotbarService'> &
  Pick<FrameHudServices, 'hotbarRenderer'>
