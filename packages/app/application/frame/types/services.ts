import type { FrameAudioServices } from '../frame-service-types/audio'
import type { FrameCameraServices } from '../frame-service-types/camera'
import type { FrameGameplayServices } from '../frame-service-types/gameplay'
import type { FrameHudServices } from '../frame-service-types/hud'
import type { FrameInteractionServices } from '../frame-service-types/interaction'
import type { FrameInventoryServices } from '../frame-service-types/inventory'
import type { FrameLivingServices } from '../frame-service-types/living'
import type { FramePresentationServices } from '../frame-service-types/presentation'
import type { FrameRenderingServices } from '../frame-service-types/rendering'
import type { FrameSettingsServices } from '../frame-service-types/settings'
import type { FrameWorldServices } from '../frame-service-types/world'

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
