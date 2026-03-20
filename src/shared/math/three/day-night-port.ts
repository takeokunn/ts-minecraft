/**
 * Structural port for the scene lighting objects manipulated by the day/night cycle.
 * Duck-typed — no Three.js import required. Any Three.js objects satisfying this
 * shape will work, keeping the application layer free from rendering infrastructure.
 */

export interface ColorPort {
  r: number
  g: number
  b: number
  setHSL(h: number, s: number, l: number): void
  lerpColors(colorA: ColorPort, colorB: ColorPort, alpha: number): void
}

export interface LightTargetPort {
  readonly position: { set(x: number, y: number, z: number): void }
  updateMatrixWorld(): void
}

export interface LightPort {
  intensity: number
  castShadow: boolean
  readonly color: ColorPort
  readonly position: { set(x: number, y: number, z: number): void }
  readonly target: LightTargetPort
}

export interface AmbientLightPort {
  intensity: number
  readonly color: ColorPort
}

export interface RendererPort {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setClearColor(color: any): void
}

export interface SkyMaterialPort {
  readonly uniforms: {
    readonly sunPosition: { value: { set(x: number, y: number, z: number): void } }
    turbidity: { value: number }
    rayleigh: { value: number }
  }
}

export interface DayNightLightsPort {
  readonly light: LightPort
  readonly ambientLight: AmbientLightPort
  readonly renderer: RendererPort
  readonly skyNight: ColorPort
  readonly skyDay: ColorPort
  readonly skyCurrent: ColorPort
  readonly sky: SkyMaterialPort | null
}
