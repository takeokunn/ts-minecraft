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

  const { entities, position, velocity, gravity, player } = yield* _(world.querySoA(physicsQuery))

  for (let i = 0; i < entities.length; i++) {
    const isGrounded = player.isGrounded[i]
    const dy = velocity.dy[i]
    const grav = gravity.value[i]
    const dx = velocity.dx[i]
    const dz = velocity.dz[i]
    const posX = position.x[i]
    const posY = position.y[i]
    const posZ = position.z[i]

    if (
      isGrounded === undefined ||
      dy === undefined ||
      grav === undefined ||
      dx === undefined ||
      dz === undefined ||
      posX === undefined ||
      posY === undefined ||
      posZ === undefined
    ) {
      continue
    }

    // Apply gravity
    const newDy = isGrounded ? dy : Math.max(-TERMINAL_VELOCITY, dy - grav * deltaTime)

    // Apply friction
    let newDx = dx
    let newDz = dz
    if (isGrounded) {
      newDx *= FRICTION
      newDz *= FRICTION
    }

    // Update velocity component store
    velocity.dx[i] = newDx
    velocity.dy[i] = newDy
    velocity.dz[i] = newDz

    // Update position
    position.x[i] = posX + newDx * deltaTime
    position.y[i] = posY + newDy * deltaTime
    position.z[i] = posZ + newDz * deltaTime
  }
})
