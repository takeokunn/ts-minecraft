import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { BlockId } from '@ts-minecraft/core'
import { Block } from '@ts-minecraft/block/domain/block'
import { BlockRegistry } from '@ts-minecraft/block/application/block-registry'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTestBlock = (type: Block['type'], idSuffix: string): Block =>
  new Block({
    id: BlockId.make(`block:${idSuffix}`),
    type,
    properties: {
      hardness: 50,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
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

// ---------------------------------------------------------------------------
// application/block-registry
// ---------------------------------------------------------------------------

describe('application/block-registry', () => {
  it.effect('register adds a block that can be retrieved with get', () =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry
      const block = makeTestBlock('STONE', 'stone-custom')

      yield* registry.register(block)

      const result = yield* registry.get('STONE')
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).type).toBe('STONE')
    }).pipe(Effect.provide(BlockRegistry.Default))
  )

  it.effect('get returns Option.some for a registered block type', () =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry
      const block = makeTestBlock('DIRT', 'dirt-custom')

      yield* registry.register(block)

      const result = yield* registry.get('DIRT')
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).id).toBe(block.id)
    }).pipe(Effect.provide(BlockRegistry.Default))
  )

  it.effect('get returns Option.none for an unregistered block type', () =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry

      // Remove any default registration for BEDROCK by calling dispose first,
      // then re-register only blocks we control.
      yield* registry.dispose()

      const result = yield* registry.get('BEDROCK')
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(BlockRegistry.Default))
  )

  it.effect('getAll returns all registered blocks', () =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry

      // Start from a clean slate so block count is deterministic.
      yield* registry.dispose()

      const blockA = makeTestBlock('SAND', 'sand-a')
      const blockB = makeTestBlock('GRAVEL', 'gravel-b')
      yield* registry.register(blockA)
      yield* registry.register(blockB)

      const all = yield* registry.getAll()
      expect(all.length).toBe(2)
      const types = Arr.map(all, (b) => b.type)
      expect(types).toContain('SAND')
      expect(types).toContain('GRAVEL')
    }).pipe(Effect.provide(BlockRegistry.Default))
  )

  it.effect('dispose clears all registered blocks', () =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry

      // Register a block, then dispose — getAll should return empty.
      yield* registry.register(makeTestBlock('WOOD', 'wood-test'))
      yield* registry.dispose()

      const all = yield* registry.getAll()
      expect(all.length).toBe(0)
    }).pipe(Effect.provide(BlockRegistry.Default))
  )

  it.effect('register overwrites an existing block with the same type', () =>
    Effect.gen(function* () {
      const registry = yield* BlockRegistry

      yield* registry.dispose()

      const original = makeTestBlock('IRON_ORE', 'iron-ore-original')
      const updated = new Block({
        id: BlockId.make('block:iron-ore-updated'),
        type: 'IRON_ORE',
        properties: {
          hardness: 80,
          transparency: false,
          solid: true,
          emissive: false,
          friction: 0.6,
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

      yield* registry.register(original)
      yield* registry.register(updated)

      const result = yield* registry.get('IRON_ORE')
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).id).toBe(updated.id)
    }).pipe(Effect.provide(BlockRegistry.Default))
  )
})
