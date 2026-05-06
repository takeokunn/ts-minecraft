import * as THREE from 'three'
import { Option } from 'effect'
import { ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD } from '@ts-minecraft/app/frame-handler.config'

export type CameraPoseSnapshot = {
  readonly version: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly qx: number
  readonly qy: number
  readonly qz: number
  readonly qw: number
  readonly p0: number
  readonly p5: number
  readonly p10: number
  readonly p14: number
}

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

export type AdaptiveQualityDecision = {
  readonly nextCooldown: number
  readonly settingsPatch: Option.Option<SettingsPatch>
}

export const captureCameraPose = (camera: THREE.PerspectiveCamera, version: number): CameraPoseSnapshot => {
  const projection = camera.projectionMatrix.elements
  return {
    version,
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    qx: camera.quaternion.x,
    qy: camera.quaternion.y,
    qz: camera.quaternion.z,
    qw: camera.quaternion.w,
    p0: projection[0] ?? Number.NaN,
    p5: projection[5] ?? Number.NaN,
    p10: projection[10] ?? Number.NaN,
    p14: projection[14] ?? Number.NaN,
  }
}

export const hasCameraPoseChanged = (
  previous: CameraPoseSnapshot,
  current: CameraPoseSnapshot,
): boolean =>
  previous.version !== current.version
  || previous.x !== current.x
  || previous.y !== current.y
  || previous.z !== current.z
  || previous.qx !== current.qx
  || previous.qy !== current.qy
  || previous.qz !== current.qz
  || previous.qw !== current.qw
  || previous.p0 !== current.p0
  || previous.p5 !== current.p5
  || previous.p10 !== current.p10
  || previous.p14 !== current.p14

export const advanceFixedStep = (
  accumulated: number,
  deltaTime: number,
  intervalSeconds: number,
): { readonly ticks: number; readonly remainder: number } => {
  const nextAccumulated = accumulated + deltaTime
  const ticks = Math.floor(nextAccumulated / intervalSeconds)

  return {
    ticks,
    remainder: nextAccumulated - ticks * intervalSeconds,
  }
}

const nextGraphicsQuality = (
  graphicsQuality: AdaptiveQualityInput['graphicsQuality'],
): 'low' | 'medium' | 'high' =>
  graphicsQuality === 'ultra'
    ? 'high'
    : graphicsQuality === 'high'
      ? 'medium'
      : 'low'

const noChange = (cooldown: number): AdaptiveQualityDecision =>
  ({ nextCooldown: cooldown, settingsPatch: Option.none() })

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

  if (fps <= 0 || fps >= ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD) {
    return noChange(cooldown)
  }

  if (graphicsQuality !== 'low') {
    return {
      nextCooldown: 20,
      settingsPatch: Option.some({ graphicsQuality: nextGraphicsQuality(graphicsQuality) }),
    }
  }

  // Lower view distance even while chunk sync is draining; waiting keeps cold-load
  // worlds stuck in the most expensive state for too long.
  if (renderDistance > 4) {
    return {
      nextCooldown: 20,
      settingsPatch: Option.some({ renderDistance: renderDistance - 1 }),
    }
  }

  return noChange(cooldown)
}
