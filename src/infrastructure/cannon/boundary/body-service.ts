import { Effect } from 'effect'
import * as CANNON from 'cannon-es'
import type { Vector3, Quaternion } from '@/infrastructure/cannon/core'

export type RigidBodyConfig = {
  readonly mass: number
  readonly position: Vector3
  readonly quaternion: Quaternion
  readonly type?: 'dynamic' | 'static' | 'kinematic'
}

export class RigidBodyService extends Effect.Service<RigidBodyService>()(
  '@minecraft/infrastructure/cannon/RigidBodyService',
  {
    succeed: {
      create: (config: RigidBodyConfig): Effect.Effect<CANNON.Body, never> =>
        Effect.sync(() => {
          const body = new CANNON.Body({
            mass: config.mass,
            position: new CANNON.Vec3(config.position.x, config.position.y, config.position.z),
            quaternion: new CANNON.Quaternion(
              config.quaternion.x,
              config.quaternion.y,
              config.quaternion.z,
              config.quaternion.w,
            ),
          })
          if (config.type === 'static') {
            body.type = CANNON.Body.STATIC
          } else if (config.type === 'kinematic') {
            body.type = CANNON.Body.KINEMATIC
          }
          return body
        }),
      setPosition: (body: CANNON.Body, position: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.position.set(position.x, position.y, position.z)
        }),
      setQuaternion: (body: CANNON.Body, quaternion: Quaternion): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
        }),
      setVelocity: (body: CANNON.Body, velocity: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.velocity.set(velocity.x, velocity.y, velocity.z)
        }),
      setAngularVelocity: (body: CANNON.Body, angularVelocity: Vector3): Effect.Effect<void, never> =>
        Effect.sync(() => {
          body.angularVelocity.set(angularVelocity.x, angularVelocity.y, angularVelocity.z)
        }),
      addShape: (body: CANNON.Body, shape: CANNON.Shape): Effect.Effect<void, never> =>
        Effect.sync(() => body.addShape(shape)),
      updateMassProperties: (body: CANNON.Body): Effect.Effect<void, never> =>
        Effect.sync(() => body.updateMassProperties()),
    },
  }
) {}
export { RigidBodyService as RigidBodyServiceLive }
