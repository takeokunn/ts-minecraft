import { Effect } from 'effect'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { DeltaTime } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

export const physicsSystem = Effect.gen(function* ($) {
  const deltaTime = yield* $(DeltaTime)

  if (deltaTime === 0) {
    return
  }

  const entities = yield* $(World.query(physicsQuery))

  yield* $(
    Effect.forEach(
      entities,
      (entity) => {
        const { entityId, player, position, velocity, gravity } = entity

        // Apply gravity
        const newVelDY = player.isGrounded ? 0 : Math.max(-TERMINAL_VELOCITY, velocity.dy - gravity.value * deltaTime)

        // Apply friction
        let newVelDX = velocity.dx
        let newVelDZ = velocity.dz
        if (player.isGrounded) {
          newVelDX *= FRICTION
          newVelDZ *= FRICTION
        }

        // Update position
        const newPosX = position.x + newVelDX * deltaTime
        const newPosY = position.y + newVelDY * deltaTime
        const newPosZ = position.z + newVelDZ * deltaTime

        return Effect.all(
          [
            World.updateComponent(entityId, 'velocity', { dx: newVelDX, dy: newVelDY, dz: newVelDZ }),
            World.updateComponent(entityId, 'position', { x: newPosX, y: newPosY, z: newPosZ }),
          ],
          { discard: true },
        )
      },
      { discard: true, concurrency: 'unbounded' },
    ),
    Effect.catchAllCause((cause) => Effect.logError('An error occurred in physicsSystem', cause)),
  )
})