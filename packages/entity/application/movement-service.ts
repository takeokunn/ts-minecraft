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
  // Early exit: skip trig computation entirely when no horizontal keys are
  // pressed (idle players are far more common than moving ones over a session).
  const hasHorizontalInput = input.forward || input.backward || input.left || input.right
  if (!hasHorizontalInput) {
    // Y velocity is handled by physics (gravity/jump).
    const moveY = input.jump && isGrounded ? MetersPerSec.toNumber(DEFAULT_JUMP_VELOCITY) : 0
    return { x: 0, y: moveY, z: 0 }
  }
  // Pre-compute trig: yaw only changes on mouse move, but computeVelocity is
  // called per-frame. When keys ARE pressed, 8→2 trig calls/frame.
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)
  const rawX =
    (input.forward ? -sinYaw : 0) +
    (input.backward ? sinYaw : 0) +
    (input.left ? -cosYaw : 0) +
    (input.right ? cosYaw : 0)
  const rawZ =
    (input.forward ? -cosYaw : 0) +
    (input.backward ? cosYaw : 0) +
    (input.left ? sinYaw : 0) +
    (input.right ? -sinYaw : 0)

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

      // R-perf-1: getInput runs EVERY frame (player update). Every key read is a
      // synchronous HashSet lookup, so the previous `Effect.all([...], {concurrency:
      // 'unbounded'})` spawned ~9 fibers per frame for zero parallelism gain — pure
      // scheduler + array allocation churn. Sequential yield* reads eliminate the
      // fibers and the intermediate arrays/tuple (mirrors camera/render/physics-stage).
      const getInput = (): Effect.Effect<MovementInput, never> =>
        Effect.gen(function* () {
          const forward = yield* isDirPressed(KeyMappings.MOVE_FORWARD, KeyMappings.MOVE_FORWARD_ALT)
          const backward = yield* isDirPressed(KeyMappings.MOVE_BACKWARD, KeyMappings.MOVE_BACKWARD_ALT)
          const left = yield* isDirPressed(KeyMappings.MOVE_LEFT, KeyMappings.MOVE_LEFT_ALT)
          const right = yield* isDirPressed(KeyMappings.MOVE_RIGHT, KeyMappings.MOVE_RIGHT_ALT)
          // consumeKeyPress (not isKeyPressed) so a held jump only fires once per press.
          const jump = yield* inputService.consumeKeyPress(KeyMappings.JUMP)
          const [ctrlL, ctrlR] = yield* Effect.all([inputService.isKeyPressed(KeyMappings.SPRINT), inputService.isKeyPressed(KeyMappings.SPRINT_ALT)], { concurrency: 'unbounded' })
          const sprint = ctrlL || ctrlR
          const sneak = yield* inputService.isKeyPressed(KeyMappings.SNEAK)
          return { forward, backward, left, right, jump, sprint, sneak }
        })

      return {
        getInput,
        calculateVelocity: (
          input: MovementInput,
          yaw: number,
          isGrounded: boolean,
        ): Effect.Effect<Vector3, never> => Effect.succeed(computeVelocity(input, yaw, isGrounded)),
        update: (yaw: number, isGrounded: boolean): Effect.Effect<Vector3, never> =>
          Effect.gen(function* () {
            const input = yield* getInput()
            return computeVelocity(input, yaw, isGrounded)
          }),
      }
    }),
  }
) {}
export const MovementServiceLive = MovementService.Default
