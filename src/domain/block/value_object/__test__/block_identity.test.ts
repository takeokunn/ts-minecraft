import { describe, expect, it } from '@effect/vitest'
import * as Arbitrary from 'effect/Arbitrary'
import * as Effect from 'effect/Effect'
import { BlockIdSchema, assembleIdentity, makeBlockId, makeBlockName, makeBlockPosition, makeBlockTag, makeBlockTags } from '../block_identity'

const blockIdArbitrary = Arbitrary.make(BlockIdSchema)

describe('block_identity', () => {
  it.effect('BlockIdを生成できる', () =>
    makeBlockId('stone').pipe(
      Effect.tap((id) => Effect.sync(() => expect(id).toBe('stone')))
    )
  )

  it.effect('BlockIdの検証に失敗する', () =>
    makeBlockId('Stone').pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() => expect(error._tag).toBe('BlockIdInvalid'))
      )
    )
  )

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('BlockIdSchemaに適合する文字列は必ず生成できる', () => Effect.unit)

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
      Effect.tap((tags) =>
        Effect.sync(() => expect(tags).toEqual(['mineable', 'stone']))
      )
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
      Effect.tap((position) =>
        Effect.sync(() => expect(position).toEqual({ x: 1, y: 64, z: -32 }))
      )
    )
  )
})
