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
export * from './InventoryTypes'

// Basic Services
export * from './InventoryService'
export * from './InventoryServiceLive'
export * from './ItemRegistry'
export * from './SlotManager'
export * from './StackProcessor'

// Enhanced Services
export * from './InventoryServiceEnhanced'
export * from './ItemManagerService'

// Storage and Persistence
export * from './InventoryStorageService'
export * from './InventoryIndexedDBService'

// State Management Integration
export * from './InventoryZustandStore'
export * from './InventoryIntegrationLayer'
export * from './InventoryStateManager'
export * from './InventoryReactiveSystem'

// High-Level API
export * from './InventoryAPIService'

// Re-export commonly used utilities
import { createEmptyInventory, validateInventory } from './InventoryTypes'
import { ItemAttributesFactory } from './ItemManagerService'
import { useInventoryStore, useCurrentInventory, useInventoryOperations } from './InventoryZustandStore'

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
import { InventoryServiceEnhanced } from './InventoryServiceEnhanced'
import { ItemManagerServiceLive } from './ItemManagerService'
import { LocalStorageInventoryService } from './InventoryStorageService'
import { HybridInventoryStorageService } from './InventoryIndexedDBService'
import { InventoryIntegrationServiceLive } from './InventoryIntegrationLayer'
import { InventoryAPIServiceLive } from './InventoryAPIService'
import { ItemRegistry } from './ItemRegistry'
import { InventoryStateManagerLive } from './InventoryStateManager'
import { InventoryReactiveSystemLive } from './InventoryReactiveSystem'

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
