import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { WorldService } from '@/domain/world'
import { WorldError } from '@/domain/errors'
import { WorldId, WorldIdSchema, Position } from '@/shared/kernel'
import { BlockType } from '@/domain/block'
import { TerrainService, TerrainServiceLive } from './flat'

// Type alias for addBlock mock call arguments: [WorldId, Position, BlockType]
type AddBlockCall = [WorldId, Position, BlockType]

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Create a mock WorldService with a spy on addBlock.
 * All methods return Effect.void / Effect.succeed by default.
 */
const createMockWorldService = (addBlockImpl?: (worldId: WorldId, position: Position, blockType: BlockType) => Effect.Effect<void, WorldError>) => {
  const addBlockFn = vi.fn().mockImplementation(
    addBlockImpl ?? ((_worldId: WorldId, _position: Position, _blockType: BlockType) => Effect.void)
  )

  const mockService = {
    create: vi.fn().mockReturnValue(Effect.void),
    addBlock: addBlockFn,
    removeBlock: vi.fn().mockReturnValue(Effect.void),
    getBlock: vi.fn().mockReturnValue(Effect.succeed(Option.none())),
    getBlocksInArea: vi.fn().mockReturnValue(Effect.succeed([])),
    dispose: vi.fn().mockReturnValue(Effect.void),
  } as unknown as WorldService

  return { mockService, addBlockFn }
}

/**
 * Build the test layer from a mock WorldService.
 */
const createTestLayer = (mockService: WorldService) =>
  TerrainService.Default.pipe(
    Layer.provide(Layer.succeed(WorldService, mockService))
  )

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const TEST_WORLD_ID = WorldIdSchema.make('test-world')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/terrain/flat', () => {
  describe('generateFlatWorld — GRASS blocks at y=0', () => {
    it('should call addBlock with GRASS and y=0 for every position', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      // All calls must use blockType 'GRASS' and y=0
      for (const call of addBlockFn.mock.calls as AddBlockCall[]) {
        const position = call[1] as Position
        const blockType = call[2] as BlockType
        expect(blockType).toBe('GRASS')
        expect(position.y).toBe(0)
      }
    })

    it('should call addBlock with y=0 for every block when size=3', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 3)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      for (const call of addBlockFn.mock.calls as AddBlockCall[]) {
        const position = call[1] as Position
        expect(position.y).toBe(0)
      }
    })

    it('should generate positions with x=0, z=0 when size=3', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 3)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const positions = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1])
      const hasOrigin = positions.some((p) => p.x === 0 && p.z === 0)
      expect(hasOrigin).toBe(true)
    })
  })

  describe('generateFlatWorld — coordinate range for size=4', () => {
    it('should produce exactly 4x4=16 addBlock calls for size=4', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(addBlockFn).toHaveBeenCalledTimes(16)
    })

    it('should cover x from -2 to 1 (halfSize=2, exclusive upper bound) for size=4', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const xs = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1].x)
      const uniqueXs = Array.from(new Set(xs)).sort((a: number, b: number) => a - b)
      expect(uniqueXs).toEqual([-2, -1, 0, 1])
    })

    it('should cover z from -2 to 1 (halfSize=2, exclusive upper bound) for size=4', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const zs = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1].z)
      const uniqueZs = Array.from(new Set(zs)).sort((a: number, b: number) => a - b)
      expect(uniqueZs).toEqual([-2, -1, 0, 1])
    })

    it('should not include x=-3 or x=2 (outside range) for size=4', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const xs = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1].x)
      expect(xs).not.toContain(-3)
      expect(xs).not.toContain(2)
    })

    it('should produce all 16 unique (x, z) combinations for size=4', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const posKeys = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => {
        const p = call[1]
        return `${p.x},${p.z}`
      })

      const uniqueKeys = new Set(posKeys)
      expect(uniqueKeys.size).toBe(16)

      // Verify every expected combination is present
      for (let x = -2; x < 2; x++) {
        for (let z = -2; z < 2; z++) {
          expect(uniqueKeys.has(`${x},${z}`)).toBe(true)
        }
      }
    })
  })

  describe('generateFlatWorld — worldId propagation', () => {
    it('should pass the given worldId to every addBlock call', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      for (const call of addBlockFn.mock.calls as AddBlockCall[]) {
        expect(call[0]).toBe(TEST_WORLD_ID)
      }
    })

    it('should use a different worldId when a different one is passed', async () => {
      const otherId = WorldIdSchema.make('other-world')
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(otherId, 4)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      for (const call of addBlockFn.mock.calls as AddBlockCall[]) {
        expect(call[0]).toBe(otherId)
        expect(call[0]).not.toBe(TEST_WORLD_ID)
      }
    })

    it('should never mix worldIds across addBlock calls for size=6', async () => {
      const worldId = WorldIdSchema.make('world-6x6')
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(worldId, 6)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const usedWorldIds = new Set((addBlockFn.mock.calls as AddBlockCall[]).map((c) => c[0]))
      expect(usedWorldIds.size).toBe(1)
      expect(usedWorldIds.has(worldId)).toBe(true)
    })
  })

  describe('generateFlatWorld — size=1 (halfSize=0 edge case)', () => {
    it('should produce 0 addBlock calls for size=1 (halfSize=0, empty loop)', async () => {
      // halfSize = Math.floor(1/2) = 0
      // Loop: x from 0 to < 0 — never executes
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 1)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(addBlockFn).toHaveBeenCalledTimes(0)
    })

    it('should succeed without error for size=1', async () => {
      const { mockService } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      const result = await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 1)
        return 'ok'
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(result).toBe('ok')
    })
  })

  describe('generateFlatWorld — size=2', () => {
    it('should produce exactly 4 addBlock calls for size=2', async () => {
      // halfSize = Math.floor(2/2) = 1
      // x in [-1, 0], z in [-1, 0] => 2 * 2 = 4
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 2)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(addBlockFn).toHaveBeenCalledTimes(4)
    })

    it('should use x in [-1, 0] and z in [-1, 0] for size=2', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 2)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const positions = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1])
      const xs = Array.from(new Set(positions.map((p) => p.x))).sort((a: number, b: number) => a - b)
      const zs = Array.from(new Set(positions.map((p) => p.z))).sort((a: number, b: number) => a - b)

      expect(xs).toEqual([-1, 0])
      expect(zs).toEqual([-1, 0])
    })
  })

  describe('generateFlatWorld — effect composition', () => {
    it('should return Effect.Effect<void, WorldError>', async () => {
      const { mockService } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      // If it compiles and resolves, the return type is correct
      const result = await Effect.gen(function* () {
        const service = yield* TerrainService
        const outcome = yield* service.generateFlatWorld(TEST_WORLD_ID, 4)
        return outcome
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      // generateFlatWorld returns void
      expect(result).toBeUndefined()
    })

    it('should propagate WorldError when addBlock fails', async () => {
      const worldId = TEST_WORLD_ID
      const failingImpl = (_id: WorldId, _pos: Position, _bt: BlockType) =>
        Effect.fail(new WorldError({ worldId: _id, reason: 'World not found' }))

      const { mockService } = createMockWorldService(failingImpl)
      const testLayer = createTestLayer(mockService)

      const result = await Effect.gen(function* () {
        const service = yield* TerrainService
        return yield* Effect.either(service.generateFlatWorld(worldId, 4))
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(WorldError)
        expect(result.left._tag).toBe('WorldError')
      }
    })
  })

  describe('TerrainService.Default', () => {
    it('should export TerrainServiceLive as an alias for TerrainService.Default', () => {
      expect(TerrainServiceLive).toBe(TerrainService.Default)
    })

    it('should expose generateFlatWorld method on the service', async () => {
      const { mockService } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        expect(typeof service.generateFlatWorld).toBe('function')
      }).pipe(Effect.provide(testLayer), Effect.runPromise)
    })
  })

  describe('generateFlatWorld — block type placement', () => {
    it('should use GRASS block type for all blocks (flat world has only grass at y=0)', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 6)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      // Every block should be GRASS
      const blockTypes = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[2])
      const uniqueTypes = new Set(blockTypes)
      expect(uniqueTypes.size).toBe(1)
      expect(uniqueTypes.has('GRASS')).toBe(true)
    })

    it('should place all blocks at y=0 (single-layer flat terrain)', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 8)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const yValues = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1].y)
      const uniqueYs = new Set(yValues)
      expect(uniqueYs.size).toBe(1)
      expect(uniqueYs.has(0)).toBe(true)
    })
  })

  describe('generateFlatWorld — chunk boundary positions', () => {
    it('should include blocks at x=0 and z=0 (origin column) for size=8', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 8)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const positions = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1])
      const hasOriginX = positions.some((p) => p.x === 0)
      const hasOriginZ = positions.some((p) => p.z === 0)
      expect(hasOriginX).toBe(true)
      expect(hasOriginZ).toBe(true)
    })

    it('should include blocks at boundary min (x=-halfSize) and max (x=halfSize-1) for size=6', async () => {
      // halfSize = Math.floor(6/2) = 3 → x in [-3, 2]
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 6)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const xs = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1].x)
      expect(xs).toContain(-3)  // min boundary
      expect(xs).toContain(2)   // max boundary (halfSize-1)
      expect(xs).not.toContain(-4)  // outside range
      expect(xs).not.toContain(3)   // outside range
    })

    it('should include blocks at boundary min (z=-halfSize) and max (z=halfSize-1) for size=6', async () => {
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 6)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      const zs = (addBlockFn.mock.calls as AddBlockCall[]).map((call) => call[1].z)
      expect(zs).toContain(-3)
      expect(zs).toContain(2)
      expect(zs).not.toContain(-4)
      expect(zs).not.toContain(3)
    })
  })

  describe('generateFlatWorld — large size', () => {
    it('should produce correct number of blocks for size=10', async () => {
      // halfSize = 5, so 10x10 = 100 blocks
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 10)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(addBlockFn).toHaveBeenCalledTimes(100)
    })
  })

  describe('generateFlatWorld — size=0 (empty)', () => {
    it('should produce 0 addBlock calls for size=0', async () => {
      // halfSize = Math.floor(0/2) = 0 → empty loop
      const { mockService, addBlockFn } = createMockWorldService()
      const testLayer = createTestLayer(mockService)

      await Effect.gen(function* () {
        const service = yield* TerrainService
        yield* service.generateFlatWorld(TEST_WORLD_ID, 0)
      }).pipe(Effect.provide(testLayer), Effect.runPromise)

      expect(addBlockFn).toHaveBeenCalledTimes(0)
    })
  })
})
