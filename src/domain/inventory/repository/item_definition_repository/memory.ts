import { Effect, HashMap, Layer, Match, Option, ReadonlyArray, Ref, pipe } from 'effect'
import type {
  ItemCategory,
  ItemCraftingRecipe,
  ItemDefinition,
  ItemDefinitionQuery,
  ItemDropTable,
  ItemId,
} from '../../types'
import { createDuplicateItemDefinitionError, createItemNotFoundError } from '../types'
import { ItemDefinitionRepository } from './index'

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
          yield* pipe(
            Match.value(HashMap.has(store, definition.id)),
            Match.when(true, () => Effect.fail(createDuplicateItemDefinitionError(definition.id))),
            Match.orElse(() =>
              Ref.update(definitionStore, (current) => HashMap.set(current, definition.id, definition))
            )
          )
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

          yield* pipe(
            Match.value(duplicates.length > 0),
            Match.when(true, () => Effect.fail(createDuplicateItemDefinitionError(duplicates[0].id))),
            Match.orElse(() => Effect.unit)
          )

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
            const matchesName = pipe(
              Option.fromNullable(query.nameContains),
              Option.match({
                onNone: () => true,
                onSome: (needle) => definition.name.toLowerCase().includes(needle.toLowerCase()),
              })
            )

            const matchesCategory = pipe(
              Option.fromNullable(query.categories),
              Option.match({
                onNone: () => true,
                onSome: (categories) => categories.includes(definition.category),
              })
            )

            const definitionTags = definition.tags ?? []

            const matchesRequiredTags = pipe(
              Option.fromNullable(query.hasTags),
              Option.filter((tags) => tags.length > 0),
              Option.match({
                onNone: () => true,
                onSome: (tags) => tags.every((tag) => definitionTags.includes(tag)),
              })
            )

            const matchesExcludedTags = pipe(
              Option.fromNullable(query.excludeTags),
              Option.filter((tags) => tags.length > 0),
              Option.match({
                onNone: () => true,
                onSome: (tags) => tags.every((tag) => !definitionTags.includes(tag)),
              })
            )

            const durability = definition.durability ?? 0

            const matchesMinDurability = pipe(
              Option.fromNullable(query.minDurability),
              Option.match({
                onNone: () => true,
                onSome: (min) => durability >= min,
              })
            )

            const matchesMaxDurability = pipe(
              Option.fromNullable(query.maxDurability),
              Option.match({
                onNone: () => true,
                onSome: (max) => durability <= max,
              })
            )

            const matchesStackable = pipe(
              Option.fromNullable(query.stackable),
              Option.match({
                onNone: () => true,
                onSome: (shouldBeStackable) => (definition.stackSize > 1) === shouldBeStackable,
              })
            )

            const matchesCraftable = pipe(
              Option.fromNullable(query.craftable),
              Option.match({
                onNone: () => true,
                onSome: (craftable) => definition.craftable === craftable,
              })
            )

            const matchesRarity = pipe(
              Option.fromNullable(query.rarity),
              Option.match({
                onNone: () => true,
                onSome: (rarity) => definition.rarity === rarity,
              })
            )

            return (
              matchesName &&
              matchesCategory &&
              matchesRequiredTags &&
              matchesExcludedTags &&
              matchesMinDurability &&
              matchesMaxDurability &&
              matchesStackable &&
              matchesCraftable &&
              matchesRarity
            )
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
          yield* pipe(
            Match.value(HashMap.has(store, definition.id)),
            Match.when(false, () => Effect.fail(createItemNotFoundError(definition.id))),
            Match.orElse(() =>
              Ref.update(definitionStore, (current) => HashMap.set(current, definition.id, definition))
            )
          )
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
