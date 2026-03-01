import { Effect } from 'effect'
import { InputService, KeyMappings } from '../../presentation/input/input-service'

/**
 * Movement input state representing which movement keys are pressed
 */
export interface MovementInput {
  readonly forward: boolean
  readonly backward: boolean
  readonly left: boolean
  readonly right: boolean
  readonly jump: boolean
  readonly sprint: boolean
}

/**
 * Velocity vector for player movement
 */
export interface Velocity {
  readonly x: number
  readonly y: number // Typically managed by physics (gravity)
  readonly z: number
}

/**
 * Movement speed constants (in meters per second)
 */
export const DEFAULT_WALK_SPEED = 4.0 // m/s
export const DEFAULT_SPRINT_SPEED = 7.0 // m/s
export const DEFAULT_JUMP_VELOCITY = 5.0 // m/s

/**
 * MovementService class for handling player movement input
 *
 * Provides functionality to:
 * - Read current keyboard input state
 * - Calculate velocity based on input and camera direction
 * - Handle sprint and jump mechanics
 */
export class MovementService extends Effect.Service<MovementService>()(
  '@minecraft/layer/MovementService',
  {
    effect: Effect.gen(function* () {
      const inputService = yield* InputService

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
          ])

          return { forward, backward, left, right, jump, sprint }
        })

      const calculateVelocity = (
        input: MovementInput,
        yaw: number,
        isGrounded: boolean
      ): Effect.Effect<Velocity, never> =>
        Effect.gen(function* () {
          const speed = input.sprint ? DEFAULT_SPRINT_SPEED : DEFAULT_WALK_SPEED

          // Calculate movement direction based on camera yaw
          // Forward direction uses negative Z in most game engines
          let moveX = 0
          let moveZ = 0

          if (input.forward) {
            moveX -= Math.sin(yaw)
            moveZ -= Math.cos(yaw)
          }
          if (input.backward) {
            moveX += Math.sin(yaw)
            moveZ += Math.cos(yaw)
          }
          if (input.left) {
            moveX -= Math.cos(yaw)
            moveZ += Math.sin(yaw)
          }
          if (input.right) {
            moveX += Math.cos(yaw)
            moveZ -= Math.sin(yaw)
          }

          // Normalize diagonal movement to prevent faster diagonal speeds
          const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
          if (length > 0) {
            moveX = (moveX / length) * speed
            moveZ = (moveZ / length) * speed
          }

          // Y velocity is handled by physics (gravity/jump)
          let moveY = 0
          if (input.jump && isGrounded) {
            moveY = DEFAULT_JUMP_VELOCITY
          }

          return { x: moveX, y: moveY, z: moveZ }
        })

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
export { MovementService as MovementServiceLive }
