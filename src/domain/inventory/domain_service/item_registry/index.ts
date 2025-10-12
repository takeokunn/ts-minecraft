/**
 * Item Registry Service Module
 *
 * アイテムレジストリドメインサービスのバレルエクスポート。
 */

export {
  ItemRegistryService,
  ItemRegistryErrorSchema,
  type ItemRegistryError,
  type EdibleProperties,
  type FuelProperties,
  type ItemCategory,
  type ItemConstraints,
  type ItemDefinition,
  type ItemDefinitionMetadata,
  type ItemProperties,
  type ItemRarity,
  type StackingRules,
  type StorageRequirements,
  type UsageRestriction,
} from './service'

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

export { makeItemRegistryService } from './live'
