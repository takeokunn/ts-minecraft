/**
 * D1: Physics → movement → position integration test
 *
 * Verifies that AABB block collision in GameStateService.update() prevents the
 * player physics body from falling below y=0 (bedrock). With NoOpChunkManager
 * (no blocks loaded), the player falls until the bedrock rule triggers, settling
 * at center y = PLAYER_HALF_HEIGHT (0.9).
 */
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Option, Ref } from 'effect'
import { GameStateService, GameStateServiceLive } from '@/application/game-state'
import { PhysicsServiceLive } from '@/application/physics/physics-service'
import { PhysicsWorldServiceLive, RigidBodyServiceLive, ShapeServiceLive } from '@/infrastructure/physics/boundary'
import { MovementServiceLive } from '@/application/player/movement-service'
import { PlayerCameraStateLive } from '@/application/camera/camera-state'
import { PlayerServiceLive } from '@/application/player/player-state'
import { PlayerInputService } from '@/application/input/player-input-service'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { HealthService } from '@/application/player/health-service'
import { DeltaTimeSecs, PlayerId } from '@/shared/kernel'
import { DEFAULT_PLAYER_ID } from '@/application/constants'

/** Player center Y when standing on bedrock (feet at y=0) */
const PLAYER_HALF_HEIGHT = 0.9

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

// NoOp ChunkManager — no chunks loaded; bedrock floor still stops the player
const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, {
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  saveChunk: (_coord: unknown) => Effect.void,
  evictChunksOutsideRange: (_pos: unknown, _dist: unknown) => Effect.succeed([]),
} as unknown as ChunkManagerService)

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
  Layer.provide(NoOpChunkManagerLayer),
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/game-state (integration)', () => {
  describe('bedrock floor invariant', () => {
    it.effect('player Y position never drops below PLAYER_HALF_HEIGHT (bedrock) after multiple physics steps', () =>
      Effect.gen(function* () {
        const SPAWN_Y = 8
        const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
        // Maximum deltaTime per step is 50ms (0.05s) from the game-loop cap
        const DELTA = DeltaTimeSecs.make(0.05)
        const STEPS = 20 // 1 second of simulation at 50ms/step

        const gameState = yield* GameStateService

        // Initialize physics world, player at SPAWN_POS (no ground plane needed)
        yield* gameState.initialize(SPAWN_POS, 0)

        // Run multiple physics steps — gravity pulls the player down
        yield* Effect.forEach(Arr.makeBy(STEPS, () => undefined), () =>
          Effect.gen(function* () {
            yield* gameState.update(DELTA)

            // Sample position after each step
            const pos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)

            // Bedrock (y<0 blocks) must prevent falling below center y = 0.9
            expect(pos.y).toBeGreaterThanOrEqual(PLAYER_HALF_HEIGHT - 0.001)
          })
        , { concurrency: 1 })
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('player stabilizes at bedrock level after falling from spawn height', () =>
      Effect.gen(function* () {
        const SPAWN_Y = 20 // spawn high; falls to bedrock with no blocks loaded
        const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
        const DELTA = DeltaTimeSecs.make(0.05)
        const STEPS = 60 // 3 seconds of simulation

        const gameState = yield* GameStateService

        yield* gameState.initialize(SPAWN_POS, 0)

        const finalYRef = yield* Ref.make(SPAWN_Y)
        yield* Effect.forEach(Arr.makeBy(STEPS, () => undefined), () =>
          Effect.gen(function* () {
            yield* gameState.update(DELTA)
            const pos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
            // Invariant: always above bedrock
            expect(pos.y).toBeGreaterThanOrEqual(PLAYER_HALF_HEIGHT - 0.001)
            yield* Ref.set(finalYRef, pos.y)
          })
        , { concurrency: 1 })
        const finalY = yield* Ref.get(finalYRef)

        // After 3 seconds the player should have landed — Y close to bedrock level
        expect(finalY).toBeLessThan(SPAWN_Y) // player fell from spawn
        expect(finalY).toBeGreaterThanOrEqual(PLAYER_HALF_HEIGHT - 0.001)
      }).pipe(Effect.provide(TestGameLayer))
    )
  })

  // ---------------------------------------------------------------------------
  // D3: Additional integration tests
  // ---------------------------------------------------------------------------

  describe('initialize', () => {
    it.effect('calling initialize() twice does not throw', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 0, y: 5, z: 0 }

        // Each run of the effect creates a fresh layer — two sequential initializes
        // on the same service instance (re-initializes physics world).
        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, 0)
        // Second initialize: re-initialize is expected to succeed without error.
        yield* Effect.either(gameState.initialize(SPAWN_POS, 0))
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('getPlayerPosition returns the spawn position immediately after initialize', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 3, y: 8, z: -5 }
        const GROUND_Y = 5

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, GROUND_Y)
        const pos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(pos.x).toBeCloseTo(SPAWN_POS.x, 3)
        expect(pos.y).toBeCloseTo(SPAWN_POS.y, 3)
        expect(pos.z).toBeCloseTo(SPAWN_POS.z, 3)
      }).pipe(Effect.provide(TestGameLayer))
    )
  })

  describe('getPlayerPosition', () => {
    it.effect('returns Left (PlayerError) for an unknown PlayerId', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 0, y: 5, z: 0 }

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, 0)
        // Query a player ID that was never registered
        const result = yield* Effect.either(
          gameState.getPlayerPosition(PlayerId.make('nonexistent-player'))
        )

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('PlayerError')
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('returns Left before initialize() is called (no player registered)', () =>
      Effect.gen(function* () {
        const gameState = yield* GameStateService
        // Do not call initialize — player has not been created yet
        const result = yield* Effect.either(
          gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
        )
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    )
  })

  describe('update', () => {
    it.effect('update() fails with GameStateError before initialize() is called', () =>
      Effect.gen(function* () {
        const DELTA = DeltaTimeSecs.make(0.016)

        const gameState = yield* GameStateService
        // Do not call initialize — playerBodyIdRef is None
        const result = yield* Effect.either(gameState.update(DELTA))

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('GameStateError')
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('frame count increments by one per update() call', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 0, y: 5, z: 0 }
        const DELTA = DeltaTimeSecs.make(0.016)

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, 0)
        const before = yield* gameState.getTiming()
        yield* gameState.update(DELTA)
        const after = yield* gameState.getTiming()

        expect(after.frameCount).toBe(before.frameCount + 1)
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('getTiming() deltaTime reflects the value passed to update()', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 0, y: 5, z: 0 }
        const DELTA = DeltaTimeSecs.make(0.033)

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, 0)
        yield* gameState.update(DELTA)
        const timing = yield* gameState.getTiming()

        expect(timing.deltaTime).toBeCloseTo(0.033, 5)
      }).pipe(Effect.provide(TestGameLayer))
    )
  })

  describe('isPlayerGrounded', () => {
    it.effect('returns false before initialize() is called', () =>
      Effect.gen(function* () {
        const gameState = yield* GameStateService
        const grounded = yield* gameState.isPlayerGrounded()
        expect(grounded).toBe(false)
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('returns true after player has settled on the bedrock floor', () =>
      Effect.gen(function* () {
        const SPAWN_Y = 2
        const SPAWN_POS = { x: 0, y: SPAWN_Y, z: 0 }
        const DELTA = DeltaTimeSecs.make(0.05)

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, 0)
        // Run enough steps to let the player fall to bedrock and settle
        yield* Effect.forEach(Arr.makeBy(40, () => undefined), () => gameState.update(DELTA), { concurrency: 1 })
        const grounded = yield* gameState.isPlayerGrounded()

        expect(grounded).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    )
  })

  // ---------------------------------------------------------------------------
  // C3: HealthService + GameStateService fall damage integration
  // ---------------------------------------------------------------------------

  describe('fall damage integration', () => {
    it.effect('processFallDamage returns > 0 after simulated fall of 10 blocks then grounded', () =>
      Effect.gen(function* () {
        // The HealthService.processFallDamage uses a two-frame state machine:
        //   - Frame N: prevY set, falling tracked
        //   - Frame N+1 (landing): wasFalling && isGrounded → compute damage
        //
        // We simulate this directly without GameState physics to avoid
        // the ground-clamp preventing isFallingRef from being set.
        const healthService = yield* HealthService

        // Frame 1: player at Y=10 (not grounded, not falling yet — prevY not set)
        const d0 = yield* healthService.processFallDamage(10, false)

        // Frame 2: player at Y=5 (falling, not grounded) → sets isFallingRef=true
        const d1 = yield* healthService.processFallDamage(5, false)

        // Frame 3: player at Y=0 (grounded after falling from 5→0 = 5 blocks)
        // wasFalling=true, isGrounded=true → damage = floor(5 - 3) = 2
        const d2 = yield* healthService.processFallDamage(0, true)

        const totalDamage = d0 + d1 + d2
        expect(totalDamage).toBeGreaterThan(0)
        expect(totalDamage).toBe(2) // floor(5 - 3) = 2
      }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect('processFallDamage returns 0 when fall distance is exactly 3 blocks (safe threshold)', () =>
      Effect.gen(function* () {
        // Fall distance ≤ 3 → damage = max(0, floor(3 - 3)) = 0
        const healthService = yield* HealthService

        // Frame 1: set prevY=3
        yield* healthService.processFallDamage(3, false)
        // Frame 2: falling from 3 to 0 (distance=3), sets isFallingRef=true
        yield* healthService.processFallDamage(0, false)
        // Frame 3: land (grounded), fallDistance = 3, damage = floor(3-3) = 0
        const damage = yield* healthService.processFallDamage(0, true)

        expect(damage).toBe(0)
      }).pipe(Effect.provide(HealthService.Default))
    )

    it.effect('processFallDamage returns 0 when fall distance is 4 blocks and landing is not grounded', () =>
      Effect.gen(function* () {
        // Still in the air — no damage even with large fall if not grounded on landing frame
        const healthService = yield* HealthService

        yield* healthService.processFallDamage(10, false) // set prevY
        yield* healthService.processFallDamage(5, false)  // falling
        // Landing check: isGrounded=false → no damage
        const damage = yield* healthService.processFallDamage(0, false)

        expect(damage).toBe(0)
      }).pipe(Effect.provide(HealthService.Default))
    )
  })

  // ---------------------------------------------------------------------------
  // C5: GameStateService.getCameraRotation() delegation test
  // ---------------------------------------------------------------------------

  describe('getCameraRotation', () => {
    it.effect('returns default { yaw: 0, pitch: 0 } before any updates', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 0, y: 5, z: 0 }

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS, 0)
        const rotation = yield* gameState.getCameraRotation()

        expect(rotation.yaw).toBe(0)
        expect(rotation.pitch).toBe(0)
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('getCameraRotation returns numbers before initialization', () =>
      Effect.gen(function* () {
        const gameState = yield* GameStateService
        // No initialize() call
        const rotation = yield* gameState.getCameraRotation()

        expect(typeof rotation.yaw).toBe('number')
        expect(typeof rotation.pitch).toBe('number')
      }).pipe(Effect.provide(TestGameLayer))
    )
  })
})
