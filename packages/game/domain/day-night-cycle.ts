const DAWN_PHASE_OFFSET = 0.25   // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
const DIRECT_LIGHT_MIN = 0.3
const DIRECT_LIGHT_RANGE = 0.7
// Night ambient floor (raised again 0.42 → 0.56 on '夜が暗すぎる' feedback): combined with
// the terrain moonlight floor below this lifts the whole night closer to a bright-moonlit
// look while the cool-blue night tint + reduced directional light keep it reading as night.
const AMBIENT_LIGHT_MIN = 0.56
const AMBIENT_LIGHT_RANGE = 0.42
const SUN_DISTANCE = 50
const SUN_HEIGHT = 80
// Half-width (in sun-elevation units, sinSun ∈ [-1,1]) of the dawn/dusk twilight band
// over which daylight ramps between night and full day. Widened 0.18 → 0.30 (sun within
// ~17° of the horizon) so dusk/dawn last longer and night arrives gradually instead of
// snapping dark ('急に夜になる').
const TWILIGHT_BAND = 0.30

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep01 = (t: number): number => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

// Daylight factor 0..1 from the sun's elevation (sinSun): 0 deep night, 1 full day,
// smooth eased ramp through the twilight band. The SINGLE source of the day/night
// brightness curve — shared by the scene light intensities (below) AND the terrain/water
// shader sun-intensity (lighting-stage). Previously the terrain used its own raw
// `max(0, sin)` which dropped to 0 at night, so terrain darkened suddenly at dusk and
// went black at night regardless of this curve.
const daylightFromElevation = (sinSun: number): number =>
  smoothstep01((sinSun + TWILIGHT_BAND) / (2 * TWILIGHT_BAND))

export const computeDaylightFactor = (timeOfDay: number): number =>
  daylightFromElevation(Math.sin((timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2))

// Moonlight floor for the terrain/water shader: at night the sun-intensity never reaches 0,
// so block faces stay lit (readable) rather than black. Raised 0.30 → 0.45 on '夜が暗すぎる'
// feedback — a bright-moonlit night. 0 → full day maps to [floor, 1].
export const TERRAIN_NIGHT_LIGHT_FLOOR = 0.45
export const computeTerrainSunIntensity = (timeOfDay: number): number =>
  TERRAIN_NIGHT_LIGHT_FLOOR + (1 - TERRAIN_NIGHT_LIGHT_FLOOR) * computeDaylightFactor(timeOfDay)

export type DayNightCycleState = {
  sunAngle: number
  cosSun: number
  sinSun: number
  dayFactor: number
  horizonBlend: number
  moonElevation: number
  moonOpacity: number
}

export const resolveDayNightCycleState = (timeOfDay: number): DayNightCycleState => {
  const sunAngle = (timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2
  const cosSun = Math.cos(sunAngle)
  const sinSun = Math.sin(sunAngle)
  const dayFactor = daylightFromElevation(sinSun)
  const horizonBlend = 1.0 - dayFactor
  const moonElevation = -sinSun
  const moonOpacity = clamp01(moonElevation)

  return {
    sunAngle,
    cosSun,
    sinSun,
    dayFactor,
    horizonBlend,
    moonElevation,
    moonOpacity,
  }
}

export {
  AMBIENT_LIGHT_MIN,
  AMBIENT_LIGHT_RANGE,
  DAWN_PHASE_OFFSET,
  DIRECT_LIGHT_MIN,
  DIRECT_LIGHT_RANGE,
  SUN_DISTANCE,
  SUN_HEIGHT,
  TWILIGHT_BAND,
}
