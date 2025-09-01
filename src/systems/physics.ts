import { Effect, Option, pipe } from 'effect'
import { Position, setPosition, setVelocity, Velocity } from '@/domain/components'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, GRAVITY, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { DeltaTime, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

export const integrate = (position: Position, velocity: Velocity, isGrounded: boolean, deltaTime: number, gravity: number): { newPosition: Position; newVelocity: Velocity } => {
  let newVelocity = { ...velocity }

  if (!isGrounded) {
    const dy = Math.max(-TERMINAL_VELOCITY, newVelocity.dy - gravity * deltaTime)
    newVelocity = setVelocity(newVelocity, { dy })
  }

  if (isGrounded) {
    newVelocity = setVelocity(newVelocity, {
      dx: newVelocity.dx * FRICTION,
      dz: newVelocity.dz * FRICTION,
    })
  }

  const newPosition = setPosition(position, {
    x: position.x + newVelocity.dx * deltaTime,
    y: position.y + newVelocity.dy * deltaTime,
    z: position.z + newVelocity.dz * deltaTime,
  })

  return { newPosition, newVelocity }
}

export const physicsSystem: System = Effect.gen(function* () {
  const world = yield* World
  const deltaTime = yield* DeltaTime

  if (deltaTime === 0) {
    return
  }

  const entities = yield* world.query(physicsQuery)

  yield* Effect.forEach(
    entities,
    (entity) =>
      Effect.gen(function* () {
        const { entityId, position, velocity } = entity
        const isGrounded = yield* pipe(
          world.getComponent(entityId, 'player'),
          Effect.map(Option.map((p) => p.isGrounded)),
          Effect.map(Option.getOrElse(() => false)),
        )

        const { newPosition, newVelocity } = integrate(position, velocity, isGrounded, deltaTime, GRAVITY)

        yield* world.updateComponent(entityId, 'position', newPosition)
        yield* world.updateComponent(entityId, 'velocity', newVelocity)
      }),
    { discard: true },
  )
})