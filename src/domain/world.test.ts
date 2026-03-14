import { describe, it, expect } from 'vitest'
import { it as effectIt } from '@effect/vitest'
import { Effect, Either, Option, Schema } from 'effect'
import { WorldService, WorldStateSchema, positionToKey, keyToPosition } from '@/domain/world'
import type { WorldId, Position } from '@/shared/kernel'

const testWorldId = 'world-1' as WorldId
const TestLayer = WorldService.Default

describe('WorldService', () => {
  describe('create', () => {
    effectIt.effect('should create a world successfully', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should not fail when creating a world with the same id twice (idempotent)', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.create(testWorldId)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should create multiple worlds with different ids', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create('world-a' as WorldId)
        yield* service.create('world-b' as WorldId)
        yield* service.create('world-c' as WorldId)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('addBlock', () => {
    effectIt.effect('should add a block to a world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 0, y: 64, z: 0 }, 'STONE')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should fail with WorldError when adding a block to a non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.addBlock('nonexistent' as WorldId, { x: 0, y: 0, z: 0 }, 'DIRT')
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('nonexistent')
          expect(result.left.reason).toContain('World not found')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should overwrite an existing block at the same position', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const pos: Position = { x: 5, y: 10, z: 15 }
        yield* service.addBlock(testWorldId, pos, 'STONE')
        yield* service.addBlock(testWorldId, pos, 'DIRT')
        const block = yield* service.getBlock(testWorldId, pos)
        expect(Option.isSome(block)).toBe(true)
        if (Option.isSome(block)) {
          expect(block.value).toBe('DIRT')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should add multiple blocks at different positions', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.addBlock(testWorldId, { x: 1, y: 0, z: 0 }, 'DIRT')
        yield* service.addBlock(testWorldId, { x: 0, y: 1, z: 0 }, 'GRASS')

        const b1 = yield* service.getBlock(testWorldId, { x: 0, y: 0, z: 0 })
        const b2 = yield* service.getBlock(testWorldId, { x: 1, y: 0, z: 0 })
        const b3 = yield* service.getBlock(testWorldId, { x: 0, y: 1, z: 0 })
        expect(Option.getOrNull(b1)).toBe('STONE')
        expect(Option.getOrNull(b2)).toBe('DIRT')
        expect(Option.getOrNull(b3)).toBe('GRASS')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('getBlock', () => {
    effectIt.effect('should return Some(blockType) for an existing block', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 3, y: 64, z: 7 }, 'WOOD')
        const block = yield* service.getBlock(testWorldId, { x: 3, y: 64, z: 7 })
        expect(Option.isSome(block)).toBe(true)
        if (Option.isSome(block)) {
          expect(block.value).toBe('WOOD')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should return None for a non-existing block position', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const block = yield* service.getBlock(testWorldId, { x: 999, y: 999, z: 999 })
        expect(Option.isNone(block)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should fail with WorldError when querying a non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlock('nonexistent' as WorldId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('nonexistent')
          expect(result.left.reason).toContain('World not found')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should return None for an empty world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const block = yield* service.getBlock(testWorldId, { x: 0, y: 0, z: 0 })
        expect(Option.isNone(block)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should include position in WorldError when world not found', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlock('missing' as WorldId, { x: 10, y: 20, z: 30 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.position).toEqual([10, 20, 30])
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('removeBlock', () => {
    effectIt.effect('should remove an existing block', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const pos: Position = { x: 5, y: 64, z: 5 }
        yield* service.addBlock(testWorldId, pos, 'STONE')
        yield* service.removeBlock(testWorldId, pos)
        const block = yield* service.getBlock(testWorldId, pos)
        expect(Option.isNone(block)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should not fail when removing a non-existing block from a valid world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.removeBlock(testWorldId, { x: 999, y: 999, z: 999 })
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should fail with WorldError when removing from a non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.removeBlock('nonexistent' as WorldId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('nonexistent')
          expect(result.left.reason).toContain('World not found')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should only remove the targeted block, not others', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.addBlock(testWorldId, { x: 1, y: 0, z: 0 }, 'DIRT')
        yield* service.removeBlock(testWorldId, { x: 0, y: 0, z: 0 })

        const removed = yield* service.getBlock(testWorldId, { x: 0, y: 0, z: 0 })
        const remaining = yield* service.getBlock(testWorldId, { x: 1, y: 0, z: 0 })
        expect(Option.isNone(removed)).toBe(true)
        expect(Option.getOrNull(remaining)).toBe('DIRT')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('getBlocksInArea', () => {
    effectIt.effect('should return blocks within the bounding box', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 1, y: 1, z: 1 }, 'STONE')
        yield* service.addBlock(testWorldId, { x: 2, y: 2, z: 2 }, 'DIRT')
        yield* service.addBlock(testWorldId, { x: 5, y: 5, z: 5 }, 'WOOD')

        const blocks = yield* service.getBlocksInArea(
          testWorldId,
          { x: 0, y: 0, z: 0 },
          { x: 3, y: 3, z: 3 }
        )
        expect(blocks.length).toBe(2)
        const blockTypes = blocks.map(([_, bt]) => bt).sort()
        expect(blockTypes).toEqual(['DIRT', 'STONE'])
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should return empty array when no blocks in area', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 100, y: 100, z: 100 }, 'STONE')

        const blocks = yield* service.getBlocksInArea(
          testWorldId,
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 10, z: 10 }
        )
        expect(blocks.length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should return empty array for an empty world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const blocks = yield* service.getBlocksInArea(
          testWorldId,
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 10, z: 10 }
        )
        expect(blocks.length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should fail with WorldError for a non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlocksInArea(
            'nonexistent' as WorldId,
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 10, z: 10 }
          )
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.reason).toContain('World not found')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should include boundary positions (min and max are inclusive)', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.addBlock(testWorldId, { x: 3, y: 3, z: 3 }, 'DIRT')

        const blocks = yield* service.getBlocksInArea(
          testWorldId,
          { x: 0, y: 0, z: 0 },
          { x: 3, y: 3, z: 3 }
        )
        expect(blocks.length).toBe(2)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should return correct positions for each block', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const pos: Position = { x: 2, y: 3, z: 4 }
        yield* service.addBlock(testWorldId, pos, 'SAND')

        const blocks = yield* service.getBlocksInArea(
          testWorldId,
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 5, z: 5 }
        )
        expect(blocks.length).toBe(1)
        expect(blocks[0]![0]).toEqual(pos)
        expect(blocks[0]![1]).toBe('SAND')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should handle single-point area (min === max)', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const pos: Position = { x: 5, y: 5, z: 5 }
        yield* service.addBlock(testWorldId, pos, 'GLASS')

        const blocks = yield* service.getBlocksInArea(testWorldId, pos, pos)
        expect(blocks.length).toBe(1)
        expect(blocks[0]![1]).toBe('GLASS')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('dispose', () => {
    effectIt.effect('should dispose a world so subsequent operations fail', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.dispose(testWorldId)

        const result = yield* Effect.either(
          service.getBlock(testWorldId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.reason).toContain('World not found')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should not fail when disposing a non-existent world (idempotent)', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.dispose('nonexistent' as WorldId)
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should not affect other worlds when disposing one', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const worldA = 'world-a' as WorldId
        const worldB = 'world-b' as WorldId
        yield* service.create(worldA)
        yield* service.create(worldB)
        yield* service.addBlock(worldA, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.addBlock(worldB, { x: 0, y: 0, z: 0 }, 'DIRT')

        yield* service.dispose(worldA)

        const block = yield* service.getBlock(worldB, { x: 0, y: 0, z: 0 })
        expect(Option.getOrNull(block)).toBe('DIRT')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should allow re-creating a world after dispose', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.dispose(testWorldId)

        yield* service.create(testWorldId)
        const block = yield* service.getBlock(testWorldId, { x: 0, y: 0, z: 0 })
        expect(Option.isNone(block)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Error paths: operations on non-existent world', () => {
    effectIt.effect('addBlock should fail with WorldError for non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.addBlock('missing' as WorldId, { x: 0, y: 0, z: 0 }, 'STONE')
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('missing')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('getBlock should fail with WorldError for non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlock('missing' as WorldId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('missing')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('removeBlock should fail with WorldError for non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.removeBlock('missing' as WorldId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('missing')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('getBlocksInArea should fail with WorldError for non-existent world', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlocksInArea('missing' as WorldId, { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
          expect(result.left.worldId).toBe('missing')
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Effect.catchTag compatibility', () => {
    effectIt.effect('should catch WorldError with catchTag on addBlock', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* service.addBlock('missing' as WorldId, { x: 0, y: 0, z: 0 }, 'STONE').pipe(
          Effect.catchTag('WorldError', (e) => Effect.succeed(`caught: ${e.worldId}`))
        )
        expect(result).toBe('caught: missing')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch WorldError with catchTag on getBlock', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* service.getBlock('missing' as WorldId, { x: 0, y: 0, z: 0 }).pipe(
          Effect.catchTag('WorldError', (e) => Effect.succeed(`caught: ${e.reason}`))
        )
        expect(result).toBe('caught: World not found')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch WorldError with catchTag on removeBlock', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* service.removeBlock('missing' as WorldId, { x: 0, y: 0, z: 0 }).pipe(
          Effect.catchTag('WorldError', (e) => Effect.succeed(`caught: ${e.worldId}`))
        )
        expect(result).toBe('caught: missing')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should catch WorldError with catchTag on getBlocksInArea', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* service.getBlocksInArea(
          'missing' as WorldId,
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 5, z: 5 }
        ).pipe(
          Effect.catchTag('WorldError', (e) => Effect.succeed(`caught: ${e.reason}`))
        )
        expect(result).toBe('caught: World not found')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('WorldError should have correct _tag for discrimination', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlock('missing' as WorldId, { x: 0, y: 0, z: 0 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('WorldError')
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('multiple worlds isolation', () => {
    effectIt.effect('should isolate blocks between two worlds', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const worldA = 'world-alpha' as WorldId
        const worldB = 'world-beta' as WorldId
        yield* service.create(worldA)
        yield* service.create(worldB)

        yield* service.addBlock(worldA, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.addBlock(worldB, { x: 0, y: 0, z: 0 }, 'DIRT')

        const blockA = yield* service.getBlock(worldA, { x: 0, y: 0, z: 0 })
        const blockB = yield* service.getBlock(worldB, { x: 0, y: 0, z: 0 })

        expect(Option.getOrNull(blockA)).toBe('STONE')
        expect(Option.getOrNull(blockB)).toBe('DIRT')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should not affect other worlds when removing a block', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const worldA = 'world-alpha' as WorldId
        const worldB = 'world-beta' as WorldId
        yield* service.create(worldA)
        yield* service.create(worldB)

        yield* service.addBlock(worldA, { x: 0, y: 0, z: 0 }, 'STONE')
        yield* service.addBlock(worldB, { x: 0, y: 0, z: 0 }, 'DIRT')
        yield* service.removeBlock(worldA, { x: 0, y: 0, z: 0 })

        const blockA = yield* service.getBlock(worldA, { x: 0, y: 0, z: 0 })
        const blockB = yield* service.getBlock(worldB, { x: 0, y: 0, z: 0 })

        expect(Option.isNone(blockA)).toBe(true)
        expect(Option.getOrNull(blockB)).toBe('DIRT')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should isolate getBlocksInArea between worlds', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const worldA = 'world-alpha' as WorldId
        const worldB = 'world-beta' as WorldId
        yield* service.create(worldA)
        yield* service.create(worldB)

        yield* service.addBlock(worldA, { x: 1, y: 1, z: 1 }, 'STONE')
        yield* service.addBlock(worldA, { x: 2, y: 2, z: 2 }, 'WOOD')
        yield* service.addBlock(worldB, { x: 1, y: 1, z: 1 }, 'DIRT')

        const blocksA = yield* service.getBlocksInArea(
          worldA,
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 5, z: 5 }
        )
        const blocksB = yield* service.getBlocksInArea(
          worldB,
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 5, z: 5 }
        )

        expect(blocksA.length).toBe(2)
        expect(blocksB.length).toBe(1)
        expect(blocksB[0]![1]).toBe('DIRT')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('helper functions', () => {
    it('positionToKey should produce a comma-separated string', () => {
      expect(positionToKey({ x: 1, y: 2, z: 3 })).toBe('1,2,3')
    })

    it('positionToKey should handle negative coordinates', () => {
      expect(positionToKey({ x: -10, y: -20, z: -30 })).toBe('-10,-20,-30')
    })

    it('positionToKey should handle zero coordinates', () => {
      expect(positionToKey({ x: 0, y: 0, z: 0 })).toBe('0,0,0')
    })

    it('keyToPosition should parse a comma-separated string back to Position', () => {
      const pos = keyToPosition('1,2,3')
      expect(pos).toEqual({ x: 1, y: 2, z: 3 })
    })

    it('keyToPosition should handle negative coordinates', () => {
      const pos = keyToPosition('-10,-20,-30')
      expect(pos).toEqual({ x: -10, y: -20, z: -30 })
    })

    it('positionToKey and keyToPosition should be inverse operations', () => {
      const original: Position = { x: 42, y: -7, z: 100 }
      const key = positionToKey(original)
      const restored = keyToPosition(key)
      expect(restored).toEqual(original)
    })
  })

  describe('WorldStateSchema', () => {
    it('should decode a valid world state', () => {
      const data = {
        id: 'world-1',
        blocks: { '0,0,0': 'STONE', '1,2,3': 'DIRT' },
      }
      const result = Schema.decodeUnknownSync(WorldStateSchema)(data)
      expect(result.id).toBe('world-1')
      expect(result.blocks['0,0,0']).toBe('STONE')
      expect(result.blocks['1,2,3']).toBe('DIRT')
    })

    it('should reject world state with missing id', () => {
      expect(() =>
        Schema.decodeUnknownSync(WorldStateSchema)({ blocks: {} })
      ).toThrow()
    })

    it('should reject world state with invalid block type', () => {
      expect(() =>
        Schema.decodeUnknownSync(WorldStateSchema)({
          id: 'world-1',
          blocks: { '0,0,0': 'INVALID_BLOCK' },
        })
      ).toThrow()
    })

    it('should accept world state with empty blocks', () => {
      const data = { id: 'empty-world', blocks: {} }
      const result = Schema.decodeUnknownSync(WorldStateSchema)(data)
      expect(result.id).toBe('empty-world')
      expect(Object.keys(result.blocks).length).toBe(0)
    })
  })

  describe('service structure', () => {
    it('should provide all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* WorldService
        expect(typeof service.create).toBe('function')
        expect(typeof service.addBlock).toBe('function')
        expect(typeof service.removeBlock).toBe('function')
        expect(typeof service.getBlock).toBe('function')
        expect(typeof service.getBlocksInArea).toBe('function')
        expect(typeof service.dispose).toBe('function')
        return { success: true }
      })
      const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))
      expect(result.success).toBe(true)
    })
  })

  describe('negative coordinate handling', () => {
    effectIt.effect('should handle blocks at negative coordinates', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        const pos: Position = { x: -5, y: -10, z: -15 }
        yield* service.addBlock(testWorldId, pos, 'COBBLESTONE')
        const block = yield* service.getBlock(testWorldId, pos)
        expect(Option.getOrNull(block)).toBe('COBBLESTONE')
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should find blocks at negative coordinates in getBlocksInArea', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        yield* service.create(testWorldId)
        yield* service.addBlock(testWorldId, { x: -2, y: -1, z: -3 }, 'GRAVEL')

        const blocks = yield* service.getBlocksInArea(
          testWorldId,
          { x: -5, y: -5, z: -5 },
          { x: 0, y: 0, z: 0 }
        )
        expect(blocks.length).toBe(1)
        expect(blocks[0]![1]).toBe('GRAVEL')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('WorldError message format', () => {
    effectIt.effect('should produce WorldError with position in message', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.addBlock('missing' as WorldId, { x: 10, y: 20, z: 30 }, 'STONE')
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.message).toContain('missing')
          expect(result.left.message).toContain('10')
          expect(result.left.message).toContain('20')
          expect(result.left.message).toContain('30')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    effectIt.effect('should produce WorldError without position for getBlocksInArea', () =>
      Effect.gen(function* () {
        const service = yield* WorldService
        const result = yield* Effect.either(
          service.getBlocksInArea('missing' as WorldId, { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 })
        )
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.position).toBeUndefined()
          expect(result.left.message).not.toContain('at (')
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
