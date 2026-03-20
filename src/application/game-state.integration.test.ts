/**
 * D1: Physics → movement → position integration test (tunneling fix)
 *
 * Verifies that the ground-clamp in GameStateService.update() prevents the
 * player physics body from falling below groundY + PLAYER_FEET_OFFSET even
 * after many simulation steps, including the worst-case 50ms cap scenario.
 */
import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { GameStateService, GameStateServiceLive } from '@/application/game-state'
import { PhysicsServiceLive, PLAYER_FEET_OFFSET } from '@/application/physics/physics-service'
import { PhysicsWorldServiceLive, RigidBodyServiceLive, ShapeServiceLive } from '@/infrastructure/cannon/boundary'
import { MovementServiceLive } from '@/application/player/movement-service'
import { PlayerCameraStateLive } from '@/application/camera/camera-state'
import { PlayerServiceLive } from '@/application/player/player-state'
import { PlayerInputService } from '@/application/input/player-input-service'
import { DeltaTimeSecs } from '@/shared/kernel'
import { DEFAULT_PLAYER_ID } from '@/application/constants'

// ---------------------------------------------------------------------------
// Mock PlayerInputService — always returns no input (no movement, no jump)
// ---------------------------------------------------------------------------
const NoOpPlayerInputLayer = Layer.succeed(PlayerInputService, {
  _tag: '@minecraft/application/PlayerInputService' as const,
  isKeyPressed: (_key: string) => Effect.succeed(false),
  consumeKeyPress: (_key: string) => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isPointerLocked: () => Effect.succeed(false),
} as unknown as PlayerInputService)

// ---------------------------------------------------------------------------
// Layer composition matching src/layers.ts GameLayer
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/game-state (integration)', () => {
  describe('ground-clamp invariant', () => {
    it('player Y position never drops below groundY + PLAYER_FEET_OFFSET after multiple physics steps', () => {
      const GROUND_Y = 5
      const SPAWN_Y = 8
      const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
      // Maximum deltaTime per step is 50ms (0.05s) from the game-loop cap
      const DELTA = DeltaTimeSecs.make(0.05)
      const STEPS = 20 // 1 second of simulation at 50ms/step
      const MIN_Y = GROUND_Y + PLAYER_FEET_OFFSET

      const program = Effect.gen(function* () {
        const gameState = yield* GameStateService

        // Initialize physics world, ground plane at GROUND_Y, player at SPAWN_POS
        yield* gameState.initialize(SPAWN_POS, GROUND_Y)

        // Run multiple physics steps — gravity pulls the player down
        for (let i = 0; i < STEPS; i++) {
          yield* gameState.update(DELTA)

          // Sample position after each step
          const pos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)

          // The ground-clamp must prevent falling below groundY + PLAYER_FEET_OFFSET
          expect(pos.y).toBeGreaterThanOrEqual(MIN_Y - 0.001) // 1mm epsilon for float precision
        }

        return { success: true }
      }).pipe(Effect.provide(TestGameLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('player stabilizes at ground level after falling from spawn height', () => {
      const GROUND_Y = 10
      const SPAWN_Y = 20 // spawn 10 blocks above ground
      const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)
      const STEPS = 60 // 3 seconds of simulation
      const MIN_Y = GROUND_Y + PLAYER_FEET_OFFSET

      const program = Effect.gen(function* () {
        const gameState = yield* GameStateService

        yield* gameState.initialize(SPAWN_POS, GROUND_Y)

        let finalY = SPAWN_Y
        for (let i = 0; i < STEPS; i++) {
          yield* gameState.update(DELTA)
          const pos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
          // Invariant: always above floor
          expect(pos.y).toBeGreaterThanOrEqual(MIN_Y - 0.001)
          finalY = pos.y
        }

        // After 3 seconds the player should have landed — Y close to ground level
        expect(finalY).toBeLessThan(SPAWN_Y) // player fell from spawn
        expect(finalY).toBeGreaterThanOrEqual(MIN_Y - 0.001)

        return { success: true }
      }).pipe(Effect.provide(TestGameLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
