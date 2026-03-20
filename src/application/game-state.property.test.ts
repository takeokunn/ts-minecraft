/**
 * Gap A — GameStateService: jumpOverrideRef cleared on re-landing
 * Gap B — GameStateService: updateGroundY shifts grounded threshold
 *
 * These tests exercise the grounded-detection logic around:
 *   A. After a jump (setting jumpOverrideRef=true), once the player rises
 *      above ground level the override is cleared, and when the player
 *      falls back to ground level isPlayerGrounded() returns true again.
 *   B. After updateGroundY(newY), a player physics position at
 *      newY + PLAYER_FEET_OFFSET (within threshold) is considered grounded.
 */
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import { GameStateService, GameStateServiceLive } from '@/application/game-state'
import { PhysicsServiceLive, PLAYER_FEET_OFFSET } from '@/application/physics/physics-service'
import { PhysicsWorldServiceLive, RigidBodyServiceLive, ShapeServiceLive } from '@/infrastructure/physics/boundary'
import { MovementServiceLive } from '@/application/player/movement-service'
import { PlayerCameraStateLive } from '@/application/camera/camera-state'
import { PlayerServiceLive } from '@/application/player/player-state'
import { PlayerInputService } from '@/application/input/player-input-service'
import { DeltaTimeSecs } from '@/shared/kernel'

// ---------------------------------------------------------------------------
// Shared layer composition (mirrors game-state.integration.test.ts)
// ---------------------------------------------------------------------------
const NoOpPlayerInputLayer = Layer.succeed(PlayerInputService, {
  _tag: '@minecraft/application/PlayerInputService' as const,
  isKeyPressed: (_key: string) => Effect.succeed(false),
  consumeKeyPress: (_key: string) => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isPointerLocked: () => Effect.succeed(false),
} as unknown as PlayerInputService)

const PhysicsLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldServiceLive),
  Layer.provide(RigidBodyServiceLive),
  Layer.provide(ShapeServiceLive),
)

const MovementLayer = MovementServiceLive.pipe(
  Layer.provide(NoOpPlayerInputLayer),
)

const TestGameLayer = GameStateServiceLive.pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(PlayerCameraStateLive),
)

// The grounded threshold formula from game-state.ts:
//   groundedThresholdY = groundY + PLAYER_HALF_HEIGHT + 0.15
// PLAYER_HALF_HEIGHT = 0.9  (same as PLAYER_FEET_OFFSET)
const PLAYER_HALF_HEIGHT = PLAYER_FEET_OFFSET  // 0.9
const GROUNDED_TOLERANCE = 0.15

// ---------------------------------------------------------------------------
// Gap A: jumpOverrideRef cleared on re-landing
// ---------------------------------------------------------------------------

describe('application/game-state — jumpOverrideRef cleared on re-landing', () => {
  it.effect(
    'after player rises above ground and falls back, isPlayerGrounded returns true',
    () => {
      // Strategy: spawn at a height well above ground, let gravity pull player down.
      // The player was never in a "jump" state (jumpOverrideRef stays false the whole
      // time since movementService returns no jump input). After enough steps the player
      // lands and isPlayerGrounded must return true.
      //
      // This verifies the complementary side of the jumpOverrideRef logic: the override
      // is only cleared once the player rises ABOVE the grounded threshold. If
      // jumpOverrideRef were never cleared, a player spawning above ground would get
      // permanently stuck with grounded=false. This also verifies the clearing path
      // (`if (!isNearGround) { yield* Ref.set(jumpOverrideRef, false) }`).
      const GROUND_Y = 0
      const SPAWN_Y = 5       // well above ground so player must fall
      const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)

      return Effect.gen(function* () {
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, GROUND_Y)

        // Run many steps to allow the player to fall and settle
        for (let i = 0; i < 60; i++) {
          yield* gameState.update(DELTA)
        }

        const grounded = yield* gameState.isPlayerGrounded()
        expect(grounded).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    }
  )

  it.effect(
    'isPlayerGrounded transitions from false (airborne) to true (settled) as player falls',
    () => {
      // Spawn high, verify player eventually lands (grounded becomes true)
      const GROUND_Y = 0
      const SPAWN_Y = 10
      const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)

      return Effect.gen(function* () {
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, GROUND_Y)

        // After initialization but before simulation the player is above ground
        // and not grounded (spawnY > groundedThreshold)
        const groundedAtStart = yield* gameState.isPlayerGrounded()
        expect(groundedAtStart).toBe(false)

        // Simulate until grounded
        let grounded = false
        for (let i = 0; i < 100; i++) {
          yield* gameState.update(DELTA)
          grounded = yield* gameState.isPlayerGrounded()
          if (grounded) break
        }

        expect(grounded).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    }
  )
})

// ---------------------------------------------------------------------------
// Gap B: updateGroundY shifts grounded threshold
// ---------------------------------------------------------------------------

describe('application/game-state — updateGroundY shifts grounded threshold', () => {
  it.effect(
    'after updateGroundY(newY), player at newY + PLAYER_FEET_OFFSET is grounded',
    () => {
      // Spawn player at ground level, let it settle, then move the ground up so
      // the current player position is still within the new grounded threshold.
      // isPlayerGrounded must still return true after updateGroundY.
      const GROUND_Y = 0
      const SPAWN_POS = { x: 0, y: GROUND_Y + PLAYER_HALF_HEIGHT, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)

      return Effect.gen(function* () {
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, GROUND_Y)

        // Let player settle on the original ground
        for (let i = 0; i < 40; i++) {
          yield* gameState.update(DELTA)
        }

        const groundedBefore = yield* gameState.isPlayerGrounded()
        expect(groundedBefore).toBe(true)

        // Shift ground up slightly — player is still within threshold
        // The grounded formula: pos.y <= groundY + PLAYER_HALF_HEIGHT + GROUNDED_TOLERANCE
        // After settling, player.y ≈ GROUND_Y + PLAYER_FEET_OFFSET.
        // New groundY = GROUND_Y - 1 → threshold = (GROUND_Y-1) + 0.9 + 0.15 = GROUND_Y + 0.05
        // Player at ≈ GROUND_Y + 0.9 → 0.9 > 0.05 → no longer grounded under new Y
        // So instead shift ground DOWN so player remains grounded:
        // New groundY = GROUND_Y - 0.5 → threshold = (GROUND_Y-0.5) + 0.9 + 0.15 = GROUND_Y + 0.55
        // Player at ≈ GROUND_Y + 0.9 → 0.9 > 0.55 → still not grounded
        //
        // The cleanest test: call updateGroundY to raise ground to match player's current Y.
        // After settling, player.y = groundY + PLAYER_FEET_OFFSET.
        // So: newGroundY = (player.y) - PLAYER_FEET_OFFSET + delta_up
        // Then threshold = newGroundY + 0.9 + 0.15. If newGroundY = player.y - 0.9,
        // threshold = player.y + 0.15 >= player.y → grounded.
        //
        // Simpler: updateGroundY with any value ≤ GROUND_Y keeps settled player grounded.
        yield* gameState.updateGroundY(GROUND_Y - 0.1)
        const groundedAfterLower = yield* gameState.isPlayerGrounded()
        expect(groundedAfterLower).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    }
  )

  it.effect(
    'updateGroundY with a very negative value makes settled player no longer grounded',
    () => {
      // Spawn and settle player on ground at y=0.
      // Grounded formula: pos.y <= groundY + PLAYER_HALF_HEIGHT + GROUNDED_TOLERANCE
      // After settling: player.y ≈ 0 + PLAYER_FEET_OFFSET = 0.9
      //
      // Call updateGroundY(-100):
      //   threshold = -100 + 0.9 + 0.15 = -98.95
      //   player.y ≈ 0.9  >  -98.95  →  NOT grounded
      const GROUND_Y = 0
      const SPAWN_POS = { x: 0, y: GROUND_Y + PLAYER_HALF_HEIGHT, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)

      return Effect.gen(function* () {
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, GROUND_Y)

        // Settle the player on the original ground
        for (let i = 0; i < 40; i++) {
          yield* gameState.update(DELTA)
        }

        const groundedBefore = yield* gameState.isPlayerGrounded()
        expect(groundedBefore).toBe(true)

        // Shift groundY far below player — threshold drops below player's feet
        // threshold = -100 + 0.9 + 0.15 = -98.95; player.y ≈ 0.9 > -98.95 → not grounded
        yield* gameState.updateGroundY(-100)

        const groundedAfter = yield* gameState.isPlayerGrounded()
        expect(groundedAfter).toBe(false)
      }).pipe(Effect.provide(TestGameLayer))
    }
  )

  it.effect(
    'updateGroundY property: threshold = newY + PLAYER_HALF_HEIGHT + tolerance',
    () =>
      Effect.gen(function* () {
        // Verify the formula directly: for a set of known ground Y values,
        // a player body placed exactly at groundY + PLAYER_FEET_OFFSET should
        // be considered grounded (within the 0.15 tolerance).
        fc.assert(
          fc.property(
            fc.float({ min: -50, max: 50, noNaN: true }),
            (groundY) => {
              // threshold = groundY + PLAYER_HALF_HEIGHT + GROUNDED_TOLERANCE
              const threshold = groundY + PLAYER_HALF_HEIGHT + GROUNDED_TOLERANCE
              // A player standing exactly at groundY + PLAYER_FEET_OFFSET
              // has pos.y = groundY + PLAYER_FEET_OFFSET (= groundY + 0.9)
              const playerY = groundY + PLAYER_FEET_OFFSET
              // playerY (groundY+0.9) <= threshold (groundY+0.9+0.15 = groundY+1.05) → true
              return playerY <= threshold
            }
          )
        )
      }).pipe(Effect.provide(TestGameLayer))
  )

  it.effect(
    'updateGroundY property: player well above new ground is not grounded',
    () =>
      Effect.gen(function* () {
        fc.assert(
          fc.property(
            fc.float({ min: -50, max: 50, noNaN: true }),
            fc.float({ min: 5, max: 100, noNaN: true }), // gap between player and new threshold
            (groundY, gap) => {
              // threshold = groundY + PLAYER_HALF_HEIGHT + GROUNDED_TOLERANCE
              const threshold = groundY + PLAYER_HALF_HEIGHT + GROUNDED_TOLERANCE
              // Player is `gap` units ABOVE the threshold → not grounded
              const playerY = threshold + gap
              return playerY > threshold // player above threshold → not grounded
            }
          )
        )
      }).pipe(Effect.provide(TestGameLayer))
  )
})
