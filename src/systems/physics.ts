import { Effect, pipe } from 'effect'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, GRAVITY, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { Clock, World } from '@/runtime/services'
import { toFloat } from '@/domain/common'
import { Position, Velocity } from '@/domain/components'

const applyGravity = (isGrounded: boolean, deltaTime: number) => (velocity: Velocity): Velocity => {
  if (isGrounded) {
    return new Velocity({ ...velocity, dy: toFloat(0) })
  }
  const newVelDY = Math.max(-TERMINAL_VELOCITY, velocity.dy - GRAVITY * deltaTime)
  return new Velocity({ ...velocity, dy: toFloat(newVelDY) })
}

const applyFriction = (isGrounded: boolean) => (velocity: Velocity): Velocity => {
  if (!isGrounded) {
    return velocity
  }
  return new Velocity({
    ...velocity,
    dx: toFloat(velocity.dx * FRICTION),
    dz: toFloat(velocity.dz * FRICTION),
  })
}

const updatePosition = (velocity: Velocity, deltaTime: number) => (position: Position): Position => {
  return new Position({
    x: toFloat(position.x + velocity.dx * deltaTime),
    y: toFloat(position.y + velocity.dy * deltaTime),
    z: toFloat(position.z + velocity.dz * deltaTime),
  })
}

export const physicsSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const clock = yield* $(Clock)
  const deltaTime = yield* $(clock.deltaTime)

  yield* $(
    Effect.when(
      () => deltaTime > 0,
      () => Effect.gen(function* ($) {
        const { entities, components } = yield* $(world.querySoA(physicsQuery))
        const { player, position, velocity } = components

        yield* $(
          Effect.forEach(
            entities,
            (entityId, i) =>
              Effect.gen(function* ($) {
                const currentPlayer = player[i]
                const currentPosition = position[i]
                const currentVelocity = velocity[i]

                const finalVelocity = pipe(
                  currentVelocity,
                  applyGravity(currentPlayer.isGrounded, deltaTime),
                  applyFriction(currentPlayer.isGrounded),
                )

                const newPosition = pipe(currentPosition, updatePosition(finalVelocity, deltaTime))

                yield* $(world.updateComponent(entityId, 'velocity', finalVelocity))
                yield* $(world.updateComponent(entityId, 'position', newPosition))
              }),
            { concurrency: 'inherit', discard: true },
          ),
        )
      }),
    ),
  )
})
