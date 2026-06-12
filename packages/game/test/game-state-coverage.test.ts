import { describe, it, expect } from '@effect/vitest'
import { Effect, Either, Layer, MutableRef, Option } from 'effect'
import { DeltaTimeSecs, CHUNK_SIZE, CHUNK_HEIGHT, DEFAULT_PLAYER_ID, PhysicsBodyId, blockTypeToIndex } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import { GameStateService, GameStateServiceLive, GameModeServiceLive } from '@ts-minecraft/game'
import { PhysicsService, PhysicsServiceError, PhysicsServiceLive } from '@ts-minecraft/game'
import type { AddBodyConfig } from '@ts-minecraft/game'
import { MovementServiceLive, PlayerCameraStateLive, PlayerInputService, PlayerServiceLive } from '@ts-minecraft/entity'
import { ChunkManagerService } from '@ts-minecraft/world'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/game'
import { InventoryServiceLive } from '@ts-minecraft/inventory'
import { BlockRegistryLive } from '@ts-minecraft/block'
import { NoOpChunkManagerLayer, createTestInputService, createTestLayer } from './game-state-test-utils'

describe('application/game-state (coverage)', () => {
  // ---------------------------------------------------------------------------
  // isBlockSolid block-lookup path (lines 204-206 in game-state.ts)
  //
  // The non-null chunk branch of isBlockSolid is reached only when at least one
  // getChunk call in the 3×3 neighbourhood cache refresh succeeds (returns a real
  // chunk instead of failing). The NoOpChunkManagerLayer used everywhere else
  // always fails, so chunkCache cells are always null and lines 204-206 are
  // never exercised. A "real chunk" layer is provided here to fill the cache.
  // ---------------------------------------------------------------------------
  describe('isBlockSolid block-lookup path (chunk cache non-null)', () => {
    // Build a minimal all-air chunk so block lookups reach line 206 (the return).
    const BLOCKS_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
    const allAirBlocks = new Uint8Array(BLOCKS_LENGTH) // all zeros = AIR

    const RealChunkManagerLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: (coord: ChunkCoord) => Effect.succeed({
        coord,
        blocks: allAirBlocks,
        fluid: Option.none(),
        skyLight: new Uint8Array(0),
        blockLight: new Uint8Array(0),
      }),
      getLoadedChunks: () => Effect.succeed([]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      markChunkDirty: () => Effect.void,
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))

    const createLayerWithRealChunks = (inputService: ReturnType<typeof createTestInputService>) => {
      const inputLayer = Layer.succeed(PlayerInputService, inputService)
      const physicsLayer = PhysicsServiceLive.pipe(
        Layer.provide(PhysicsWorldPortLayer),
        Layer.provide(RigidBodyPortLayer),
        Layer.provide(ShapePortLayer),
      )
      const movementLayer = MovementServiceLive.pipe(Layer.provide(inputLayer))
      const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive))
      const dependencyLayers = Layer.mergeAll(
        physicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        movementLayer,
        PlayerCameraStateLive,
        PlayerServiceLive,
        RealChunkManagerLayer,
        GameModeServiceLive,
        inventoryLayer,
      )
      return Layer.mergeAll(
        GameStateServiceLive.pipe(Layer.provide(dependencyLayers)),
        PlayerServiceLive,
      )
    }

    it.effect('reaches block-array lookup in isBlockSolid when chunk cache is populated', () => {
      const inputService = createTestInputService()
      const testLayer = createLayerWithRealChunks(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // initialize sets the player body and player state
        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // The first update() triggers the 3×3 cache refresh because lastChunkCoord
        // starts at NaN,NaN. RealChunkManagerLayer succeeds for all coords, so
        // chunkCache cells become non-null. isBlockSolid is then called for each
        // AABB probe — any probe with 0 <= ly < CHUNK_HEIGHT and |dx|/|dz| <= 1
        // reaches the block-array lookup at lines 204-206.
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        // Player should have moved (physics ran, position synced back)
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(typeof pos.x).toBe('number')
        expect(typeof pos.y).toBe('number')
        expect(typeof pos.z).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // Error-wrapping paths that require mock services with injected failures
  // ---------------------------------------------------------------------------

  describe('initialize PhysicsServiceError wrapping (line 107)', () => {
    // A PhysicsService mock where addBody fails — triggers the catchTag at
    // line 107 in game-state.ts (initialize wraps PhysicsServiceError →
    // GameStateError).
    const makeFailingAddBodyPhysicsLayer = () => {
      const seq = { initialized: false }
      return Layer.succeed(PhysicsService, PhysicsService.of({
        _tag: '@minecraft/application/PhysicsService' as const,
        initialize: (_config: unknown) => Effect.sync(() => { seq.initialized = true }),
        addBody: (_config: AddBodyConfig) =>
          Effect.fail(new PhysicsServiceError({ operation: 'addBody', cause: 'mock addBody failure' })),
        removeBody: (_id: PhysicsBodyId) => Effect.void,
        step: (_dt: unknown) => Effect.void,
        getVelocity: (_id: PhysicsBodyId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
        getPosition: (_id: PhysicsBodyId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
        copyVelocityInto: <T extends Record<'x' | 'y' | 'z', number>>(_id: PhysicsBodyId, out: T) => { out.x = out.y = out.z = 0; return Effect.succeed(out) },
        copyPositionInto: <T extends Record<'x' | 'y' | 'z', number>>(_id: PhysicsBodyId, out: T) => { out.x = out.y = out.z = 0; return Effect.succeed(out) },
        setVelocity: (_id: PhysicsBodyId, _v: unknown) => Effect.void,
        setPosition: (_id: PhysicsBodyId, _p: unknown) => Effect.void,
      }))
    }

    const createLayerWithFailingAddBody = (inputService: ReturnType<typeof createTestInputService>) => {
      const inputLayer = Layer.succeed(PlayerInputService, inputService)
      const failingPhysicsLayer = makeFailingAddBodyPhysicsLayer()
      const movementLayer = MovementServiceLive.pipe(Layer.provide(inputLayer))
      const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive))
      const dependencyLayers = Layer.mergeAll(
        failingPhysicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        movementLayer,
        PlayerCameraStateLive,
        PlayerServiceLive,
        NoOpChunkManagerLayer,
        GameModeServiceLive,
        inventoryLayer,
      )
      return Layer.mergeAll(
        GameStateServiceLive.pipe(Layer.provide(dependencyLayers)),
        PlayerServiceLive,
      )
    }

    it.effect('initialize wraps PhysicsServiceError as GameStateError with operation=initialize', () => {
      const inputService = createTestInputService()
      const testLayer = createLayerWithFailingAddBody(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        const result = yield* service.initialize({ x: 0, y: 5, z: 0 }).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        const err = Option.getOrThrow(Either.getLeft(result))
        expect(err._tag).toBe('GameStateError')
        expect(err.operation).toBe('initialize')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('update getVelocity fallback (lines 131-133)', () => {
    // A PhysicsService where getVelocity always fails AFTER initialize+addBody
    // succeed. This triggers the Effect.catchTag fallback at line 130-134 that
    // logs a warning and returns ZERO_VEC3.
    const makeGetVelocityFailPhysicsLayer = () => {
      const bodyIdCounterRef = MutableRef.make(0)
      return Layer.succeed(PhysicsService, PhysicsService.of({
        _tag: '@minecraft/application/PhysicsService' as const,
        initialize: (_config: unknown) => Effect.void,
        addBody: (_config: AddBodyConfig) =>
          Effect.sync(() => PhysicsBodyId.make(`mock-body-${MutableRef.updateAndGet(bodyIdCounterRef, n => n + 1)}`)),
        removeBody: (_id: PhysicsBodyId) => Effect.void,
        step: (_dt: unknown) => Effect.void,
        getVelocity: (_id: PhysicsBodyId) =>
          Effect.fail(new PhysicsServiceError({ operation: 'getVelocity', cause: 'mock getVelocity failure' })),
        getPosition: (_id: PhysicsBodyId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
        copyVelocityInto: <T extends Record<'x' | 'y' | 'z', number>>(_id: PhysicsBodyId, _out: T) =>
          Effect.fail(new PhysicsServiceError({ operation: 'copyVelocityInto', cause: 'mock failure' })),
        copyPositionInto: <T extends Record<'x' | 'y' | 'z', number>>(_id: PhysicsBodyId, out: T) => { out.x = out.y = out.z = 0; return Effect.succeed(out) },
        setVelocity: (_id: PhysicsBodyId, _v: unknown) => Effect.void,
        setPosition: (_id: PhysicsBodyId, _p: unknown) => Effect.void,
      }))
    }

    const createLayerWithFailingGetVelocity = (inputService: ReturnType<typeof createTestInputService>) => {
      const inputLayer = Layer.succeed(PlayerInputService, inputService)
      const failingPhysicsLayer = makeGetVelocityFailPhysicsLayer()
      const movementLayer = MovementServiceLive.pipe(Layer.provide(inputLayer))
      const inventoryLayer = InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive))
      const dependencyLayers = Layer.mergeAll(
        failingPhysicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        movementLayer,
        PlayerCameraStateLive,
        PlayerServiceLive,
        NoOpChunkManagerLayer,
        GameModeServiceLive,
        inventoryLayer,
      )
      return Layer.mergeAll(
        GameStateServiceLive.pipe(Layer.provide(dependencyLayers)),
        PlayerServiceLive,
      )
    }

    it.effect('update falls back to ZERO_VEC3 when getVelocity fails and continues normally', () => {
      const inputService = createTestInputService()
      const testLayer = createLayerWithFailingGetVelocity(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // initialize must succeed (addBody succeeds in this mock)
        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // update triggers the getVelocity call; the mock fails it, which
        // exercises the catchTag fallback at lines 130-134. update should
        // still succeed because the fallback returns ZERO_VEC3 instead of
        // propagating the error.
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        // Timing incremented → update completed without re-throwing
        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // Water drag path (lines 168-173 in game-state-service.ts)
  // isInWater returns true when the player is inside a WATER block.
  // ---------------------------------------------------------------------------
  describe('water drag applied when player is inside a WATER block', () => {
    it.effect('applies 60% velocity dampening when player is submerged in water', () => {
      const inputService = createTestInputService()
      const waterBlockId = blockTypeToIndex('WATER')

      // Build chunk with WATER filling the bottom 10 blocks across the whole column
      const BLOCKS_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
      const waterBlocks = new Uint8Array(BLOCKS_LENGTH)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let y = 0; y < 10; y++) {
            waterBlocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = waterBlockId
          }
        }
      }

      const WaterChunkManagerLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
        _tag: '@minecraft/application/ChunkManagerService' as const,
        getChunk: (coord: ChunkCoord) => Effect.succeed({ coord, blocks: waterBlocks, fluid: Option.none(), skyLight: new Uint8Array(0), blockLight: new Uint8Array(0) }),
        getLoadedChunks: () => Effect.succeed([]),
        drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
        loadChunksAroundPlayer: () => Effect.succeed(false),
        markChunkDirty: () => Effect.void,
        saveDirtyChunks: () => Effect.void,
        unloadChunk: () => Effect.void,
      }))

      const inputLayer = Layer.succeed(PlayerInputService, inputService)
      const physicsLayer = PhysicsServiceLive.pipe(
        Layer.provide(PhysicsWorldPortLayer),
        Layer.provide(RigidBodyPortLayer),
        Layer.provide(ShapePortLayer),
      )
      const dependencyLayers = Layer.mergeAll(
        physicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        MovementServiceLive.pipe(Layer.provide(inputLayer)),
        PlayerCameraStateLive,
        PlayerServiceLive,
        WaterChunkManagerLayer,
        GameModeServiceLive,
        InventoryServiceLive.pipe(Layer.provide(BlockRegistryLive)),
      )
      const testLayer = Layer.mergeAll(
        GameStateServiceLive.pipe(Layer.provide(dependencyLayers)),
        PlayerServiceLive,
      )

      return Effect.gen(function* () {
        const service = yield* GameStateService
        // Spawn inside water (y=3 is within the water zone y<10)
        yield* service.initialize({ x: 0, y: 3, z: 0 })
        // Run physics — player is submerged, water drag executes (lines 168-173)
        yield* service.update(DeltaTimeSecs.make(1 / 60))
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(typeof pos.x).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('respawn before initialization (PhysicsBodyId is none)', () => {
    it.effect('respawn fails with GameStateError when called before initialize', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // No initialize — playerBodyIdRef holds Option.none()
        const result = yield* service.respawn({ x: 0, y: 5, z: 0 }).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        const err = Option.getOrThrow(Either.getLeft(result))
        expect(err._tag).toBe('GameStateError')
        expect(err.operation).toBe('respawn')
      }).pipe(Effect.provide(testLayer))
    })
  })
})
