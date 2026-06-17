// Structural port for the scene lighting objects manipulated by the day/night cycle.
// Duck-typed — no Three.js import required. Any Three.js objects satisfying this
// shape will work, keeping the application layer free from rendering infrastructure.
import { Option, Schema } from 'effect'
export { Option }

type Vec3Set = (x: number, y: number, z: number) => void
type ClearColor = (color: ColorPort) => void
type UpdateMatrixWorld = () => void
type UpdateProjectionMatrix = () => void
type SkyUniformSet = (x: number, y: number, z: number) => void
type MoonPhaseSetPosition = (x: number, y: number, z: number) => void
type MoonPhaseSetPhase = (phase: number) => void
type MoonPhaseSetVisible = (visible: boolean) => void
type MoonPhaseSetOpacity = (opacity: number) => void
export type ColorPort = {
  readonly r: number
  readonly g: number
  readonly b: number
  setHSL(h: number, s: number, l: number, colorSpace?: string): unknown
  lerpColors(color1: ColorPort, color2: ColorPort, alpha: number): unknown
}

const hasFunctionProperty = <K extends PropertyKey>(value: object, key: K): value is Record<K, (...args: ReadonlyArray<unknown>) => unknown> =>
  key in value && typeof Reflect.get(value, key) === 'function'

const hasNumberProperty = (value: object, key: PropertyKey): boolean =>
  key in value && typeof Reflect.get(value, key) === 'number'

export const ColorPortSchema = Schema.declare(
  (u): u is ColorPort =>
    typeof u === 'object' &&
    u !== null &&
    hasNumberProperty(u, 'r') &&
    hasNumberProperty(u, 'g') &&
    hasNumberProperty(u, 'b') &&
    hasFunctionProperty(u, 'setHSL') &&
    hasFunctionProperty(u, 'lerpColors')
)

export const LightTargetPortSchema = Schema.mutable(Schema.Struct({
  position: Schema.Struct({
    set: Schema.declare((u): u is Vec3Set => typeof u === 'function'),
  }),
  updateMatrixWorld: Schema.declare((u): u is UpdateMatrixWorld => typeof u === 'function'),
}))

export type LightTargetPort = Schema.Schema.Type<typeof LightTargetPortSchema>

export const LightPortSchema = Schema.mutable(Schema.Struct({
  intensity: Schema.Number,
  castShadow: Schema.Boolean,
  color: ColorPortSchema,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
    set: Schema.declare((u): u is Vec3Set => typeof u === 'function'),
  }),
  target: LightTargetPortSchema,
  shadow: Schema.mutable(Schema.Struct({
    camera: Schema.mutable(Schema.Struct({
      far: Schema.Number,
      left: Schema.Number,
      right: Schema.Number,
      top: Schema.Number,
      bottom: Schema.Number,
      updateProjectionMatrix: Schema.declare((u): u is UpdateProjectionMatrix => typeof u === 'function'),
    })),
  })),
}))

export type LightPort = Schema.Schema.Type<typeof LightPortSchema>

export const AmbientLightPortSchema = Schema.mutable(Schema.Struct({
  intensity: Schema.Number,
  color: ColorPortSchema,
}))

export type AmbientLightPort = Schema.Schema.Type<typeof AmbientLightPortSchema>

export const RendererPortSchema = Schema.mutable(Schema.Struct({
  setClearColor: Schema.declare((u): u is ClearColor => typeof u === 'function'),
}))

export type RendererPort = Schema.Schema.Type<typeof RendererPortSchema>

export const SkyMaterialPortSchema = Schema.mutable(Schema.Struct({
  uniforms: Schema.mutable(Schema.Struct({
    sunPosition: Schema.mutable(Schema.Struct({
      value: Schema.mutable(Schema.Struct({
        set: Schema.declare((u): u is SkyUniformSet => typeof u === 'function'),
      })),
    })),
    turbidity: Schema.mutable(Schema.Struct({
      value: Schema.Number,
    })),
    rayleigh: Schema.mutable(Schema.Struct({
      value: Schema.Number,
    })),
  })),
}))

export type SkyMaterialPort = Schema.Schema.Type<typeof SkyMaterialPortSchema>

export const MoonPhasePortSchema = Schema.mutable(Schema.Struct({
  setPosition: Schema.declare((u): u is MoonPhaseSetPosition => typeof u === 'function'),
  setPhase: Schema.declare((u): u is MoonPhaseSetPhase => typeof u === 'function'),
  setVisible: Schema.declare((u): u is MoonPhaseSetVisible => typeof u === 'function'),
  setOpacity: Schema.declare((u): u is MoonPhaseSetOpacity => typeof u === 'function'),
}))

export type MoonPhasePort = Schema.Schema.Type<typeof MoonPhasePortSchema>

const DayNightLightsPortSchemaBase = Schema.mutable(Schema.Struct({
  light: LightPortSchema,
  ambientLight: AmbientLightPortSchema,
  renderer: RendererPortSchema,
  skyNight: ColorPortSchema,
  skyDay: ColorPortSchema,
  skyCurrent: ColorPortSchema,
  sky: Schema.declare((u): u is Option.Option<SkyMaterialPort> => {
  /* c8 ignore start -- Schema.declare validator is invoked by the Effect Schema runtime during decode/is checks; not directly unit testable */
  if (!Option.isOption(u)) return false
  const val = Option.getOrNull(u)
  return val === null || Schema.is(SkyMaterialPortSchema)(val)
  /* c8 ignore end */
}),
  moon: Schema.declare((u): u is Option.Option<MoonPhasePort> => {
  /* c8 ignore start -- Schema.declare validator is invoked by the Effect Schema runtime during decode/is checks; not directly unit testable */
  if (!Option.isOption(u)) return false
  const val = Option.getOrNull(u)
  return val === null || Schema.is(MoonPhasePortSchema)(val)
  /* c8 ignore end */
}),
}))

export const DayNightLightsPortSchema = DayNightLightsPortSchemaBase

type DayNightLightsPortBase = Schema.Schema.Type<typeof DayNightLightsPortSchemaBase>

export type DayNightLightsPort = Omit<DayNightLightsPortBase, 'sky' | 'moon'> & {
  readonly sky: Option.Option<SkyMaterialPort>
  readonly moon: Option.Option<MoonPhasePort>
}
