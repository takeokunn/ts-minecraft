import { ItemDefinitionRepository } from '@domain/inventory/repository/item_definition_repository'
import {
  createDuplicateItemDefinitionError,
  createItemNotFoundError,
  createStorageError,
} from '@domain/inventory/repository/types'
import type {
  ItemCategory,
  ItemCraftingRecipe,
  ItemDefinition,
  ItemDefinitionQuery,
  ItemDropTable,
  ItemId,
} from '@domain/inventory/types'
import { makeUnsafe as makeUnsafeItemId } from '@domain/shared/entities/item_id/operations'
import { Clock, Effect, Array as EffectArray, HashMap, Layer, Match, Option, Ref, pipe } from 'effect'

/**
 * JSON File Storage Configuration
 */
export interface JsonFileConfig {
  readonly filePath: string
  readonly autoSaveEnabled?: boolean
  readonly backupEnabled?: boolean
  readonly validationEnabled?: boolean
}

export const DefaultJsonFileConfig: JsonFileConfig = {
  filePath: './data/item-definitions.json',
  autoSaveEnabled: true,
  backupEnabled: true,
  validationEnabled: true,
}

/**
 * ItemDefinitionRepository JSON File Implementation
 *
 * JSONファイル実装。サーバーサイド・デスクトップ環境向け。
 * ファイルシステムを使用してアイテム定義を永続化する。
 */
export const ItemDefinitionRepositoryJsonFile = (config: JsonFileConfig = DefaultJsonFileConfig) =>
  Layer.effect(
    ItemDefinitionRepository,
    Effect.gen(function* () {
      // インメモリキャッシュ
      const definitionCache = yield* Ref.make(HashMap.empty<ItemId, ItemDefinition>())
      const recipeCache = yield* Ref.make(HashMap.empty<ItemId, ItemCraftingRecipe>())
      const dropTableCache = yield* Ref.make(HashMap.empty<ItemId, ItemDropTable>())
      const isDirty = yield* Ref.make(false)

      // ファイル操作のヘルパー関数
      const loadFromFile = pipe(
        Effect.gen(function* () {
          return yield* pipe(
            Match.value(typeof require !== 'undefined'),
            Match.when(
              (available) => available,
              () =>
                Effect.gen(function* () {
                  const fs = require('fs').promises
                  const fileContent = yield* Effect.promise(() => fs.readFile(config.filePath, 'utf8'))
                  return JSON.parse(fileContent)
                })
            ),
            Match.orElse(() => Effect.fail(new Error('File system not available')))
          )
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              createStorageError(
                'filesystem',
                'load',
                `Failed to load file: ${error instanceof Error ? error.message : String(error)}`
              )
            )
          )
        ),
        Effect.flatMap((data) =>
          Effect.gen(function* () {
            // definitions の処理
            yield* pipe(
              Option.fromNullable(data.definitions),
              Option.match({
                onNone: () => Effect.void,
                onSome: (defs) =>
                  pipe(
                    Object.entries(defs),
                    EffectArray.reduce(new Map<ItemId, ItemDefinition>(), (map, [id, definition]) => {
                      map.set(makeUnsafeItemId(id), definition)
                      return map
                    }),
                    (definitions) => Ref.set(definitionCache, HashMap.fromIterable(definitions))
                  ),
              })
            )

            // recipes の処理
            yield* pipe(
              Option.fromNullable(data.recipes),
              Option.match({
                onNone: () => Effect.void,
                onSome: (recs) =>
                  pipe(
                    Object.entries(recs),
                    EffectArray.reduce(new Map<ItemId, ItemCraftingRecipe>(), (map, [id, recipe]) => {
                      map.set(makeUnsafeItemId(id), recipe)
                      return map
                    }),
                    (recipes) => Ref.set(recipeCache, HashMap.fromIterable(recipes))
                  ),
              })
            )

            // dropTables の処理
            yield* pipe(
              Option.fromNullable(data.dropTables),
              Option.match({
                onNone: () => Effect.void,
                onSome: (tables) =>
                  pipe(
                    Object.entries(tables),
                    EffectArray.reduce(new Map<ItemId, ItemDropTable>(), (map, [id, dropTable]) => {
                      map.set(makeUnsafeItemId(id), dropTable)
                      return map
                    }),
                    (dropTables) => Ref.set(dropTableCache, HashMap.fromIterable(dropTables))
                  ),
              })
            )
          })
        ),
        Effect.catchAll((error) =>
          pipe(
            error,
            (e) => 'message' in e && typeof e.message === 'string' && e.message.includes('ENOENT'),
            (isFileNotFound) =>
              isFileNotFound
                ? Effect.void // ファイルが存在しない場合は正常とみなす（初回起動時）
                : Effect.fail(error)
          )
        )
      )

      const saveToFile = Effect.gen(function* () {
        const definitions = yield* Ref.get(definitionCache)
        const recipes = yield* Ref.get(recipeCache)
        const dropTables = yield* Ref.get(dropTableCache)
        const timestamp = yield* Clock.currentTimeMillis

        const data = {
          definitions: Object.fromEntries(HashMap.entries(definitions)),
          recipes: Object.fromEntries(HashMap.entries(recipes)),
          dropTables: Object.fromEntries(HashMap.entries(dropTables)),
          version: 1,
          lastSaved: timestamp,
        }

        yield* pipe(
          Match.value(typeof require !== 'undefined'),
          Match.when(
            (available) => available,
            () =>
              Effect.gen(function* () {
                const fs = require('fs').promises
                const path = require('path')

                const dir = path.dirname(config.filePath)
                yield* Effect.promise(() => fs.mkdir(dir, { recursive: true }))

                yield* pipe(
                  Match.value(config.backupEnabled === true),
                  Match.when(true, () =>
                    pipe(
                      Effect.gen(function* () {
                        const backupTimestamp = yield* Clock.currentTimeMillis
                        const backupPath = `${config.filePath}.backup-${backupTimestamp}`
                        yield* Effect.promise(() => fs.copyFile(config.filePath, backupPath))
                      }),
                      Effect.catchAll((error) =>
                        Effect.sync(() => {
                          console.warn('Failed to create backup:', error)
                        })
                      )
                    )
                  ),
                  Match.orElse(() => Effect.void)
                )

                yield* Effect.promise(() => fs.writeFile(config.filePath, JSON.stringify(data, null, 2), 'utf8'))
              })
          ),
          Match.orElse(() => Effect.fail(createStorageError('filesystem', 'save', 'File system not available')))
        ).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              createStorageError(
                'filesystem',
                'save',
                `Failed to save file: ${error instanceof Error ? error.message : String(error)}`
              )
            )
          )
        )

        yield* Ref.set(isDirty, false)
      })

      // 初期化時にファイルからデータをロード
      yield* loadFromFile

      return ItemDefinitionRepository.of({
        save: (definition: ItemDefinition) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)

            yield* pipe(HashMap.has(cache, definition.id), (exists) =>
              exists ? Effect.fail(createDuplicateItemDefinitionError(definition.id)) : Effect.void
            )

            yield* Ref.update(definitionCache, (cache) => HashMap.set(cache, definition.id, definition))
            yield* Ref.set(isDirty, true)

            yield* pipe(config.autoSaveEnabled, (enabled) => (enabled ? saveToFile : Effect.void))
          }),

        findById: (id: ItemId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            return HashMap.get(cache, id)
          }),

        findByCategory: (category: ItemCategory) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const definitions = Array.from(HashMap.values(cache))
            return definitions.filter((def) => def.category === category)
          }),

        findByTag: (tag: string) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const definitions = Array.from(HashMap.values(cache))
            return definitions.filter((def) => def.tags?.includes(tag) || false)
          }),

        findByRarity: (rarity: string) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const definitions = Array.from(HashMap.values(cache))
            return definitions.filter((def) => def.rarity === rarity)
          }),

        findCraftableItems: () =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const definitions = Array.from(HashMap.values(cache))
            return definitions.filter((def) => def.craftable === true)
          }),

        findAll: () =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            return Array.from(HashMap.values(cache))
          }),

        delete: (id: ItemId) =>
          Effect.gen(function* () {
            yield* Ref.update(definitionCache, (cache) => HashMap.remove(cache, id))
            yield* Ref.update(recipeCache, (cache) => HashMap.remove(cache, id))
            yield* Ref.update(dropTableCache, (cache) => HashMap.remove(cache, id))
            yield* Ref.set(isDirty, true)

            yield* pipe(config.autoSaveEnabled, (enabled) => (enabled ? saveToFile : Effect.void))
          }),

        exists: (id: ItemId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            return HashMap.has(cache, id)
          }),

        count: () =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            return HashMap.size(cache)
          }),

        saveMany: (definitions: ReadonlyArray<ItemDefinition>) =>
          Effect.gen(function* () {
            // 重複チェック
            const cache = yield* Ref.get(definitionCache)
            const duplicates = definitions.filter((def) => HashMap.has(cache, def.id))

            yield* pipe(duplicates.length > 0, (hasDuplicates) =>
              hasDuplicates ? Effect.fail(createDuplicateItemDefinitionError(duplicates[0].id)) : Effect.void
            )

            yield* Ref.update(definitionCache, (cache) =>
              pipe(
                definitions,
                EffectArray.reduce(cache, (updatedCache, definition) =>
                  HashMap.set(updatedCache, definition.id, definition)
                )
              )
            )
            yield* Ref.set(isDirty, true)

            yield* pipe(config.autoSaveEnabled, (enabled) => (enabled ? saveToFile : Effect.void))
          }),

        findByQuery: (query: ItemDefinitionQuery) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const definitions = Array.from(HashMap.values(cache))

            // フィルタリング条件を関数として定義
            const matchesName = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.nameContains),
                Option.match({
                  onNone: () => true,
                  onSome: (nameFilter) => def.name.toLowerCase().includes(nameFilter.toLowerCase()),
                })
              )

            const matchesCategory = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.categories),
                Option.match({
                  onNone: () => true,
                  onSome: (categories) => categories.includes(def.category),
                })
              )

            const matchesRequiredTags = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.hasTags),
                Option.filter((tags) => tags.length > 0),
                Option.match({
                  onNone: () => true,
                  onSome: (requiredTags) => {
                    const defTags = def.tags || []
                    return requiredTags.every((tag) => defTags.includes(tag))
                  },
                })
              )

            const matchesExcludedTags = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.excludeTags),
                Option.filter((tags) => tags.length > 0),
                Option.match({
                  onNone: () => true,
                  onSome: (excludedTags) => {
                    const defTags = def.tags || []
                    return !excludedTags.some((tag) => defTags.includes(tag))
                  },
                })
              )

            const matchesMinDurability = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.minDurability),
                Option.match({
                  onNone: () => true,
                  onSome: (minDur) => (def.durability || 0) >= minDur,
                })
              )

            const matchesMaxDurability = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.maxDurability),
                Option.match({
                  onNone: () => true,
                  onSome: (maxDur) => (def.durability || 0) <= maxDur,
                })
              )

            const matchesStackable = (def: ItemDefinition): boolean =>
              pipe(
                Option.fromNullable(query.stackable),
                Option.match({
                  onNone: () => true,
                  onSome: (expectedStackable) => {
                    const isStackable = def.stackSize > 1
                    return expectedStackable === isStackable
                  },
                })
              )

            return definitions.filter(
              (definition) =>
                matchesName(definition) &&
                matchesCategory(definition) &&
                matchesRequiredTags(definition) &&
                matchesExcludedTags(definition) &&
                matchesMinDurability(definition) &&
                matchesMaxDurability(definition) &&
                matchesStackable(definition)
            )
          }),

        getCraftingRecipe: (itemId: ItemId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(recipeCache)
            return HashMap.get(cache, itemId)
          }),

        getDropTable: (itemId: ItemId) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(dropTableCache)
            return HashMap.get(cache, itemId)
          }),

        update: (definition: ItemDefinition) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)

            yield* pipe(HashMap.has(cache, definition.id), (exists) =>
              exists ? Effect.void : Effect.fail(createItemNotFoundError(definition.id))
            )

            yield* Ref.update(definitionCache, (cache) => HashMap.set(cache, definition.id, definition))
            yield* Ref.set(isDirty, true)

            yield* pipe(config.autoSaveEnabled, (enabled) => (enabled ? saveToFile : Effect.void))
          }),

        initialize: () =>
          Effect.gen(function* () {
            yield* loadFromFile
          }),

        cleanup: () =>
          Effect.gen(function* () {
            const dirty = yield* Ref.get(isDirty)
            yield* pipe(dirty, (isDirtyFlag) => (isDirtyFlag ? saveToFile : Effect.void))
          }),
      })
    })
  )

/**
 * デフォルト設定でのJSONファイルレイヤー
 */
export const ItemDefinitionRepositoryJsonFileDefault = ItemDefinitionRepositoryJsonFile(DefaultJsonFileConfig)
