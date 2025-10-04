import { Effect, HashMap, Layer, Ref } from 'effect'
import type {
  ItemCategory,
  ItemCraftingRecipe,
  ItemDefinition,
  ItemDefinitionQuery,
  ItemDropTable,
  ItemId,
} from '../../types'
import { createDuplicateItemDefinitionError, createItemNotFoundError, createStorageError } from '../types'
import { ItemDefinitionRepository } from './interface'

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
      const loadFromFile = Effect.gen(function* () {
        try {
          // Node.js環境でのファイル読み込み（実際の実装では fs モジュールを使用）
          const data = yield* Effect.tryPromise({
            try: async () => {
              if (typeof require !== 'undefined') {
                const fs = require('fs').promises
                const fileContent = await fs.readFile(config.filePath, 'utf8')
                return JSON.parse(fileContent)
              }
              throw new Error('File system not available')
            },
            catch: (error) => createStorageError('filesystem', 'load', `Failed to load file: ${error}`),
          })

          if (data.definitions) {
            const definitions = new Map<ItemId, ItemDefinition>()
            Object.entries(data.definitions).forEach(([id, definition]) => {
              definitions.set(id as ItemId, definition as ItemDefinition)
            })
            yield* Ref.set(definitionCache, HashMap.fromIterable(definitions))
          }

          if (data.recipes) {
            const recipes = new Map<ItemId, ItemCraftingRecipe>()
            Object.entries(data.recipes).forEach(([id, recipe]) => {
              recipes.set(id as ItemId, recipe as ItemCraftingRecipe)
            })
            yield* Ref.set(recipeCache, HashMap.fromIterable(recipes))
          }

          if (data.dropTables) {
            const dropTables = new Map<ItemId, ItemDropTable>()
            Object.entries(data.dropTables).forEach(([id, dropTable]) => {
              dropTables.set(id as ItemId, dropTable as ItemDropTable)
            })
            yield* Ref.set(dropTableCache, HashMap.fromIterable(dropTables))
          }
        } catch (error) {
          // ファイルが存在しない場合は正常とみなす（初回起動時）
          if (error instanceof Error && error.message.includes('ENOENT')) {
            // 何もしない
          } else {
            yield* Effect.fail(createStorageError('filesystem', 'load', `Failed to load file: ${error}`))
          }
        }
      })

      const saveToFile = Effect.gen(function* () {
        try {
          const definitions = yield* Ref.get(definitionCache)
          const recipes = yield* Ref.get(recipeCache)
          const dropTables = yield* Ref.get(dropTableCache)

          const data = {
            definitions: Object.fromEntries(HashMap.entries(definitions)),
            recipes: Object.fromEntries(HashMap.entries(recipes)),
            dropTables: Object.fromEntries(HashMap.entries(dropTables)),
            version: 1,
            lastSaved: Date.now(),
          }

          yield* Effect.tryPromise({
            try: async () => {
              if (typeof require !== 'undefined') {
                const fs = require('fs').promises
                const path = require('path')

                // ディレクトリが存在しない場合は作成
                const dir = path.dirname(config.filePath)
                await fs.mkdir(dir, { recursive: true })

                // バックアップ作成（有効な場合）
                if (config.backupEnabled) {
                  try {
                    const backupPath = `${config.filePath}.backup-${Date.now()}`
                    await fs.copyFile(config.filePath, backupPath)
                  } catch (backupError) {
                    // バックアップ失敗は警告レベル（メイン処理は継続）
                    console.warn('Failed to create backup:', backupError)
                  }
                }

                await fs.writeFile(config.filePath, JSON.stringify(data, null, 2), 'utf8')
              } else {
                throw new Error('File system not available')
              }
            },
            catch: (error) => createStorageError('filesystem', 'save', `Failed to save file: ${error}`),
          })

          yield* Ref.set(isDirty, false)
        } catch (error) {
          yield* Effect.fail(createStorageError('filesystem', 'save', `Failed to save file: ${error}`))
        }
      })

      // 初期化時にファイルからデータをロード
      yield* loadFromFile

      return ItemDefinitionRepository.of({
        save: (definition: ItemDefinition) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const exists = HashMap.has(cache, definition.id)

            if (exists) {
              yield* Effect.fail(createDuplicateItemDefinitionError(definition.id))
            }

            yield* Ref.update(definitionCache, (cache) => HashMap.set(cache, definition.id, definition))
            yield* Ref.set(isDirty, true)

            if (config.autoSaveEnabled) {
              yield* saveToFile
            }
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

            if (config.autoSaveEnabled) {
              yield* saveToFile
            }
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

            if (duplicates.length > 0) {
              yield* Effect.fail(createDuplicateItemDefinitionError(duplicates[0].id))
            }

            yield* Ref.update(definitionCache, (cache) => {
              let updatedCache = cache
              definitions.forEach((definition) => {
                updatedCache = HashMap.set(updatedCache, definition.id, definition)
              })
              return updatedCache
            })
            yield* Ref.set(isDirty, true)

            if (config.autoSaveEnabled) {
              yield* saveToFile
            }
          }),

        findByQuery: (query: ItemDefinitionQuery) =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(definitionCache)
            const definitions = Array.from(HashMap.values(cache))

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

              return true
            })
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
            const exists = HashMap.has(cache, definition.id)

            if (!exists) {
              yield* Effect.fail(createItemNotFoundError(definition.id))
            }

            yield* Ref.update(definitionCache, (cache) => HashMap.set(cache, definition.id, definition))
            yield* Ref.set(isDirty, true)

            if (config.autoSaveEnabled) {
              yield* saveToFile
            }
          }),

        initialize: () =>
          Effect.gen(function* () {
            yield* loadFromFile
          }),

        cleanup: () =>
          Effect.gen(function* () {
            const dirty = yield* Ref.get(isDirty)
            if (dirty) {
              yield* saveToFile
            }
          }),
      })
    })
  )

/**
 * デフォルト設定でのJSONファイルレイヤー
 */
export const ItemDefinitionRepositoryJsonFileDefault = ItemDefinitionRepositoryJsonFile(DefaultJsonFileConfig)
