/**
 * Item Registry Service Live Implementation
 *
 * アイテムレジストリドメインサービスの純粋なドメインロジック実装。
 */

import { Effect, Layer, Match, Option, pipe } from 'effect'
import {
  getAllDefaultItemDefinitions,
  getDefaultItemDefinition,
  getDefaultItemsByCategory,
  getItemStackLimit,
  itemExists,
  ItemRegistryError,
  ItemRegistryService,
  searchDefaultItems,
} from './index'

/**
 * アイテムレジストリサービスのLive実装
 */
export const ItemRegistryServiceLive = Layer.succeed(
  ItemRegistryService,
  ItemRegistryService.of({
    /**
     * アイテム定義取得
     */
    getItemDefinition: (itemId) =>
      Effect.gen(function* () {
        const definition = yield* getDefaultItemDefinition(itemId)

        return yield* pipe(
          Option.fromNullable(definition),
          Option.match({
            onNone: () => Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId)),
            onSome: (def) => Effect.succeed(def),
          })
        )
      }),

    /**
     * 全アイテム定義取得
     */
    getAllItemDefinitions: getAllDefaultItemDefinitions,

    /**
     * カテゴリ別アイテム検索
     */
    getItemsByCategory: getDefaultItemsByCategory,

    /**
     * アイテム検索
     */
    searchItems: (criteria) =>
      Effect.gen(function* () {
        return yield* searchDefaultItems(criteria)
      }),

    /**
     * アイテム互換性チェック
     */
    checkCompatibility: (sourceItemId, targetItemId) =>
      Effect.gen(function* () {
        const sourceDefinition = yield* getDefaultItemDefinition(sourceItemId)
        const targetDefinition = yield* getDefaultItemDefinition(targetItemId)

        // 定義が存在するか検証
        const [validatedSource, validatedTarget] = yield* pipe(
          [sourceDefinition, targetDefinition] as const,
          Match.value,
          Match.when(
            ([src, tgt]) => !src || !tgt,
            ([src]) => Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', !src ? sourceItemId : targetItemId))
          ),
          Match.orElse(([src, tgt]) => Effect.succeed([src!, tgt!] as const))
        )

        const reasons: string[] = []

        // 同じアイテムかチェック
        pipe(
          Match.value(sourceItemId !== targetItemId),
          Match.when(true, () => reasons.push('Different item types')),
          Match.when(false, () => undefined),
          Match.exhaustive
        )

        // スタッキングルールチェック
        pipe(
          Match.value(validatedSource.constraints.stackingRules.allowStacking),
          Match.when(false, () => reasons.push('Source item does not allow stacking')),
          Match.orElse(() => undefined)
        )

        pipe(
          Match.value(validatedTarget.constraints.stackingRules.allowStacking),
          Match.when(false, () => reasons.push('Target item does not allow stacking')),
          Match.orElse(() => undefined)
        )

        // メタデータ要件チェック（ルールの存在のみ確認）
        // 実際のメタデータ比較は別のレイヤーで行う

        return {
          compatible: reasons.length === 0,
          reasons,
        }
      }),

    /**
     * スタック制限取得
     */
    getStackLimit: (itemId) =>
      Effect.gen(function* () {
        const exists = yield* itemExists(itemId)

        return yield* pipe(
          Match.value(exists),
          Match.when(false, () => Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId))),
          Match.when(true, () => getItemStackLimit(itemId)),
          Match.exhaustive
        )
      }),

    /**
     * アイテム存在確認
     */
    exists: itemExists,
  })
)
