import type { FrameInteractionServices } from '../frame-service-types'

export type FrameRedstoneInteractionServices = Pick<FrameInteractionServices, 'redstoneService' | 'blockService'>
