import { Effect } from 'effect'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, GRAVITY, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { Clock, World } from '@/runtime/services'
import { Float } from '@/domain/common'
import { Player, Position, Velocity } from '@/domain/components'

const applyGravity = (velocity: Velocity, isGrounded: boolean, deltaTime: number): Velocity => {
  if (isGrounded) {
    return new Velocity({ ...velocity, dy: Float(0) })
  }
  const newVelDY = Math.max(-TERMINAL_VELOCITY, velocity.dy - GRAVITY * deltaTime)
  return new Velocity({ ...velocity, dy: Float(newVelDY) })
}

const applyFriction = (velocity: Velocity, isGrounded: boolean): Velocity => {
  if (!isGrounded) {
    return velocity
  }
  return new Velocity({
    ...velocity,
    dx: Float(velocity.dx * FRICTION),
    dz: Float(velocity.dz * FRICTION),
  })
}

const updatePosition = (position: Position, velocity: Velocity, deltaTime: number): Position => {
  return new Position({
    x: Float(position.x + velocity.dx * deltaTime),
    y: Float(position.y + velocity.dy * deltaTime),
    z: Float(position.z + velocity.dz * deltaTime),
  })
}

export const physicsSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const clock = yield* $(Clock)
  const deltaTime = yield* $(clock.deltaTime)

  if (deltaTime === 0) {
    return
  }

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

          const velocityAfterGravity = applyGravity(currentVelocity, currentPlayer.isGrounded, deltaTime)
          const finalVelocity = applyFriction(velocityAfterGravity, currentPlayer.isGrounded)
          const newPosition = updatePosition(currentPosition, finalVelocity, deltaTime)

          yield* $(world.updateComponent(entityId, 'velocity', finalVelocity))
          yield* $(world.updateComponent(entityId, 'position', newPosition))
        }),
      { concurrency: 'inherit' },
    ),
  )
})