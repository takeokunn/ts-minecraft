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
  fromThreeVector,
  toThreeVector,
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
  fromThreeQuaternion,
  toThreeQuaternion,
  fromAxisAngle,
  multiply,
  slerp,
} from './quaternion'

export type { Quaternion } from './quaternion'

// Matrix4
export {
  identity as matrix4Identity,
  fromThreeMatrix4,
  toThreeMatrix4,
} from './matrix4'

export type { Matrix4 } from './matrix4'

// Color
export { ColorSchema, makeColor, fromHex, toThreeColor } from './color'
export type { Color } from './color'
