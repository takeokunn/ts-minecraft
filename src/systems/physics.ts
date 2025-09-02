import { Effect } from 'effect'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { DeltaTime } from '@/runtime/services'
import { World } from '@/runtime/world'

export const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const deltaTime = yield* _(DeltaTime)

  if (deltaTime === 0) {
    return
  }

  const entities = yield* _(world.query(physicsQuery))

  yield* _(
    Effect.forEach(
      entities,
      (entity) =>
        Effect.gen(function* (_) {
          const {
            entityId,
            player: { isGrounded },
            position,
            velocity,
            gravity,
          } = entity

          // Apply gravity
          const newDy = isGrounded ? velocity.dy : Math.max(-TERMINAL_VELOCITY, velocity.dy - gravity.value * deltaTime)

          // Apply friction
          let newDx = velocity.dx
          let newDz = velocity.dz
          if (isGrounded) {
            newDx *= FRICTION
            newDz *= FRICTION
          }

          // Update velocity component
          yield* _(
            world.updateComponent(entityId, 'velocity', {
              ...velocity,
              dx: newDx,
              dy: newDy,
              dz: newDz,
            }),
          )

          // Update position
          yield* _(
            world.updateComponent(entityId, 'position', {
              ...position,
              x: position.x + newDx * deltaTime,
              y: position.y + newDy * deltaTime,
              z: position.z + newDz * deltaTime,
            }),
          )
        }),
      { discard: true },
    ),
  )
})
