import type { FrameInteractionServices } from '../frame-service-types/interaction'

export type FrameRedstoneInteractionServices = Pick<FrameInteractionServices, 'redstoneService' | 'blockService'>
