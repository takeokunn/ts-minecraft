import { Effect, Schema } from 'effect'
import { Vector3Schema } from '@/shared/math/three'
import type { Vector3 } from '@/shared/math/three'
import { PlayerInputService } from '@/application/input/player-input-service'
import { KeyMappings } from '@/application/input/key-mappings'
import { MetersPerSec } from '@/shared/kernel'

/**
 * Movement input state representing which movement keys are pressed
 */
export const MovementInputSchema = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sprint: Schema.Boolean,
})
export type MovementInput = Schema.Schema.Type<typeof MovementInputSchema>

/**
 * Velocity vector for player movement (alias for Vector3Schema)
 */
export const VelocitySchema = Vector3Schema
export type Velocity = Vector3

/**
 * Movement speed constants in meters per second.
 * Branded type enforces unit at compile time and validates finiteness at runtime.
 */
export const DEFAULT_WALK_SPEED: MetersPerSec = MetersPerSec.make(8.0)
export const DEFAULT_SPRINT_SPEED: MetersPerSec = MetersPerSec.make(14.0)
export const DEFAULT_JUMP_VELOCITY: MetersPerSec = MetersPerSec.make(5.0)

/**
 * Pure math: compute movement velocity from input state and camera yaw.
 * No side effects — safe to call anywhere without Effect wrapping.
 */
const computeVelocity = (
  input: MovementInput,
  yaw: number,
  isGrounded: boolean,
): { x: number; y: number; z: number } => {
  const speed = MetersPerSec.toNumber(input.sprint ? DEFAULT_SPRINT_SPEED : DEFAULT_WALK_SPEED)

  // Accumulate movement direction from all pressed keys.
  // Forward direction uses negative Z in most game engines.
  const rawX =
    (input.forward ? -Math.sin(yaw) : 0) +
    (input.backward ? Math.sin(yaw) : 0) +
    (input.left ? -Math.cos(yaw) : 0) +
    (input.right ? Math.cos(yaw) : 0)
  const rawZ =
    (input.forward ? -Math.cos(yaw) : 0) +
    (input.backward ? Math.cos(yaw) : 0) +
    (input.left ? Math.sin(yaw) : 0) +
    (input.right ? -Math.sin(yaw) : 0)

  // Normalize diagonal movement to prevent faster diagonal speeds.
  const length = Math.sqrt(rawX * rawX + rawZ * rawZ)
  const moveX = length > 0 ? (rawX / length) * speed : 0
  const moveZ = length > 0 ? (rawZ / length) * speed : 0

  // Y velocity is handled by physics (gravity/jump).
  const moveY = input.jump && isGrounded ? MetersPerSec.toNumber(DEFAULT_JUMP_VELOCITY) : 0

  return { x: moveX, y: moveY, z: moveZ }
}

/**
 * MovementService class for handling player movement input
 *
 * Provides functionality to:
 * - Read current keyboard input state
 * - Calculate velocity based on input and camera direction
 * - Handle sprint and jump mechanics
 */
export class MovementService extends Effect.Service<MovementService>()(
  '@minecraft/application/MovementService',
  {
    effect: Effect.gen(function* () {
      const inputService = yield* PlayerInputService

      const getInput = (): Effect.Effect<MovementInput, never> =>
        Effect.gen(function* () {
          const [forward, backward, left, right, jump, sprint] = yield* Effect.all([
            inputService.isKeyPressed(KeyMappings.MOVE_FORWARD),
            inputService.isKeyPressed(KeyMappings.MOVE_BACKWARD),
            inputService.isKeyPressed(KeyMappings.MOVE_LEFT),
            inputService.isKeyPressed(KeyMappings.MOVE_RIGHT),
            // Use consumeKeyPress for jump to only trigger once per key press
            inputService.consumeKeyPress(KeyMappings.JUMP),
            inputService.isKeyPressed(KeyMappings.SPRINT),
          ], { concurrency: 'unbounded' })

          return { forward, backward, left, right, jump, sprint }
        })

      const calculateVelocity = (
        input: MovementInput,
        yaw: number,
        isGrounded: boolean
      ): Effect.Effect<Velocity, never> =>
        Effect.succeed(computeVelocity(input, yaw, isGrounded))

      return {
        /**
         * Get current movement input state
         */
        getInput,

        /**
         * Calculate velocity based on input, camera yaw, and grounded state
         * @param input - Current movement input state
         * @param yaw - Camera yaw angle in radians
         * @param isGrounded - Whether the player is on the ground
         */
        calculateVelocity,

        /**
         * Update movement by combining input reading and velocity calculation
         * @param yaw - Camera yaw angle in radians
         * @param isGrounded - Whether the player is on the ground
         */
        update: (yaw: number, isGrounded: boolean): Effect.Effect<Velocity, never> =>
          Effect.gen(function* () {
            const input = yield* getInput()
            return yield* calculateVelocity(input, yaw, isGrounded)
          }),
      }
    }),
  }
) {}
export const MovementServiceLive = MovementService.Default
