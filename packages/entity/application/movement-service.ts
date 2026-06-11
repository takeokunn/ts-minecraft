import { Effect, Schema } from 'effect'
import type { Vector3 } from '@ts-minecraft/core'
import { MetersPerSec } from '@ts-minecraft/core'
import { PlayerInputService } from './player-input-service'
import { KeyMappings } from '../domain/key-mappings'

export const MovementInputSchema = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sprint: Schema.Boolean,
  sneak: Schema.Boolean,
})
export type MovementInput = Schema.Schema.Type<typeof MovementInputSchema>

// ─── Speed constants ──────────────────────────────────────────────────────────
// Vanilla Minecraft (1.18) ground movement speeds in blocks/second. The branded
// type enforces the unit at compile time and validates finiteness at runtime.
//   walk   = 4.317 b/s  (vanilla baseline)
//   sprint = walk × 1.3  = 5.612 b/s
//   sneak  = walk × 0.3  = 1.295 b/s
export const DEFAULT_WALK_SPEED: MetersPerSec = MetersPerSec.make(4.317)
export const DEFAULT_SPRINT_SPEED: MetersPerSec = MetersPerSec.make(5.612)
export const DEFAULT_SNEAK_SPEED: MetersPerSec = MetersPerSec.make(1.295)
// Jump velocity is calibrated against GRAVITY_Y (-9.82 m/s²) so the apex height
// h = v²/2g = 5²/19.64 ≈ 1.27 blocks matches the vanilla jump height (~1.25).
export const DEFAULT_JUMP_VELOCITY: MetersPerSec = MetersPerSec.make(5.0)

// Pure math: no side effects — safe to call anywhere without Effect wrapping.
export const computeVelocity = (
  input: MovementInput,
  yaw: number,
  isGrounded: boolean,
): { x: number; y: number; z: number } => {
  // Speed priority mirrors vanilla: sneaking suppresses sprinting, so it wins
  // when both keys are held. Sprint otherwise takes precedence over the walk base.
  const speed = MetersPerSec.toNumber(
    input.sneak ? DEFAULT_SNEAK_SPEED : input.sprint ? DEFAULT_SPRINT_SPEED : DEFAULT_WALK_SPEED
  )

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

export class MovementService extends Effect.Service<MovementService>()(
  '@minecraft/application/MovementService',
  {
    effect: Effect.map(PlayerInputService, (inputService) => {
      // Each movement direction responds to its WASD key OR its arrow-key alias.
      const isDirPressed = (primary: string, alt: string): Effect.Effect<boolean, never> =>
        Effect.zipWith(
          inputService.isKeyPressed(primary),
          inputService.isKeyPressed(alt),
          (a, b) => a || b,
        )

      const getInput = (): Effect.Effect<MovementInput, never> =>
        Effect.gen(function* () {
          const [forward, backward, left, right, jump, sprint, sneak] = yield* Effect.all([
            isDirPressed(KeyMappings.MOVE_FORWARD, KeyMappings.MOVE_FORWARD_ALT),
            isDirPressed(KeyMappings.MOVE_BACKWARD, KeyMappings.MOVE_BACKWARD_ALT),
            isDirPressed(KeyMappings.MOVE_LEFT, KeyMappings.MOVE_LEFT_ALT),
            isDirPressed(KeyMappings.MOVE_RIGHT, KeyMappings.MOVE_RIGHT_ALT),
            // Use consumeKeyPress for jump to only trigger once per key press
            inputService.consumeKeyPress(KeyMappings.JUMP),
            Effect.all([inputService.isKeyPressed('ControlLeft'), inputService.isKeyPressed('ControlRight')], {concurrency: 'unbounded'}).pipe(
              Effect.map(([l, r]) => l || r)
            ),
            inputService.isKeyPressed(KeyMappings.SNEAK),
          ], { concurrency: 'unbounded' })

          return { forward, backward, left, right, jump, sprint, sneak }
        })

      const calculateVelocity = (
        input: MovementInput,
        yaw: number,
        isGrounded: boolean
      ): Effect.Effect<Vector3, never> =>
        Effect.succeed(computeVelocity(input, yaw, isGrounded))

      return {
        getInput,
        calculateVelocity,
        update: (yaw: number, isGrounded: boolean): Effect.Effect<Vector3, never> =>
          Effect.gen(function* () {
            const input = yield* getInput()
            return yield* calculateVelocity(input, yaw, isGrounded)
          }),
      }
    }),
  }
) {}
export const MovementServiceLive = MovementService.Default
