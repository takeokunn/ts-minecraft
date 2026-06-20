import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameWorldServices } from '../frame-service-types/world'

export type FrameDoorInteractionServices = Pick<FrameInteractionServices, 'blockService'> &
  Pick<FrameWorldServices, 'chunkManagerService'> &
  Pick<FrameAudioServices, 'soundManager'>
