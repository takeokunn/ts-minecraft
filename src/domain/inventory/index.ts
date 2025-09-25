/**
 * Inventory Domain - Complete Inventory Core System
 *
 * Provides comprehensive inventory management system including:
 * - 36-slot inventory management with persistence
 * - Item stacking, merging, and advanced operations
 * - Hotbar management (9 slots) with armor/offhand
 * - Enhanced item system with rarity, quality, NBT data
 * - Zustand state management integration
 * - LocalStorage and IndexedDB persistence
 * - High-level API for easy consumption
 */

// Core Types and Schemas
export * from './InventoryTypes.js'

// Basic Services
export * from './InventoryService.js'
export * from './InventoryServiceLive.js'
export * from './ItemRegistry.js'
export * from './SlotManager.js'
export * from './StackProcessor.js'

// Enhanced Services
export * from './InventoryServiceEnhanced.js'
export * from './ItemManagerService.js'

// Storage and Persistence
export * from './InventoryStorageService.js'
export * from './InventoryIndexedDBService.js'

// State Management Integration
export * from './InventoryZustandStore.js'
export * from './InventoryIntegrationLayer.js'
export * from './InventoryStateManager.js'
export * from './InventoryReactiveSystem.js'

// High-Level API
export * from './InventoryAPIService.js'

// Re-export commonly used utilities
import { createEmptyInventory, validateInventory } from './InventoryTypes.js'
import { ItemAttributesFactory } from './ItemManagerService.js'
import { useInventoryStore, useCurrentInventory, useInventoryOperations } from './InventoryZustandStore.js'

export const InventoryUtils = {
  createEmptyInventory,
  validateInventory,
  ItemAttributesFactory,
}

export const InventoryHooks = {
  useInventoryStore,
  useCurrentInventory,
  useInventoryOperations,
}

// Layer composition helpers
import { Layer } from 'effect'
import { InventoryServiceEnhanced } from './InventoryServiceEnhanced.js'
import { ItemManagerServiceLive } from './ItemManagerService.js'
import { LocalStorageInventoryService } from './InventoryStorageService.js'
import { HybridInventoryStorageService } from './InventoryIndexedDBService.js'
import { InventoryIntegrationServiceLive } from './InventoryIntegrationLayer.js'
import { InventoryAPIServiceLive } from './InventoryAPIService.js'
import { ItemRegistry } from './ItemRegistry.js'
import { InventoryStateManagerLive } from './InventoryStateManager.js'
import { InventoryReactiveSystemLive } from './InventoryReactiveSystem.js'

// Complete inventory system layers
export const InventoryCoreLayers = Layer.mergeAll(
  ItemRegistry.Default,
  LocalStorageInventoryService,
  ItemManagerServiceLive,
  InventoryServiceEnhanced
)

export const InventoryIntegratedLayers = Layer.mergeAll(
  InventoryCoreLayers,
  InventoryIntegrationServiceLive,
  InventoryAPIServiceLive
)

export const InventoryGameLayers = Layer.mergeAll(
  InventoryCoreLayers,
  InventoryStateManagerLive,
  InventoryReactiveSystemLive,
  InventoryAPIServiceLive
)

export const InventoryProductionLayers = Layer.mergeAll(
  ItemRegistry.Default,
  HybridInventoryStorageService,
  ItemManagerServiceLive,
  InventoryServiceEnhanced,
  InventoryIntegrationServiceLive,
  InventoryStateManagerLive,
  InventoryReactiveSystemLive,
  InventoryAPIServiceLive
)

// Constants
export const INVENTORY_CONSTANTS = {
  MAX_SLOTS: 36,
  HOTBAR_SIZE: 9,
  MAX_STACK_SIZE: 64,
  ARMOR_SLOTS: 4,
} as const

// Version info
export const INVENTORY_VERSION = '2.0.0' as const
