/**
 * Item Registry Service Module
 *
 * アイテムレジストリドメインサービスのバレルエクスポート。
 */

// Service Interface and Implementation
export { ItemRegistryError, ItemRegistryService, ItemRegistryServiceLive } from './service'
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
} from './service'

// Live Implementation
export { ItemRegistryServiceLive } from './live'

// Definitions
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
  searchDefaultItems,
} from './definitions'
