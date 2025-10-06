/**
 * Item Registry Service Module
 *
 * アイテムレジストリドメインサービスのバレルエクスポート。
 */

// Service Interface and Implementation
export { ItemRegistryError, ItemRegistryService, ItemRegistryServiceLive } from './index'
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
} from './index'

// Live Implementation
export { ItemRegistryServiceLive } from './index'

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
} from './index'
export * from './index';
export * from './index';
export * from './service';
