// Vector3
export {
  Vector3Schema,
  makeVector3,
  zero,
  one,
  up,
  down,
  left,
  right,
  forward,
  backward,
  add,
  subtract,
  scale,
  dot,
  cross,
  length,
  lengthSquared,
  normalize,
  distance,
  toJSON,
  fromJSON,
} from './vector3'

export type { Vector3 } from './vector3'

// Quaternion
export {
  QuaternionSchema,
  identity,
  makeQuaternion,
  fromAxisAngle,
  multiply,
  slerp,
} from './quaternion'

export type { Quaternion } from './quaternion'

// Color
export { ColorSchema, makeColor, fromHex } from './color'
export type { Color } from './color'

// Camera port
export type { CameraRotationPort, CameraTransformPort } from './camera-port'

// Day/night port
export { SkyMaterialPortSchema, MoonPhasePortSchema, DayNightLightsPortSchema, Option } from './day-night-port'
export type { DayNightLightsPort, LightPort, LightTargetPort, AmbientLightPort, ColorPort, RendererPort, SkyMaterialPort, MoonPhasePort } from './day-night-port'
