/**
 * Item Registry Service Module
 *
 * アイテムレジストリドメインサービスのバレルエクスポート。
 */

export {
  ItemRegistryErrorSchema,
  ItemRegistryService,
  type EdibleProperties,
  type FuelProperties,
  type ItemCategory,
  type ItemConstraints,
  type ItemDefinition,
  type ItemDefinitionMetadata,
  type ItemProperties,
  type ItemRarity,
  type ItemRegistryError,
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
