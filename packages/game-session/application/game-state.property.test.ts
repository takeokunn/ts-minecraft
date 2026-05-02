// Gap A — GameStateService: jumpOverrideRef cleared on re-landing
//
// These tests exercise the grounded-detection logic:
//   A. A player spawning above the bedrock floor falls until AABB collision
//      detects the bedrock (wy < 0 → solid), settles at center y = 0.9,
//      and isPlayerGrounded() returns true.
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import { GameStateService, GameStateServiceLive } from '@ts-minecraft/game-session'
import { PhysicsServiceLive } from '@ts-minecraft/physics-engine'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/app'
import { MovementServiceLive } from '@ts-minecraft/player-controller'
import { PlayerCameraStateLive } from '@ts-minecraft/camera-controller'
import { PlayerServiceLive } from '@ts-minecraft/player-controller'
import { PlayerInputService } from '@ts-minecraft/input-handler'
import { ChunkManagerService } from '@ts-minecraft/chunk-manager'
import { GameModeServiceLive } from '@ts-minecraft/game-mode'
import { InventoryServiceLive } from '@ts-minecraft/inventory-system'
import { BlockRegistryLive } from '@ts-minecraft/domain'
import { DeltaTimeSecs } from '@ts-minecraft/kernel'

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
  Layer.provide(PhysicsWorldPortLayer),
  Layer.provide(RigidBodyPortLayer),
  Layer.provide(ShapePortLayer),
)

const MovementLayer = MovementServiceLive.pipe(
  Layer.provide(NoOpPlayerInputLayer),
)

const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, {
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  saveChunk: (_coord: unknown) => Effect.void,
  evictChunksOutsideRange: (_pos: unknown, _dist: unknown) => Effect.succeed([]),
} as unknown as ChunkManagerService)

const InventoryLayerForTest = InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive))

const TestGameLayer = GameStateServiceLive.pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(PlayerCameraStateLive),
  Layer.provide(NoOpChunkManagerLayer),
  Layer.provide(GameModeServiceLive),
  Layer.provide(InventoryLayerForTest),
)

// ---------------------------------------------------------------------------
// Gap A: player falls to bedrock floor and isPlayerGrounded returns true
// ---------------------------------------------------------------------------

describe('application/game-state — player falls to bedrock and lands', () => {
  it.effect(
    'after player falls to bedrock from above, isPlayerGrounded returns true',
    () => {
      // Strategy: spawn at a height above bedrock with no blocks loaded.
      // Gravity pulls the player down until AABB detects bedrock (wy < 0 → solid).
      // After enough steps the player lands and isPlayerGrounded must return true.
      const SPAWN_Y = 5       // well above bedrock so player must fall
      const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)

      return Effect.gen(function* () {
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS)

        // Run many steps to allow the player to fall and settle on bedrock
        yield* Effect.forEach(Arr.makeBy(60, () => undefined), () => gameState.update(DELTA), { concurrency: 1 })

        const grounded = yield* gameState.isPlayerGrounded()
        expect(grounded).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    }
  )

  it.effect(
    'isPlayerGrounded transitions from false (airborne) to true (settled) as player falls',
    () => {
      // Spawn high, verify player eventually lands (grounded becomes true)
      const SPAWN_Y = 10
      const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
      const DELTA = DeltaTimeSecs.make(0.05)

      return Effect.gen(function* () {
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS)

        // After initialization but before simulation the player is above bedrock
        // and not grounded
        const groundedAtStart = yield* gameState.isPlayerGrounded()
        expect(groundedAtStart).toBe(false)

        // Simulate until grounded
        const groundedState = yield* Effect.iterate(
          { grounded: false, i: 0 },
          {
            while: (s) => !s.grounded && s.i < 100,
            body: (s) => Effect.gen(function* () {
              yield* gameState.update(DELTA)
              const grounded = yield* gameState.isPlayerGrounded()
              return { grounded, i: s.i + 1 }
            }),
          }
        )

        expect(groundedState.grounded).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    }
  )
})
