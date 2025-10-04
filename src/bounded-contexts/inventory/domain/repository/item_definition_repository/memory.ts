import { Effect, HashMap, Layer, Ref } from 'effect'
import type {
  ItemCategory,
  ItemCraftingRecipe,
  ItemDefinition,
  ItemDefinitionQuery,
  ItemDropTable,
  ItemId,
} from '../../types'
import { createDuplicateItemDefinitionError, createItemNotFoundError } from '../types'
import { ItemDefinitionRepository } from './interface'

/**
 * ItemDefinitionRepository Memory Implementation
 *
 * インメモリ実装。テスト・開発用途向け。
 * 高速だが永続化されないため、アプリケーション再起動で消失する。
 */
export const ItemDefinitionRepositoryMemory = Layer.effect(
  ItemDefinitionRepository,
  Effect.gen(function* () {
    // アイテム定義ストア
    const definitionStore = yield* Ref.make(HashMap.empty<ItemId, ItemDefinition>())

    // クラフトレシピストア
    const recipeStore = yield* Ref.make(HashMap.empty<ItemId, ItemCraftingRecipe>())

    // ドロップテーブルストア
    const dropTableStore = yield* Ref.make(HashMap.empty<ItemId, ItemDropTable>())

    return ItemDefinitionRepository.of({
      save: (definition: ItemDefinition) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const exists = HashMap.has(store, definition.id)

          if (exists) {
            yield* Effect.fail(createDuplicateItemDefinitionError(definition.id))
          }

          yield* Ref.update(definitionStore, (store) => HashMap.set(store, definition.id, definition))
        }),

      findById: (id: ItemId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          return HashMap.get(store, id)
        }),

      findByCategory: (category: ItemCategory) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const definitions = Array.from(HashMap.values(store))
          return definitions.filter((def) => def.category === category)
        }),

      findByTag: (tag: string) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const definitions = Array.from(HashMap.values(store))
          return definitions.filter((def) => def.tags?.includes(tag) || false)
        }),

      findByRarity: (rarity: string) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const definitions = Array.from(HashMap.values(store))
          return definitions.filter((def) => def.rarity === rarity)
        }),

      findCraftableItems: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const definitions = Array.from(HashMap.values(store))
          return definitions.filter((def) => def.craftable === true)
        }),

      findAll: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          return Array.from(HashMap.values(store))
        }),

      delete: (id: ItemId) =>
        Effect.gen(function* () {
          yield* Ref.update(definitionStore, (store) => HashMap.remove(store, id))
          // 関連するレシピとドロップテーブルも削除
          yield* Ref.update(recipeStore, (store) => HashMap.remove(store, id))
          yield* Ref.update(dropTableStore, (store) => HashMap.remove(store, id))
        }),

      exists: (id: ItemId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          return HashMap.has(store, id)
        }),

      count: () =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          return HashMap.size(store)
        }),

      saveMany: (definitions: ReadonlyArray<ItemDefinition>) =>
        Effect.gen(function* () {
          // 重複チェック
          const store = yield* Ref.get(definitionStore)
          const duplicates = definitions.filter((def) => HashMap.has(store, def.id))

          if (duplicates.length > 0) {
            yield* Effect.fail(createDuplicateItemDefinitionError(duplicates[0].id))
          }

          yield* Ref.update(definitionStore, (store) => {
            let updatedStore = store
            definitions.forEach((definition) => {
              updatedStore = HashMap.set(updatedStore, definition.id, definition)
            })
            return updatedStore
          })
        }),

      findByQuery: (query: ItemDefinitionQuery) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const definitions = Array.from(HashMap.values(store))

          return definitions.filter((definition) => {
            // 名前フィルター
            if (query.nameContains && !definition.name.toLowerCase().includes(query.nameContains.toLowerCase())) {
              return false
            }

            // カテゴリフィルター
            if (query.categories && !query.categories.includes(definition.category)) {
              return false
            }

            // 必須タグフィルター
            if (query.hasTags && query.hasTags.length > 0) {
              const defTags = definition.tags || []
              const hasAllTags = query.hasTags.every((tag) => defTags.includes(tag))
              if (!hasAllTags) return false
            }

            // 除外タグフィルター
            if (query.excludeTags && query.excludeTags.length > 0) {
              const defTags = definition.tags || []
              const hasExcludedTag = query.excludeTags.some((tag) => defTags.includes(tag))
              if (hasExcludedTag) return false
            }

            // 耐久性フィルター
            if (query.minDurability !== undefined && (definition.durability || 0) < query.minDurability) {
              return false
            }
            if (query.maxDurability !== undefined && (definition.durability || 0) > query.maxDurability) {
              return false
            }

            // スタック可能性フィルター
            if (query.stackable !== undefined) {
              const isStackable = definition.stackSize > 1
              if (query.stackable !== isStackable) return false
            }

            // クラフト可能性フィルター
            if (query.craftable !== undefined && definition.craftable !== query.craftable) {
              return false
            }

            // レアリティフィルター
            if (query.rarity && definition.rarity !== query.rarity) {
              return false
            }

            return true
          })
        }),

      getCraftingRecipe: (itemId: ItemId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(recipeStore)
          return HashMap.get(store, itemId)
        }),

      getDropTable: (itemId: ItemId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(dropTableStore)
          return HashMap.get(store, itemId)
        }),

      update: (definition: ItemDefinition) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(definitionStore)
          const exists = HashMap.has(store, definition.id)

          if (!exists) {
            yield* Effect.fail(createItemNotFoundError(definition.id))
          }

          yield* Ref.update(definitionStore, (store) => HashMap.set(store, definition.id, definition))
        }),

      initialize: () =>
        Effect.gen(function* () {
          // デフォルトアイテム定義のロード（例）
          const defaultItems: ItemDefinition[] = [
            {
              id: 'stone' as ItemId,
              name: 'Stone',
              description: 'A common building block',
              category: 'building',
              stackSize: 64,
              rarity: 'common',
              craftable: false,
              tradeable: true,
              properties: {},
              tags: ['building', 'solid'],
            },
            {
              id: 'wood' as ItemId,
              name: 'Wood',
              description: 'Basic wooden material',
              category: 'material',
              stackSize: 64,
              rarity: 'common',
              craftable: false,
              tradeable: true,
              properties: { flammable: true },
              tags: ['material', 'flammable'],
            },
          ]

          yield* Ref.update(definitionStore, (store) => {
            let updatedStore = store
            defaultItems.forEach((item) => {
              updatedStore = HashMap.set(updatedStore, item.id, item)
            })
            return updatedStore
          })
        }),

      cleanup: () => Effect.void,
    })
  })
)
