/**
 * Inventory GUI Type Definitions
 *
 * Effect-TS based type system for inventory GUI components
 * Follows strict functional programming patterns with branded types
 */

import { Schema, Brand, Option, Either, Effect } from 'effect'
import type { ItemStack, PlayerId, Inventory } from '../../../domain/inventory/InventoryTypes.js'

// =========================================
// Branded Types for GUI
// =========================================

export type SlotPosition = readonly [x: number, y: number] & Brand.Brand<'SlotPosition'>
export const SlotPosition = Brand.nominal<SlotPosition>()

export type DragItemId = string & Brand.Brand<'DragItemId'>
export const DragItemId = Brand.nominal<DragItemId>()

// =========================================
// GUI State Types
// =========================================

export const InventorySection = Schema.Literal('hotbar', 'main', 'armor', 'offhand', 'crafting', 'craftingResult').pipe(
  Schema.annotations({
    identifier: 'InventorySection',
    description: 'Different sections of the inventory GUI',
  })
)
export type InventorySection = Schema.Schema.Type<typeof InventorySection>

export const SlotType = Schema.Literal(
  'normal',
  'armor-helmet',
  'armor-chestplate',
  'armor-leggings',
  'armor-boots',
  'offhand',
  'crafting-input',
  'crafting-output',
  'fuel',
  'result'
).pipe(
  Schema.annotations({
    identifier: 'SlotType',
    description: 'Type of inventory slot with specific restrictions',
  })
)
export type SlotType = Schema.Schema.Type<typeof SlotType>

// =========================================
// Slot Definition
// =========================================

export interface InventorySlot {
  readonly index: number
  readonly section: InventorySection
  readonly type: SlotType
  readonly position: SlotPosition
  readonly item: Option.Option<ItemStack>
  readonly isHighlighted: boolean
  readonly isDisabled: boolean
  readonly acceptsItem: (item: ItemStack) => boolean
}

// =========================================
// Drag & Drop Types
// =========================================

export interface DragState {
  readonly isDragging: boolean
  readonly draggedItem: Option.Option<ItemStack>
  readonly sourceSlot: Option.Option<number>
  readonly hoveredSlot: Option.Option<number>
  readonly dragMode: 'move' | 'split' | 'clone'
}

export interface DropResult {
  readonly accepted: boolean
  readonly action: 'move' | 'swap' | 'merge' | 'split' | 'rejected'
  readonly sourceSlot: number
  readonly targetSlot: number
  readonly amount: number
}

// =========================================
// GUI Events
// =========================================

export type InventoryGUIEvent =
  | { readonly _tag: 'SlotClicked'; readonly slot: number; readonly button: 'left' | 'right' | 'middle' }
  | { readonly _tag: 'SlotHovered'; readonly slot: number }
  | { readonly _tag: 'SlotUnhovered'; readonly slot: number }
  | { readonly _tag: 'ItemDragStart'; readonly slot: number; readonly item: ItemStack }
  | { readonly _tag: 'ItemDragEnd'; readonly result: Option.Option<DropResult> }
  | { readonly _tag: 'ItemDropped'; readonly sourceSlot: number; readonly targetSlot: number }
  | { readonly _tag: 'HotbarSelected'; readonly index: number }
  | { readonly _tag: 'InventoryOpened' }
  | { readonly _tag: 'InventoryClosed' }
  | { readonly _tag: 'QuickMove'; readonly slot: number }
  | { readonly _tag: 'QuickDrop'; readonly slot: number; readonly all: boolean }

// =========================================
// GUI Configuration
// =========================================

export interface InventoryGUIConfig {
  readonly slotSize: number
  readonly slotSpacing: number
  readonly hotbarSlots: number
  readonly mainSlots: number
  readonly columns: number
  readonly animationDuration: number
  readonly enableDragAndDrop: boolean
  readonly enableKeyboardShortcuts: boolean
  readonly enableTooltips: boolean
  readonly theme: InventoryTheme
}

export interface InventoryTheme {
  readonly slotBackground: string
  readonly slotBorder: string
  readonly slotHover: string
  readonly slotSelected: string
  readonly slotDisabled: string
  readonly itemCountColor: string
  readonly itemDurabilityColor: string
  readonly tooltipBackground: string
  readonly tooltipText: string
}

// =========================================
// Component Props
// =========================================

export interface InventoryPanelProps {
  readonly playerId: PlayerId
  readonly inventory: Inventory
  readonly isOpen: boolean
  readonly config: InventoryGUIConfig
  readonly onEvent: (event: InventoryGUIEvent) => Effect.Effect<void, never>
}

export interface ItemSlotProps {
  readonly slot: InventorySlot
  readonly size: number
  readonly theme: InventoryTheme
  readonly isDragOver: boolean
  readonly onSlotClick: (button: 'left' | 'right' | 'middle') => void
  readonly onDragStart: () => void
  readonly onDragEnd: (result: Option.Option<DropResult>) => void
  readonly onDrop: (sourceSlot: number) => void
}

export interface ItemIconProps {
  readonly item: ItemStack
  readonly size: number
  readonly showCount: boolean
  readonly showDurability: boolean
  readonly animate: boolean
}

export interface ItemTooltipProps {
  readonly item: ItemStack
  readonly position: readonly [x: number, y: number]
  readonly theme: InventoryTheme
}

// =========================================
// Animation States
// =========================================

export interface SlotAnimationState {
  readonly scale: number
  readonly rotation: number
  readonly opacity: number
  readonly glow: number
  readonly shake: number
}

export interface ItemTransferAnimation {
  readonly from: SlotPosition
  readonly to: SlotPosition
  readonly item: ItemStack
  readonly duration: number
  readonly easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

// =========================================
// Hotbar State
// =========================================

export interface HotbarState {
  readonly selectedIndex: number
  readonly slots: ReadonlyArray<Option.Option<ItemStack>>
  readonly isLocked: boolean
}

// =========================================
// Error Types
// =========================================

export class InventoryGUIError {
  readonly _tag = 'InventoryGUIError'
  constructor(
    readonly reason: 'SlotNotFound' | 'InvalidDrop' | 'AnimationFailed' | 'RenderError',
    readonly details?: unknown
  ) {}
}

// =========================================
// Helper Functions (Pure)
// =========================================

export const createSlotPosition = (x: number, y: number): SlotPosition => SlotPosition([x, y] as const)

export const getSlotGridPosition = (
  index: number,
  columns: number,
  spacing: number,
  slotSize: number
): SlotPosition => {
  const row = Math.floor(index / columns)
  const col = index % columns
  const x = col * (slotSize + spacing)
  const y = row * (slotSize + spacing)
  return createSlotPosition(x, y)
}

export const isValidSlotTransfer = (sourceType: SlotType, targetType: SlotType, item: ItemStack): boolean => {
  // Armor slots validation
  if (targetType.startsWith('armor-')) {
    // Check if item has armor metadata
    const metadata = item.metadata as any
    return metadata?.category === 'armor' && metadata?.armorType === targetType.replace('armor-', '')
  }

  // Crafting output is read-only
  if (targetType === 'crafting-output' || targetType === 'result') {
    return false
  }

  // Fuel slot validation
  if (targetType === 'fuel') {
    const metadata = item.metadata as any
    return metadata?.isFuel === true
  }

  return targetType === 'normal' || targetType === 'crafting-input'
}

// =========================================
// Default Configuration
// =========================================

export const defaultInventoryGUIConfig: InventoryGUIConfig = {
  slotSize: 48,
  slotSpacing: 4,
  hotbarSlots: 9,
  mainSlots: 27,
  columns: 9,
  animationDuration: 200,
  enableDragAndDrop: true,
  enableKeyboardShortcuts: true,
  enableTooltips: true,
  theme: {
    slotBackground: '#2a2a2a',
    slotBorder: '#4a4a4a',
    slotHover: '#3a3a3a',
    slotSelected: '#5a5a5a',
    slotDisabled: '#1a1a1a',
    itemCountColor: '#ffffff',
    itemDurabilityColor: '#00ff00',
    tooltipBackground: 'rgba(0, 0, 0, 0.9)',
    tooltipText: '#ffffff',
  },
}
