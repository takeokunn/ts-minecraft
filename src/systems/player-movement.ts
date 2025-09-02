import { Effect } from 'effect'
import { match } from 'ts-pattern'
import { CameraState, InputState, Velocity } from '@/domain/components'
import { playerMovementQuery } from '@/domain/queries'
import { DECELERATION, JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import { World } from '@/runtime/world'

export const calculateHorizontalVelocity = (
  input: Pick<InputState, 'forward' | 'backward' | 'left' | 'right' | 'sprint'>,
  camera: Pick<CameraState, 'yaw'>,
): { dx: number; dz: number } => {
  const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
  let moveX = 0
  let moveZ = 0

  if (input.forward) moveZ -= 1
  if (input.backward) moveZ += 1
  if (input.left) moveX -= 1
  if (input.right) moveX += 1

  if (moveX === 0 && moveZ === 0) {
    return { dx: 0, dz: 0 }
  }

  // Normalize diagonal movement
  const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ)
  moveX = (moveX / magnitude) * speed
  moveZ = (moveZ / magnitude) * speed

  // Apply camera rotation
  const sinYaw = Math.sin(camera.yaw)
  const cosYaw = Math.cos(camera.yaw)
  const dx = moveX * cosYaw - moveZ * sinYaw
  const dz = moveX * sinYaw + moveZ * cosYaw

  return { dx, dz }
}

export const calculateVerticalVelocity = (isGrounded: boolean, jumpPressed: boolean, currentDy: number): { newDy: number; newIsGrounded: boolean } => {
  if (jumpPressed && isGrounded) {
    return { newDy: JUMP_FORCE, newIsGrounded: false }
  }
  return { newDy: currentDy, newIsGrounded: isGrounded }
}

export const applyDeceleration = (velocity: Pick<Velocity, 'dx' | 'dz'>): Pick<Velocity, 'dx' | 'dz'> => {
  let { dx, dz } = velocity
  dx *= DECELERATION
  dz *= DECELERATION

  if (Math.abs(dx) < MIN_VELOCITY_THRESHOLD) dx = 0
  if (Math.abs(dz) < MIN_VELOCITY_THRESHOLD) dz = 0

  return { dx, dz }
}

export const playerMovementSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const players = yield* _(world.query(playerMovementQuery))

  yield* _(
    Effect.forEach(
      players,
      (p) =>
        Effect.gen(function* (_) {
          const { entityId, player, inputState, velocity, cameraState } = p
          const { isGrounded } = player
          const { jump: jumpPressed, forward, backward, left, right, sprint } = inputState
          const { dy: currentDy, dx: currentDx, dz: currentDz } = velocity
          const { yaw } = cameraState

          const { newDy, newIsGrounded } = calculateVerticalVelocity(isGrounded, jumpPressed, currentDy)

          const hasHorizontalInput = forward || backward || left || right

          const { dx, dz } = match(hasHorizontalInput)
            .with(true, () =>
              calculateHorizontalVelocity(
                {
                  forward,
                  backward,
                  left,
                  right,
                  sprint,
                },
                { yaw },
              ),
            )
            .otherwise(() => applyDeceleration({ dx: currentDx, dz: currentDz }))

          yield* _(
            world.updateComponent(entityId, 'velocity', {
              ...velocity,
              dx,
              dy: newDy,
              dz,
            }),
          )
          yield* _(world.updateComponent(entityId, 'player', { ...player, isGrounded: newIsGrounded }))
        }),
      { discard: true },
    ),
  )
})
