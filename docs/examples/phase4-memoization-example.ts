/**
 * Phase 4.2: Effect.cachedFunction 実装例
 *
 * Item Registry Serviceにメモ化を導入する例
 * このファイルは実装のリファレンスとして使用してください
 */

import { Effect, Layer, Match, Option, ReadonlyArray, pipe } from 'effect'
import type { ItemId } from '../domain/inventory/types/core'

// ========================================
// Before: メモ化なし
// ========================================

export const ItemRegistryServiceLive_Before = Layer.effect(
  ItemRegistryService,
  Effect.gen(function* () {
    return ItemRegistryService.of({
      /**
       * アイテム定義取得
       *
       * 問題点:
       * - 同じitemIdで何度も呼ばれる
       * - getDefaultItemDefinition()は毎回実行される
       * - 大量のアイテム検索時にパフォーマンス低下
       */
      getItemDefinition: (itemId) =>
        Effect.gen(function* () {
          // ❌ 毎回実行される
          const definition = yield* getDefaultItemDefinition(itemId)

          return yield* pipe(
            Option.fromNullable(definition),
            Option.match({
              onNone: () => Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId)),
              onSome: (def) => Effect.succeed(def),
            })
          )
        }),
    })
  })
)

// ========================================
// After: Effect.cachedFunction 導入
// ========================================

export const ItemRegistryServiceLive_After = Layer.effect(
  ItemRegistryService,
  Effect.gen(function* () {
    /**
     * ✅ アイテム定義取得をメモ化
     *
     * 利点:
     * - 同じitemIdの場合、キャッシュから即座に返却
     * - getDefaultItemDefinition()は各itemIdで1回のみ実行
     * - CPU負荷削減: 10-30%（使用頻度による）
     */
    const getDefinitionCached = yield* Effect.cachedFunction((itemId: ItemId) => getDefaultItemDefinition(itemId))

    return ItemRegistryService.of({
      getItemDefinition: (itemId) =>
        Effect.gen(function* () {
          // ✅ キャッシュから取得
          const definition = yield* getDefinitionCached(itemId)

          return yield* pipe(
            Option.fromNullable(definition),
            Option.match({
              onNone: () => Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId)),
              onSome: (def) => Effect.succeed(def),
            })
          )
        }),

      /**
       * スタック制限取得もメモ化
       */
      getStackLimit: (itemId) =>
        Effect.gen(function* () {
          const exists = yield* itemExists(itemId)

          return yield* pipe(
            Match.value(exists),
            Match.when(false, () => Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId))),
            Match.when(true, () => {
              // ✅ 既にメモ化された定義を使用
              return Effect.gen(function* () {
                const definition = yield* getDefinitionCached(itemId)
                return definition?.constraints.stackingRules.maxStackSize ?? 1
              })
            }),
            Match.exhaustive
          )
        }),
    })
  })
)

// ========================================
// パフォーマンステスト
// ========================================

/**
 * ベンチマーク: メモ化の効果測定
 *
 * 実行方法:
 * ```typescript
 * import { Effect } from 'effect'
 *
 * Effect.runPromise(benchmarkItemRegistry).then(console.log)
 * ```
 */
export const benchmarkItemRegistry = Effect.gen(function* () {
  const iterations = 1000
  const testItemIds = ['minecraft:stone', 'minecraft:dirt', 'minecraft:wood']

  // ========================================
  // Test 1: メモ化なし
  // ========================================
  const serviceWithoutCache = yield* Effect.provide(ItemRegistryService, ItemRegistryServiceLive_Before)

  const start1 = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

  const iterationIndices = ReadonlyArray.fromIterable(Array.from({ length: iterations }, (_, i) => i))

  yield* pipe(
    iterationIndices,
    Effect.forEach(
      () => Effect.forEach(testItemIds, (itemId) => serviceWithoutCache.getItemDefinition(itemId), { discard: true }),
      { discard: true }
    )
  )

  const end1 = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  const time1 = end1 - start1

  // ========================================
  // Test 2: メモ化あり
  // ========================================
  const serviceWithCache = yield* Effect.provide(ItemRegistryService, ItemRegistryServiceLive_After)

  const start2 = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

  yield* pipe(
    iterationIndices,
    Effect.forEach(
      () => Effect.forEach(testItemIds, (itemId) => serviceWithCache.getItemDefinition(itemId), { discard: true }),
      { discard: true }
    )
  )

  const end2 = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  const time2 = end2 - start2

  // ========================================
  // 結果出力
  // ========================================
  const improvement = ((time1 - time2) / time1) * 100

  yield* Effect.logInfo(`\n=== Item Registry メモ化ベンチマーク ===`)
  yield* Effect.logInfo(`反復回数: ${iterations * testItemIds.length}`)
  yield* Effect.logInfo(`\nメモ化なし: ${time1}ms`)
  yield* Effect.logInfo(`メモ化あり: ${time2}ms`)
  yield* Effect.logInfo(`\n改善率: ${improvement.toFixed(2)}%`)

  return {
    withoutCache: time1,
    withCache: time2,
    improvement: improvement,
  }
})

// ========================================
// 実装のベストプラクティス
// ========================================

/**
 * ✅ Good: 純粋関数のメモ化
 */
const goodExample = Effect.gen(function* () {
  // 計算コストが高く、同じ入力で繰り返し呼ばれる関数
  const expensiveComputation = (id: string) =>
    Effect.gen(function* () {
      // 複雑な計算...
      yield* Effect.sleep('50 millis')
      return `result-${id}`
    })

  const cached = yield* Effect.cachedFunction(expensiveComputation)

  // 同じIDは1回のみ計算
  const r1 = yield* cached('item1') // 計算実行
  const r2 = yield* cached('item1') // キャッシュから返却
  const r3 = yield* cached('item2') // 新しいIDなので計算実行
})

/**
 * ❌ Bad: 副作用のある関数のメモ化
 */
const badExample = Effect.gen(function* () {
  // 副作用があるため、メモ化すべきでない
  const withSideEffect = () =>
    Effect.gen(function* () {
      const timestamp = yield* Effect.sync(() => Date.now())
      return timestamp
    })

  // ❌ 常に同じ結果を返してしまう（意図しない動作）
  const cached = yield* Effect.cachedFunction(withSideEffect)

  const t1 = yield* cached() // 1704067200000
  yield* Effect.sleep('1000 millis')
  const t2 = yield* cached() // 1704067200000 (同じ値！)
})

/**
 * ⚠️ Warning: メモリリークに注意
 */
const memoryLeakExample = Effect.gen(function* () {
  // ❌ 大きなデータ構造を永続的にメモ化
  const getAllItems = () =>
    Effect.succeed(
      Array.from({ length: 100000 }, (_, i) => ({
        id: `item-${i}`,
        data: new Array(1000).fill(i),
      }))
    )

  const cached = yield* Effect.cachedFunction(getAllItems)

  // ずっとメモリに残り続ける（約800MB）

  // ✅ 解決策: TTL設定
  const cachedWithTTL = () => Effect.cachedWithTTL(getAllItems(), '1 minute')
})

// ========================================
// 統合テスト例
// ========================================

import { describe, expect, it } from '@effect/vitest'

describe('ItemRegistryService with memoization', () => {
  it('should cache item definitions', () =>
    Effect.gen(function* () {
      const service = yield* Effect.provide(ItemRegistryService, ItemRegistryServiceLive_After)

      // 1回目: 実際に取得
      const def1 = yield* service.getItemDefinition('minecraft:stone')

      // 2回目: キャッシュから取得（高速）
      const start = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      const def2 = yield* service.getItemDefinition('minecraft:stone')
      const end = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

      // キャッシュから取得したため、ほぼ即座に返る（< 1ms）
      expect(end - start).toBeLessThan(1)
      expect(def1).toEqual(def2)
    }))

  it('should handle different item IDs separately', () =>
    Effect.gen(function* () {
      const service = yield* Effect.provide(ItemRegistryService, ItemRegistryServiceLive_After)

      const stone = yield* service.getItemDefinition('minecraft:stone')
      const dirt = yield* service.getItemDefinition('minecraft:dirt')

      // 異なるアイテムは別々にキャッシュ
      expect(stone).not.toEqual(dirt)
    }))
})

// ========================================
// 次のステップ
// ========================================

/**
 * このパターンを他の箇所にも適用できます：
 *
 * 1. Biome Lookup Cache
 *    - src/domain/world/repository/biome_system_repository/biome_cache.ts
 *    - getBiomeAt() をメモ化
 *
 * 2. Recipe Lookup
 *    - src/domain/crafting/repository/recipe_repository.ts
 *    - getRecipe() をメモ化
 *
 * 3. Block Property Lookup
 *    - src/domain/block/repository/block_repository.ts
 *    - getBlockProperties() をメモ化
 *
 * 注意: 各実装前に必ずベンチマークで効果を測定すること！
 */
