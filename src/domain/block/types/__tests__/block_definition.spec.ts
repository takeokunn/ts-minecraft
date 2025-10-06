import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as fc from 'effect/FastCheck'
import { makeBlockTag } from '../../value_object/block_identity'
import { makeBlockDefinition, makeInteractiveBlock, makeLiquidBlock, makeStandardBlock } from '../block_definition'

const propertyConfig: fc.Parameters = { numRuns: 64 }

const blockIdArbitrary = fc.string({ minLength: 1, maxLength: 32 }).filter((value) => /^[a-z0-9_]+$/.test(value))

const blockNameArbitrary = fc
  .string({ minLength: 1, maxLength: 32, charSet: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ' })
  .map((value) => (value.trim().length === 0 ? 'Block' : value.trim()))

const blockTagArbitrary = fc
  .string({ minLength: 1, maxLength: 16, charSet: 'abcdefghijklmnopqrstuvwxyz0123456789_-' })
  .filter((value) => /^[a-z0-9][a-z0-9_-]*$/.test(value))

describe('block_definition', () => {
  it.effect('標準ブロックを生成する', () =>
    makeStandardBlock({ id: 'stone', name: 'Stone' }).pipe(
      Effect.tap((definition) =>
        Effect.sync(() => {
          expect(definition._tag).toBe('Standard')
          expect(definition.identity.id).toBe('stone')
        })
      )
    )
  )

  it.effect('液体ブロックを生成する', () =>
    makeLiquidBlock({ id: 'water', name: 'Water', viscosity: 1.5, flowRange: 4 }).pipe(
      Effect.tap((definition) =>
        Effect.sync(() => {
          expect(definition._tag).toBe('Liquid')
          expect(definition.viscosity).toBe(1.5)
        })
      )
    )
  )

  it.effect('インタラクティブブロックを生成する', () =>
    makeInteractiveBlock({ id: 'chest', name: 'Chest', interactionId: 'container', inventorySize: 27 }).pipe(
      Effect.tap((definition) =>
        Effect.sync(() => {
          expect(definition._tag).toBe('Interactive')
          expect(definition.inventorySize).toBe(27)
        })
      )
    )
  )

  it.effect('ID検証エラーを変換する', () =>
    makeStandardBlock({ id: 'Stone', name: 'Invalid' }).pipe(
      Effect.flip,
      Effect.tap((error) => Effect.sync(() => expect(error._tag).toBe('IdentityError')))
    )
  )

  it.effect('液体スキーマ検証エラーを変換する', () =>
    makeLiquidBlock({ id: 'water', name: 'Water', viscosity: 0, flowRange: 0 }).pipe(
      Effect.flip,
      Effect.tap((error) => Effect.sync(() => expect(error._tag).toBe('LiquidError')))
    )
  )

  it.effect('kind指定でブロックを生成する', () =>
    makeBlockDefinition({ kind: 'interactive', id: 'furnace', name: 'Furnace', interactionId: 'furnace' }).pipe(
      Effect.tap((definition) => Effect.sync(() => expect(definition._tag).toBe('Interactive')))
    )
  )

  it('有効なBlockIdで標準ブロックを生成できる (PBT)', () =>
    fc.assert(
      fc.property(
        blockIdArbitrary,
        blockNameArbitrary,
        fc.array(blockTagArbitrary, { maxLength: 3 }),
        (id, name, tags) => {
          const definition = Effect.runSync(
            makeStandardBlock({
              id,
              name,
              ...(tags.length > 0 ? { tags } : {}),
            })
          )

          expect(definition._tag).toBe('Standard')
          expect(definition.identity.id).toBe(id)
          if (tags.length > 0) {
            expect(definition.identity.tags).toEqual(tags)
          } else {
            expect(definition.identity.tags).toHaveLength(0)
          }
        }
      ),
      propertyConfig
    ))

  it.effect('タグ付きブロックを生成する', () =>
    Effect.gen(function* () {
      const tag = yield* makeBlockTag('flammable')
      return yield* makeStandardBlock({
        id: 'campfire',
        name: 'Campfire',
        tags: [tag],
        properties: { physics: { flammable: true } },
      })
    }).pipe(Effect.tap((definition) => Effect.sync(() => expect(definition.identity.tags).toEqual(['flammable']))))
  )
})
