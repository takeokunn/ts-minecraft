import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import { provideLayers } from '../../../testing/effect'
import { BlockFactory, BlockFactoryLive } from '../block_factory'

describe('block_factory', () => {
  const withFactory = <A>(effect: Effect.Effect<A>) => provideLayers(effect, BlockFactoryLive)

  it.effect('標準ブロックを生成する', () =>
    withFactory(
      Effect.gen(function* () {
        const factory = yield* BlockFactory
        const block = yield* factory.standard({ id: 'stone', name: 'Stone' })
        expect(block._tag).toBe('Standard')
        return block
      })
    )
  )

  it.effect('kind指定でブロックを生成する', () =>
    withFactory(
      Effect.gen(function* () {
        const factory = yield* BlockFactory
        const block = yield* factory.fromKind({
          kind: 'liquid',
          id: 'water',
          name: 'Water',
          viscosity: 1,
          flowRange: 4,
        })
        expect(block._tag).toBe('Liquid')
        return block
      })
    )
  )
})
