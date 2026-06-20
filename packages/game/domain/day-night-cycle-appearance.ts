import type { DayNightCycleState } from './day-night-cycle'
import { AMBIENT_LIGHT_MIN, AMBIENT_LIGHT_RANGE, DIRECT_LIGHT_MIN, DIRECT_LIGHT_RANGE, SUN_DISTANCE, SUN_HEIGHT } from './day-night-cycle'

const SKY_TURBIDITY_DAY = 2
const SKY_TURBIDITY_HORIZON = 4
const SKY_RAYLEIGH_DAY = 3
const SKY_RAYLEIGH_NIGHT = 0.5

export type Vector3Like = {
  x: number
  y: number
  z: number
}

export type HslColor = {
  h: number
  s: number
  l: number
}

export type DayNightCycleAppearance = {
  directionalLightIntensity: number
  ambientLightIntensity: number
  directionalLightColor: HslColor
  ambientLightColor: HslColor
  lightPosition: Vector3Like
  skySunPosition: Vector3Like
  skyTurbidity: number
  skyRayleigh: number
  moonPosition: Vector3Like
  moonOpacity: number
  moonVisible: boolean
}

export const resolveDayNightCycleAppearance = (state: DayNightCycleState): DayNightCycleAppearance => {
  const directionalLightIntensity = DIRECT_LIGHT_MIN + state.dayFactor * DIRECT_LIGHT_RANGE
  const ambientLightIntensity = AMBIENT_LIGHT_MIN + state.dayFactor * AMBIENT_LIGHT_RANGE
  const directionalLightColor = {
    h: Math.max(0, 0.06 - state.horizonBlend * 0.08),
    s: state.horizonBlend * 0.9,
    l: 0.5 + state.dayFactor * 0.5,
  }
  const ambientLightColor = state.dayFactor < 0.1
    ? { h: 0.6, s: 0.35, l: 0.42 }
    : { h: 0.06, s: state.horizonBlend * 0.3, l: 0.5 + state.dayFactor * 0.3 }

  return {
    directionalLightIntensity,
    ambientLightIntensity,
    directionalLightColor,
    ambientLightColor,
    lightPosition: {
      x: state.cosSun * SUN_DISTANCE,
      y: state.sinSun * SUN_HEIGHT,
      z: 0,
    },
    skySunPosition: {
      x: state.cosSun * SUN_DISTANCE,
      y: state.sinSun * SUN_HEIGHT,
      z: 0,
    },
    skyTurbidity: SKY_TURBIDITY_DAY + (1 - state.dayFactor) * (SKY_TURBIDITY_HORIZON - SKY_TURBIDITY_DAY),
    skyRayleigh: SKY_RAYLEIGH_NIGHT + state.dayFactor * (SKY_RAYLEIGH_DAY - SKY_RAYLEIGH_NIGHT),
    moonPosition: {
      x: -state.cosSun * SUN_DISTANCE,
      y: state.moonElevation * SUN_HEIGHT,
      z: 0,
    },
    moonOpacity: state.moonOpacity,
    moonVisible: state.moonOpacity > 0.02,
  }
}
