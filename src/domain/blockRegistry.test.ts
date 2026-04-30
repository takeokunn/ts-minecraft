import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Option, Schema } from 'effect'
import { expect } from 'vitest'
import { BlockRegistry, BlockRegistryLive, initialBlocks } from './block-registry'
import { Block } from './block'

const expectedInitialBlockCount = new Set(Arr.map(initialBlocks, (block) => block.type)).size

describe('BlockRegistry', () => {
  describe('initialization', () => {
    it.effect('should have all initial blocks registered', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry
        const allBlocks = yield* registry.getAll()

        expect(allBlocks).toHaveLength(expectedInitialBlockCount)

        const blockTypes = Arr.map(allBlocks, (block) => block.type)
        expect(blockTypes).toContain('AIR')
        expect(blockTypes).toContain('DIRT')
        expect(blockTypes).toContain('STONE')
        expect(blockTypes).toContain('WOOD')
        expect(blockTypes).toContain('GRASS')
        expect(blockTypes).toContain('SAND')
        expect(blockTypes).toContain('WATER')
        expect(blockTypes).toContain('LEAVES')
        expect(blockTypes).toContain('GLASS')
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should have correct initial block IDs', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const cases = [
          ['AIR', 'block:air'],
          ['DIRT', 'block:dirt'],
        ] as const

        yield* Effect.forEach(cases, ([blockType, expectedId]) =>
          registry.get(blockType).pipe(
            Effect.map((block) => {
              expect(Option.getOrThrow(block).id).toBe(expectedId)
            }),
          )
        , { concurrency: 1 })
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('register', () => {
    it.effect('should add a new block to registry', () =>
      Effect.gen(function* () {
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

        const newBlock = yield* Schema.decode(Block)(newBlockData)
        yield* registry.register(newBlock)

        const block = Option.getOrThrow(yield* registry.get('STONE'))
        expect(block).toHaveProperty('id', 'block:diamond')
        expect(block.properties.hardness).toBe(100)
        expect(block.properties.friction).toBe(0.9)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should update an existing block', () =>
      Effect.gen(function* () {
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

        const updatedBlock = yield* Schema.decode(Block)(updatedBlockData)
        yield* registry.register(updatedBlock)

        const block = Option.getOrThrow(yield* registry.get('STONE'))
        expect(block.properties.hardness).toBe(90)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should not affect other block types when updating', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const originalDirtBlock = Option.getOrThrow(yield* registry.get('DIRT'))

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

        const updatedStone = yield* Schema.decode(Block)(updatedStoneData)
        yield* registry.register(updatedStone)

        const dirt = Option.getOrThrow(yield* registry.get('DIRT'))

        expect(dirt.id).toBe(originalDirtBlock.id)
        expect(dirt.properties.hardness).toBe(originalDirtBlock.properties.hardness)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('get', () => {
    it.effect('should return Option.Some for registered block types', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const blockTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'] as const

        yield* Effect.forEach(blockTypes, (blockType) =>
          registry.get(blockType).pipe(Effect.map(block => expect(Option.isSome(block)).toBe(true)))
        , { concurrency: 1 })
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should return Option.None for unregistered block types', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const block = yield* registry.get('NETHERRACK' as any)
        expect(block).toStrictEqual(Option.none())
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should return correct block for each type', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const air = Option.getOrThrow(yield* registry.get('AIR'))
        expect(air).toHaveProperty('type', 'AIR')
        expect(air.properties.solid).toBe(false)

        const grass = Option.getOrThrow(yield* registry.get('GRASS'))
        expect(grass).toHaveProperty('type', 'GRASS')
        expect(grass.properties.emissive).toBe(false)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('getAll', () => {
    it.effect('should return all registered blocks', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const allBlocks = yield* registry.getAll()

        expect(allBlocks).toHaveLength(expectedInitialBlockCount)
        expect(Array.isArray(allBlocks)).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should return blocks with all required properties', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const allBlocks = yield* registry.getAll()

        Arr.forEach(allBlocks, (block) => {
          expect(block).toHaveProperty('id')
          expect(block).toHaveProperty('type')
          expect(block).toHaveProperty('properties')
          expect(block).toHaveProperty('faces')
          expect(block.properties).toHaveProperty('hardness')
          expect(block.properties).toHaveProperty('transparency')
          expect(block.properties).toHaveProperty('solid')
          expect(block.properties).toHaveProperty('emissive')
          expect(block.properties).toHaveProperty('friction')
          expect(block.faces).toHaveProperty('top')
          expect(block.faces).toHaveProperty('bottom')
          expect(block.faces).toHaveProperty('north')
          expect(block.faces).toHaveProperty('south')
          expect(block.faces).toHaveProperty('east')
          expect(block.faces).toHaveProperty('west')
        })
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should include newly registered blocks', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        const initialBlocks = yield* registry.getAll()
        expect(initialBlocks).toHaveLength(expectedInitialBlockCount)

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

        const newBlock = yield* Schema.decode(Block)(newBlockData)
        yield* registry.register(newBlock)

        const allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(expectedInitialBlockCount)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('dispose', () => {
    it.effect('should clear all registered blocks', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        let allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(expectedInitialBlockCount)

        yield* registry.dispose()

        allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(0)
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should make get return Option.None for all types', () =>
      Effect.gen(function* () {
        const registry = yield* BlockRegistry

        yield* registry.dispose()

        const blockTypes = ['AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'] as const

        yield* Effect.forEach(blockTypes, (blockType) =>
          registry.get(blockType).pipe(Effect.map((block) => expect(block).toStrictEqual(Option.none())))
        , { concurrency: 1 })
      }).pipe(Effect.provide(BlockRegistryLive))
    )

    it.effect('should allow re-registering after dispose', () =>
      Effect.gen(function* () {
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

        const newBlock = yield* Schema.decode(Block)(newBlockData)
        yield* registry.register(newBlock)

        const allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(1)

        expect(Option.isSome(yield* registry.get('STONE'))).toBe(true)
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })

  describe('integration scenarios', () => {
    it.effect('should support complex workflow: dispose, register multiple, retrieve', () =>
      Effect.gen(function* () {
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

        const ironBlock = yield* Schema.decode(Block)(ironBlockData)
        const goldBlock = yield* Schema.decode(Block)(goldBlockData)
        const newBlocks = [ironBlock, goldBlock]

        yield* Effect.forEach(newBlocks, (block) => registry.register(block), { concurrency: 1 })

        const allBlocks = yield* registry.getAll()
        expect(allBlocks).toHaveLength(2)

        const cases = [
          ['STONE', 'block:iron'],
          ['DIRT', 'block:gold'],
        ] as const

        yield* Effect.forEach(cases, ([blockType, expectedId]) =>
          registry.get(blockType).pipe(
            Effect.map((block) => {
              expect(Option.getOrThrow(block).id).toBe(expectedId)
            }),
          )
        , { concurrency: 1 })
      }).pipe(Effect.provide(BlockRegistryLive))
    )
  })
})
