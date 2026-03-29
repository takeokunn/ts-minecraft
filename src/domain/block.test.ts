import { describe, it } from '@effect/vitest'
import { Effect, Either, Schema } from 'effect'
import { expect } from 'vitest'
import { BlockTypeSchema, BlockPropertiesSchema, Block, BlockType, BlockIdSchema } from './block'

describe('BlockTypeSchema', () => {
  describe('validation', () => {
    it.effect('should accept valid block types', () => {
      const validTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE'] as const
      return Effect.forEach(validTypes, (type) =>
        Effect.gen(function* () {
          const result = yield* Schema.decode(BlockTypeSchema)(type)
          expect(result).toBe(type)
        })
      , { concurrency: 1, discard: true })
    })

    it.effect('should reject invalid block types', () => {
      const invalidTypes = ['BEDROCK', 'LAVA', 'DIAMOND', 'GOLD'] as const
      return Effect.forEach(invalidTypes, (type) =>
        Effect.gen(function* () {
          const result = yield* Effect.either(Schema.decodeUnknown(BlockTypeSchema)(type))
          expect(Either.isLeft(result)).toBe(true)
        })
      , { concurrency: 1, discard: true })
    })
  })

  describe('type inference', () => {
    it('should correctly infer type', () => {
      const blockType: BlockType = 'STONE'
      expect(blockType).toBe('STONE')
    })
  })
})

describe('BlockPropertiesSchema', () => {
  describe('validation', () => {
    it.effect('should accept valid properties', () => {
      const validProperties = {
        hardness: 50,
        transparency: false,
        solid: true,
        emissive: false,
        friction: 0.6,
      }
      return Effect.gen(function* () {
        const decoded = yield* Schema.decode(BlockPropertiesSchema)(validProperties)
        expect(decoded).toEqual(validProperties)
      })
    })

    it.effect('should reject hardness outside 0-100 range', () => {
      const invalidHardnessValues = [-1, -50, 101, 200]
      return Effect.forEach(invalidHardnessValues, (hardness) =>
        Effect.gen(function* () {
          const invalidProperties = {
            hardness,
            transparency: false,
            solid: true,
            emissive: false,
            friction: 0.6,
          }
          const result = yield* Effect.either(Schema.decode(BlockPropertiesSchema)(invalidProperties))
          expect(Either.isLeft(result)).toBe(true)
        })
      , { concurrency: 1, discard: true })
    })

    it.effect('should reject friction outside 0-1 range', () => {
      const invalidFrictionValues = [-0.1, -1, 1.1, 2]
      return Effect.forEach(invalidFrictionValues, (friction) =>
        Effect.gen(function* () {
          const invalidProperties = {
            hardness: 50,
            transparency: false,
            solid: true,
            emissive: false,
            friction,
          }
          const result = yield* Effect.either(Schema.decode(BlockPropertiesSchema)(invalidProperties))
          expect(Either.isLeft(result)).toBe(true)
        })
      , { concurrency: 1, discard: true })
    })

    it.effect('should accept hardness at boundary values', () => {
      const boundaryValues = [0, 100]
      return Effect.forEach(boundaryValues, (hardness) =>
        Effect.gen(function* () {
          const validProperties = {
            hardness,
            transparency: false,
            solid: true,
            emissive: false,
            friction: 0.5,
          }
          const decoded = yield* Schema.decode(BlockPropertiesSchema)(validProperties)
          expect(decoded.hardness).toBe(hardness)
        })
      , { concurrency: 1, discard: true })
    })

    it.effect('should accept friction at boundary values', () => {
      const boundaryValues = [0, 1]
      return Effect.forEach(boundaryValues, (friction) =>
        Effect.gen(function* () {
          const validProperties = {
            hardness: 50,
            transparency: false,
            solid: true,
            emissive: false,
            friction,
          }
          const decoded = yield* Schema.decode(BlockPropertiesSchema)(validProperties)
          expect(decoded.friction).toBe(friction)
        })
      , { concurrency: 1, discard: true })
    })
  })

  describe('boolean properties', () => {
    it.effect('should accept all boolean combinations', () => {
      const combinations = [
        { transparency: true, solid: true, emissive: true },
        { transparency: true, solid: true, emissive: false },
        { transparency: true, solid: false, emissive: true },
        { transparency: true, solid: false, emissive: false },
        { transparency: false, solid: true, emissive: true },
        { transparency: false, solid: true, emissive: false },
        { transparency: false, solid: false, emissive: true },
        { transparency: false, solid: false, emissive: false },
      ]
      return Effect.forEach(combinations, ({ transparency, solid, emissive }) =>
        Effect.gen(function* () {
          const validProperties = {
            hardness: 50,
            transparency,
            solid,
            emissive,
            friction: 0.5,
          }
          const decoded = yield* Schema.decode(BlockPropertiesSchema)(validProperties)
          expect(decoded.transparency).toBe(transparency)
          expect(decoded.solid).toBe(solid)
          expect(decoded.emissive).toBe(emissive)
        })
      , { concurrency: 1, discard: true })
    })
  })
})

describe('Block', () => {
  describe('make', () => {
    it.effect('should create a valid block using Schema.make', () => {
      const blockData = {
        id: 'block:test' as const,
        type: 'STONE' as const,
        properties: {
          hardness: 100,
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.8,
        },
        faces: {
          top: true,
          bottom: true,
          north: true,
          south: true,
          east: true,
          west: true,
        },
      }
      return Effect.gen(function* () {
        const block = yield* Schema.decode(Block)(blockData)
        expect(block).toEqual(blockData)
      })
    })
  })

  describe('decode', () => {
    it.effect('should decode a valid block', () => {
      const blockData = {
        id: 'block:stone' as const,
        type: 'STONE' as const,
        properties: {
          hardness: 100,
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.8,
        },
        faces: {
          top: true,
          bottom: true,
          north: true,
          south: true,
          east: true,
          west: true,
        },
      }
      return Effect.gen(function* () {
        const decoded = yield* Schema.decode(Block)(blockData)
        expect(decoded).toEqual(blockData)
      })
    })

    it.effect('should reject block with invalid properties', () => {
      const invalidBlockData = {
        id: 'block:invalid' as const,
        type: 'STONE' as const,
        properties: {
          hardness: 150, // Invalid: > 100
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.8,
        },
        faces: {
          top: true,
          bottom: true,
          north: true,
          south: true,
          east: true,
          west: true,
        },
      }
      return Effect.gen(function* () {
        const result = yield* Effect.either(Schema.decode(Block)(invalidBlockData))
        expect(Either.isLeft(result)).toBe(true)
      })
    })

    it.effect('should decode all twelve block types', () => {
      const blockTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'WATER', 'LEAVES', 'GLASS', 'SNOW', 'GRAVEL', 'COBBLESTONE'] as const
      return Effect.forEach(blockTypes, (type) =>
        Effect.gen(function* () {
          const blockData = {
            id: `block:${type.toLowerCase()}` as const,
            type,
            properties: {
              hardness: type === 'AIR' ? 0 : 50,
              transparency: type === 'AIR',
              solid: type !== 'AIR',
              emissive: type === 'GRASS',
              friction: 0.6,
            },
            faces: {
              top: type !== 'AIR',
              bottom: type !== 'AIR',
              north: type !== 'AIR',
              south: type !== 'AIR',
              east: type !== 'AIR',
              west: type !== 'AIR',
            },
          }
          const decoded = yield* Schema.decode(Block)(blockData)
          expect(decoded.type).toBe(type)
        })
      , { concurrency: 1, discard: true })
    })
  })

  describe('encode', () => {
    it.effect('should encode a block', () => {
      const block = new Block({
        id: Schema.decodeSync(BlockIdSchema)('block:stone'),
        type: 'STONE' as const,
        properties: {
          hardness: 100,
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.8,
        },
        faces: {
          top: true,
          bottom: true,
          north: true,
          south: true,
          east: true,
          west: true,
        },
      })
      return Effect.gen(function* () {
        const encoded = yield* Schema.encodeUnknown(Block)(block)
        expect(encoded).toEqual(block)
      })
    })
  })
})
