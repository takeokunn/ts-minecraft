import { describe, it } from '@effect/vitest'
import { Effect, Schema, Option } from 'effect'
import { expect } from 'vitest'
import { BlockRegistry, BlockRegistryLive } from './blockRegistry'
import { BlockIdSchema, BlockSchema } from './block'

describe('BlockRegistry', () => {
  describe('initialization', () => {
    it('should have all six initial blocks registered', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const allBlocks = yield* registry.getAll()

        expect(allBlocks).toHaveLength(6)

        const blockTypes = allBlocks.map((block) => block.type)
        expect(blockTypes).toContain('AIR')
        expect(blockTypes).toContain('DIRT')
        expect(blockTypes).toContain('STONE')
        expect(blockTypes).toContain('WOOD')
        expect(blockTypes).toContain('GRASS')
        expect(blockTypes).toContain('SAND')
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should have correct initial block IDs', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const airBlock = yield* registry.get('AIR')
        expect(Option.isSome(airBlock)).toBe(true)

        const airId = Option.match(airBlock, {
          onNone: () => null,
          onSome: (block) => block.id,
        })
        expect(airId).toBe('block:air')

        const dirtBlock = yield* registry.get('DIRT')
        expect(Option.isSome(dirtBlock)).toBe(true)

        const dirtId = Option.match(dirtBlock, {
          onNone: () => null,
          onSome: (block) => block.id,
        })
        expect(dirtId).toBe('block:dirt')
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })
  })

  describe('register', () => {
    it('should add a new block to registry', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const newBlockData = {
          id: 'block:diamond' as const,
          type: 'STONE' as const,
          properties: {
            hardness: 100,
            transparency: false,
            solid: true,
            emissive: true,
            friction: 0.9,
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

        const newBlock = Effect.runSync(Schema.decode(BlockSchema)(newBlockData))
        yield* registry.register(newBlock)

        const retrievedBlock = yield* registry.get('STONE')
        expect(Option.isSome(retrievedBlock)).toBe(true)

        const block = Option.match(retrievedBlock, {
          onNone: () => null,
          onSome: (b) => b,
        })
        expect(block).toHaveProperty('id', 'block:diamond')
        expect(block?.properties.hardness).toBe(100)
        expect(block?.properties.friction).toBe(0.9)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should update an existing block', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const updatedBlockData = {
          id: 'block:stone' as const,
          type: 'STONE' as const,
          properties: {
            hardness: 90,
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

        const updatedBlock = Effect.runSync(Schema.decode(BlockSchema)(updatedBlockData))
        yield* registry.register(updatedBlock)

        const retrievedBlock = yield* registry.get('STONE')
        expect(Option.isSome(retrievedBlock)).toBe(true)

        const block = Option.match(retrievedBlock, {
          onNone: () => null,
          onSome: (b) => b,
        })
        expect(block?.properties.hardness).toBe(90)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should not affect other block types when updating', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const originalDirt = yield* registry.get('DIRT')
        expect(Option.isSome(originalDirt)).toBe(true)

        const updatedStoneData = {
          id: 'block:stone' as const,
          type: 'STONE' as const,
          properties: {
            hardness: 99,
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

        const updatedStone = Effect.runSync(Schema.decode(BlockSchema)(updatedStoneData))
        yield* registry.register(updatedStone)

        const dirtAfterUpdate = yield* registry.get('DIRT')
        expect(Option.isSome(dirtAfterUpdate)).toBe(true)

        const dirt = Option.match(dirtAfterUpdate, {
          onNone: () => null,
          onSome: (b) => b,
        })
        const originalDirtBlock = Option.match(originalDirt, {
          onNone: () => null,
          onSome: (b) => b,
        })

        expect(dirt?.id).toBe(originalDirtBlock?.id)
        expect(dirt?.properties.hardness).toBe(originalDirtBlock?.properties.hardness)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })
  })

  describe('get', () => {
    it('should return Option.Some for registered block types', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const blockTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'] as const

        for (const blockType of blockTypes) {
          const block = yield* registry.get(blockType)
          expect(Option.isSome(block)).toBe(true)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should return Option.None for unregistered block types', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const block = yield* registry.get('WATER' as any)
        expect(Option.isNone(block)).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should return correct block for each type', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const airBlock = yield* registry.get('AIR')
        const air = Option.match(airBlock, {
          onNone: () => null,
          onSome: (b) => b,
        })
        expect(air).toHaveProperty('type', 'AIR')
        expect(air?.properties.solid).toBe(false)

        const grassBlock = yield* registry.get('GRASS')
        const grass = Option.match(grassBlock, {
          onNone: () => null,
          onSome: (b) => b,
        })
        expect(grass).toHaveProperty('type', 'GRASS')
        expect(grass?.properties.emissive).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })
  })

  describe('getAll', () => {
    it('should return all registered blocks', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const allBlocks = yield* registry.getAll()

        expect(allBlocks).toHaveLength(6)
        expect(Array.isArray(allBlocks)).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should return blocks with all required properties', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const allBlocks = yield* registry.getAll()

        for (const block of allBlocks) {
          expect(block).toHaveProperty('id')
          expect(block).toHaveProperty('type')
          expect(block).toHaveProperty('properties')
          expect(block).toHaveProperty('faces')
          expect(block?.properties).toHaveProperty('hardness')
          expect(block?.properties).toHaveProperty('transparency')
          expect(block?.properties).toHaveProperty('solid')
          expect(block?.properties).toHaveProperty('emissive')
          expect(block?.properties).toHaveProperty('friction')
          expect(block?.faces).toHaveProperty('top')
          expect(block?.faces).toHaveProperty('bottom')
          expect(block?.faces).toHaveProperty('north')
          expect(block?.faces).toHaveProperty('south')
          expect(block?.faces).toHaveProperty('east')
          expect(block?.faces).toHaveProperty('west')
        }
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should include newly registered blocks', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const initialBlocks = yield* registry.getAll()
        expect(initialBlocks).toHaveLength(6)

        const newBlockData = {
          id: 'block:obsidian' as const,
          type: 'DIRT' as const,
          properties: {
            hardness: 100,
            transparency: false,
            solid: true,
            emissive: false,
            friction: 0.9,
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

        const newBlock = Effect.runSync(Schema.decode(BlockSchema)(newBlockData))
        yield* registry.register(newBlock)

        const allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(6)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })
  })

  describe('dispose', () => {
    it('should clear all registered blocks', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        let allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(6)

        yield* registry.dispose()

        allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(0)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should make get return Option.None for all types', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        yield* registry.dispose()

        const blockTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'] as const

        for (const blockType of blockTypes) {
          const block = yield* registry.get(blockType)
          expect(Option.isNone(block)).toBe(true)
        }
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })

    it('should allow re-registering after dispose', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        yield* registry.dispose()

        const newBlockData = {
          id: 'block:test' as const,
          type: 'STONE' as const,
          properties: {
            hardness: 50,
            transparency: false,
            solid: true,
            emissive: false,
            friction: 0.5,
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

        const newBlock = Effect.runSync(Schema.decode(BlockSchema)(newBlockData))
        yield* registry.register(newBlock)

        const allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(1)

        const retrievedBlock = yield* registry.get('STONE')
        expect(Option.isSome(retrievedBlock)).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })
  })

  describe('integration scenarios', () => {
    it('should support complex workflow: dispose, register multiple, retrieve', () => {
      const program = Effect.gen(function* () {
        const registry = yield* BlockRegistry

        yield* registry.dispose()

        const ironBlockData = {
          id: 'block:iron' as const,
          type: 'STONE' as const,
          properties: {
            hardness: 80,
            transparency: false,
            solid: true,
            emissive: false,
            friction: 0.7,
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

        const goldBlockData = {
          id: 'block:gold' as const,
          type: 'DIRT' as const,
          properties: {
            hardness: 60,
            transparency: false,
            solid: true,
            emissive: true,
            friction: 0.5,
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

        const newBlocks = [
          Effect.runSync(Schema.decode(BlockSchema)(ironBlockData)),
          Effect.runSync(Schema.decode(BlockSchema)(goldBlockData)),
        ]

        for (const block of newBlocks) {
          yield* registry.register(block)
        }

        const allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(2)

        const stoneBlock = yield* registry.get('STONE')
        expect(Option.isSome(stoneBlock)).toBe(true)

        const stoneId = Option.match(stoneBlock, {
          onNone: () => null,
          onSome: (b) => b.id,
        })
        expect(stoneId).toBe('block:iron')

        const dirtBlock = yield* registry.get('DIRT')
        expect(Option.isSome(dirtBlock)).toBe(true)

        const dirtId = Option.match(dirtBlock, {
          onNone: () => null,
          onSome: (b) => b.id,
        })
        expect(dirtId).toBe('block:gold')
      })

      Effect.runSync(program.pipe(Effect.provide(BlockRegistryLive)))
    })
  })
})
