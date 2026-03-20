import { Effect } from 'effect'
import * as THREE from 'three'
import { TimeService } from '@/application/time/time-service'
import type { DeltaTimeSecs } from '@/shared/kernel'

const DAWN_PHASE_OFFSET = 0.25   // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
const DIRECT_LIGHT_MIN = 0.2
const DIRECT_LIGHT_RANGE = 0.8
const AMBIENT_LIGHT_MIN = 0.1
const AMBIENT_LIGHT_RANGE = 0.4
const SUN_DISTANCE = 50
const SUN_HEIGHT = 80

/**
 * Intentional plain interface: THREE.DirectionalLight, AmbientLight, and WebGLRenderer
 * are class instances — Schema.instanceOf is not applicable for function parameter shapes
 * that mix non-serializable Three.js objects with primitive values.
 */
export interface DayNightLights {
  readonly light: THREE.DirectionalLight
  readonly ambientLight: THREE.AmbientLight
  readonly renderer: { setClearColor: (color: THREE.Color) => void }
  readonly skyNight: THREE.Color
  readonly skyDay: THREE.Color
  readonly skyCurrent: THREE.Color
}

export const updateDayNightCycle = (
  deltaTime: DeltaTimeSecs,
  lights: DayNightLights,
  timeService: InstanceType<typeof TimeService>,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* timeService.advanceTick(deltaTime)
    const timeOfDay = yield* timeService.getTimeOfDay()

    // Sun arc: 0.25=dawn, 0.5=noon, 0.75=dusk, 0.0/1.0=midnight
    // sin peaks at noon (0.5), zero at dawn/dusk, negative at night → clamp to 0
    const dayFactor = Math.max(0, Math.sin((timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2))

    // Directional light follows a horizontal arc east→west
    const sunAngle = (timeOfDay - DAWN_PHASE_OFFSET) * Math.PI  // 0 at dawn, π at dusk
    lights.light.intensity = DIRECT_LIGHT_MIN + dayFactor * DIRECT_LIGHT_RANGE
    lights.light.position.set(Math.cos(sunAngle) * SUN_DISTANCE, Math.sin(sunAngle) * SUN_HEIGHT, 0)

    // Ambient light dims at night
    lights.ambientLight.intensity = AMBIENT_LIGHT_MIN + dayFactor * AMBIENT_LIGHT_RANGE

    // Sky background: lerp between night (dark blue) and day (sky blue)
    lights.skyCurrent.lerpColors(lights.skyNight, lights.skyDay, dayFactor)
    lights.renderer.setClearColor(lights.skyCurrent)
  })
