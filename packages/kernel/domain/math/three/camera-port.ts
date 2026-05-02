/**
 * Minimal duck-typed interface for a 3D camera that supports rotation mutation.
 * Satisfied structurally by THREE.PerspectiveCamera and any compatible mock.
 */
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

/**
 * Extended camera port that also exposes position mutation and lookAt.
 * Satisfied structurally by THREE.PerspectiveCamera. Used by third-person
 * camera service which needs to relocate the camera and orient it toward the player.
 */
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
