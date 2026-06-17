import type { FrameAudioServices, FrameWorldServices } from '../frame-service-types'

export type FrameBedInteractionServices = Pick<FrameWorldServices, 'timeService' | 'netherService'> &
  Pick<FrameAudioServices, 'soundManager'>
