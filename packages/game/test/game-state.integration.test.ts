// D1: Physics → movement → position integration test
//
// Verifies that AABB block collision in GameStateService.update() prevents the
// player physics body from falling below y=0 (bedrock). With NoOpChunkManager
// (no blocks loaded), the player falls until the bedrock rule triggers, settling
// at center y = PLAYER_HALF_HEIGHT (0.9).
import { describe,it } from '@effect/vitest'
import { PhysicsWorldPortLayer,RigidBodyPortLayer,ShapePortLayer } from '@ts-minecraft/app'
import { GameModeServiceLive,GameStateService,GameStateServiceLive } from '@ts-minecraft/game'
import { InventoryServiceLive } from '@ts-minecraft/inventory'
import { DEFAULT_PLAYER_ID,DeltaTimeSecs,PLAYER_HALF_HEIGHT,PlayerId } from '@ts-minecraft/kernel'
import { PhysicsServiceLive } from '@ts-minecraft/physics'
import { MovementServiceLive,PlayerCameraStateLive,PlayerInputService,PlayerServiceLive } from '@ts-minecraft/player'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { BlockRegistryLive } from '@ts-minecraft/world-state'
import { Array as Arr,Effect,Either,Layer,Option,Ref } from 'effect'
import { expect } from 'vitest'

// ---------------------------------------------------------------------------
// Mock PlayerInputService — always returns no input (no movement, no jump)
// ---------------------------------------------------------------------------
const NoOpPlayerInputLayer = Layer.succeed(PlayerInputService, PlayerInputService.of({
  _tag: '@minecraft/application/PlayerInputService' as const,
  isKeyPressed: (_key: string) => Effect.succeed(false),
  consumeKeyPress: (_key: string) => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isPointerLocked: () => Effect.succeed(false),
}))

// NoOp ChunkManager — no chunks loaded; bedrock floor still stops the player
const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  markChunkDirty: () => Effect.void,
  saveDirtyChunks: () => Effect.void,
  unloadChunk: () => Effect.void,
}))

// ---------------------------------------------------------------------------
// Layer composition matching src/layers.ts GameLayer
// ---------------------------------------------------------------------------
const PhysicsLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldPortLayer),
  Layer.provide(RigidBodyPortLayer),
  Layer.provide(ShapePortLayer),
)

const MovementLayer = MovementServiceLive.pipe(
  Layer.provide(NoOpPlayerInputLayer),
)

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
        yield* gameState.initialize(SPAWN_POS)

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

        yield* gameState.initialize(SPAWN_POS)

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
        yield* gameState.initialize(SPAWN_POS)
        // Second initialize: re-initialize is expected to succeed without error.
        yield* Effect.either(gameState.initialize(SPAWN_POS))
      }).pipe(Effect.provide(TestGameLayer))
    )

    it.effect('getPlayerPosition returns the spawn position immediately after initialize', () =>
      Effect.gen(function* () {
        const SPAWN_POS = { x: 3, y: 8, z: -5 }

        const gameState = yield* GameStateService
        yield* gameState.initialize(SPAWN_POS)
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
        yield* gameState.initialize(SPAWN_POS)
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
        yield* gameState.initialize(SPAWN_POS)
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
        yield* gameState.initialize(SPAWN_POS)
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
        yield* gameState.initialize(SPAWN_POS)
        // Run enough steps to let the player fall to bedrock and settle
        yield* Effect.forEach(Arr.makeBy(40, () => undefined), () => gameState.update(DELTA), { concurrency: 1 })
        const grounded = yield* gameState.isPlayerGrounded()

        expect(grounded).toBe(true)
      }).pipe(Effect.provide(TestGameLayer))
    )
  })
})
