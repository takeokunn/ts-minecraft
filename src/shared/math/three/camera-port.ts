/**
 * Minimal duck-typed interface for a 3D camera that supports rotation mutation.
 * Satisfied structurally by THREE.PerspectiveCamera and any compatible mock.
 */
import { Schema } from 'effect'
import type { EulerOrder } from 'three'

type CameraRotationSet = (x: number, y: number, z: number, order?: EulerOrder) => void

export const CameraRotationPortSchema = Schema.mutable(Schema.Struct({
  rotation: Schema.Struct({
    set: Schema.declare((u): u is CameraRotationSet => typeof u === 'function'),
  }),
}))

export type CameraRotationPort = Schema.Schema.Type<typeof CameraRotationPortSchema>
