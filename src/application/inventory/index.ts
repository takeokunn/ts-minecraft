/**
 * Application Layer - Inventory Module Exports
 *
 * アプリケーション層のInventory関連サービスを統合
 * ドメインとインフラストラクチャ層の協調による高レベルAPI
 */

// Integration Layer - Effect-TS ⇔ Zustand統合
export {
  InventoryEventSystem,
  InventoryIntegrationService,
  InventoryIntegrationServiceLive,
  useInventoryIntegration,
} from './integration-layer'

// API Service - 統合型高レベルAPI
export {
  InventoryAPIService,
  InventoryAPIServiceLive,
  // Types
  type APIResponse,
  type BulkOperationResult,
  type InventorySnapshot,
  type ItemOperationResult,
} from './api-service'

// Enhanced Service - 永続化統合サービス
export { InventoryServiceEnhanced } from './enhanced-service'

// Item Manager Service - 高度なアイテム管理
export {
  ItemAttributesFactory,
  ItemManagerError,
  ItemManagerService,
  ItemManagerServiceLive,
  registerEnhancedItem,
  type EnhancedItemDefinition,
  type EnhancedItemStack,
  type ItemAttributes,
  type ItemNBTData,
  type ItemQuality,
  // Types
  type ItemRarity,
} from './item-manager-service'
