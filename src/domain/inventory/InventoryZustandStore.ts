/**
 * InventoryZustandStore - Zustand状態管理統合
 *
 * Zustand persistミドルウェアとEffect-TSサービス層を統合
 * リアクティブなUI更新と型安全な状態管理を提供
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { subscribeWithSelector } from 'zustand/middleware'
import { Effect, Option, pipe, Match } from 'effect'
import { get, set, del, createStore } from 'idb-keyval'
import type { UseStore } from 'idb-keyval'
import { Inventory, InventoryState, PlayerId, ItemStack } from './InventoryTypes.js'
import { EnhancedItemStack } from './ItemManagerService.js'

// Zustand store state interface
export interface InventoryZustandState {
  // Current active player inventory
  currentInventory: Inventory | null
  currentPlayerId: PlayerId | null

  // Inventory operations
  setCurrentInventory: (playerId: PlayerId, inventory: Inventory) => void
  updateSlot: (slotIndex: number, itemStack: ItemStack | null) => void
  addItem: (itemStack: ItemStack) => void
  removeItem: (slotIndex: number, amount?: number) => void
  moveItem: (fromSlot: number, toSlot: number) => void
  swapItems: (slot1: number, slot2: number) => void

  // Hotbar operations
  setSelectedSlot: (slotIndex: number) => void
  getSelectedItem: () => ItemStack | null

  // Utility functions
  getEmptySlotCount: () => number
  getUsedSlotCount: () => number
  findItemSlots: (itemId: string) => number[]
  hasSpaceForItem: (itemStack: ItemStack) => boolean

  // State management
  isLoading: boolean
  lastSaved: number | null
  error: string | null
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Persistence actions
  saveToStorage: () => Promise<void>
  loadFromStorage: (playerId: PlayerId) => Promise<void>
  clearStorage: () => Promise<void>
}

// Custom IndexedDB storage for Zustand persist
const createIndexedDBStorage = (): StateStorage => {
  // Create custom store for Zustand data
  const zustandStore: UseStore = createStore('minecraft-zustand-db', 'inventory-state')

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const value = await get(name, zustandStore)
        return value ? JSON.stringify(value) : null
      } catch (error) {
        console.error('IndexedDB getItem error:', error)
        return null
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const parsed = JSON.parse(value)
        await set(name, parsed, zustandStore)
      } catch (error) {
        console.error('IndexedDB setItem error:', error)
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await del(name, zustandStore)
      } catch (error) {
        console.error('IndexedDB removeItem error:', error)
      }
    },
  }
}

// Create the Zustand store with persistence
export const useInventoryStore = create<InventoryZustandState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State
        currentInventory: null,
        currentPlayerId: null,
        isLoading: false,
        lastSaved: null,
        error: null,

        // Actions
        setCurrentInventory: (playerId: PlayerId, inventory: Inventory) => {
          set({
            currentPlayerId: playerId,
            currentInventory: inventory,
            error: null,
          })
        },

        updateSlot: (slotIndex: number, itemStack: ItemStack | null) => {
          const state = get()
          if (!state.currentInventory) return

          const newSlots = [...state.currentInventory.slots]
          newSlots[slotIndex] = itemStack

          set({
            currentInventory: {
              ...state.currentInventory,
              slots: newSlots,
            },
          })
        },

        addItem: (itemStack: ItemStack) => {
          const state = get()
          if (!state.currentInventory) return

          // Find first empty slot
          const emptySlotIndex = state.currentInventory.slots.findIndex((slot) => slot === null)
          if (emptySlotIndex !== -1) {
            state.updateSlot(emptySlotIndex, itemStack)
          }
        },

        removeItem: (slotIndex: number, amount?: number) => {
          const state = get()
          if (!state.currentInventory) return

          const currentItem = state.currentInventory.slots[slotIndex]
          if (!currentItem) return

          const removeAmount = amount ?? currentItem.count

          if (removeAmount >= currentItem.count) {
            state.updateSlot(slotIndex, null)
          } else {
            const updatedItem: ItemStack = {
              ...currentItem,
              count: currentItem.count - removeAmount,
            }
            state.updateSlot(slotIndex, updatedItem)
          }
        },

        moveItem: (fromSlot: number, toSlot: number) => {
          const state = get()
          if (!state.currentInventory) return

          const fromItem = state.currentInventory.slots[fromSlot]
          const toItem = state.currentInventory.slots[toSlot]

          if (!fromItem) return

          // If destination is empty, move item
          if (!toItem) {
            state.updateSlot(fromSlot, null)
            state.updateSlot(toSlot, fromItem)
            return
          }

          // If items can stack, try to merge
          if (
            fromItem.itemId === toItem.itemId &&
            JSON.stringify(fromItem.metadata) === JSON.stringify(toItem.metadata)
          ) {
            const maxStackSize = 64 // Should come from item definition
            const totalCount = fromItem.count + toItem.count

            if (totalCount <= maxStackSize) {
              // Merge completely
              state.updateSlot(fromSlot, null)
              state.updateSlot(toSlot, { ...toItem, count: totalCount })
            } else {
              // Partial merge
              state.updateSlot(fromSlot, { ...fromItem, count: totalCount - maxStackSize })
              state.updateSlot(toSlot, { ...toItem, count: maxStackSize })
            }
          } else {
            // Swap items
            state.swapItems(fromSlot, toSlot)
          }
        },

        swapItems: (slot1: number, slot2: number) => {
          const state = get()
          if (!state.currentInventory) return

          const item1 = state.currentInventory.slots[slot1]
          const item2 = state.currentInventory.slots[slot2]

          state.updateSlot(slot1, item2)
          state.updateSlot(slot2, item1)
        },

        setSelectedSlot: (slotIndex: number) => {
          const state = get()
          if (!state.currentInventory) return

          set({
            currentInventory: {
              ...state.currentInventory,
              selectedSlot: Math.max(0, Math.min(8, slotIndex)),
            },
          })
        },

        getSelectedItem: () => {
          const state = get()
          if (!state.currentInventory) return null

          const selectedHotbarSlot = state.currentInventory.hotbar[state.currentInventory.selectedSlot]
          return selectedHotbarSlot !== undefined ? state.currentInventory.slots[selectedHotbarSlot] : null
        },

        getEmptySlotCount: () => {
          const state = get()
          if (!state.currentInventory) return 0

          return state.currentInventory.slots.filter((slot) => slot === null).length
        },

        getUsedSlotCount: () => {
          const state = get()
          if (!state.currentInventory) return 0

          return state.currentInventory.slots.filter((slot) => slot !== null).length
        },

        findItemSlots: (itemId: string) => {
          const state = get()
          if (!state.currentInventory) return []

          return state.currentInventory.slots
            .map((slot, index) => (slot?.itemId === itemId ? index : -1))
            .filter((index) => index !== -1)
        },

        hasSpaceForItem: (itemStack: ItemStack) => {
          const state = get()
          if (!state.currentInventory) return false

          // Check for empty slots
          if (state.getEmptySlotCount() > 0) return true

          // Check for stackable slots
          const compatibleSlots = state.findItemSlots(itemStack.itemId)
          for (const slotIndex of compatibleSlots) {
            const existingItem = state.currentInventory.slots[slotIndex]
            if (
              existingItem &&
              JSON.stringify(existingItem.metadata) === JSON.stringify(itemStack.metadata) &&
              existingItem.count < 64
            ) {
              // Should come from item definition
              return true
            }
          }

          return false
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading })
        },

        setError: (error: string | null) => {
          set({ error })
        },

        saveToStorage: async () => {
          const state = get()
          if (!state.currentInventory || !state.currentPlayerId) return

          try {
            state.setLoading(true)
            // This would integrate with our InventoryStorageService
            // For now, just update timestamp
            set({ lastSaved: Date.now(), error: null })
          } catch (error) {
            state.setError(error instanceof Error ? error.message : 'Save failed')
          } finally {
            state.setLoading(false)
          }
        },

        loadFromStorage: async (playerId: PlayerId) => {
          try {
            get().setLoading(true)
            // This would integrate with our InventoryStorageService
            // For now, just clear error
            set({ error: null })
          } catch (error) {
            get().setError(error instanceof Error ? error.message : 'Load failed')
          } finally {
            get().setLoading(false)
          }
        },

        clearStorage: async () => {
          try {
            set({
              currentInventory: null,
              currentPlayerId: null,
              lastSaved: null,
              error: null,
            })
          } catch (error) {
            get().setError(error instanceof Error ? error.message : 'Clear failed')
          }
        },
      }),
      {
        name: 'minecraft-inventory-storage',
        storage: createJSONStorage(() => createIndexedDBStorage()),

        // Only persist essential data
        partialize: (state) => ({
          currentInventory: state.currentInventory,
          currentPlayerId: state.currentPlayerId,
          lastSaved: state.lastSaved,
        }),

        // Handle version migrations
        version: 1,
        migrate: (persistedState: any, version: number) => {
          if (version === 0) {
            // Migration from version 0 to 1
            return {
              ...persistedState,
              lastSaved: Date.now(),
            }
          }
          return persistedState as InventoryZustandState
        },

        // Custom merge function to handle complex data
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...persistedState,
          // Always use current state for functions and computed values
          isLoading: false,
          error: null,
        }),

        // Skip hydration on SSR
        skipHydration: typeof window === 'undefined',
      }
    )
  )
)

// Effect-TS integration helpers
export const InventoryZustandEffects = {
  // Convert Zustand actions to Effects
  setInventory: (playerId: PlayerId, inventory: Inventory) =>
    Effect.sync(() => {
      useInventoryStore.getState().setCurrentInventory(playerId, inventory)
    }),

  addItem: (itemStack: ItemStack) =>
    Effect.sync(() => {
      useInventoryStore.getState().addItem(itemStack)
    }),

  removeItem: (slotIndex: number, amount?: number) =>
    Effect.sync(() => {
      useInventoryStore.getState().removeItem(slotIndex, amount)
    }),

  moveItem: (fromSlot: number, toSlot: number) =>
    Effect.sync(() => {
      useInventoryStore.getState().moveItem(fromSlot, toSlot)
    }),

  // Get current state as Effect
  getCurrentInventory: () =>
    Effect.sync(() => {
      const state = useInventoryStore.getState()
      return Option.fromNullable(state.currentInventory)
    }),

  getCurrentPlayerId: () =>
    Effect.sync(() => {
      const state = useInventoryStore.getState()
      return Option.fromNullable(state.currentPlayerId)
    }),

  // Subscribe to changes
  subscribeToChanges: <T>(selector: (state: InventoryZustandState) => T, callback: (value: T) => void) =>
    Effect.sync(() => {
      return useInventoryStore.subscribe(selector, callback)
    }),
}

// React hooks for type-safe access
export const useCurrentInventory = () => {
  return useInventoryStore((state) => state.currentInventory)
}

export const useCurrentPlayerId = () => {
  return useInventoryStore((state) => state.currentPlayerId)
}

export const useInventorySlot = (slotIndex: number) => {
  return useInventoryStore((state) => state.currentInventory?.slots[slotIndex] ?? null)
}

export const useSelectedItem = () => {
  return useInventoryStore((state) => state.getSelectedItem())
}

export const useInventoryStats = () => {
  return useInventoryStore((state) => ({
    emptySlots: state.getEmptySlotCount(),
    usedSlots: state.getUsedSlotCount(),
    totalSlots: 36,
  }))
}

export const useInventoryOperations = () => {
  return useInventoryStore((state) => ({
    addItem: state.addItem,
    removeItem: state.removeItem,
    moveItem: state.moveItem,
    swapItems: state.swapItems,
    setSelectedSlot: state.setSelectedSlot,
    hasSpaceForItem: state.hasSpaceForItem,
    findItemSlots: state.findItemSlots,
  }))
}

// Performance optimized selectors
export const inventorySelectors = {
  hotbar: (state: InventoryZustandState) =>
    state.currentInventory
      ? state.currentInventory.hotbar.map((slotIndex) => state.currentInventory!.slots[slotIndex])
      : [],

  armor: (state: InventoryZustandState) =>
    state.currentInventory?.armor ?? {
      helmet: null,
      chestplate: null,
      leggings: null,
      boots: null,
    },

  offhand: (state: InventoryZustandState) => state.currentInventory?.offhand ?? null,

  selectedSlot: (state: InventoryZustandState) => state.currentInventory?.selectedSlot ?? 0,

  isLoading: (state: InventoryZustandState) => state.isLoading,

  error: (state: InventoryZustandState) => state.error,
}

// DevTools integration (development only)
if (typeof window !== 'undefined' && process.env['NODE_ENV'] === 'development') {
  ;(window as any).__INVENTORY_STORE__ = useInventoryStore
}
