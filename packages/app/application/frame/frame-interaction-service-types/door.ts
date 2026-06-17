import type { FrameAudioServices, FrameInteractionServices, FrameWorldServices } from '../frame-service-types'

export type FrameDoorInteractionServices = Pick<FrameInteractionServices, 'blockService'> &
  Pick<FrameWorldServices, 'chunkManagerService'> &
  Pick<FrameAudioServices, 'soundManager'>
