import { Effect, Match } from 'effect'
import { CameraState, InputState, Velocity } from '@/domain/components'
import { playerMovementQuery } from '@/domain/queries'
import { DECELERATION, JUMP_FORCE, MIN_VELOCITY_THRESHOLD, PLAYER_SPEED, SPRINT_MULTIPLIER } from '@/domain/world-constants'
import * as World from '@/domain/world'
import { QuerySoAResult } from '@/domain/world'

export const calculateHorizontalVelocity = (
  input: Pick<InputState, 'forward' | 'backward' | 'left' | 'right' | 'sprint'>,
  camera: Pick<CameraState, 'yaw'>,
): { dx: number; dz: number } => {
  const speed = input.sprint ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0)

  if (moveX === 0 && moveZ === 0) {
    return { dx: 0, dz: 0 }
  }

  // Normalize diagonal movement
  const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ)
  const normalizedX = (moveX / magnitude) * speed
  const normalizedZ = (moveZ / magnitude) * speed

  // Apply camera rotation
  const sinYaw = Math.sin(camera.yaw)
  const cosYaw = Math.cos(camera.yaw)
  const dx = normalizedX * cosYaw - normalizedZ * sinYaw
  const dz = normalizedX * sinYaw + normalizedZ * cosYaw

  return { dx, dz }
}

export const calculateVerticalVelocity = (isGrounded: boolean, jumpPressed: boolean, currentDy: number): { newDy: number; newIsGrounded: boolean } => {
  if (jumpPressed && isGrounded) {
    return { newDy: JUMP_FORCE, newIsGrounded: false }
  }
  return { newDy: currentDy, newIsGrounded: isGrounded }
}

const clampToZero = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.abs(value) < MIN_VELOCITY_THRESHOLD ? 0 : value
}

export const applyDeceleration = (velocity: Pick<Velocity, 'dx' | 'dz'>): Pick<Velocity, 'dx' | 'dz'> => {
  const dx = clampToZero(velocity.dx * DECELERATION)
  const dz = clampToZero(velocity.dz * DECELERATION)
  return { dx, dz }
}

export const playerMovementSystem = Effect.gen(function* ($) {
  const soa: QuerySoAResult<typeof playerMovementQuery['components']> = yield* $(World.querySoA(playerMovementQuery))

  if (soa.entities.length === 0) {
    return
  }

  const player = soa.player
  const inputState = soa.inputState
  const velocity = soa.velocity
  const cameraState = soa.cameraState

  for (let i = 0; i < soa.entities.length; i++) {
    const isGrounded = player.isGrounded[i] ?? false
    const jump = inputState.jump[i] ?? false
    const dy = velocity.dy[i] ?? 0

    const { newDy, newIsGrounded } = calculateVerticalVelocity(isGrounded, jump, dy)

    const forward = inputState.forward[i] ?? false
    const backward = inputState.backward[i] ?? false
    const left = inputState.left[i] ?? false
    const right = inputState.right[i] ?? false
    const sprint = inputState.sprint[i] ?? false
    const yaw = cameraState.yaw[i] ?? 0
    const currentDx = velocity.dx[i] ?? 0
    const currentDz = velocity.dz[i] ?? 0

    const hasHorizontalInput = forward || backward || left || right

    const { dx, dz } = Match.value(hasHorizontalInput).pipe(
      Match.when(true, () => calculateHorizontalVelocity({ forward, backward, left, right, sprint }, { yaw })),
      Match.orElse(() => applyDeceleration({ dx: currentDx, dz: currentDz })),
    )

    velocity.dx[i] = dx
    velocity.dy[i] = newDy
    velocity.dz[i] = dz
    player.isGrounded[i] = newIsGrounded
  }
})
