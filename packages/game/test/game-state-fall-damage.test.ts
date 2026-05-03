import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer } from 'effect'
import { GameStateService, GameStateServiceLive } from '@ts-minecraft/game'
import { PhysicsServiceLive } from '@ts-minecraft/physics'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/app'
import { MovementServiceLive } from '@ts-minecraft/player'
import { PlayerCameraStateLive } from '@ts-minecraft/player'
import { PlayerServiceLive } from '@ts-minecraft/player'
import { PlayerInputService } from '@ts-minecraft/player'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { HealthService } from '@ts-minecraft/player'
import { GameModeServiceLive } from '@ts-minecraft/game'
import { InventoryServiceLive } from '@ts-minecraft/inventory'
import { BlockRegistryLive } from '@ts-minecraft/world-state'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'

const NoOpPlayerInputLayer = Layer.succeed(PlayerInputService, {
  _tag: '@minecraft/application/PlayerInputService' as const,
  isKeyPressed: (_key: string) => Effect.succeed(false),
  consumeKeyPress: (_key: string) => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isPointerLocked: () => Effect.succeed(false),
} as unknown as PlayerInputService)

const NoOpChunkManagerLayer = Layer.succeed(ChunkManagerService, {
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: unknown) => Effect.fail({ _tag: 'ChunkError', message: 'not loaded' } as never),
  getLoadedChunks: () => Effect.succeed([]),
  loadChunksAroundPlayer: (_pos: unknown, _dist?: unknown) => Effect.succeed(false),
  saveChunk: (_coord: unknown) => Effect.void,
  evictChunksOutsideRange: (_pos: unknown, _dist: unknown) => Effect.succeed([]),
} as unknown as ChunkManagerService)

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

describe('application/game-state (integration)', () => {
  describe('fall damage integration', () => {
    it.effect('processFallDamage returns > 0 after simulated fall of 10 blocks then grounded', () =>
      Effect.gen(function* () {
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
        const healthService = yield* HealthService

        yield* healthService.processFallDamage(10, false) // set prevY
        yield* healthService.processFallDamage(5, false)  // falling
        // Landing check: isGrounded=false → no damage
        const damage = yield* healthService.processFallDamage(0, false)

        expect(damage).toBe(0)
      }).pipe(Effect.provide(HealthService.Default))
    )
  })

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
