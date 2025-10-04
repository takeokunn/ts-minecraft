/**
 * Inventory Domain Services
 *
 * インベントリドメインの全ドメインサービスのバレルエクスポート。
 * DDD原則に従い、複数の集約にまたがるビジネスロジックを
 * 責任分離された各種サービスとして提供します。
 */

// =============================================================================
// Transfer Service - アイテム移動の複雑なロジック
// =============================================================================

export {
  analyzeTransferability,
  BatchTransferError,
  CanTransferSpecification,
  SourceItemExistsSpecification,
  StackLimitSpecification,
  TargetSlotAvailableSpecification,
  TransferError,
  TransferService,
  TransferServiceLive,
  ValidItemCountSpecification,
  ValidSlotSpecification,
} from './transfer-service'
export type {
  BatchTransferRequest,
  OptimizedTransferOptions,
  TransferabilityDetails,
  TransferConstraint,
  TransferRequest,
  TransferResult,
  TransferSpecification,
} from './transfer-service'

// =============================================================================
// Stacking Service - スタック処理の高度なロジック
// =============================================================================

export {
  checkCompleteStackCompatibility,
  checkDurabilityCompatibility,
  checkItemIdCompatibility,
  checkMetadataCompatibility,
  checkStackLimitRule,
  resolveMetadataConflicts,
  StackingError,
  StackingService,
  StackingServiceLive,
  StackOptimizationError,
} from './stacking-service'
export type {
  MetadataConflict,
  MetadataResolutionStrategy,
  StackCompatibility,
  StackIncompatibilityReason,
  StackOperation,
  StackOptimizationOptions,
  StackOptimizationResult,
  StackSplitRequest,
  StackSplitResult,
} from './stacking-service'

// =============================================================================
// Validation Service - インベントリ検証の統合サービス
// =============================================================================

export {
  CorrectionError,
  runAllValidators,
  validateArmorSlots,
  validateDurability,
  validateHotbarSlots,
  validateMetadata,
  validateSelectedSlot,
  validateSlotCount,
  validateStackSizes,
  ValidationError,
  ValidationService,
  ValidationServiceLive,
} from './validation-service'
export type {
  CorrectionStep,
  CorrectionSuggestion,
  ValidationOptions,
  ValidationResult,
  ValidationSummary,
  ValidationViolation,
  ValidationViolationType,
  ValidationWarning,
} from './validation-service'

// =============================================================================
// Item Registry Service - アイテム定義の管理サービス
// =============================================================================

export {
  createDynamicItemDefinition,
  getAllDefaultItemDefinitions,
  getDefaultItemDefinition,
  getDefaultItemsByCategory,
  getItemRarity,
  getItemStackLimit,
  isEdible,
  isEnchantable,
  isFuel,
  itemExists,
  ItemRegistryError,
  ItemRegistryService,
  ItemRegistryServiceLive,
  searchDefaultItems,
} from './item-registry'
export type {
  EdibleProperties,
  FuelProperties,
  ItemCategory,
  ItemConstraints,
  ItemDefinition,
  ItemDefinitionMetadata,
  ItemProperties,
  ItemRarity,
  StackingRules,
  StorageRequirements,
  UsageRestriction,
} from './item-registry'

// =============================================================================
// Crafting Integration Service - クラフティングシステム統合
// =============================================================================

export {
  CraftingIntegrationError,
  CraftingIntegrationService,
  CraftingIntegrationServiceLive,
} from './crafting-integration'
export type {
  CraftabilityResult,
  CraftingResult,
  FuelRequirement,
  IngredientCollectionResult,
  Recipe,
  RecipeIngredient,
  RecipeRequirements,
  RecipeResult,
  RecipeType,
} from './crafting-integration'

// =============================================================================
// Unified Layer for All Domain Services
// =============================================================================

import { Layer } from 'effect'
import { CraftingIntegrationServiceLive } from './crafting-integration'
import { ItemRegistryServiceLive } from './item-registry'
import { StackingServiceLive } from './stacking-service'
import { TransferServiceLive } from './transfer-service'
import { ValidationServiceLive } from './validation-service'

/**
 * 全インベントリドメインサービスの統合レイヤー
 *
 * 全てのドメインサービスを一度に提供する便利なレイヤー。
 * 各サービスは独立して使用することも可能。
 *
 * @example
 * ```typescript
 * // 全サービスを提供
 * const program = Effect.gen(function* () {
 *   const transferService = yield* TransferService
 *   const stackingService = yield* StackingService
 *   const validationService = yield* ValidationService
 *   const itemRegistry = yield* ItemRegistryService
 *   const craftingIntegration = yield* CraftingIntegrationService
 *
 *   // サービスを使用した処理...
 * })
 *
 * Effect.provide(program, InventoryDomainServicesLive)
 * ```
 */
export const InventoryDomainServicesLive = Layer.mergeAll(
  TransferServiceLive,
  StackingServiceLive,
  ValidationServiceLive,
  ItemRegistryServiceLive,
  CraftingIntegrationServiceLive
)
