/**
 * @fileoverview Inventory Domain Types - Unified Export
 *
 * TypeScript Minecraft Clone プロジェクトのInventoryドメインにおける
 * DDD原理主義に基づく型定義とエラー体系の統一エクスポート
 *
 * このファイルは以下の型カテゴリを統一的に公開します：
 * - Core Types: コアドメイン型（Brand型、ADT等）
 * - Constants: ドメイン定数とバリデーション
 * - Errors: Schema.TaggedErrorによる階層的エラー体系
 * - Events: ドメインイベント型（EventSourcing対応）
 * - Commands: CQRSコマンド型
 * - Queries: CQRSクエリ型
 * - Specifications: 仕様パターンインターフェース
 * - Interfaces: サービスインターフェース（DI対応）
 *
 * @version 1.0.0
 * @author TypeScript Minecraft Clone Team
 */

// =============================================================================
// Core Domain Types
// =============================================================================

export type {
  Durability,
  // Value Object Types
  Enchantment,
  EnchantmentLevel,
  // Brand Types
  InventoryId,
  InventorySlot,
  // ADT Types
  InventoryType,
  // Entity Types
  ItemDefinition,
  ItemId,
  ItemMetadata,
  ItemQuality,
  ItemQuantity,
  ItemStack,
  PlayerId,
  SlotNumber,
  SlotType,
} from './core'

export {
  DurabilitySchema,
  EnchantmentLevelSchema,
  EnchantmentSchema,
  // Schema Definitions
  InventoryIdSchema,
  InventorySlotSchema,
  InventoryTypeSchema,
  ItemDefinitionSchema,
  ItemIdSchema,
  ItemMetadataSchema,
  ItemQualitySchema,
  ItemQuantitySchema,
  ItemStackSchema,
  PlayerIdSchema,
  SlotNumberSchema,
  SlotTypeSchema,
  isValidDurability,
  isValidEnchantmentLevel,
  // Validation Functions
  isValidInventoryId,
  isValidInventorySlot,
  isValidInventoryType,
  isValidItemDefinition,
  isValidItemId,
  isValidItemQuality,
  isValidItemQuantity,
  isValidItemStack,
  isValidPlayerId,
  isValidSlotNumber,
  isValidSlotType,
  parseDurability,
  parseEnchantmentLevel,
  // Parse Functions
  parseInventoryId,
  parseInventorySlot,
  parseInventoryType,
  parseItemDefinition,
  parseItemId,
  parseItemQuality,
  parseItemQuantity,
  parseItemStack,
  parsePlayerId,
  parseSlotNumber,
  parseSlotType,
} from './core'

// =============================================================================
// Domain Constants
// =============================================================================

export {
  CUSTOM_STACK_SIZES,
  ERROR_MESSAGES,
  // Inventory Size Constants
  INVENTORY_SIZES,
  // Configuration Constants
  INVENTORY_TYPE_CONFIG,
  // Item Constraint Constants
  ITEM_CONSTRAINTS,
  ITEM_QUALITY_CONFIG,
  // Schema Exports
  InventorySizeSchema,
  ItemConstraintsSchema,
  SLOT_RANGES,
  SlotRangeSchema,
  VALIDATION_CONSTANTS,
  getCustomStackSize,
  isCustomStackSizeItem,
  // Utility Functions
  isValidInventorySize,
  isValidSlotRange,
} from './constants'

// =============================================================================
// Error Types and Error Handling
// =============================================================================

export type {
  // Error Hierarchy
  InventoryDomainError,
} from './errors'

export {
  ConcurrencyError,
  ConstraintViolationError,
  CorruptionError,
  InsufficientSpaceError,
  // Error Classes (Schema.TaggedError) - Classes export both type and constructor
  InventoryError,
  ItemNotFoundError,
  ItemValidationError,
  OperationError,
  OwnershipError,
  PermissionError,
  SlotValidationError,
  SystemError,
  TransferFailureError,
  ValidationError,
  createConcurrencyError,
  createConstraintViolationError,
  createCorruptionError,
  createInsufficientSpaceError,
  // Error Factory Functions
  createInventoryError,
  createItemNotFoundError,
  createItemValidationError,
  createOwnershipError,
  createPermissionError,
  createSlotValidationError,
  createTransferFailureError,
  createValidationError,
  // Error Utilities
  formatErrorMessage,
  getErrorSeverity,
  isConcurrencyError,
  isConstraintViolationError,
  isCorruptionError,
  isInsufficientSpaceError,
  isInventoryDomainError,
  // Error Guard Functions
  isInventoryError,
  isItemNotFoundError,
  isItemValidationError,
  isOperationError,
  isOwnershipError,
  isPermissionError,
  isRecoverableError,
  isSlotValidationError,
  isSystemError,
  isTransferFailureError,
  isValidationError,
} from './errors'

// =============================================================================
// Domain Events (Event Sourcing)
// =============================================================================

export type {
  // Base Event
  BaseDomainEvent,
  InventoryBackupCreatedEvent,
  // Inventory Aggregate Events
  InventoryCreatedEvent,
  InventoryDeletedEvent,
  // Domain Event Union
  InventoryDomainEvent,
  // Inventory State Events
  InventoryLockedEvent,
  InventoryResizedEvent,
  InventoryUnlockedEvent,
  // Item Stack Events
  ItemAddedEvent,
  ItemBrokenEvent,
  // Item State Change Events
  ItemDurabilityChangedEvent,
  ItemEnchantedEvent,
  ItemMovedEvent,
  ItemRemovedEvent,
  ItemStackMergedEvent,
  ItemStackSplitEvent,
  ItemTransferCompletedEvent,
  ItemTransferFailedEvent,
  // Item Transfer Events
  ItemTransferStartedEvent,
  // Integration Events
  PlayerInventorySyncedEvent,
} from './events'

export {
  // Event Schemas
  BaseDomainEventSchema,
  InventoryBackupCreatedEventSchema,
  InventoryCreatedEventSchema,
  InventoryDeletedEventSchema,
  InventoryDomainEventSchema,
  InventoryLockedEventSchema,
  InventoryResizedEventSchema,
  InventoryUnlockedEventSchema,
  ItemAddedEventSchema,
  ItemBrokenEventSchema,
  ItemDurabilityChangedEventSchema,
  ItemEnchantedEventSchema,
  ItemMovedEventSchema,
  ItemRemovedEventSchema,
  ItemStackMergedEventSchema,
  ItemStackSplitEventSchema,
  ItemTransferCompletedEventSchema,
  ItemTransferFailedEventSchema,
  ItemTransferStartedEventSchema,
  PlayerInventorySyncedEventSchema,
  // Event Factory Functions
  createInventoryCreatedEvent,
  createItemAddedEvent,
  createItemRemovedEvent,
  createItemTransferStartedEvent,

  // Event Type Guards
  isInventoryCreatedEvent,
  isInventoryLockedEvent,
  isInventoryUnlockedEvent,
  isItemAddedEvent,
  isItemMovedEvent,
  isItemRemovedEvent,
  isItemTransferCompletedEvent,
  isItemTransferFailedEvent,
  isItemTransferStartedEvent,
  isValidInventoryDomainEvent,
  // Event Validation
  validateInventoryDomainEvent,
} from './events'

// =============================================================================
// CQRS Commands
// =============================================================================

export type {
  // Item Manipulation Commands
  AddItemCommand,
  // Base Command
  BaseCommand,
  BulkTransferCommand,
  // Inventory Management Commands
  CreateInventoryCommand,
  DeleteInventoryCommand,
  EnchantItemCommand,
  // Command Union
  InventoryCommand,
  // Inventory State Commands
  LockInventoryCommand,
  MergeItemStacksCommand,
  MoveItemCommand,
  RemoveItemCommand,
  ResizeInventoryCommand,
  SplitItemStackCommand,
  SyncInventoryCommand,
  // Item Transfer Commands
  TransferItemCommand,
  UnlockInventoryCommand,
  // Item State Change Commands
  UpdateItemDurabilityCommand,
  UpdateItemMetadataCommand,
} from './commands'

export {
  AddItemCommandSchema,
  // Command Schemas
  BaseCommandSchema,
  BulkTransferCommandSchema,
  CreateInventoryCommandSchema,
  DeleteInventoryCommandSchema,
  EnchantItemCommandSchema,
  InventoryCommandSchema,
  LockInventoryCommandSchema,
  MergeItemStacksCommandSchema,
  MoveItemCommandSchema,
  RemoveItemCommandSchema,
  ResizeInventoryCommandSchema,
  SplitItemStackCommandSchema,
  SyncInventoryCommandSchema,
  TransferItemCommandSchema,
  UnlockInventoryCommandSchema,
  UpdateItemDurabilityCommandSchema,
  UpdateItemMetadataCommandSchema,
  // Command Factory Functions
  createAddItemCommand,
  createMoveItemCommand,
  createRemoveItemCommand,
  createTransferItemCommand,
  isAddItemCommand,
  isBulkTransferCommand,
  // Command Type Guards
  isCreateInventoryCommand,
  isLockInventoryCommand,
  isMoveItemCommand,
  isRemoveItemCommand,
  isTransferItemCommand,
  isUnlockInventoryCommand,
  isValidInventoryCommand,
  // Command Validation
  validateInventoryCommand,
} from './commands'

// =============================================================================
// CQRS Queries
// =============================================================================

export type {
  // Base Query
  BaseQuery,
  CheckItemAvailabilityQuery,
  CheckPermissionsQuery,
  CountItemsQuery,
  FindEmptySlotsQuery,
  // Item Queries
  FindItemsQuery,
  // Inventory Queries
  GetInventoryQuery,
  // Analytics Queries
  GetInventoryStatsQuery,
  GetItemHistoryQuery,
  GetPlayerInventoryQuery,
  // Slot Queries
  GetSlotInfoQuery,
  GetSlotUtilizationQuery,
  // Query Union
  InventoryQuery,
  ItemFilter,
  ListInventoriesQuery,
  Pagination,
  QueryResult,
  SortConfig,
  // Query Support Types
  SortOrder,
  // Validation Queries
  VerifyInventoryIntegrityQuery,
} from './queries'

export {
  // Query Schemas
  BaseQuerySchema,
  CheckItemAvailabilityQuerySchema,
  CheckPermissionsQuerySchema,
  CountItemsQuerySchema,
  FindEmptySlotsQuerySchema,
  FindItemsQuerySchema,
  GetInventoryQuerySchema,
  GetInventoryStatsQuerySchema,
  GetItemHistoryQuerySchema,
  GetPlayerInventoryQuerySchema,
  GetSlotInfoQuerySchema,
  GetSlotUtilizationQuerySchema,
  InventoryQuerySchema,
  ItemFilterSchema,
  ListInventoriesQuerySchema,
  // Query Result Utilities
  PaginatedResultSchema,
  PaginationSchema,
  QueryResultSchema,
  SortConfigSchema,
  SortOrderSchema,
  VerifyInventoryIntegrityQuerySchema,
  createCountItemsQuery,
  createFindEmptySlotsQuery,
  createFindItemsQuery,
  // Query Factory Functions
  createGetInventoryQuery,
  isCheckItemAvailabilityQuery,
  isCountItemsQuery,
  isFindEmptySlotsQuery,
  isFindItemsQuery,
  // Query Type Guards
  isGetInventoryQuery,
  isGetInventoryStatsQuery,
  isGetPlayerInventoryQuery,
  isValidInventoryQuery,
  isVerifyInventoryIntegrityQuery,

  // Query Validation
  validateInventoryQuery,
} from './queries'

// =============================================================================
// Specification Pattern (Business Rules)
// =============================================================================

export type {
  CapacityConfiguration,
  CraftingRecipe,
  IAsyncSpecification,
  // Composite Specifications
  ICompositeSpecification,
  IGameRuleSpecification,
  // Inventory Specifications
  IInventoryCapacitySpecification,
  IInventoryIntegritySpecification,
  IInventoryPermissionSpecification,
  IInventoryStateSpecification,
  IItemCompatibilitySpecification,
  IItemQualitySpecification,
  // Item Specifications
  IItemSpecification,
  IItemStackabilitySpecification,
  // Business Rule Specifications
  IItemTransferSpecification,
  ISlotCompatibilitySpecification,
  // Slot Specifications
  ISlotConstraintSpecification,
  // Specification Interfaces
  ISpecification,
  // Factory and Service Interfaces
  ISpecificationFactory,
  ISpecificationRepository,
  ISpecificationService,
  IntegrityCheckConfiguration,
  IntegrityValidationResult,
  // Configuration Types
  ItemSpecificationCriteria,
  ItemStackValidationResult,
  ItemTypeRestriction,
  PermissionRules,
  Enchantment as SpecEnchantment,
  SpecificationViolation,
  TransferConfiguration,
  TransferLimitation,
  TransferRequest,
  TransferValidationResult,
  UsageContext,
  // Supporting Types
  ValidationResult,
} from './specifications'

export {
  CapacityConfigurationSchema,
  CraftingRecipeSchema,
  IntegrityCheckConfigurationSchema,
  IntegrityValidationResultSchema,
  ItemSpecificationCriteriaSchema,
  ItemStackValidationResultSchema,
  ItemTypeRestrictionSchema,
  PermissionRulesSchema,
  EnchantmentSchema as SpecEnchantmentSchema,
  SpecificationViolationSchema,
  TransferConfigurationSchema,
  TransferLimitationSchema,
  TransferRequestSchema,
  TransferValidationResultSchema,
  UsageContextSchema,
  // Supporting Schemas
  ValidationResultSchema,
  isValidTransferRequest,
  isValidTransferValidationResult,
  // Type Guards
  isValidValidationResult,
  validateCapacityConfiguration,
  validateIntegrityCheckConfiguration,
  validateItemSpecificationCriteria,
  validatePermissionRules,
  validateTransferConfiguration,
  validateTransferRequest,
  validateTransferValidationResult,
  // Validation Functions
  validateValidationResult,
} from './specifications'

// =============================================================================
// Service Interfaces (Dependency Injection)
// =============================================================================

export type {
  BackupResult,
  EventStream,
  IntegrityResult,
  InventoryAggregate,
  InventoryData,
  InventoryDomainConfiguration,
  InventoryDomainDependencies,
  // Domain Configuration Types
  InventoryDomainInput,
  InventoryDomainOutput,
  InventorySnapshot,
  InventoryStatistics,
  // Supporting Types
  ItemAddResult,
  ItemSearchCriteria,
  TradeRequest,
  TradeResult,
  TransferResult,
} from './interfaces'

export {
  CraftingIntegrationService,
  EconomyIntegrationService,
  IntegrityResultSchema,
  // Context Tags (export both tag and interface type)
  InventoryDomainProvider,
  InventoryEventStore,
  InventoryQueryService,
  InventoryRepository,
  InventorySpecificationService,
  InventoryStatisticsSchema,
  // Schema Exports
  ItemAddResultSchema,
  ItemDefinitionRepository,
  ItemManagementService,
  TransferResultSchema,
  isValidIntegrityResult,
  isValidInventoryStatistics,
  // Validation Functions
  isValidItemAddResult,
  isValidTransferResult,
  parseIntegrityResult,
  parseIntegrityResultSync,
  parseInventoryStatistics,
  parseInventoryStatisticsSync,
  // Parser Functions
  parseItemAddResult,
  parseItemAddResultSync,
  parseTransferResult,
  parseTransferResultSync,
} from './interfaces'

// =============================================================================
// Re-exports for Convenience
// =============================================================================

/**
 * 型定義エクスポート完了
 *
 * 上記のエクスポートにより、以下の型カテゴリが利用可能になります：
 * - Core Types: Brand型による型安全性の確保
 * - Constants: ドメイン定数と制約値
 * - Errors: Schema.TaggedErrorによる階層的エラー体系
 * - Events: Event Sourcingパターン対応のドメインイベント
 * - Commands: CQRSパターンのコマンド型
 * - Queries: CQRSパターンのクエリ型
 * - Specifications: Specification Patternのインターフェース
 * - Interfaces: 依存性注入対応のサービスインターフェース
 */

// =============================================================================
// Version Information
// =============================================================================

/**
 * 型定義のバージョン情報
 */
export const INVENTORY_TYPES_VERSION = '1.0.0' as const

/**
 * 互換性情報
 */
export const COMPATIBILITY = {
  minEffectTSVersion: '3.17.0',
  minTypeScriptVersion: '5.0.0',
  supportedNodeVersions: ['18', '20', '22'],
} as const

/**
 * エクスポートされた型の数
 */
export const TYPE_EXPORT_STATS = {
  coreTypes: 23,
  constants: 15,
  errors: 12,
  events: 18,
  commands: 16,
  queries: 13,
  specifications: 35,
  interfaces: 28,
  total: 160,
} as const

/**
 * 型定義の特徴
 */
export const TYPE_FEATURES = {
  brandTypes: true,
  algebraicDataTypes: true,
  eventSourcing: true,
  cqrsPattern: true,
  specificationPattern: true,
  serviceInterfaces: true,
  dependencyInjection: true,
  effectTSIntegration: true,
  schemaValidation: true,
  hierarchicalErrors: true,
} as const
