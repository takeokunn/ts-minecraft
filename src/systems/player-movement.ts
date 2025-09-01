import { Effect } from 'effect'
import { match } from 'ts-pattern'
import { CameraState, InputState, setPlayerGrounded, setVelocity, Velocity } from '@/domain/components'
import { playerMovementQuery } from '@/domain/queries'
import { DECELERATION, JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import { System } from '@/runtime/loop'
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

export const playerMovementSystem: System = Effect.gen(function* () {
  const world = yield* World
  const players = yield* world.query(playerMovementQuery)

  yield* Effect.forEach(
    players,
    (entity) =>
      Effect.gen(function* () {
        const { entityId, player, inputState, velocity, cameraState } = entity
        const { newDy, newIsGrounded } = calculateVerticalVelocity(player.isGrounded, inputState.jump, velocity.dy)
        const hasHorizontalInput = inputState.forward || inputState.backward || inputState.left || inputState.right
        const { dx, dz } = match(hasHorizontalInput)
          .with(true, () => calculateHorizontalVelocity(inputState, cameraState))
          .otherwise(() => applyDeceleration(velocity))

        const newVelocity = setVelocity(velocity, { dx, dy: newDy, dz })
        yield* world.updateComponent(entityId, 'velocity', newVelocity)

        const newPlayerState = setPlayerGrounded(player, newIsGrounded)
        yield* world.updateComponent(entityId, 'player', newPlayerState)
      }),
    { discard: true },
  )
})