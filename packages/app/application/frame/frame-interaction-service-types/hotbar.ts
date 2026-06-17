import type { FrameHudServices, FrameInventoryServices } from '../frame-service-types'

export type FrameHotbarInputServices = Pick<FrameInventoryServices, 'hotbarService'>

export type FrameHotbarHudServices = Pick<FrameInventoryServices, 'hotbarService'> &
  Pick<FrameHudServices, 'hotbarRenderer'>
