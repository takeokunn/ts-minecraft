import { Effect, Schema } from 'effect'
import { JsonRecordSchema, JsonValueSchema } from '@shared/schema/json'
import type { JsonValue } from '@shared/schema/json'
import type { AllRepositoryErrors } from '@/domain/inventory/repository/types'
import type {
  InventoryId,
  InventorySlot,
  ItemDefinition,
  ItemId,
  ItemQuantity,
  ItemStack,
  PlayerId,
  SlotNumber,
  SlotType,
} from './core'

// =============================================================================
// Specification Pattern Interface Types
// =============================================================================

/**
 * 仕様パターンの基底インターフェース
 * ドメインルールとビジネスロジックの検証
 */
export interface ISpecification<T> {
  readonly _tag: string
  isSatisfiedBy(candidate: T): boolean
  and(other: ISpecification<T>): ISpecification<T>
  or(other: ISpecification<T>): ISpecification<T>
  not(): ISpecification<T>
}

/**
 * Effect-TS対応の仕様インターフェース
 * 非同期処理とエラーハンドリングをサポート
 */
export interface IAsyncSpecification<T, E = never> {
  readonly _tag: string
  isSatisfiedBy(candidate: T): import('effect/Effect').Effect<boolean, E>
  and(other: IAsyncSpecification<T, E>): IAsyncSpecification<T, E>
  or(other: IAsyncSpecification<T, E>): IAsyncSpecification<T, E>
  not(): IAsyncSpecification<T, E>
}

// =============================================================================
// Item Specification Interfaces
// =============================================================================

/**
 * アイテム仕様インターフェース
 * アイテムに関するビジネスルールの検証
 */
export interface IItemSpecification extends ISpecification<ItemStack> {
  readonly _tag: 'ItemSpecification'
}

/**
 * アイテムスタック可能性仕様
 * 2つのアイテムスタックが結合可能かを判定
 */
export interface IItemStackabilitySpecification {
  readonly _tag: 'ItemStackabilitySpecification'
  canStack(stack1: ItemStack, stack2: ItemStack): boolean
  getMaxStackSize(itemId: ItemId): ItemQuantity
  getRemainingCapacity(stack: ItemStack): ItemQuantity
}

/**
 * アイテム互換性仕様
 * アイテム間の互換性を判定
 */
export interface IItemCompatibilitySpecification {
  readonly _tag: 'ItemCompatibilitySpecification'
  isCompatible(item1: ItemDefinition, item2: ItemDefinition): boolean
  canCombine(stack1: ItemStack, stack2: ItemStack): boolean
  canUpgrade(baseItem: ItemStack, upgradeItem: ItemStack): boolean
}

/**
 * アイテム品質仕様
 * アイテムの品質基準を判定
 */
export interface IItemQualitySpecification extends ISpecification<ItemStack> {
  readonly _tag: 'ItemQualitySpecification'
  meetsQualityStandard(item: ItemStack, minimumQuality: string): boolean
  isDamaged(item: ItemStack): boolean
  isRepairable(item: ItemStack): boolean
  getQualityScore(item: ItemStack): number
}

// =============================================================================
// Inventory Specification Interfaces
// =============================================================================

/**
 * インベントリ容量仕様
 * インベントリの容量制限とスペース管理
 */
export interface IInventoryCapacitySpecification {
  readonly _tag: 'InventoryCapacitySpecification'
  hasSpace(inventoryId: InventoryId, requiredSlots: number): boolean
  canAddItem(inventoryId: InventoryId, item: ItemStack): boolean
  getAvailableSlots(inventoryId: InventoryId): SlotNumber[]
  getFreeSpaceCount(inventoryId: InventoryId): number
  isInventoryFull(inventoryId: InventoryId): boolean
}

/**
 * インベントリ権限仕様
 * インベントリアクセス権限の検証
 */
export interface IInventoryPermissionSpecification {
  readonly _tag: 'InventoryPermissionSpecification'
  canAccess(playerId: PlayerId, inventoryId: InventoryId): boolean
  canModify(playerId: PlayerId, inventoryId: InventoryId): boolean
  canTransferFrom(playerId: PlayerId, sourceInventoryId: InventoryId): boolean
  canTransferTo(playerId: PlayerId, targetInventoryId: InventoryId): boolean
  hasAdminAccess(playerId: PlayerId, inventoryId: InventoryId): boolean
}

/**
 * インベントリ状態仕様
 * インベントリの状態とロック状況
 */
export interface IInventoryStateSpecification extends ISpecification<InventoryId> {
  readonly _tag: 'InventoryStateSpecification'
  isLocked(inventoryId: InventoryId): boolean
  isReadOnly(inventoryId: InventoryId): boolean
  isActive(inventoryId: InventoryId): boolean
  isCorrupted(inventoryId: InventoryId): boolean
}

// =============================================================================
// Slot Specification Interfaces
// =============================================================================

/**
 * スロット制約仕様
 * スロットの制約とアイテム配置規則
 */
export interface ISlotConstraintSpecification {
  readonly _tag: 'SlotConstraintSpecification'
  canPlaceItem(slot: InventorySlot, item: ItemStack): boolean
  isSlotRestricted(slotNumber: SlotNumber, slotType: SlotType): boolean
  getSlotRestrictions(slotNumber: SlotNumber): string[]
  validateSlotPlacement(slot: InventorySlot, item: ItemStack): ValidationResult
}

/**
 * スロット互換性仕様
 * スロットとアイテムタイプの互換性
 */
export interface ISlotCompatibilitySpecification {
  readonly _tag: 'SlotCompatibilitySpecification'
  isItemTypeAllowed(slotType: SlotType, itemId: ItemId): boolean
  getCompatibleSlots(inventoryId: InventoryId, itemId: ItemId): SlotNumber[]
  getSlotTypeRestrictions(slotType: SlotType): ItemTypeRestriction[]
}

// =============================================================================
// Business Rule Specification Interfaces
// =============================================================================

/**
 * アイテム転送仕様
 * インベントリ間のアイテム転送ルール
 */
export interface IItemTransferSpecification {
  readonly _tag: 'ItemTransferSpecification'
  canTransfer(
    sourceInventoryId: InventoryId,
    targetInventoryId: InventoryId,
    item: ItemStack,
    quantity: ItemQuantity
  ): boolean
  validateTransfer(transferRequest: TransferRequest): TransferValidationResult
  getTransferLimitations(sourceInventoryId: InventoryId, targetInventoryId: InventoryId): TransferLimitation[]
}

/**
 * インベントリ整合性仕様
 * インベントリデータの整合性検証
 */
export interface IInventoryIntegritySpecification {
  readonly _tag: 'InventoryIntegritySpecification'
  validateIntegrity(inventoryId: InventoryId): IntegrityValidationResult
  checkSlotConsistency(inventoryId: InventoryId): boolean
  validateItemStacks(inventoryId: InventoryId): ItemStackValidationResult[]
  verifyCapacityLimits(inventoryId: InventoryId): boolean
}

/**
 * ゲームルール仕様
 * ゲーム固有のビジネスルール
 */
export interface IGameRuleSpecification {
  readonly _tag: 'GameRuleSpecification'
  canCraftItem(ingredients: ItemStack[], recipe: CraftingRecipe): boolean
  isValidEnchantmentCombination(baseItem: ItemStack, enchantments: Enchantment[]): boolean
  canRepairItem(damagedItem: ItemStack, repairMaterial: ItemStack): boolean
  validateItemUsage(item: ItemStack, context: UsageContext): boolean
}

// =============================================================================
// Supporting Types for Specifications
// =============================================================================

/**
 * バリデーション結果
 */
export const ValidationResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  errors: Schema.Array(Schema.String),
  warnings: Schema.Array(Schema.String),
  metadata: Schema.optional(JsonRecordSchema),
}).pipe(
  Schema.annotations({
    title: 'ValidationResult',
    description: 'Result of a validation operation',
  })
)

export type ValidationResult = Schema.Schema.Type<typeof ValidationResultSchema>

/**
 * 転送リクエスト
 */
export const TransferRequestSchema = Schema.Struct({
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  sourceSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  targetSlot: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  userId: Schema.String,
  metadata: Schema.optional(JsonRecordSchema),
}).pipe(
  Schema.annotations({
    title: 'TransferRequest',
    description: 'Request for item transfer between inventories',
  })
)

export type TransferRequest = Schema.Schema.Type<typeof TransferRequestSchema>

/**
 * 転送バリデーション結果
 */
export const TransferValidationResultSchema = Schema.Struct({
  canTransfer: Schema.Boolean,
  maxQuantity: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  restrictions: Schema.Array(Schema.String),
  estimatedCost: Schema.optional(Schema.Number),
  alternativeSlots: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))),
}).pipe(
  Schema.annotations({
    title: 'TransferValidationResult',
    description: 'Result of transfer validation',
  })
)

export type TransferValidationResult = Schema.Schema.Type<typeof TransferValidationResultSchema>

/**
 * 転送制限
 */
export const TransferLimitationSchema = Schema.Struct({
  type: Schema.Literal('PERMISSION', 'CAPACITY', 'ITEM_TYPE', 'QUANTITY', 'COOLDOWN'),
  description: Schema.String,
  value: Schema.optional(JsonValueSchema),
  expires: Schema.optional(Schema.Number),
}).pipe(
  Schema.annotations({
    title: 'TransferLimitation',
    description: 'Limitation on item transfers',
  })
)

export type TransferLimitation = Schema.Schema.Type<typeof TransferLimitationSchema>

/**
 * 整合性バリデーション結果
 */
export const IntegrityValidationResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  issues: Schema.Array(
    Schema.Struct({
      severity: Schema.Literal('ERROR', 'WARNING', 'INFO'),
      category: Schema.String,
      description: Schema.String,
      affectedSlots: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
      suggestedFix: Schema.optional(Schema.String),
    })
  ),
  lastChecked: Schema.Number,
  checksum: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'IntegrityValidationResult',
    description: 'Result of inventory integrity validation',
  })
)

export type IntegrityValidationResult = Schema.Schema.Type<typeof IntegrityValidationResultSchema>

/**
 * アイテムスタックバリデーション結果
 */
export const ItemStackValidationResultSchema = Schema.Struct({
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  isValid: Schema.Boolean,
  violations: Schema.Array(
    Schema.Struct({
      rule: Schema.String,
      description: Schema.String,
      severity: Schema.Literal('ERROR', 'WARNING'),
    })
  ),
  suggestedActions: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'ItemStackValidationResult',
    description: 'Result of item stack validation',
  })
)

export type ItemStackValidationResult = Schema.Schema.Type<typeof ItemStackValidationResultSchema>

/**
 * アイテムタイプ制限
 */
export const ItemTypeRestrictionSchema = Schema.Struct({
  allowedItemIds: Schema.optional(Schema.Array(Schema.String)),
  forbiddenItemIds: Schema.optional(Schema.Array(Schema.String)),
  allowedTags: Schema.optional(Schema.Array(Schema.String)),
  forbiddenTags: Schema.optional(Schema.Array(Schema.String)),
  maxQuantity: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  requiresPermission: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'ItemTypeRestriction',
    description: 'Restrictions on item types for specific slots',
  })
)

export type ItemTypeRestriction = Schema.Schema.Type<typeof ItemTypeRestrictionSchema>

/**
 * クラフトレシピ
 */
export const CraftingRecipeSchema = Schema.Struct({
  recipeId: Schema.String,
  ingredients: Schema.Array(
    Schema.Struct({
      itemId: Schema.String,
      quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
      metadata: Schema.optional(JsonRecordSchema),
    })
  ),
  result: Schema.Struct({
    itemId: Schema.String,
    quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    metadata: Schema.optional(JsonRecordSchema),
  }),
  craftingType: Schema.Literal('CRAFTING_TABLE', 'FURNACE', 'ANVIL', 'BREWING_STAND'),
  requirements: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'CraftingRecipe',
    description: 'Recipe for crafting items',
  })
)

export type CraftingRecipe = Schema.Schema.Type<typeof CraftingRecipeSchema>

/**
 * エンチャント
 */
export const EnchantmentSchema = Schema.Struct({
  enchantmentId: Schema.String,
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  maxLevel: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  applicableItems: Schema.Array(Schema.String),
  conflictsWith: Schema.optional(Schema.Array(Schema.String)),
  cost: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
}).pipe(
  Schema.annotations({
    title: 'Enchantment',
    description: 'Enchantment definition',
  })
)

export type Enchantment = Schema.Schema.Type<typeof EnchantmentSchema>

/**
 * 使用コンテキスト
 */
export const UsageContextSchema = Schema.Struct({
  playerId: Schema.String,
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  action: Schema.String,
  target: Schema.optional(JsonValueSchema),
  environment: Schema.optional(JsonRecordSchema),
  timestamp: Schema.Number,
}).pipe(
  Schema.annotations({
    title: 'UsageContext',
    description: 'Context for item usage validation',
  })
)

export type UsageContext = Schema.Schema.Type<typeof UsageContextSchema>

// =============================================================================
// Specification Factory Types
// =============================================================================

/**
 * 仕様ファクトリインターフェース
 * 各種仕様の生成と管理
 */
export interface ISpecificationFactory {
  createItemSpecification(criteria: ItemSpecificationCriteria): IItemSpecification
  createInventoryCapacitySpecification(config: CapacityConfiguration): IInventoryCapacitySpecification
  createPermissionSpecification(rules: PermissionRules): IInventoryPermissionSpecification
  createTransferSpecification(config: TransferConfiguration): IItemTransferSpecification
  createIntegritySpecification(checks: IntegrityCheckConfiguration): IInventoryIntegritySpecification
}

/**
 * アイテム仕様条件
 */
export const ItemSpecificationCriteriaSchema = Schema.Struct({
  itemTypes: Schema.optional(Schema.Array(Schema.String)),
  qualities: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  minDurability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  maxDurability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  hasEnchantments: Schema.optional(Schema.Boolean),
  requiredEnchantments: Schema.optional(Schema.Array(Schema.String)),
}).pipe(
  Schema.annotations({
    title: 'ItemSpecificationCriteria',
    description: 'Criteria for item specifications',
  })
)

export type ItemSpecificationCriteria = Schema.Schema.Type<typeof ItemSpecificationCriteriaSchema>

/**
 * 容量設定
 */
export const CapacityConfigurationSchema = Schema.Struct({
  maxSlots: Schema.Number.pipe(Schema.int(), Schema.positive()),
  reservedSlots: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  expansionAllowed: Schema.Boolean,
  compressionRatio: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
}).pipe(
  Schema.annotations({
    title: 'CapacityConfiguration',
    description: 'Configuration for inventory capacity limits',
  })
)

export type CapacityConfiguration = Schema.Schema.Type<typeof CapacityConfigurationSchema>

/**
 * 権限ルール
 */
export const PermissionRulesSchema = Schema.Struct({
  defaultAccess: Schema.Literal('NONE', 'READ', 'WRITE', 'ADMIN'),
  playerRules: Schema.optional(
    Schema.Record({
      key: Schema.String, // PlayerId
      value: Schema.Literal('NONE', 'READ', 'WRITE', 'ADMIN'),
    })
  ),
  groupRules: Schema.optional(
    Schema.Record({
      key: Schema.String, // GroupId
      value: Schema.Literal('NONE', 'READ', 'WRITE', 'ADMIN'),
    })
  ),
  timeRestrictions: Schema.optional(
    Schema.Array(
      Schema.Struct({
        startTime: Schema.Number,
        endTime: Schema.Number,
        allowedActions: Schema.Array(Schema.String),
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'PermissionRules',
    description: 'Rules for inventory access permissions',
  })
)

export type PermissionRules = Schema.Schema.Type<typeof PermissionRulesSchema>

/**
 * 転送設定
 */
export const TransferConfigurationSchema = Schema.Struct({
  maxTransferQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  allowedDirections: Schema.Array(Schema.Literal('IN', 'OUT', 'BIDIRECTIONAL')),
  cooldownPeriod: Schema.optional(Schema.Number.pipe(Schema.positive())),
  costPerItem: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  requiresConfirmation: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'TransferConfiguration',
    description: 'Configuration for item transfer operations',
  })
)

export type TransferConfiguration = Schema.Schema.Type<typeof TransferConfigurationSchema>

/**
 * 整合性チェック設定
 */
export const IntegrityCheckConfigurationSchema = Schema.Struct({
  enabledChecks: Schema.Array(
    Schema.Literal(
      'SLOT_CONSISTENCY',
      'ITEM_VALIDITY',
      'STACK_LIMITS',
      'DURABILITY_RANGES',
      'ENCHANTMENT_COMPATIBILITY',
      'METADATA_INTEGRITY',
      'PERMISSION_CONSISTENCY'
    )
  ),
  strictMode: Schema.Boolean,
  autoRepair: Schema.Boolean,
  reportLevel: Schema.Literal('ERROR_ONLY', 'WARNING_AND_ERROR', 'ALL'),
}).pipe(
  Schema.annotations({
    title: 'IntegrityCheckConfiguration',
    description: 'Configuration for inventory integrity checks',
  })
)

export type IntegrityCheckConfiguration = Schema.Schema.Type<typeof IntegrityCheckConfigurationSchema>

// =============================================================================
// Composite Specification Interfaces
// =============================================================================

/**
 * 複合仕様インターフェース
 * 複数の仕様を組み合わせた高レベルビジネスルール
 */
export interface ICompositeSpecification<T> extends ISpecification<T> {
  readonly _tag: 'CompositeSpecification'
  readonly specifications: ISpecification<T>[]
  addSpecification(spec: ISpecification<T>): void
  removeSpecification(spec: ISpecification<T>): void
  getViolations(candidate: T): SpecificationViolation[]
}

/**
 * 仕様違反
 */
export const SpecificationViolationSchema = Schema.Struct({
  specificationTag: Schema.String,
  message: Schema.String,
  severity: Schema.Literal('ERROR', 'WARNING', 'INFO'),
  field: Schema.optional(Schema.String),
  value: Schema.optional(JsonValueSchema),
  suggestedFix: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'SpecificationViolation',
    description: 'Violation of a business rule specification',
  })
)

export type SpecificationViolation = Schema.Schema.Type<typeof SpecificationViolationSchema>

// =============================================================================
// Specification Service Interfaces
// =============================================================================

/**
 * 仕様サービスインターフェース
 * 仕様の管理と実行を担当
 */
export interface ISpecificationService {
  readonly _tag: 'SpecificationService'
  validateItem(item: ItemStack, specifications: IItemSpecification[]): ValidationResult
  validateInventory(inventoryId: InventoryId, specifications: ISpecification<InventoryId>[]): ValidationResult
  validateTransfer(request: TransferRequest, specifications: IItemTransferSpecification[]): TransferValidationResult
  registerSpecification<T>(spec: ISpecification<T>): void
  unregisterSpecification<T>(spec: ISpecification<T>): void
  getSpecificationsByTag(tag: string): ISpecification<unknown>[]
}

/**
 * 仕様リポジトリインターフェース
 * 仕様の永続化と検索を担当
 */
export interface ISpecificationRepository {
  readonly _tag: 'SpecificationRepository'
  readonly save: <T>(specification: ISpecification<T>) => Effect.Effect<void, AllRepositoryErrors>
  readonly findByTag: (
    tag: string
  ) => Effect.Effect<ReadonlyArray<ISpecification<unknown>>, AllRepositoryErrors>
  readonly findByType: <T>(
    type: new () => T
  ) => Effect.Effect<ReadonlyArray<ISpecification<T>>, AllRepositoryErrors>
  readonly delete: <T>(specification: ISpecification<T>) => Effect.Effect<void, AllRepositoryErrors>
  readonly exists: <T>(specification: ISpecification<T>) => Effect.Effect<boolean, AllRepositoryErrors>
}

// =============================================================================
// Validation Schema Exports
// =============================================================================

/**
 * 仕様関連のスキーマバリデーション関数
 */
export const validateValidationResult = Schema.decodeUnknown(ValidationResultSchema)
export const validateTransferRequest = Schema.decodeUnknown(TransferRequestSchema)
export const validateTransferValidationResult = Schema.decodeUnknown(TransferValidationResultSchema)
export const validateItemSpecificationCriteria = Schema.decodeUnknown(ItemSpecificationCriteriaSchema)
export const validateCapacityConfiguration = Schema.decodeUnknown(CapacityConfigurationSchema)
export const validatePermissionRules = Schema.decodeUnknown(PermissionRulesSchema)
export const validateTransferConfiguration = Schema.decodeUnknown(TransferConfigurationSchema)
export const validateIntegrityCheckConfiguration = Schema.decodeUnknown(IntegrityCheckConfigurationSchema)

export const isValidValidationResult = Schema.is(ValidationResultSchema)
export const isValidTransferRequest = Schema.is(TransferRequestSchema)
export const isValidTransferValidationResult = Schema.is(TransferValidationResultSchema)
