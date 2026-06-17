import type {
  FrameAudioServices,
  FrameCameraServices,
  FrameGameplayServices,
  FrameHudServices,
  FrameInteractionServices,
  FrameInventoryServices,
  FrameLivingServices,
  FramePresentationServices,
  FrameRenderingServices,
  FrameSettingsServices,
  FrameWorldServices,
} from '../frame-service-types'

// Passed as explicit instances (not yielded from context) so R = never — avoids rebuilding
// all 30+ layers at 60 Hz. Resolved once in main.ts and forwarded to the frame handler.
export type FrameHandlerServices =
  FrameCameraServices &
  FrameGameplayServices &
  FrameSettingsServices &
  FrameAudioServices &
  FrameHudServices &
  FramePresentationServices &
  FrameWorldServices &
  FrameInventoryServices &
  FrameLivingServices &
  FrameInteractionServices &
  FrameRenderingServices
