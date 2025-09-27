/**
 * InventoryPanel Component
 *
 * Main inventory GUI panel with Effect-TS integration
 * Implements responsive grid layout with drag & drop support
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, type DragEndEvent, type DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { Effect, Option, pipe, Match } from 'effect'
import type { InventoryPanelProps, InventorySlot, DragState, DropResult, InventoryGUIEvent } from '../types.js'
import { ItemSlot } from './ItemSlot.js'
import { HotbarPanel } from './HotbarPanel.js'
import { ArmorSlots } from './ArmorSlots.js'
import { createSlotPosition, getSlotGridPosition, isValidSlotTransfer } from '../types.js'
import { useInventoryKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { useInventoryAnimations } from '../hooks/useAnimations.js'

/**
 * Main inventory panel component
 */
export const InventoryPanel: React.FC<InventoryPanelProps> = ({ playerId, inventory, isOpen, config, onEvent }) => {
  // =========================================
  // State Management
  // =========================================

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItem: Option.none(),
    sourceSlot: Option.none(),
    hoveredSlot: Option.none(),
    dragMode: 'move',
  })

  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState(0)
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<Option.Option<number>>(Option.none())

  // =========================================
  // Drag & Drop Setup
  // =========================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // =========================================
  // Slot Creation
  // =========================================

  const slots = useMemo(() => {
    const allSlots: InventorySlot[] = []

    // Main inventory slots (27 slots, 3 rows of 9)
    for (let i = 0; i < config.mainSlots; i++) {
      const position = getSlotGridPosition(i, config.columns, config.slotSpacing, config.slotSize)
      allSlots.push({
        index: i + 9, // Offset by hotbar slots
        section: 'main',
        type: 'normal',
        position,
        item: Option.fromNullable(inventory.slots[i + 9]),
        isHighlighted: false,
        isDisabled: false,
        acceptsItem: () => true,
      })
    }

    // Hotbar slots (9 slots)
    for (let i = 0; i < config.hotbarSlots; i++) {
      const position = getSlotGridPosition(i, config.columns, config.slotSpacing, config.slotSize)
      allSlots.push({
        index: i,
        section: 'hotbar',
        type: 'normal',
        position: createSlotPosition(position[0], position[1] + (config.slotSize + config.slotSpacing) * 4),
        item: Option.fromNullable(inventory.slots[i]),
        isHighlighted: i === selectedHotbarIndex,
        isDisabled: false,
        acceptsItem: () => true,
      })
    }

    return allSlots
  }, [inventory, config, selectedHotbarIndex])

  // =========================================
  // Event Handlers
  // =========================================

  const handleSlotClick = useCallback(
    (slotIndex: number, button: 'left' | 'right' | 'middle') => {
      const event: InventoryGUIEvent = {
        _tag: 'SlotClicked',
        slot: slotIndex,
        button,
      }

      Effect.runSync(onEvent(event))
    },
    [onEvent]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const slotIndex = Number(event.active.id)
      const slot = slots.find((s) => s.index === slotIndex)

      if (slot && Option.isSome(slot.item)) {
        setDragState({
          isDragging: true,
          draggedItem: slot.item,
          sourceSlot: Option.some(slotIndex),
          hoveredSlot: Option.none(),
          dragMode:
            event.activatorEvent &&
            'shiftKey' in event.activatorEvent &&
            (event.activatorEvent as KeyboardEvent).shiftKey
              ? 'split'
              : 'move',
        })

        const dragEvent: InventoryGUIEvent = {
          _tag: 'ItemDragStart',
          slot: slotIndex,
          item: slot.item.value,
        }

        Effect.runSync(onEvent(dragEvent))
      }
    },
    [slots, onEvent]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!dragState.isDragging || Option.isNone(dragState.sourceSlot)) {
        return
      }

      const sourceSlotIndex = dragState.sourceSlot.value
      const targetSlotIndex = event.over ? Number(event.over.id) : null

      let dropResult: Option.Option<DropResult> = Option.none()

      if (targetSlotIndex !== null && targetSlotIndex !== sourceSlotIndex) {
        const sourceSlot = slots.find((s) => s.index === sourceSlotIndex)
        const targetSlot = slots.find((s) => s.index === targetSlotIndex)

        if (sourceSlot && targetSlot && Option.isSome(dragState.draggedItem)) {
          const canTransfer = isValidSlotTransfer(sourceSlot.type, targetSlot.type, dragState.draggedItem.value)

          if (canTransfer) {
            const action = Option.isSome(targetSlot.item) ? 'swap' : 'move'

            dropResult = Option.some({
              accepted: true,
              action,
              sourceSlot: sourceSlotIndex,
              targetSlot: targetSlotIndex,
              amount:
                dragState.dragMode === 'split'
                  ? Math.ceil(dragState.draggedItem.value.count / 2)
                  : dragState.draggedItem.value.count,
            })

            const dropEvent: InventoryGUIEvent = {
              _tag: 'ItemDropped',
              sourceSlot: sourceSlotIndex,
              targetSlot: targetSlotIndex,
            }

            Effect.runSync(onEvent(dropEvent))
          }
        }
      }

      const dragEndEvent: InventoryGUIEvent = {
        _tag: 'ItemDragEnd',
        result: dropResult,
      }

      Effect.runSync(onEvent(dragEndEvent))

      setDragState({
        isDragging: false,
        draggedItem: Option.none(),
        sourceSlot: Option.none(),
        hoveredSlot: Option.none(),
        dragMode: 'move',
      })
    },
    [dragState, slots, onEvent]
  )

  // =========================================
  // Keyboard Shortcuts
  // =========================================

  useInventoryKeyboardShortcuts({
    enabled: config.enableKeyboardShortcuts && isOpen,
    onHotbarSelect: (index) => {
      setSelectedHotbarIndex(index)
      const event: InventoryGUIEvent = {
        _tag: 'HotbarSelected',
        index,
      }
      Effect.runSync(onEvent(event))
    },
    onQuickMove: (slotIndex) => {
      const event: InventoryGUIEvent = {
        _tag: 'QuickMove',
        slot: slotIndex,
      }
      Effect.runSync(onEvent(event))
    },
    onQuickDrop: (slotIndex, all) => {
      const event: InventoryGUIEvent = {
        _tag: 'QuickDrop',
        slot: slotIndex,
        all,
      }
      Effect.runSync(onEvent(event))
    },
    onClose: () => {
      const event: InventoryGUIEvent = {
        _tag: 'InventoryClosed',
      }
      Effect.runSync(onEvent(event))
    },
  })

  // =========================================
  // Animations
  // =========================================

  const { slotAnimations, itemTransfers } = useInventoryAnimations({
    slots,
    dragState,
    hoveredSlotIndex,
    animationDuration: config.animationDuration,
  })

  // =========================================
  // Lifecycle
  // =========================================

  useEffect(() => {
    if (isOpen) {
      const event: InventoryGUIEvent = { _tag: 'InventoryOpened' }
      Effect.runSync(onEvent(event))
    }
  }, [isOpen, onEvent])

  // =========================================
  // Render
  // =========================================

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="inventory-panel"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: config.animationDuration / 1000 }}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 1000,
        }}
      >
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Player Model Preview (optional) */}
          <div
            className="inventory-player-preview"
            style={{
              position: 'absolute',
              left: '20px',
              top: '20px',
              width: '100px',
              height: '200px',
            }}
          >
            {/* Player 3D model would go here */}
          </div>

          {/* Armor Slots */}
          <ArmorSlots
            armor={inventory.armor}
            offhand={inventory.offhand}
            theme={config.theme}
            slotSize={config.slotSize}
            onSlotClick={handleSlotClick}
          />

          {/* Main Inventory Grid */}
          <div
            className="inventory-main-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${config.columns}, ${config.slotSize}px)`,
              gap: `${config.slotSpacing}px`,
              marginBottom: '20px',
            }}
          >
            {slots
              .filter((slot) => slot.section === 'main')
              .map((slot) => (
                <ItemSlot
                  key={slot.index}
                  slot={slot}
                  size={config.slotSize}
                  theme={config.theme}
                  isDragOver={pipe(
                    hoveredSlotIndex,
                    Option.map((i) => i === slot.index),
                    Option.getOrElse(() => false)
                  )}
                  onSlotClick={(button) => handleSlotClick(slot.index, button)}
                  onDragStart={() => {}}
                  onDragEnd={() => {}}
                  onDrop={() => {}}
                  animation={slotAnimations[slot.index] || undefined}
                />
              ))}
          </div>

          {/* Hotbar */}
          <HotbarPanel
            slots={slots.filter((slot) => slot.section === 'hotbar')}
            selectedIndex={selectedHotbarIndex}
            config={config}
            onSlotClick={handleSlotClick}
            onHotbarSelect={(index) => {
              setSelectedHotbarIndex(index)
              const event: InventoryGUIEvent = {
                _tag: 'HotbarSelected',
                index,
              }
              Effect.runSync(onEvent(event))
            }}
          />
        </DndContext>

        {/* Close Button */}
        <motion.button
          className="inventory-close-button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            const event: InventoryGUIEvent = { _tag: 'InventoryClosed' }
            Effect.runSync(onEvent(event))
          }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            color: '#ffffff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          ×
        </motion.button>
      </motion.div>
    </AnimatePresence>
  )
}
