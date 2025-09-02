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
  const { entities, player, inputState, velocity, cameraState } = yield* _(world.querySoA(playerMovementQuery))

  for (let i = 0; i < entities.length; i++) {
    const isGrounded = player.isGrounded[i]
    const jumpPressed = inputState.jump[i]
    const currentDy = velocity.dy[i]
    const forward = inputState.forward[i]
    const backward = inputState.backward[i]
    const left = inputState.left[i]
    const right = inputState.right[i]
    const sprint = inputState.sprint[i]
    const yaw = cameraState.yaw[i]
    const currentDx = velocity.dx[i]
    const currentDz = velocity.dz[i]

    if (
      isGrounded === undefined ||
      jumpPressed === undefined ||
      currentDy === undefined ||
      forward === undefined ||
      backward === undefined ||
      left === undefined ||
      right === undefined ||
      sprint === undefined ||
      yaw === undefined ||
      currentDx === undefined ||
      currentDz === undefined
    ) {
      continue
    }

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

    velocity.dx[i] = dx
    velocity.dy[i] = newDy
    velocity.dz[i] = dz
    player.isGrounded[i] = newIsGrounded
  }
})
