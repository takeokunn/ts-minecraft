import { Brand, Schema } from 'effect'
import { CameraDistance } from './index'

/**
 * CameraDistance Brand型用Schema
 */
export const CameraDistanceSchema = Schema.Number.pipe(
  Schema.between(1, 50),
  Schema.fromBrand(Brand.nominal<CameraDistance>())
)

/**
 * FirstPersonSettings Schema
 */
export const FirstPersonSettingsSchema = Schema.Struct({
  bobbing: Schema.Boolean,
  mouseSensitivity: Schema.Number.pipe(Schema.between(0.1, 5.0)),
  smoothing: Schema.Number.pipe(Schema.between(0, 1)),
  headOffset: Schema.Number.pipe(Schema.between(-2, 2)),
})

/**
 * ThirdPersonSettings Schema
 */
export const ThirdPersonSettingsSchema = Schema.Struct({
  mouseSensitivity: Schema.Number.pipe(Schema.between(0.1, 5.0)),
  smoothing: Schema.Number.pipe(Schema.between(0, 1)),
  distance: Schema.Number.pipe(Schema.between(1.0, 50.0)),
  verticalOffset: Schema.Number.pipe(Schema.between(-10, 10)),
  collisionEnabled: Schema.Boolean,
})

/**
 * SpectatorSettings Schema
 */
export const SpectatorSettingsSchema = Schema.Struct({
  movementSpeed: Schema.Number.pipe(Schema.between(0.1, 10)),
  mouseSensitivity: Schema.Number.pipe(Schema.between(0.1, 5.0)),
  freefly: Schema.Boolean,
  nightVision: Schema.Boolean,
})

/**
 * CinematicSettings Schema
 */
export const CinematicSettingsSchema = Schema.Struct({
  easing: Schema.Boolean,
  duration: Schema.Number.pipe(Schema.positive()),
  interpolation: Schema.Literal('linear', 'smooth', 'bezier'),
  lockInput: Schema.Boolean,
})

/**
 * AnimationKeyframe Schema
 */
export const AnimationKeyframeSchema = Schema.Struct({
  time: Schema.Number.pipe(Schema.nonNegative()),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  rotation: Schema.Struct({
    pitch: Schema.Number.pipe(Schema.between(-Math.PI / 2, Math.PI / 2)),
    yaw: Schema.Number,
  }),
  easing: Schema.Literal('linear', 'ease-in', 'ease-out', 'ease-in-out'),
})

/**
 * AnimationTimeline Schema
 */
export const AnimationTimelineSchema = Schema.Struct({
  keyframes: Schema.Array(AnimationKeyframeSchema),
  duration: Schema.Number.pipe(Schema.positive()),
  loop: Schema.Boolean,
})

/**
 * ViewMode Schema - Unionを使用
 */
const FirstPersonViewMode = Schema.Struct({
  _tag: Schema.Literal('FirstPerson'),
  settings: FirstPersonSettingsSchema,
})

const ThirdPersonViewMode = Schema.Struct({
  _tag: Schema.Literal('ThirdPerson'),
  settings: ThirdPersonSettingsSchema,
  distance: CameraDistanceSchema,
})

const SpectatorViewMode = Schema.Struct({
  _tag: Schema.Literal('Spectator'),
  settings: SpectatorSettingsSchema,
})

const CinematicViewMode = Schema.Struct({
  _tag: Schema.Literal('Cinematic'),
  settings: CinematicSettingsSchema,
  timeline: AnimationTimelineSchema,
})

export const ViewModeSchema = Schema.Union(
  FirstPersonViewMode,
  ThirdPersonViewMode,
  SpectatorViewMode,
  CinematicViewMode
)
