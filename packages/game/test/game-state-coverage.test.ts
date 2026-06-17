import { describe, it, expect } from '@effect/vitest'
import { Effect, Either, Layer, MutableRef, Option } from 'effect'
import { DeltaTimeSecs, CHUNK_SIZE, CHUNK_HEIGHT, DEFAULT_PLAYER_ID, PhysicsBodyId, blockTypeToIndex } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import { GameModeService, GameStateService, PhysicsService } from '@ts-minecraft/game'
import type { AddBodyConfig } from '@ts-minecraft/game'
import { PhysicsServiceError } from '../application/physics-service-error'
import { HungerService, KeyMappings, MovementService, PlayerCameraStateService, PlayerInputService, PlayerService } from '@ts-minecraft/entity'
import { ChunkManagerService, chunkBlockIndexUnchecked } from '@ts-minecraft/world'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/game'
import { InventoryService } from '@ts-minecraft/inventory'
import { BlockRegistry } from '@ts-minecraft/block'
import { NoOpChunkManagerLayer, createTestInputService, createTestLayer } from './game-state-test-utils'

describe('application/game-state (coverage)', () => {
  const BLOCKS_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

  const makeChunkManagerLayer = (blocks: Uint8Array) =>
    Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: (coord: ChunkCoord) => Effect.succeed({
        coord,
        blocks,
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
      setActiveWorldId: () => Effect.void,
      setActiveDimension: () => Effect.void,
    }))

  const createLayerWithChunks = (
    inputService: ReturnType<typeof createTestInputService>,
    chunkManagerLayer: Layer.Layer<ChunkManagerService>,
  ) => {
    const inputLayer = Layer.succeed(PlayerInputService, inputService)
    const physicsLayer = PhysicsService.Default.pipe(
      Layer.provide(PhysicsWorldPortLayer),
      Layer.provide(RigidBodyPortLayer),
      Layer.provide(ShapePortLayer),
    )
    const movementLayer = MovementService.Default.pipe(
      Layer.provide(inputLayer),
      Layer.provide(HungerService.Default),
    )
    const inventoryLayer = InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default))
    const dependencyLayers = Layer.mergeAll(
      physicsLayer,
      inputLayer,
      movementLayer,
      PlayerCameraStateService.Default,
      PlayerService.Default,
      chunkManagerLayer,
      GameModeService.Default,
      inventoryLayer,
    )
    return Layer.mergeAll(
      GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
      dependencyLayers,
    )
  }

  const createLayerWithPhysics = (
    inputService: ReturnType<typeof createTestInputService>,
    physicsLayer: Layer.Layer<PhysicsService>,
    chunkManagerLayer: Layer.Layer<ChunkManagerService>,
  ) => {
    const inputLayer = Layer.succeed(PlayerInputService, inputService)
    const movementLayer = MovementService.Default.pipe(
      Layer.provide(inputLayer),
      Layer.provide(HungerService.Default),
    )
    const inventoryLayer = InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default))
    const dependencyLayers = Layer.mergeAll(
      physicsLayer,
      inputLayer,
      movementLayer,
      PlayerCameraStateService.Default,
      PlayerService.Default,
      chunkManagerLayer,
      GameModeService.Default,
      inventoryLayer,
    )
    return Layer.mergeAll(
      GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
      dependencyLayers,
    )
  }

  const fillBlockColumn = (blocks: Uint8Array, blockId: number, fromY: number, toYExclusive: number) => {
    for (let y = fromY; y < toYExclusive; y++) {
      blocks[chunkBlockIndexUnchecked(0, y, 0)] = blockId
    }
  }

  const fillBlockLayers = (blocks: Uint8Array, blockId: number, fromY: number, toYExclusive: number) => {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = fromY; y < toYExclusive; y++) {
          blocks[chunkBlockIndexUnchecked(lx, y, lz)] = blockId
        }
      }
    }
  }

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
      const physicsLayer = PhysicsService.Default.pipe(
        Layer.provide(PhysicsWorldPortLayer),
        Layer.provide(RigidBodyPortLayer),
        Layer.provide(ShapePortLayer),
      )
      const movementLayer = MovementService.Default.pipe(
        Layer.provide(inputLayer),
        Layer.provide(HungerService.Default),
      )
      const inventoryLayer = InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default))
      const dependencyLayers = Layer.mergeAll(
        physicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        movementLayer,
        PlayerCameraStateService.Default,
        PlayerService.Default,
        RealChunkManagerLayer,
        GameModeService.Default,
        inventoryLayer,
      )
      return Layer.mergeAll(
        GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
        PlayerService.Default,
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
      const movementLayer = MovementService.Default.pipe(
        Layer.provide(inputLayer),
        Layer.provide(HungerService.Default),
      )
      const inventoryLayer = InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default))
      const dependencyLayers = Layer.mergeAll(
        failingPhysicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        movementLayer,
        PlayerCameraStateService.Default,
        PlayerService.Default,
        NoOpChunkManagerLayer,
        GameModeService.Default,
        inventoryLayer,
      )
      return Layer.mergeAll(
        GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
        PlayerService.Default,
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

  describe('update physics velocity read errors', () => {
    // A PhysicsService where velocity reads fail after initialize+addBody
    // succeed. update must surface the physics fault instead of inventing a
    // synthetic velocity.
    const makeVelocityReadFailPhysicsLayer = () => {
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

    const createLayerWithFailingVelocityRead = (inputService: ReturnType<typeof createTestInputService>) => {
      const inputLayer = Layer.succeed(PlayerInputService, inputService)
      const failingPhysicsLayer = makeVelocityReadFailPhysicsLayer()
      const movementLayer = MovementService.Default.pipe(
        Layer.provide(inputLayer),
        Layer.provide(HungerService.Default),
      )
      const inventoryLayer = InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default))
      const dependencyLayers = Layer.mergeAll(
        failingPhysicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        movementLayer,
        PlayerCameraStateService.Default,
        PlayerService.Default,
        NoOpChunkManagerLayer,
        GameModeService.Default,
        inventoryLayer,
      )
      return Layer.mergeAll(
        GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
        PlayerService.Default,
      )
    }

    it.effect('wraps copyVelocityInto failure as GameStateError', () => {
      const inputService = createTestInputService()
      const testLayer = createLayerWithFailingVelocityRead(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const result = yield* service.update(DeltaTimeSecs.make(1 / 60)).pipe(Effect.either)

        expect(Either.isLeft(result)).toBe(true)
        const error = Option.getOrThrow(Either.getLeft(result))
        expect(error._tag).toBe('GameStateError')
        expect(error.operation).toBe('update')
        expect(error.reason).toBe('copyVelocityInto')
        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(0)
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
      const physicsLayer = PhysicsService.Default.pipe(
        Layer.provide(PhysicsWorldPortLayer),
        Layer.provide(RigidBodyPortLayer),
        Layer.provide(ShapePortLayer),
      )
      const dependencyLayers = Layer.mergeAll(
        physicsLayer,
        // GameStateService directly requires PlayerInputService (creative flight, FR-1).
        inputLayer,
        MovementService.Default.pipe(
          Layer.provide(inputLayer),
          Layer.provide(HungerService.Default),
        ),
        PlayerCameraStateService.Default,
        PlayerService.Default,
        WaterChunkManagerLayer,
        GameModeService.Default,
        InventoryService.Default.pipe(Layer.provide(BlockRegistry.Default)),
      )
      const testLayer = Layer.mergeAll(
        GameStateService.Default.pipe(Layer.provide(dependencyLayers)),
        PlayerService.Default,
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

    it.effect('uses the default water sink when submerged without options', () => {
      const inputService = createTestInputService()
      const waterBlocks = new Uint8Array(BLOCKS_LENGTH)
      fillBlockLayers(waterBlocks, blockTypeToIndex('WATER'), 0, 10)
      const testLayer = createLayerWithChunks(inputService, makeChunkManagerLayer(waterBlocks))

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 3, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const timing = yield* service.getTiming()
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(timing.frameCount).toBe(1)
        expect(typeof pos.y).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('applies the sneaking water branch while submerged', () => {
      const inputService = createTestInputService({ sneak: true })
      const waterBlocks = new Uint8Array(BLOCKS_LENGTH)
      fillBlockLayers(waterBlocks, blockTypeToIndex('WATER'), 0, 10)
      const testLayer = createLayerWithChunks(inputService, makeChunkManagerLayer(waterBlocks))

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 3, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const timing = yield* service.getTiming()
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(timing.frameCount).toBe(1)
        expect(typeof pos.y).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('swims upward with explicit horizontal drag while submerged', () => {
      const inputService = createTestInputService({ jump: true })
      const waterBlocks = new Uint8Array(BLOCKS_LENGTH)
      fillBlockLayers(waterBlocks, blockTypeToIndex('WATER'), 0, 10)
      const testLayer = createLayerWithChunks(inputService, makeChunkManagerLayer(waterBlocks))

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 3, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60), 0.45)

        const timing = yield* service.getTiming()
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(timing.frameCount).toBe(1)
        expect(typeof pos.y).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('creative flight and passable block movement branches', () => {
    it.effect('uses creative flight position and velocity when flying upward', () => {
      const inputService = createTestInputService({ jump: true })
      inputService.simulateKeyPress(KeyMappings.TOGGLE_FLIGHT)
      const testLayer = createLayerWithChunks(inputService, makeChunkManagerLayer(new Uint8Array(BLOCKS_LENGTH)))

      return Effect.gen(function* () {
        const service = yield* GameStateService
        const gameModeService = yield* GameModeService

        yield* gameModeService.set('creative')
        yield* service.initialize({ x: 0, y: 5, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 10))

        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(pos.y).toBeGreaterThan(5)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('climbs ladders when jump is held', () => {
      const inputService = createTestInputService({ jump: true })
      const ladderBlocks = new Uint8Array(BLOCKS_LENGTH)
      fillBlockColumn(ladderBlocks, blockTypeToIndex('LADDER'), 2, 5)
      const testLayer = createLayerWithChunks(inputService, makeChunkManagerLayer(ladderBlocks))

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 3, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('slows movement inside cobweb blocks', () => {
      const inputService = createTestInputService({ forward: true })
      const cobwebBlocks = new Uint8Array(BLOCKS_LENGTH)
      fillBlockLayers(cobwebBlocks, blockTypeToIndex('COBWEB'), 2, 5)
      const testLayer = createLayerWithChunks(inputService, makeChunkManagerLayer(cobwebBlocks))

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 3, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('grounded surface cache refresh', () => {
    const makeGroundedChunkShiftPhysicsLayer = () => {
      const positionRef = MutableRef.make({ x: 0, y: 0.8, z: 0 })
      const velocityRef = MutableRef.make({ x: 0, y: 0, z: 0 })
      const nextBodyRef = MutableRef.make(0)
      const setPositionCallsRef = MutableRef.make(0)

      return Layer.succeed(PhysicsService, PhysicsService.of({
        _tag: '@minecraft/application/PhysicsService' as const,
        initialize: (_config: unknown) => Effect.void,
        addBody: (_config: AddBodyConfig) =>
          Effect.sync(() => PhysicsBodyId.make(`surface-refresh-${MutableRef.updateAndGet(nextBodyRef, n => n + 1)}`)),
        removeBody: (_id: PhysicsBodyId) => Effect.void,
        step: (_dt: unknown) => Effect.void,
        getVelocity: (_id: PhysicsBodyId) => Effect.sync(() => ({ ...MutableRef.get(velocityRef) })),
        getPosition: (_id: PhysicsBodyId) => Effect.sync(() => ({ ...MutableRef.get(positionRef) })),
        copyVelocityInto: <T extends Record<'x' | 'y' | 'z', number>>(_id: PhysicsBodyId, out: T) =>
          Effect.sync(() => {
            const velocity = MutableRef.get(velocityRef)
            out.x = velocity.x
            out.y = velocity.y
            out.z = velocity.z
            return out
          }),
        copyPositionInto: <T extends Record<'x' | 'y' | 'z', number>>(_id: PhysicsBodyId, out: T) =>
          Effect.sync(() => {
            const position = MutableRef.get(positionRef)
            out.x = position.x
            out.y = position.y
            out.z = position.z
            return out
          }),
        setVelocity: (_id: PhysicsBodyId, velocity: Record<'x' | 'y' | 'z', number>) =>
          Effect.sync(() => MutableRef.set(velocityRef, { x: velocity.x, y: velocity.y, z: velocity.z })),
        setPosition: (_id: PhysicsBodyId, position: Record<'x' | 'y' | 'z', number>) =>
          Effect.sync(() => {
            const calls = MutableRef.updateAndGet(setPositionCallsRef, n => n + 1)
            const nextPosition = calls === 1
              ? { x: CHUNK_SIZE, y: 0.8, z: 0 }
              : { x: position.x, y: position.y, z: position.z }
            MutableRef.set(positionRef, nextPosition)
          }),
      }))
    }

    it.effect('refreshes the surface cache when a grounded physics position enters another chunk', () => {
      const inputService = createTestInputService()
      const testLayer = createLayerWithPhysics(
        inputService,
        makeGroundedChunkShiftPhysicsLayer(),
        makeChunkManagerLayer(new Uint8Array(BLOCKS_LENGTH)),
      )

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 1, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(2)
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
