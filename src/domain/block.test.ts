import { describe, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { expect } from 'vitest'
import { BlockTypeSchema, BlockPropertiesSchema, BlockSchema, BlockType } from './block'

describe('BlockTypeSchema', () => {
  describe('validation', () => {
    it('should accept valid block types', () => {
      const validTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'] as const

      for (const type of validTypes) {
        const result = Schema.decode(BlockTypeSchema)(type)
        expect(Effect.runSync(result)).toBe(type)
      }
    })

    it('should reject invalid block types', () => {
      const invalidTypes = ['WATER', 'LAVA', 'DIAMOND', 'GOLD'] as const

      for (const type of invalidTypes) {
        const result = Schema.decode(BlockTypeSchema)(type)
        expect(() => Effect.runSync(result)).toThrow()
      }
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
    it('should accept valid properties', () => {
      const validProperties = {
        hardness: 50,
        transparency: false,
        solid: true,
        emissive: false,
        friction: 0.6,
      }

      const result = Schema.decode(BlockPropertiesSchema)(validProperties)
      const decoded = Effect.runSync(result)

      expect(decoded).toEqual(validProperties)
    })

    it('should reject hardness outside 0-100 range', () => {
      const invalidHardnessValues = [-1, -50, 101, 200]

      for (const hardness of invalidHardnessValues) {
        const invalidProperties = {
          hardness,
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.6,
        }

        const result = Schema.decode(BlockPropertiesSchema)(invalidProperties)
        expect(() => Effect.runSync(result)).toThrow()
      }
    })

    it('should reject friction outside 0-1 range', () => {
      const invalidFrictionValues = [-0.1, -1, 1.1, 2]

      for (const friction of invalidFrictionValues) {
        const invalidProperties = {
          hardness: 50,
          transparency: false,
          solid: true,
          emissive: false,
          friction,
        }

        const result = Schema.decode(BlockPropertiesSchema)(invalidProperties)
        expect(() => Effect.runSync(result)).toThrow()
      }
    })

    it('should accept hardness at boundary values', () => {
      const boundaryValues = [0, 100]

      for (const hardness of boundaryValues) {
        const validProperties = {
          hardness,
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.5,
        }

        const result = Schema.decode(BlockPropertiesSchema)(validProperties)
        const decoded = Effect.runSync(result)

        expect(decoded.hardness).toBe(hardness)
      }
    })

    it('should accept friction at boundary values', () => {
      const boundaryValues = [0, 1]

      for (const friction of boundaryValues) {
        const validProperties = {
          hardness: 50,
          transparency: false,
          solid: true,
          emissive: false,
          friction,
        }

        const result = Schema.decode(BlockPropertiesSchema)(validProperties)
        const decoded = Effect.runSync(result)

        expect(decoded.friction).toBe(friction)
      }
    })
  })

  describe('boolean properties', () => {
    it('should accept all boolean combinations', () => {
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

      for (const { transparency, solid, emissive } of combinations) {
        const validProperties = {
          hardness: 50,
          transparency,
          solid,
          emissive,
          friction: 0.5,
        }

        const result = Schema.decode(BlockPropertiesSchema)(validProperties)
        const decoded = Effect.runSync(result)

        expect(decoded.transparency).toBe(transparency)
        expect(decoded.solid).toBe(solid)
        expect(decoded.emissive).toBe(emissive)
      }
    })
  })
})

describe('BlockSchema', () => {
  describe('make', () => {
    it('should create a valid block using Schema.make', () => {
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

      const result = Schema.decode(BlockSchema)(blockData)
      const block = Effect.runSync(result)
      expect(block).toEqual(blockData)
    })
  })

  describe('decode', () => {
    it('should decode a valid block', () => {
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

      const result = Schema.decode(BlockSchema)(blockData)
      const decoded = Effect.runSync(result)

      expect(decoded).toEqual(blockData)
    })

    it('should reject block with invalid properties', () => {
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

      const result = Schema.decode(BlockSchema)(invalidBlockData)
      expect(() => Effect.runSync(result)).toThrow()
    })

    it('should decode all six block types', () => {
      const blockTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'] as const

      for (const type of blockTypes) {
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

        const result = Schema.decode(BlockSchema)(blockData)
        const decoded = Effect.runSync(result)

        expect(decoded.type).toBe(type)
      }
    })
  })

  describe('encode', () => {
    it('should encode a block', () => {
      const block = {
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

      const result = Schema.encode(BlockSchema)(block)
      const encoded = Effect.runSync(result)

      expect(encoded).toEqual(block)
    })
  })
})
