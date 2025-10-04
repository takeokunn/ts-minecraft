/**
 * @fileoverview Inventory Domain Service Interfaces
 *
 * TypeScript Minecraft Clone プロジェクトのInventoryドメインにおける
 * DDD原理主義に基づくサービスインターフェース定義
 *
 * このファイルは以下のインターフェースを定義します：
 * - Domain Service Interfaces: ドメインサービスの契約
 * - Repository Interfaces: データ永続化の抽象化
 * - Domain Provider Interfaces: 外部ドメインとの境界
 * - Context Interfaces: 依存性注入のための型定義
 * - Integration Interfaces: 外部システム連携の契約
 *
 * @version 1.0.0
 * @author TypeScript Minecraft Clone Team
 */

import { Context, Effect, Schema } from 'effect'

// Core Types Import
import type {
  Enchantment,
  InventoryId,
  InventorySlot,
  InventoryType,
  ItemDefinition,
  ItemId,
  ItemMetadata,
  ItemQuantity,
  ItemStack,
  PlayerId,
  SlotNumber,
} from './core'

// Error Types Import
import type {
  InsufficientSpaceError,
  InventoryError,
  ItemNotFoundError,
  OperationError,
  SystemError,
  TransferFailureError,
  ValidationError,
} from './errors'

// Event Types Import
import type { InventoryDomainEvent } from './events'

// Command Types Import

// Query Types Import
import type { CountItemsQuery, FindItemsQuery, GetInventoryQuery, Pagination } from './queries'

// Specification Types Import
import type {
  CraftingRecipe,
  ISpecification,
  TransferRequest,
  TransferValidationResult,
  ValidationResult,
} from './specifications'

// =============================================================================
// Domain Service Interfaces
// =============================================================================

/**
 * Inventory Domain Provider Interface - インベントリドメインの核心機能
 *
 * 純粋なドメインサービスとして、技術的実装に依存しない
 * ビジネスロジックの契約を定義する。
 *
 * 責任範囲:
 * - インベントリ集約の操作
 * - アイテムスタックの管理
 * - ビジネスルールの実行
 * - ドメインイベントの発行
 */
export interface InventoryDomainProvider {
  /**
   * プレイヤーのインベントリを作成
   *
   * @param playerId - プレイヤーID
   * @param inventoryType - インベントリタイプ
   * @returns 作成されたインベントリIDまたはエラー
   */
  readonly createInventory: (
    playerId: PlayerId,
    inventoryType: InventoryType
  ) => Effect.Effect<InventoryId, InventoryError>

  /**
   * インベントリにアイテムを追加
   *
   * @param inventoryId - インベントリID
   * @param itemStack - 追加するアイテムスタック
   * @returns 追加結果またはエラー
   */
  readonly addItem: (
    inventoryId: InventoryId,
    itemStack: ItemStack
  ) => Effect.Effect<ItemAddResult, InsufficientSpaceError | ValidationError>

  /**
   * インベントリからアイテムを削除
   *
   * @param inventoryId - インベントリID
   * @param slotNumber - スロット番号
   * @param quantity - 削除数量
   * @returns 削除されたアイテムまたはエラー
   */
  readonly removeItem: (
    inventoryId: InventoryId,
    slotNumber: SlotNumber,
    quantity: ItemQuantity
  ) => Effect.Effect<ItemStack | null, ItemNotFoundError | ValidationError>

  /**
   * アイテムの移動
   *
   * @param inventoryId - インベントリID
   * @param fromSlot - 移動元スロット
   * @param toSlot - 移動先スロット
   * @param quantity - 移動数量（オプション）
   * @returns 移動結果またはエラー
   */
  readonly moveItem: (
    inventoryId: InventoryId,
    fromSlot: SlotNumber,
    toSlot: SlotNumber,
    quantity?: ItemQuantity
  ) => Effect.Effect<void, OperationError>

  /**
   * アイテムの転送（インベントリ間）
   *
   * @param request - 転送リクエスト
   * @returns 転送結果またはエラー
   */
  readonly transferItem: (request: TransferRequest) => Effect.Effect<TransferResult, TransferFailureError>

  /**
   * インベントリの検証
   *
   * @param inventoryId - インベントリID
   * @returns 検証結果またはエラー
   */
  readonly validateInventory: (inventoryId: InventoryId) => Effect.Effect<ValidationResult, SystemError>

  /**
   * インベントリの整合性チェック
   *
   * @param inventoryId - インベントリID
   * @returns 整合性チェック結果またはエラー
   */
  readonly checkIntegrity: (inventoryId: InventoryId) => Effect.Effect<IntegrityResult, SystemError>
}

/**
 * Inventory Domain Provider のContext.GenericTag
 */
export const InventoryDomainProvider = Context.GenericTag<InventoryDomainProvider>('InventoryDomainProvider')

/**
 * Item Management Service Interface - アイテム管理サービス
 *
 * アイテムに関する専門的な操作を担当するドメインサービス。
 * アイテムの特性、エンチャント、耐久性などを管理。
 */
export interface ItemManagementService {
  /**
   * アイテム定義の取得
   *
   * @param itemId - アイテムID
   * @returns アイテム定義またはエラー
   */
  readonly getItemDefinition: (itemId: ItemId) => Effect.Effect<ItemDefinition, ItemNotFoundError>

  /**
   * アイテムスタックの作成
   *
   * @param itemId - アイテムID
   * @param quantity - 数量
   * @param metadata - メタデータ（オプション）
   * @returns アイテムスタックまたはエラー
   */
  readonly createItemStack: (
    itemId: ItemId,
    quantity: ItemQuantity,
    metadata?: ItemMetadata
  ) => Effect.Effect<ItemStack, ValidationError>

  /**
   * アイテムスタックの結合可能性チェック
   *
   * @param stack1 - スタック1
   * @param stack2 - スタック2
   * @returns 結合可能かどうか
   */
  readonly canCombineStacks: (stack1: ItemStack, stack2: ItemStack) => Effect.Effect<boolean, never>

  /**
   * アイテムスタックの結合
   *
   * @param stack1 - スタック1
   * @param stack2 - スタック2
   * @returns 結合後のスタックまたはエラー
   */
  readonly combineStacks: (stack1: ItemStack, stack2: ItemStack) => Effect.Effect<ItemStack, ValidationError>

  /**
   * アイテムスタックの分割
   *
   * @param stack - 分割元スタック
   * @param quantity - 分割数量
   * @returns 分割後のスタック配列またはエラー
   */
  readonly splitStack: (
    stack: ItemStack,
    quantity: ItemQuantity
  ) => Effect.Effect<readonly [ItemStack, ItemStack], ValidationError>

  /**
   * アイテムの耐久度更新
   *
   * @param stack - アイテムスタック
   * @param damage - ダメージ量
   * @returns 更新後のスタックまたはエラー
   */
  readonly updateDurability: (stack: ItemStack, damage: number) => Effect.Effect<ItemStack, ValidationError>

  /**
   * アイテムのエンチャント
   *
   * @param stack - アイテムスタック
   * @param enchantment - エンチャント
   * @returns エンチャント後のスタックまたはエラー
   */
  readonly enchantItem: (stack: ItemStack, enchantment: Enchantment) => Effect.Effect<ItemStack, ValidationError>
}

/**
 * Item Management Service のContext.GenericTag
 */
export const ItemManagementService = Context.GenericTag<ItemManagementService>('ItemManagementService')

/**
 * Inventory Query Service Interface - インベントリクエリサービス
 *
 * インベントリに対する各種検索・集計操作を提供する
 * 読み取り専用のドメインサービス。
 */
export interface InventoryQueryService {
  /**
   * インベントリの取得
   *
   * @param query - インベントリ取得クエリ
   * @returns インベントリデータまたはエラー
   */
  readonly getInventory: (query: GetInventoryQuery) => Effect.Effect<InventoryData, InventoryError>

  /**
   * アイテムの検索
   *
   * @param query - アイテム検索クエリ
   * @returns 検索結果またはエラー
   */
  readonly findItems: (query: FindItemsQuery) => Effect.Effect<readonly ItemStack[], InventoryError>

  /**
   * アイテム数のカウント
   *
   * @param query - アイテムカウントクエリ
   * @returns アイテム数またはエラー
   */
  readonly countItems: (query: CountItemsQuery) => Effect.Effect<number, InventoryError>

  /**
   * 空きスロットの検索
   *
   * @param inventoryId - インベントリID
   * @returns 空きスロット番号配列またはエラー
   */
  readonly findEmptySlots: (inventoryId: InventoryId) => Effect.Effect<readonly SlotNumber[], InventoryError>

  /**
   * スロット使用率の取得
   *
   * @param inventoryId - インベントリID
   * @returns 使用率（0.0-1.0）またはエラー
   */
  readonly getSlotUtilization: (inventoryId: InventoryId) => Effect.Effect<number, InventoryError>

  /**
   * インベントリ統計の取得
   *
   * @param inventoryId - インベントリID
   * @returns 統計情報またはエラー
   */
  readonly getInventoryStats: (inventoryId: InventoryId) => Effect.Effect<InventoryStatistics, InventoryError>
}

/**
 * Inventory Query Service のContext.GenericTag
 */
export const InventoryQueryService = Context.GenericTag<InventoryQueryService>('InventoryQueryService')

// =============================================================================
// Repository Interfaces
// =============================================================================

/**
 * Inventory Repository Interface - インベントリリポジトリ
 *
 * インベントリ集約の永続化を担当するリポジトリインターフェース。
 * データストレージの技術的詳細を抽象化する。
 */
export interface InventoryRepository {
  /**
   * インベントリの保存
   *
   * @param inventory - インベントリ集約
   * @returns 保存結果またはエラー
   */
  readonly save: (inventory: InventoryAggregate) => Effect.Effect<void, SystemError>

  /**
   * インベントリの取得
   *
   * @param inventoryId - インベントリID
   * @returns インベントリ集約またはエラー
   */
  readonly findById: (inventoryId: InventoryId) => Effect.Effect<InventoryAggregate | null, SystemError>

  /**
   * プレイヤーのインベントリ取得
   *
   * @param playerId - プレイヤーID
   * @returns インベントリ集約配列またはエラー
   */
  readonly findByPlayerId: (playerId: PlayerId) => Effect.Effect<readonly InventoryAggregate[], SystemError>

  /**
   * インベントリの削除
   *
   * @param inventoryId - インベントリID
   * @returns 削除結果またはエラー
   */
  readonly delete: (inventoryId: InventoryId) => Effect.Effect<void, SystemError>

  /**
   * インベントリの存在確認
   *
   * @param inventoryId - インベントリID
   * @returns 存在するかどうか
   */
  readonly exists: (inventoryId: InventoryId) => Effect.Effect<boolean, SystemError>

  /**
   * インベントリのバックアップ
   *
   * @param inventoryId - インベントリID
   * @returns バックアップ結果またはエラー
   */
  readonly backup: (inventoryId: InventoryId) => Effect.Effect<BackupResult, SystemError>

  /**
   * インベントリの復元
   *
   * @param inventoryId - インベントリID
   * @param backupId - バックアップID
   * @returns 復元結果またはエラー
   */
  readonly restore: (inventoryId: InventoryId, backupId: string) => Effect.Effect<void, SystemError>
}

/**
 * Inventory Repository のContext.GenericTag
 */
export const InventoryRepository = Context.GenericTag<InventoryRepository>('InventoryRepository')

/**
 * Item Definition Repository Interface - アイテム定義リポジトリ
 *
 * アイテム定義の永続化を担当するリポジトリインターフェース。
 * アイテムマスターデータの管理を抽象化する。
 */
export interface ItemDefinitionRepository {
  /**
   * アイテム定義の取得
   *
   * @param itemId - アイテムID
   * @returns アイテム定義またはエラー
   */
  readonly findById: (itemId: ItemId) => Effect.Effect<ItemDefinition | null, SystemError>

  /**
   * 全アイテム定義の取得
   *
   * @param pagination - ページネーション
   * @returns アイテム定義配列またはエラー
   */
  readonly findAll: (pagination?: Pagination) => Effect.Effect<readonly ItemDefinition[], SystemError>

  /**
   * アイテム定義の検索
   *
   * @param criteria - 検索条件
   * @returns 検索結果またはエラー
   */
  readonly search: (criteria: ItemSearchCriteria) => Effect.Effect<readonly ItemDefinition[], SystemError>

  /**
   * アイテム定義の保存
   *
   * @param definition - アイテム定義
   * @returns 保存結果またはエラー
   */
  readonly save: (definition: ItemDefinition) => Effect.Effect<void, SystemError>

  /**
   * アイテム定義の削除
   *
   * @param itemId - アイテムID
   * @returns 削除結果またはエラー
   */
  readonly delete: (itemId: ItemId) => Effect.Effect<void, SystemError>
}

/**
 * Item Definition Repository のContext.GenericTag
 */
export const ItemDefinitionRepository = Context.GenericTag<ItemDefinitionRepository>('ItemDefinitionRepository')

// =============================================================================
// Event Store Interfaces
// =============================================================================

/**
 * Inventory Event Store Interface - インベントリイベントストア
 *
 * Event Sourcingパターンでのイベント永続化を担当する
 * イベントストアインターフェース。
 */
export interface InventoryEventStore {
  /**
   * イベントの保存
   *
   * @param events - ドメインイベント配列
   * @returns 保存結果またはエラー
   */
  readonly saveEvents: (events: readonly InventoryDomainEvent[]) => Effect.Effect<void, SystemError>

  /**
   * イベントの取得
   *
   * @param inventoryId - インベントリID
   * @param fromVersion - 開始バージョン（オプション）
   * @returns イベント配列またはエラー
   */
  readonly getEvents: (
    inventoryId: InventoryId,
    fromVersion?: number
  ) => Effect.Effect<readonly InventoryDomainEvent[], SystemError>

  /**
   * イベントストリームの取得
   *
   * @param inventoryId - インベントリID
   * @returns イベントストリームまたはエラー
   */
  readonly getEventStream: (inventoryId: InventoryId) => Effect.Effect<EventStream<InventoryDomainEvent>, SystemError>

  /**
   * スナップショットの保存
   *
   * @param inventoryId - インベントリID
   * @param snapshot - スナップショット
   * @returns 保存結果またはエラー
   */
  readonly saveSnapshot: (inventoryId: InventoryId, snapshot: InventorySnapshot) => Effect.Effect<void, SystemError>

  /**
   * スナップショットの取得
   *
   * @param inventoryId - インベントリID
   * @returns スナップショットまたはエラー
   */
  readonly getSnapshot: (inventoryId: InventoryId) => Effect.Effect<InventorySnapshot | null, SystemError>
}

/**
 * Inventory Event Store のContext.GenericTag
 */
export const InventoryEventStore = Context.GenericTag<InventoryEventStore>('InventoryEventStore')

// =============================================================================
// Integration Interfaces
// =============================================================================

/**
 * Crafting Integration Service Interface - クラフティング連携サービス
 *
 * Inventoryドメインとの境界インターフェース。
 * クラフティングシステムとの連携を抽象化する。
 */
export interface CraftingIntegrationService {
  /**
   * クラフティング可能かチェック
   *
   * @param inventoryId - インベントリID
   * @param recipeId - レシピID
   * @returns クラフティング可能かどうか
   */
  readonly canCraft: (inventoryId: InventoryId, recipeId: string) => Effect.Effect<boolean, InventoryError>

  /**
   * クラフティング材料の消費
   *
   * @param inventoryId - インベントリID
   * @param recipe - レシピ
   * @returns 消費結果またはエラー
   */
  readonly consumeIngredients: (
    inventoryId: InventoryId,
    recipe: CraftingRecipe
  ) => Effect.Effect<void, InsufficientSpaceError>

  /**
   * クラフティング結果の追加
   *
   * @param inventoryId - インベントリID
   * @param result - クラフティング結果
   * @returns 追加結果またはエラー
   */
  readonly addCraftingResult: (
    inventoryId: InventoryId,
    result: ItemStack
  ) => Effect.Effect<void, InsufficientSpaceError>
}

/**
 * Crafting Integration Service のContext.GenericTag
 */
export const CraftingIntegrationService = Context.GenericTag<CraftingIntegrationService>('CraftingIntegrationService')

/**
 * Economy Integration Service Interface - 経済システム連携サービス
 *
 * Inventoryドメインとの境界インターフェース。
 * 経済システム（取引、通貨など）との連携を抽象化する。
 */
export interface EconomyIntegrationService {
  /**
   * アイテムの価値評価
   *
   * @param itemStack - アイテムスタック
   * @returns アイテム価値またはエラー
   */
  readonly evaluateItem: (itemStack: ItemStack) => Effect.Effect<number, ValidationError>

  /**
   * 取引の実行
   *
   * @param trade - 取引情報
   * @returns 取引結果またはエラー
   */
  readonly executeTrade: (trade: TradeRequest) => Effect.Effect<TradeResult, TransferFailureError>

  /**
   * 通貨のアイテム化
   *
   * @param amount - 通貨額
   * @returns 通貨アイテムまたはエラー
   */
  readonly convertCurrencyToItem: (amount: number) => Effect.Effect<ItemStack, ValidationError>

  /**
   * アイテムの通貨化
   *
   * @param itemStack - アイテムスタック
   * @returns 通貨額またはエラー
   */
  readonly convertItemToCurrency: (itemStack: ItemStack) => Effect.Effect<number, ValidationError>
}

/**
 * Economy Integration Service のContext.GenericTag
 */
export const EconomyIntegrationService = Context.GenericTag<EconomyIntegrationService>('EconomyIntegrationService')

// =============================================================================
// Specification Service Interfaces
// =============================================================================

/**
 * Inventory Specification Service Interface - インベントリ仕様サービス
 *
 * Specification Patternに基づくビジネスルール検証サービス。
 * 複雑なビジネスルールの組み合わせを管理する。
 */
export interface InventorySpecificationService {
  /**
   * アイテム追加の仕様検証
   *
   * @param inventoryId - インベントリID
   * @param itemStack - アイテムスタック
   * @returns 検証結果
   */
  readonly validateItemAddition: (
    inventoryId: InventoryId,
    itemStack: ItemStack
  ) => Effect.Effect<ValidationResult, never>

  /**
   * アイテム転送の仕様検証
   *
   * @param request - 転送リクエスト
   * @returns 転送検証結果
   */
  readonly validateItemTransfer: (request: TransferRequest) => Effect.Effect<TransferValidationResult, never>

  /**
   * インベントリ容量の仕様検証
   *
   * @param inventoryId - インベントリID
   * @returns 検証結果
   */
  readonly validateCapacity: (inventoryId: InventoryId) => Effect.Effect<ValidationResult, never>

  /**
   * 複合仕様の実行
   *
   * @param specification - 仕様オブジェクト
   * @param target - 検証対象
   * @returns 検証結果
   */
  readonly executeSpecification: <T>(
    specification: ISpecification<T>,
    target: T
  ) => Effect.Effect<ValidationResult, never>

  /**
   * 仕様の組み合わせ実行
   *
   * @param specifications - 仕様配列
   * @param target - 検証対象
   * @returns 検証結果
   */
  readonly executeCompositeSpecification: <T>(
    specifications: readonly ISpecification<T>[],
    target: T
  ) => Effect.Effect<ValidationResult, never>
}

/**
 * Inventory Specification Service のContext.GenericTag
 */
export const InventorySpecificationService = Context.GenericTag<InventorySpecificationService>(
  'InventorySpecificationService'
)

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * アイテム追加結果
 */
export type ItemAddResult = {
  readonly success: boolean
  readonly addedQuantity: ItemQuantity
  readonly remainingStack: ItemStack | null
  readonly affectedSlots: readonly SlotNumber[]
}

/**
 * 転送結果
 */
export type TransferResult = {
  readonly success: boolean
  readonly transferredQuantity: ItemQuantity
  readonly sourceInventoryId: InventoryId
  readonly targetInventoryId: InventoryId
  readonly affectedSlots: readonly SlotNumber[]
}

/**
 * 整合性チェック結果
 */
export type IntegrityResult = {
  readonly isValid: boolean
  readonly violations: readonly string[]
  readonly corruptedSlots: readonly SlotNumber[]
  readonly recommendations: readonly string[]
}

/**
 * インベントリデータ
 */
export type InventoryData = {
  readonly inventoryId: InventoryId
  readonly playerId: PlayerId
  readonly type: InventoryType
  readonly slots: readonly InventorySlot[]
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * インベントリ統計
 */
export type InventoryStatistics = {
  readonly totalSlots: number
  readonly usedSlots: number
  readonly emptySlots: number
  readonly utilizationRate: number
  readonly totalItems: number
  readonly uniqueItemTypes: number
  readonly averageStackSize: number
  readonly mostCommonItem: ItemId | null
  readonly rareItems: readonly ItemId[]
}

/**
 * インベントリ集約
 */
export type InventoryAggregate = {
  readonly id: InventoryId
  readonly playerId: PlayerId
  readonly type: InventoryType
  readonly slots: readonly InventorySlot[]
  readonly version: number
  readonly events: readonly InventoryDomainEvent[]
}

/**
 * インベントリスナップショット
 */
export type InventorySnapshot = {
  readonly inventoryId: InventoryId
  readonly version: number
  readonly data: InventoryData
  readonly createdAt: Date
}

/**
 * イベントストリーム
 */
export type EventStream<T> = {
  readonly subscribe: (handler: (event: T) => Effect.Effect<void, never>) => Effect.Effect<void, never>
  readonly unsubscribe: () => Effect.Effect<void, never>
}

/**
 * バックアップ結果
 */
export type BackupResult = {
  readonly backupId: string
  readonly inventoryId: InventoryId
  readonly size: number
  readonly createdAt: Date
  readonly checksum: string
}

/**
 * アイテム検索条件
 */
export type ItemSearchCriteria = {
  readonly name?: string
  readonly category?: string
  readonly tags?: readonly string[]
  readonly minValue?: number
  readonly maxValue?: number
  readonly rarity?: string
}

/**
 * 取引リクエスト
 */
export type TradeRequest = {
  readonly fromPlayerId: PlayerId
  readonly toPlayerId: PlayerId
  readonly offerItems: readonly ItemStack[]
  readonly requestItems: readonly ItemStack[]
  readonly currency?: number
}

/**
 * 取引結果
 */
export type TradeResult = {
  readonly success: boolean
  readonly tradeId: string
  readonly executedAt: Date
  readonly exchangedItems: readonly ItemStack[]
  readonly currencyExchanged?: number
}

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * ItemAddResult Schema
 */
export const ItemAddResultSchema = Schema.Struct({
  success: Schema.Boolean,
  addedQuantity: Schema.Number,
  remainingStack: Schema.NullOr(Schema.Unknown),
  affectedSlots: Schema.Array(Schema.Number),
})

/**
 * TransferResult Schema
 */
export const TransferResultSchema = Schema.Struct({
  success: Schema.Boolean,
  transferredQuantity: Schema.Number,
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  affectedSlots: Schema.Array(Schema.Number),
})

/**
 * IntegrityResult Schema
 */
export const IntegrityResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  violations: Schema.Array(Schema.String),
  corruptedSlots: Schema.Array(Schema.Number),
  recommendations: Schema.Array(Schema.String),
})

/**
 * InventoryStatistics Schema
 */
export const InventoryStatisticsSchema = Schema.Struct({
  totalSlots: Schema.Number,
  usedSlots: Schema.Number,
  emptySlots: Schema.Number,
  utilizationRate: Schema.Number,
  totalItems: Schema.Number,
  uniqueItemTypes: Schema.Number,
  averageStackSize: Schema.Number,
  mostCommonItem: Schema.NullOr(Schema.String),
  rareItems: Schema.Array(Schema.String),
})

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * ItemAddResult パーサー
 */
export const parseItemAddResult = Schema.decodeUnknown(ItemAddResultSchema)
export const parseItemAddResultSync = Schema.decodeUnknownSync(ItemAddResultSchema)

/**
 * TransferResult パーサー
 */
export const parseTransferResult = Schema.decodeUnknown(TransferResultSchema)
export const parseTransferResultSync = Schema.decodeUnknownSync(TransferResultSchema)

/**
 * IntegrityResult パーサー
 */
export const parseIntegrityResult = Schema.decodeUnknown(IntegrityResultSchema)
export const parseIntegrityResultSync = Schema.decodeUnknownSync(IntegrityResultSchema)

/**
 * InventoryStatistics パーサー
 */
export const parseInventoryStatistics = Schema.decodeUnknown(InventoryStatisticsSchema)
export const parseInventoryStatisticsSync = Schema.decodeUnknownSync(InventoryStatisticsSchema)

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * ItemAddResult バリデーター
 */
export const isValidItemAddResult = Schema.is(ItemAddResultSchema)

/**
 * TransferResult バリデーター
 */
export const isValidTransferResult = Schema.is(TransferResultSchema)

/**
 * IntegrityResult バリデーター
 */
export const isValidIntegrityResult = Schema.is(IntegrityResultSchema)

/**
 * InventoryStatistics バリデーター
 */
export const isValidInventoryStatistics = Schema.is(InventoryStatisticsSchema)

// =============================================================================
// Domain Input/Output Types
// =============================================================================

/**
 * Inventory Domain Input - 外部依存関係
 *
 * Inventoryドメインが外部ドメインから受け取る入力型。
 * ドメイン間の境界を明確化する。
 */
export type InventoryDomainInput = {
  readonly playerService?: unknown // Player Domain からの入力
  readonly craftingService?: unknown // Crafting Domain からの入力
  readonly economyService?: unknown // Economy Domain からの入力
  readonly worldService?: unknown // World Domain からの入力
}

/**
 * Inventory Domain Output - 外部提供インターフェース
 *
 * Inventoryドメインが外部ドメインに提供する出力型。
 * 他のドメインに公開するインターフェースを定義。
 */
export type InventoryDomainOutput = {
  readonly inventoryProvider: InventoryDomainProvider
  readonly itemManagementService: ItemManagementService
  readonly inventoryQueryService: InventoryQueryService
  readonly specificationService: InventorySpecificationService
}

/**
 * Inventory Domain Configuration - ドメイン設定
 *
 * Inventoryドメインの実行時設定。
 * パフォーマンス、制限値、動作設定を定義。
 */
export type InventoryDomainConfiguration = {
  readonly maxInventoriesPerPlayer: number
  readonly defaultInventorySize: number
  readonly enableEventSourcing: boolean
  readonly enableBackup: boolean
  readonly backupInterval: number
  readonly cacheSize: number
  readonly validationLevel: 'strict' | 'normal' | 'relaxed'
  readonly performanceMode: 'memory' | 'balanced' | 'storage'
  readonly debugMode: boolean
}

/**
 * Inventory Domain Dependencies - ドメイン依存関係
 *
 * Inventoryドメインの外部依存関係定義。
 * 依存性注入で解決される外部サービス。
 */
export type InventoryDomainDependencies = {
  readonly inventoryRepository: InventoryRepository
  readonly itemDefinitionRepository: ItemDefinitionRepository
  readonly eventStore: InventoryEventStore
  readonly craftingIntegration?: CraftingIntegrationService
  readonly economyIntegration?: EconomyIntegrationService
  readonly configuration: InventoryDomainConfiguration
}
