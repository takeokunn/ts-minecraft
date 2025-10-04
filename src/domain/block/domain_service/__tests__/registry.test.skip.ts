import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import { provideLayers } from '../../../testing/effect'
import { BlockRegistryLayer, BlockRegistryService } from '../registry'

describe('block_registry_service', () => {
  const withRegistry = <A>(effect: Effect.Effect<A>) => provideLayers(effect, BlockRegistryLayer)

  it.effect('ブロックを登録して取得する', () =>
    withRegistry(
      Effect.gen(function* () {
        const service = yield* BlockRegistryService
        const block = yield* service.registerStandard({ id: 'stone', name: 'Stone' })
        const stored = yield* service.get(block.identity.id)
        expect(block.identity.id).toBe('stone')
        expect(stored.identity.id).toBe('stone')
        return stored
      })
    )
  )

  it.effect('定義エラーを変換する', () =>
    withRegistry(
      Effect.gen(function* () {
        const service = yield* BlockRegistryService
        const error = yield* service.registerStandard({ id: 'Stone', name: 'Invalid' }).pipe(Effect.flip)
        expect(error._tag).toBe('DefinitionError')
        return error
      })
    )
  )

  it.effect('重複登録でRepositoryErrorを返す', () =>
    withRegistry(
      Effect.gen(function* () {
        const service = yield* BlockRegistryService
        const block = yield* service.registerStandard({ id: 'stone', name: 'Stone' })
        const error = yield* service.registerStandard({ id: block.identity.id, name: 'Stone' }).pipe(Effect.flip)
        expect(error._tag).toBe('RepositoryError')
        return error
      })
    )
  )

  it.effect('タグでフィルタリングできる', () =>
    withRegistry(
      Effect.gen(function* () {
        const service = yield* BlockRegistryService
        const block = yield* service.registerStandard({ id: 'campfire', name: 'Campfire', tags: ['fire'] })
        const filtered = yield* service.filterByTag('fire')
        expect(filtered.some((item) => item.identity.id === block.identity.id)).toBe(true)
        return filtered
      })
    )
  )

  it.effect('削除フラグを返す', () =>
    withRegistry(
      Effect.gen(function* () {
        const service = yield* BlockRegistryService
        const block = yield* service.registerStandard({ id: 'stone', name: 'Stone' })
        const removed = yield* service.remove(block.identity.id)
        expect(removed).toBe(true)
        const removedAgain = yield* service.remove(block.identity.id)
        expect(removedAgain).toBe(false)
        return removedAgain
      })
    )
  )
})
