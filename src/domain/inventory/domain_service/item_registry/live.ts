/**
 * Item Registry Service Live Implementation
 *
 * アイテムレジストリドメインサービスの純粋なドメインロジック実装。
 */

import { Effect, Layer } from 'effect'
import {
  getAllDefaultItemDefinitions,
  getDefaultItemDefinition,
  getDefaultItemsByCategory,
  getItemStackLimit,
  itemExists,
  searchDefaultItems,
} from './index'
import { ItemRegistryError, ItemRegistryService } from './index'

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

        if (!definition) {
          yield* Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId))
        }

        return definition!
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

        if (!sourceDefinition || !targetDefinition) {
          yield* Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', !sourceDefinition ? sourceItemId : targetItemId))
        }

        const reasons: string[] = []

        // 同じアイテムかチェック
        if (sourceItemId !== targetItemId) {
          reasons.push('Different item types')
        }

        // スタッキングルールチェック
        if (!sourceDefinition!.constraints.stackingRules.allowStacking) {
          reasons.push('Source item does not allow stacking')
        }

        if (!targetDefinition!.constraints.stackingRules.allowStacking) {
          reasons.push('Target item does not allow stacking')
        }

        // メタデータ要件チェック
        if (
          sourceDefinition!.constraints.stackingRules.requiresIdenticalMetadata &&
          targetDefinition!.constraints.stackingRules.requiresIdenticalMetadata
        ) {
          // 実際のメタデータ比較は別のレイヤーで行う
          // ここではルールの存在のみチェック
        }

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

        if (!exists) {
          yield* Effect.fail(new ItemRegistryError('ITEM_NOT_FOUND', itemId))
        }

        return yield* getItemStackLimit(itemId)
      }),

    /**
     * アイテム存在確認
     */
    exists: itemExists,
  })
)
