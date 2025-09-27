/**
 * InventoryGUI Tests
 *
 * Comprehensive tests for inventory GUI components
 * Using vitest and @testing-library/react
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Effect, Option } from 'effect'
import React from 'react'
import { InventoryPanel } from '../components/InventoryPanel.js'
import { ItemSlot } from '../components/ItemSlot.js'
import { ItemIcon } from '../components/ItemIcon.js'
import { ItemTooltip } from '../components/ItemTooltip.js'
import type { Inventory, ItemStack, PlayerId } from '@domain/inventory/InventoryTypes.js'
import type { InventoryGUIEvent } from '../types.js'
import { defaultInventoryGUIConfig } from '../types.js'

// Mock data
const mockPlayerId = 'test-player' as PlayerId

const mockItemStack: ItemStack = {
  itemId: 'diamond' as any,
  count: 32,
  metadata: {
    durability: 0.75,
    enchantments: [{ id: 'sharpness', level: 3 }],
  },
}

const mockInventory: Inventory = {
  playerId: mockPlayerId,
  slots: new Array(36).fill(null),
  selectedSlot: 0,
  hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  armor: {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  },
  offhand: null,
}

describe('InventoryGUI Components', () => {
  describe('InventoryPanel', () => {
    const mockOnEvent = vi.fn(() => Effect.succeed(undefined))

    beforeEach(() => {
      mockOnEvent.mockClear()
    })

    it('should render when open', () => {
      const { container } = render(
        <InventoryPanel
          playerId={mockPlayerId}
          inventory={mockInventory}
          isOpen={true}
          config={defaultInventoryGUIConfig}
          onEvent={mockOnEvent}
        />
      )

      expect(container.querySelector('.inventory-panel')).toBeTruthy()
    })

    it('should not render when closed', () => {
      const { container } = render(
        <InventoryPanel
          playerId={mockPlayerId}
          inventory={mockInventory}
          isOpen={false}
          config={defaultInventoryGUIConfig}
          onEvent={mockOnEvent}
        />
      )

      expect(container.querySelector('.inventory-panel')).toBeFalsy()
    })

    it('should trigger InventoryOpened event when opened', () => {
      render(
        <InventoryPanel
          playerId={mockPlayerId}
          inventory={mockInventory}
          isOpen={true}
          config={defaultInventoryGUIConfig}
          onEvent={mockOnEvent}
        />
      )

      expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({ _tag: 'InventoryOpened' }))
    })

    it('should render correct number of slots', () => {
      const { container } = render(
        <InventoryPanel
          playerId={mockPlayerId}
          inventory={mockInventory}
          isOpen={true}
          config={defaultInventoryGUIConfig}
          onEvent={mockOnEvent}
        />
      )

      const slots = container.querySelectorAll('.inventory-slot')
      expect(slots.length).toBe(36) // 27 main + 9 hotbar
    })

    it('should handle close button click', () => {
      const { container } = render(
        <InventoryPanel
          playerId={mockPlayerId}
          inventory={mockInventory}
          isOpen={true}
          config={defaultInventoryGUIConfig}
          onEvent={mockOnEvent}
        />
      )

      const closeButton = container.querySelector('.inventory-close-button')
      expect(closeButton).toBeTruthy()

      fireEvent.click(closeButton!)

      expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({ _tag: 'InventoryClosed' }))
    })
  })

  describe('ItemSlot', () => {
    const mockOnSlotClick = vi.fn()
    const mockOnDragStart = vi.fn()
    const mockOnDragEnd = vi.fn()
    const mockOnDrop = vi.fn()

    beforeEach(() => {
      mockOnSlotClick.mockClear()
      mockOnDragStart.mockClear()
      mockOnDragEnd.mockClear()
      mockOnDrop.mockClear()
    })

    it('should render empty slot', () => {
      const { container } = render(
        <ItemSlot
          slot={{
            index: 0,
            section: 'main',
            type: 'normal',
            position: [0, 0] as any,
            item: Option.none(),
            isHighlighted: false,
            isDisabled: false,
            acceptsItem: () => true,
          }}
          size={48}
          theme={defaultInventoryGUIConfig.theme}
          isDragOver={false}
          onSlotClick={mockOnSlotClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          onDrop={mockOnDrop}
        />
      )

      const slot = container.querySelector('.inventory-slot')
      expect(slot).toBeTruthy()
      expect(container.querySelector('.item-icon')).toBeFalsy()
    })

    it('should render slot with item', () => {
      const { container } = render(
        <ItemSlot
          slot={{
            index: 0,
            section: 'main',
            type: 'normal',
            position: [0, 0] as any,
            item: Option.some(mockItemStack),
            isHighlighted: false,
            isDisabled: false,
            acceptsItem: () => true,
          }}
          size={48}
          theme={defaultInventoryGUIConfig.theme}
          isDragOver={false}
          onSlotClick={mockOnSlotClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          onDrop={mockOnDrop}
        />
      )

      expect(container.querySelector('.item-icon')).toBeTruthy()
    })

    it('should handle click events', () => {
      const { container } = render(
        <ItemSlot
          slot={{
            index: 5,
            section: 'main',
            type: 'normal',
            position: [0, 0] as any,
            item: Option.some(mockItemStack),
            isHighlighted: false,
            isDisabled: false,
            acceptsItem: () => true,
          }}
          size={48}
          theme={defaultInventoryGUIConfig.theme}
          isDragOver={false}
          onSlotClick={mockOnSlotClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          onDrop={mockOnDrop}
        />
      )

      const slot = container.querySelector('.inventory-slot')
      fireEvent.click(slot!)

      expect(mockOnSlotClick).toHaveBeenCalledWith('left')
    })

    it('should handle right click', () => {
      const { container } = render(
        <ItemSlot
          slot={{
            index: 5,
            section: 'main',
            type: 'normal',
            position: [0, 0] as any,
            item: Option.some(mockItemStack),
            isHighlighted: false,
            isDisabled: false,
            acceptsItem: () => true,
          }}
          size={48}
          theme={defaultInventoryGUIConfig.theme}
          isDragOver={false}
          onSlotClick={mockOnSlotClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          onDrop={mockOnDrop}
        />
      )

      const slot = container.querySelector('.inventory-slot')
      fireEvent.contextMenu(slot!)

      expect(mockOnSlotClick).toHaveBeenCalledWith('right')
    })

    it('should show highlighted state', () => {
      const { container } = render(
        <ItemSlot
          slot={{
            index: 0,
            section: 'hotbar',
            type: 'normal',
            position: [0, 0] as any,
            item: Option.some(mockItemStack),
            isHighlighted: true,
            isDisabled: false,
            acceptsItem: () => true,
          }}
          size={48}
          theme={defaultInventoryGUIConfig.theme}
          isDragOver={false}
          onSlotClick={mockOnSlotClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          onDrop={mockOnDrop}
        />
      )

      expect(container.querySelector('.slot-highlight')).toBeTruthy()
    })

    it('should show disabled state', () => {
      const { container, getByRole } = render(
        <ItemSlot
          slot={{
            index: 0,
            section: 'main',
            type: 'normal',
            position: [0, 0] as any,
            item: Option.none(),
            isHighlighted: false,
            isDisabled: true,
            acceptsItem: () => false,
          }}
          size={48}
          theme={defaultInventoryGUIConfig.theme}
          isDragOver={false}
          onSlotClick={mockOnSlotClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          onDrop={mockOnDrop}
        />
      )

      const slot = container.querySelector('.inventory-slot') as HTMLElement
      expect(slot.style.cursor).toBe('not-allowed')
    })
  })

  describe('ItemIcon', () => {
    it('should render item icon', () => {
      const { container } = render(
        <ItemIcon item={mockItemStack} size={40} showCount={true} showDurability={true} animate={false} />
      )

      expect(container.querySelector('.item-icon')).toBeTruthy()
      expect(container.querySelector('.item-texture')).toBeTruthy()
    })

    it('should show item count for stacks', () => {
      const { container } = render(
        <ItemIcon item={mockItemStack} size={40} showCount={true} showDurability={false} animate={false} />
      )

      const countElement = container.querySelector('.item-count')
      expect(countElement).toBeTruthy()
      expect(countElement?.textContent).toBe('32')
    })

    it('should show durability bar', () => {
      const { container } = render(
        <ItemIcon item={mockItemStack} size={40} showCount={false} showDurability={true} animate={false} />
      )

      expect(container.querySelector('.item-durability')).toBeTruthy()
      expect(container.querySelector('.durability-fill')).toBeTruthy()
    })

    it('should show enchantment glow', () => {
      const { container } = render(
        <ItemIcon item={mockItemStack} size={40} showCount={false} showDurability={false} animate={false} />
      )

      expect(container.querySelector('.enchantment-glow')).toBeTruthy()
    })

    it('should not show count for single items', () => {
      const singleItem: ItemStack = {
        ...mockItemStack,
        count: 1,
      }

      const { container } = render(
        <ItemIcon item={singleItem} size={40} showCount={true} showDurability={false} animate={false} />
      )

      expect(container.querySelector('.item-count')).toBeFalsy()
    })
  })

  describe('ItemTooltip', () => {
    it('should render tooltip with item name', () => {
      const { container } = render(
        <ItemTooltip item={mockItemStack} position={[100, 100]} theme={defaultInventoryGUIConfig.theme} />
      )

      const tooltip = container.querySelector('.item-tooltip')
      expect(tooltip).toBeTruthy()
      expect(container.querySelector('.tooltip-title')).toBeTruthy()
    })

    it('should show enchantments', () => {
      const { container } = render(
        <ItemTooltip item={mockItemStack} position={[100, 100]} theme={defaultInventoryGUIConfig.theme} />
      )

      expect(container.querySelector('.tooltip-enchantments')).toBeTruthy()
    })

    it('should show durability', () => {
      const { container } = render(
        <ItemTooltip item={mockItemStack} position={[100, 100]} theme={defaultInventoryGUIConfig.theme} />
      )

      expect(container.querySelector('.tooltip-durability')).toBeTruthy()
    })

    it('should show stack size for multiple items', () => {
      const { container } = render(
        <ItemTooltip item={mockItemStack} position={[100, 100]} theme={defaultInventoryGUIConfig.theme} />
      )

      const countElement = container.querySelector('.tooltip-count')
      expect(countElement).toBeTruthy()
      expect(countElement?.textContent).toContain('32/64')
    })
  })
})
