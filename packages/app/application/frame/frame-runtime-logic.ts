import * as THREE from 'three'
import { Option } from 'effect'

export type CameraPoseSnapshot = {
  readonly version: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly qx: number
  readonly qy: number
  readonly qz: number
  readonly qw: number
}

export type AdaptiveQualityInput = {
  readonly adaptivePerformanceMode: boolean
  readonly graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'
  readonly renderDistance: number
  readonly fps: number
  readonly cooldown: number
}

export type SettingsPatch = {
  readonly graphicsQuality?: 'low' | 'medium' | 'high'
  readonly renderDistance?: number
}

export type AdaptiveQualityDecision = {
  readonly nextCooldown: number
  readonly settingsPatch: Option.Option<SettingsPatch>
}

export const captureCameraPose = (camera: THREE.PerspectiveCamera, version: number): CameraPoseSnapshot => ({
  version,
  x: camera.position.x,
  y: camera.position.y,
  z: camera.position.z,
  qx: camera.quaternion.x,
  qy: camera.quaternion.y,
  qz: camera.quaternion.z,
  qw: camera.quaternion.w,
})

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

  if (fps <= 0 || fps >= 110) {
    return noChange(cooldown)
  }

  if (graphicsQuality !== 'low') {
    return {
      nextCooldown: 20,
      settingsPatch: Option.some({ graphicsQuality: nextGraphicsQuality(graphicsQuality) }),
    }
  }

  if (renderDistance > 4) {
    return {
      nextCooldown: 20,
      settingsPatch: Option.some({ renderDistance: renderDistance - 1 }),
    }
  }

  return noChange(cooldown)
}
