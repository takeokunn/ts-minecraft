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
  BatchTransferError,
  CanTransferSpecification,
  SourceItemExistsSpecification,
  StackLimitSpecification,
  TargetSlotAvailableSpecification,
  TransferError,
  TransferService,
  makeTransferService,
  ValidItemCountSpecification,
  ValidSlotSpecification,
  analyzeTransferability,
} from './transfer_service'
export type {
  BatchTransferRequest,
  OptimizedTransferOptions,
  TransferConstraint,
  TransferRequest,
  TransferResult,
  TransferSpecification,
  TransferabilityDetails,
} from './transfer_service'

// =============================================================================
// Stacking Service - スタック処理の高度なロジック
// =============================================================================

export {
  StackOptimizationError,
  StackingError,
  StackingService,
  makeStackingService,
  checkCompleteStackCompatibility,
  checkDurabilityCompatibility,
  checkItemIdCompatibility,
  checkMetadataCompatibility,
  checkStackLimitRule,
  resolveMetadataConflicts,
} from './stacking_service'
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
} from './stacking_service'

// =============================================================================
// Validation Service - インベントリ検証の統合サービス
// =============================================================================

export {
  CorrectionError,
  ValidationError,
  ValidationService,
  makeValidationService,
  runAllValidators,
  validateArmorSlots,
  validateDurability,
  validateHotbarSlots,
  validateMetadata,
  validateSelectedSlot,
  validateSlotCount,
  validateStackSizes,
} from './validation_service'
export type {
  CorrectionStep,
  CorrectionSuggestion,
  ValidationOptions,
  ValidationResult,
  ValidationSummary,
  ValidationViolation,
  ValidationViolationType,
  ValidationWarning,
} from './validation_service'

// =============================================================================
// Item Registry Service - アイテム定義の管理サービス
// =============================================================================

export {
  ItemRegistryError,
  ItemRegistryService,
  makeItemRegistryService,
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
  searchDefaultItems,
} from './item_registry'
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
} from './item_registry'

// =============================================================================
// Crafting Integration Service - クラフティングシステム統合
// =============================================================================

export {
  CraftingIntegrationError,
  CraftingIntegrationService,
  makeCraftingIntegrationService,
} from './crafting_integration'
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
} from './crafting_integration'

// =============================================================================
// Unified Layer for All Domain Services
// =============================================================================

export * from './layer'
