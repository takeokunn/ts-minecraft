import { Context, Effect, Option } from 'effect'
import type {
  ItemCategory,
  ItemCraftingRecipe,
  ItemDefinition,
  ItemDefinitionQuery,
  ItemDropTable,
  ItemId,
} from '../../types'
import type { AllRepositoryErrors } from '../types'

/**
 * Item Definition Repository
 *
 * アイテム定義の永続化を抽象化するRepository層インターフェース。
 * アイテムの基本プロパティ、レシピ、ドロップテーブル等の
 * 静的なゲームデータを管理する。
 */
export interface ItemDefinitionRepository {
  /**
   * アイテム定義の保存
   *
   * 新しいアイテム定義を永続化層に保存する。
   * 既存のアイテムIDと重複する場合はエラーを返す。
   *
   * @param definition - 保存するアイテム定義
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const definition: ItemDefinition = {
   *   id: 'diamond_sword' as ItemId,
   *   name: 'Diamond Sword',
   *   description: 'A sharp sword made of diamond',
   *   category: 'weapon',
   *   stackSize: 1,
   *   durability: 1561,
   *   rarity: 'epic',
   *   craftable: true,
   *   tradeable: true,
   *   properties: {
   *     attackDamage: 7,
   *     attackSpeed: 1.6,
   *     enchantable: true
   *   },
   *   tags: ['weapon', 'sword', 'melee', 'tool']
   * }
   *
   * yield* repo.save(definition)
   * console.log('アイテム定義保存完了')
   * ```
   */
  readonly save: (definition: ItemDefinition) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * アイテムIDによる定義検索
   *
   * 指定されたアイテムIDに一致するアイテム定義を取得する。
   * 存在しない場合はOption.noneを返す。
   *
   * @param id - 検索するアイテムID
   * @returns Option<アイテム定義> (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const definitionOption = yield* repo.findById('diamond_sword' as ItemId)
   *
   * yield* pipe(
   *   definitionOption,
   *   Option.match({
   *     onNone: () => Effect.sync(() =>
   *       console.log('アイテム定義が見つかりません')
   *     ),
   *     onSome: (definition) => Effect.sync(() =>
   *       console.log(`アイテム発見: ${definition.name}`)
   *     ),
   *   })
   * )
   * ```
   */
  readonly findById: (id: ItemId) => Effect.Effect<Option.Option<ItemDefinition>, AllRepositoryErrors>

  /**
   * カテゴリによる定義検索
   *
   * 指定されたカテゴリに属するアイテム定義一覧を取得する。
   * カテゴリに該当するアイテムが存在しない場合は空配列を返す。
   *
   * @param category - 検索するアイテムカテゴリ
   * @returns アイテム定義配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const weapons = yield* repo.findByCategory('weapon')
   * console.log(`武器の種類数: ${weapons.length}`)
   *
   * weapons.forEach(weapon => {
   *   console.log(`- ${weapon.name} (攻撃力: ${weapon.properties.attackDamage})`)
   * })
   * ```
   */
  readonly findByCategory: (category: ItemCategory) => Effect.Effect<ReadonlyArray<ItemDefinition>, AllRepositoryErrors>

  /**
   * タグによる定義検索
   *
   * 指定されたタグを持つアイテム定義一覧を取得する。
   * タグに該当するアイテムが存在しない場合は空配列を返す。
   *
   * @param tag - 検索するタグ
   * @returns アイテム定義配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const enchantableItems = yield* repo.findByTag('enchantable')
   * console.log(`エンチャント可能アイテム数: ${enchantableItems.length}`)
   *
   * const toolItems = yield* repo.findByTag('tool')
   * console.log(`ツール系アイテム数: ${toolItems.length}`)
   * ```
   */
  readonly findByTag: (tag: string) => Effect.Effect<ReadonlyArray<ItemDefinition>, AllRepositoryErrors>

  /**
   * レアリティによる定義検索
   *
   * 指定されたレアリティのアイテム定義一覧を取得する。
   * 該当するアイテムが存在しない場合は空配列を返す。
   *
   * @param rarity - 検索するレアリティ
   * @returns アイテム定義配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const epicItems = yield* repo.findByRarity('epic')
   * console.log(`エピックアイテム数: ${epicItems.length}`)
   * ```
   */
  readonly findByRarity: (rarity: string) => Effect.Effect<ReadonlyArray<ItemDefinition>, AllRepositoryErrors>

  /**
   * クラフト可能アイテムの検索
   *
   * クラフト可能なアイテム定義一覧を取得する。
   * クラフトレシピが存在するアイテムのみを返す。
   *
   * @returns クラフト可能アイテム定義配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const craftableItems = yield* repo.findCraftableItems()
   * console.log(`クラフト可能アイテム数: ${craftableItems.length}`)
   * ```
   */
  readonly findCraftableItems: () => Effect.Effect<ReadonlyArray<ItemDefinition>, AllRepositoryErrors>

  /**
   * 全アイテム定義の取得
   *
   * 永続化されている全てのアイテム定義を取得する。
   * パフォーマンス上の理由で大量データ時は注意が必要。
   *
   * @returns アイテム定義配列 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const allItems = yield* repo.findAll()
   * console.log(`総アイテム数: ${allItems.length}`)
   *
   * const categories = new Set(allItems.map(item => item.category))
   * console.log(`カテゴリ数: ${categories.size}`)
   * ```
   */
  readonly findAll: () => Effect.Effect<ReadonlyArray<ItemDefinition>, AllRepositoryErrors>

  /**
   * アイテム定義の削除
   *
   * 指定されたアイテムIDの定義を永続化層から削除する。
   * 存在しないIDを指定してもエラーとしない。
   *
   * @param id - 削除するアイテムID
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.delete('custom_item' as ItemId)
   * console.log('カスタムアイテムを削除しました')
   * ```
   */
  readonly delete: (id: ItemId) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * アイテム定義存在確認
   *
   * 指定されたアイテムIDの定義が存在するかを確認する。
   * findById よりも軽量な操作として提供される。
   *
   * @param id - 確認するアイテムID
   * @returns 存在フラグ (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const exists = yield* repo.exists('diamond_sword' as ItemId)
   * if (exists) {
   *   console.log('ダイヤモンドソードは定義されています')
   * } else {
   *   console.log('ダイヤモンドソードは未定義です')
   * }
   * ```
   */
  readonly exists: (id: ItemId) => Effect.Effect<boolean, AllRepositoryErrors>

  /**
   * アイテム定義数の取得
   *
   * 現在永続化されているアイテム定義の総数を取得する。
   * パフォーマンス監視やリソース管理での使用を想定。
   *
   * @returns アイテム定義数 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const count = yield* repo.count()
   * console.log(`登録アイテム定義数: ${count}`)
   *
   * if (count > 50000) {
   *   console.warn('アイテム定義数が上限に近づいています')
   * }
   * ```
   */
  readonly count: () => Effect.Effect<number, AllRepositoryErrors>

  /**
   * 複数アイテム定義の一括保存
   *
   * 複数のアイテム定義を効率的に一括保存する。
   * トランザクション的な処理で、一部失敗時は全体をロールバック。
   *
   * @param definitions - 保存するアイテム定義配列
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const definitions: ItemDefinition[] = [
   *   { id: 'oak_log', name: 'Oak Log', ... },
   *   { id: 'oak_planks', name: 'Oak Planks', ... },
   *   { id: 'oak_stick', name: 'Oak Stick', ... }
   * ]
   *
   * yield* repo.saveMany(definitions)
   * console.log(`${definitions.length}個のアイテム定義を一括保存`)
   * ```
   */
  readonly saveMany: (definitions: ReadonlyArray<ItemDefinition>) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * 検索クエリによる絞り込み
   *
   * 複雑な検索条件でアイテム定義を絞り込む。
   * 名前、プロパティ、タグ、カテゴリ等を組み合わせた検索が可能。
   *
   * @param query - 検索クエリオブジェクト
   * @returns 絞り込み結果 (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const query: ItemDefinitionQuery = {
   *   nameContains: 'sword',
   *   categories: ['weapon'],
   *   hasTags: ['melee'],
   *   minDurability: 1000,
   *   excludeTags: ['deprecated'],
   *   stackable: false
   * }
   *
   * const results = yield* repo.findByQuery(query)
   * console.log(`検索結果: ${results.length}個のアイテム`)
   * ```
   */
  readonly findByQuery: (
    query: ItemDefinitionQuery
  ) => Effect.Effect<ReadonlyArray<ItemDefinition>, AllRepositoryErrors>

  /**
   * クラフトレシピの取得
   *
   * 指定されたアイテムIDのクラフトレシピを取得する。
   * レシピが存在しない場合はOption.noneを返す。
   *
   * @param itemId - 取得するアイテムID
   * @returns Option<クラフトレシピ> (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const recipeOption = yield* repo.getCraftingRecipe('diamond_sword' as ItemId)
   *
   * yield* pipe(
   *   recipeOption,
   *   Option.match({
   *     onNone: () => Effect.sync(() =>
   *       console.log('レシピが見つかりません')
   *     ),
   *     onSome: (recipe) => Effect.sync(() =>
   *       console.log(`レシピ発見: ${recipe.ingredients.length}個の材料`)
   *     ),
   *   })
   * )
   * ```
   */
  readonly getCraftingRecipe: (itemId: ItemId) => Effect.Effect<Option.Option<ItemCraftingRecipe>, AllRepositoryErrors>

  /**
   * ドロップテーブルの取得
   *
   * 指定されたアイテムIDのドロップテーブルを取得する。
   * ドロップテーブルが存在しない場合はOption.noneを返す。
   *
   * @param itemId - 取得するアイテムID
   * @returns Option<ドロップテーブル> (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const dropTableOption = yield* repo.getDropTable('stone' as ItemId)
   *
   * yield* pipe(
   *   dropTableOption,
   *   Option.match({
   *     onNone: () => Effect.sync(() =>
   *       console.log('ドロップテーブルが見つかりません')
   *     ),
   *     onSome: (dropTable) => Effect.sync(() =>
   *       console.log(`ドロップテーブル発見: ${dropTable.drops.length}個のドロップ`)
   *     ),
   *   })
   * )
   * ```
   */
  readonly getDropTable: (itemId: ItemId) => Effect.Effect<Option.Option<ItemDropTable>, AllRepositoryErrors>

  /**
   * アイテム定義の更新
   *
   * 既存のアイテム定義を更新する。
   * 存在しないアイテムIDを指定した場合はエラーを返す。
   *
   * @param definition - 更新するアイテム定義
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * const updatedDefinition: ItemDefinition = {
   *   id: 'diamond_sword' as ItemId,
   *   name: 'Enhanced Diamond Sword',
   *   // ... その他のプロパティ
   * }
   *
   * yield* repo.update(updatedDefinition)
   * console.log('アイテム定義更新完了')
   * ```
   */
  readonly update: (definition: ItemDefinition) => Effect.Effect<void, AllRepositoryErrors>

  /**
   * Repository の初期化
   *
   * 必要に応じてストレージの初期化処理を実行する。
   * デフォルトアイテム定義のロードなども行う。
   *
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.initialize()
   * console.log('ItemDefinitionRepository初期化完了')
   * ```
   */
  readonly initialize: () => Effect.Effect<void, AllRepositoryErrors>

  /**
   * Repository のクリーンアップ
   *
   * リソースの解放やクリーンアップ処理を実行する。
   * アプリケーション終了時に呼び出される。
   *
   * @returns void (成功時) | RepositoryError (失敗時)
   *
   * @example
   * ```typescript
   * yield* repo.cleanup()
   * console.log('ItemDefinitionRepository終了処理完了')
   * ```
   */
  readonly cleanup: () => Effect.Effect<void, AllRepositoryErrors>
}

/**
 * ItemDefinitionRepository Context Tag
 */
export const ItemDefinitionRepository = Context.GenericTag<ItemDefinitionRepository>(
  '@minecraft/domain/inventory/repository/ItemDefinitionRepository'
)
