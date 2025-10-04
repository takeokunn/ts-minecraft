import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as fc from 'effect/FastCheck'
import { assembleIdentity, makeBlockId, makeBlockName, makeBlockPosition, makeBlockTag, makeBlockTags } from '../block_identity'

const propertyConfig: fc.Parameters = { numRuns: 64 }

const blockIdArbitrary = fc
  .string({ minLength: 1, maxLength: 32, charSet: 'abcdefghijklmnopqrstuvwxyz0123456789_' })
  .filter((value) => /^[a-z0-9_]+$/.test(value))

describe('block_identity', () => {
  it.effect('BlockIdを生成できる', () =>
    makeBlockId('stone').pipe(Effect.tap((id) => Effect.sync(() => expect(id).toBe('stone'))))
  )

  it.effect('BlockIdの検証に失敗する', () =>
    makeBlockId('Stone').pipe(
      Effect.flip,
      Effect.tap((error) => Effect.sync(() => expect(error._tag).toBe('BlockIdInvalid')))
    )
  )

  it('BlockIdSchemaに適合する文字列は必ず生成できる (PBT)', () =>
    fc.assert(
      fc.property(blockIdArbitrary, (value) => {
        const id = Effect.runSync(makeBlockId(value))
        expect(id).toBe(value)
      }),
      propertyConfig
    )
  )

  it.effect('BlockTagとBlockNameを組み立てられる', () =>
    Effect.all({
      tag: makeBlockTag('mineable'),
      name: makeBlockName('Stone'),
    }).pipe(
      Effect.tap(({ tag, name }) =>
        Effect.sync(() => {
          expect(tag).toBe('mineable')
          expect(name).toBe('Stone')
        })
      )
    )
  )

  it.effect('タグリストを生成できる', () =>
    makeBlockTags(['mineable', 'stone']).pipe(
      Effect.tap((tags) => Effect.sync(() => expect(tags).toEqual(['mineable', 'stone'])))
    )
  )

  it.effect('BlockIdentityを組み立てる', () =>
    assembleIdentity({ id: 'stone', name: 'Stone', tags: ['mineable'] }).pipe(
      Effect.tap((identity) =>
        Effect.sync(() => {
          expect(identity.id).toBe('stone')
          expect(identity.name).toBe('Stone')
          expect(identity.tags).toEqual(['mineable'])
        })
      )
    )
  )

  it.effect('BlockPositionを生成できる', () =>
    makeBlockPosition({ x: 1, y: 64, z: -32 }).pipe(
      Effect.tap((position) => Effect.sync(() => expect(position).toEqual({ x: 1, y: 64, z: -32 })))
    )
  )
})
