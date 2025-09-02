import { Effect } from 'effect'
import { physicsQuery } from '@/domain/queries'
import { FRICTION, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { DeltaTime } from '@/runtime/services'
import * as World from '@/domain/world'

export const physicsSystem = Effect.gen(function* ($) {
  const deltaTime = yield* $(DeltaTime)

  if (deltaTime === 0) {
    return
  }

  const soa = yield* $(World.querySoA(physicsQuery))

  for (let i = 0; i < soa.entities.length; i++) {
    // Apply gravity
    const newVelDY = soa.player.isGrounded[i]
      ? 0
      : Math.max(-TERMINAL_VELOCITY, soa.velocity.dy[i]! - soa.gravity.value[i]! * deltaTime)

    // Apply friction
    let newVelDX = soa.velocity.dx[i]!
    let newVelDZ = soa.velocity.dz[i]!
    if (soa.player.isGrounded[i]) {
      newVelDX *= FRICTION
      newVelDZ *= FRICTION
    }

    // Update velocity component
    soa.velocity.dx[i] = newVelDX
    soa.velocity.dy[i] = newVelDY
    soa.velocity.dz[i] = newVelDZ

    // Update position component
    soa.position.x[i]! += newVelDX * deltaTime
    soa.position.y[i]! += newVelDY * deltaTime
    soa.position.z[i]! += newVelDZ * deltaTime
  }
})
