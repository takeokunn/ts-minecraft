import { ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD } from '@ts-minecraft/app/frame-handler.config'

export type AdaptiveQualityInput = {
  readonly adaptivePerformanceMode: boolean
  readonly graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'
  readonly renderDistance: number
  readonly fps: number
  readonly cooldown: number
  readonly chunkSyncPending?: boolean
}

export type SettingsPatch = {
  readonly graphicsQuality?: 'low' | 'medium' | 'high'
  readonly renderDistance?: number
}

export type AdaptiveQualityDecision =
  | number
  | {
      readonly nextCooldown: number
      readonly settingsPatch: SettingsPatch
    }

const ADAPTIVE_QUALITY_COOLDOWN_FRAMES = 20
const ADAPTIVE_QUALITY_MIN_RENDER_DISTANCE = 4
const ADAPTIVE_QUALITY_RECOVERY_RENDER_DISTANCE = 8
const ADAPTIVE_QUALITY_RECOVERY_FPS_THRESHOLD = ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD + 10

const nextGraphicsQuality = (
  graphicsQuality: AdaptiveQualityInput['graphicsQuality'],
): 'low' | 'medium' | 'high' =>
  graphicsQuality === 'ultra'
    ? 'high'
    : graphicsQuality === 'high'
      ? 'medium'
      : 'low'

const previousGraphicsQuality = (
  graphicsQuality: AdaptiveQualityInput['graphicsQuality'],
): 'medium' | 'high' | null =>
  graphicsQuality === 'low'
    ? 'medium'
    : graphicsQuality === 'medium'
      ? 'high'
      : null

const noChange = (cooldown: number): AdaptiveQualityDecision => cooldown

export const decideAdaptiveQuality = ({
  adaptivePerformanceMode,
  graphicsQuality,
  renderDistance,
  fps,
  cooldown,
}: AdaptiveQualityInput): AdaptiveQualityDecision => {
  if (!adaptivePerformanceMode) {
    return noChange(cooldown)
  }

  if (cooldown > 0) {
    return noChange(cooldown - 1)
  }

  if (fps <= 0) {
    return noChange(cooldown)
  }

  if (fps >= ADAPTIVE_QUALITY_RECOVERY_FPS_THRESHOLD) {
    if (renderDistance < ADAPTIVE_QUALITY_RECOVERY_RENDER_DISTANCE) {
      return {
        nextCooldown: ADAPTIVE_QUALITY_COOLDOWN_FRAMES,
        settingsPatch: { renderDistance: renderDistance + 1 },
      }
    }

    const upgradedQuality = previousGraphicsQuality(graphicsQuality)
    if (upgradedQuality !== null) {
      return {
        nextCooldown: ADAPTIVE_QUALITY_COOLDOWN_FRAMES,
        settingsPatch: { graphicsQuality: upgradedQuality },
      }
    }

    return noChange(cooldown)
  }

  if (fps >= ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD) {
    return noChange(cooldown)
  }

  if (graphicsQuality !== 'low') {
    return {
      nextCooldown: ADAPTIVE_QUALITY_COOLDOWN_FRAMES,
      settingsPatch: { graphicsQuality: nextGraphicsQuality(graphicsQuality) },
    }
  }

  // Lower view distance even while chunk sync is draining; waiting keeps cold-load
  // worlds stuck in the most expensive state for too long.
  if (renderDistance > ADAPTIVE_QUALITY_MIN_RENDER_DISTANCE) {
    return {
      nextCooldown: ADAPTIVE_QUALITY_COOLDOWN_FRAMES,
      settingsPatch: { renderDistance: renderDistance - 1 },
    }
  }

  return noChange(cooldown)
}
