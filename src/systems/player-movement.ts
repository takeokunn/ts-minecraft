import { Effect, Match, Option } from 'effect'
import { CameraState, InputState, Player, Velocity } from '@/domain/components'
import { playerMovementQuery } from '@/domain/queries'
import { DECELERATION, JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import { World } from '@/runtime/services'
import { Float, toFloat } from '@/domain/common'

export const calculateHorizontalVelocity = (
  input: Pick<InputState, 'forward' | 'backward' | 'left' | 'right' | 'sprint'>,
  camera: Pick<CameraState, 'yaw'>,
): { dx: Float; dz: Float } => {
  const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0)

  if (moveX === 0 && moveZ === 0) {
    return { dx: toFloat(0), dz: toFloat(0) }
  }

  // Normalize diagonal movement
  const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ)
  const normalizedX = (moveX / magnitude) * speed
  const normalizedZ = (moveZ / magnitude) * speed

  // Apply camera rotation
  const sinYaw = Math.sin(camera.yaw)
  const cosYaw = Math.cos(camera.yaw)
  const dx = toFloat(normalizedX * cosYaw - normalizedZ * sinYaw)
  const dz = toFloat(normalizedX * sinYaw + normalizedZ * cosYaw)

  return { dx, dz }
}

export const calculateVerticalVelocity = (
  isGrounded: boolean,
  jumpPressed: boolean,
  currentDy: Float,
): { newDy: Float; newIsGrounded: boolean } => {
  if (jumpPressed && isGrounded) {
    return { newDy: JUMP_FORCE, newIsGrounded: false }
  }
  return { newDy: currentDy, newIsGrounded: isGrounded }
}

const clampToZero = (value: number): Float => {
  if (!Number.isFinite(value)) {
    return toFloat(0)
  }
  return toFloat(Math.abs(value) < MIN_VELOCITY_THRESHOLD ? 0 : value)
}

export const applyDeceleration = (velocity: Pick<Velocity, 'dx' | 'dz'>): Pick<Velocity, 'dx' | 'dz'> => {
  const dx = clampToZero(velocity.dx * DECELERATION)
  const dz = clampToZero(velocity.dz * DECELERATION)
  return { dx, dz }
}

export const playerMovementSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const { entities, components } = yield* $(world.querySoA(playerMovementQuery))
  const { player, inputState, velocity, cameraState } = components

  yield* $(
    Effect.forEach(
      entities,
      (entityId, i) =>
        Effect.gen(function* ($) {
          const currentPlayer = player[i]
          const currentInputState = inputState[i]
          const currentVelocity = velocity[i]
          const currentCameraState = cameraState[i]

          const { newDy, newIsGrounded } = calculateVerticalVelocity(
            currentPlayer.isGrounded,
            currentInputState.jump,
            currentVelocity.dy,
          )

          const hasHorizontalInput =
            currentInputState.forward ||
            currentInputState.backward ||
            currentInputState.left ||
            currentInputState.right

          const { dx, dz } = Match.value(hasHorizontalInput).pipe(
            Match.when(true, () => calculateHorizontalVelocity(currentInputState, currentCameraState)),
            Match.orElse(() => applyDeceleration(currentVelocity)),
          )

          yield* $(world.updateComponent(entityId, 'velocity', new Velocity({ dx, dy: newDy, dz })))
          yield* $(world.updateComponent(entityId, 'player', new Player({ isGrounded: newIsGrounded })))
        }),
      { concurrency: 'inherit', discard: true },
    ),
  )
})
