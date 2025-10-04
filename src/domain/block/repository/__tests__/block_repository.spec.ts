import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import { makeStandardBlock } from '../../types/block_definition'
import { makeBlockId } from '../../value_object/block_identity'
import { BlockRepositoryError, makeInMemory } from '../block_repository'

const createBlock = (id: string, name: string, tags?: ReadonlyArray<string>) => makeStandardBlock({ id, name, tags })

describe('block_repository', () => {
  it.effect('ブロックを保存して取得する', () =>
    Effect.gen(function* () {
      const repository = yield* makeInMemory
      const block = yield* createBlock('stone', 'Stone')
      yield* repository.insert(block)
      const stored = yield* repository.get(block.identity.id)
      expect(stored.identity.id).toBe('stone')
    })
  )

  it.effect('重複保存を防ぐ', () =>
    Effect.gen(function* () {
      const repository = yield* makeInMemory
      const block = yield* createBlock('stone', 'Stone')
      yield* repository.insert(block)
      const duplicated = repository.insert(block)
      const error = yield* duplicated.pipe(Effect.flip)
      expect(error).toEqual(BlockRepositoryError.AlreadyExists({ id: block.identity.id }))
    })
  )

  it.effect('登録されていないIDでエラーを返す', () =>
    Effect.gen(function* () {
      const repository = yield* makeInMemory
      const missing = yield* makeBlockId('missing')
      const result = repository.get(missing)
      const error = yield* result.pipe(Effect.flip)
      expect(error._tag).toBe('NotFound')
    })
  )

  it.effect('一覧取得とタグフィルタを提供する', () =>
    Effect.gen(function* () {
      const repository = yield* makeInMemory
      const stone = yield* createBlock('stone', 'Stone', ['mineable'])
      const ore = yield* createBlock('coal_ore', 'Coal Ore', ['ore'])
      yield* repository.insert(stone)
      yield* repository.insert(ore)
      const list = yield* repository.list
      expect(list.length).toBe(2)
      const tag = stone.identity.tags[0]
      const filtered = yield* repository.filterByTag(tag)
      expect(filtered.some((item) => item.identity.id === 'stone')).toBe(true)
    })
  )

  it.effect('削除結果を返す', () =>
    Effect.gen(function* () {
      const repository = yield* makeInMemory
      const block = yield* createBlock('stone', 'Stone')
      yield* repository.insert(block)
      const removed = yield* repository.remove(block.identity.id)
      const removedAgain = yield* repository.remove(block.identity.id)
      expect(removed).toBe(true)
      expect(removedAgain).toBe(false)
    })
  )
})
