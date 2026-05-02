// Duck-typed: satisfied structurally by THREE.PerspectiveCamera and any compatible mock.
import { Schema } from 'effect'
import type { EulerOrder } from 'three'

type CameraRotationSet = (x: number, y: number, z: number, order?: EulerOrder) => void
type CameraVec3Set = (x: number, y: number, z: number) => void
type CameraLookAt = (x: number, y: number, z: number) => void

export const CameraRotationPortSchema = Schema.mutable(Schema.Struct({
  rotation: Schema.Struct({
    set: Schema.declare((u): u is CameraRotationSet => typeof u === 'function'),
  }),
}))

export type CameraRotationPort = Schema.Schema.Type<typeof CameraRotationPortSchema>

// Extended port with position + lookAt; used by third-person camera to relocate and orient.
export const CameraTransformPortSchema = Schema.mutable(Schema.Struct({
  rotation: Schema.Struct({
    set: Schema.declare((u): u is CameraRotationSet => typeof u === 'function'),
  }),
  position: Schema.Struct({
    set: Schema.declare((u): u is CameraVec3Set => typeof u === 'function'),
  }),
  lookAt: Schema.declare((u): u is CameraLookAt => typeof u === 'function'),
}))

export type CameraTransformPort = Schema.Schema.Type<typeof CameraTransformPortSchema>
