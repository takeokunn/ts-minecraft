/**
 * ItemSlot Component
 *
 * Individual inventory slot with drag & drop support
 * Displays item icon, count, and durability with animations
 */

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Option } from 'effect'
import { motion } from 'framer-motion'
import React, { useCallback, useState } from 'react'
import type { ItemSlotProps, SlotAnimationState } from '../types.js'
import { ItemIcon } from './ItemIcon.js'
import { ItemTooltip } from './ItemTooltip.js'

export const ItemSlot: React.FC<ItemSlotProps & { animation?: SlotAnimationState | undefined }> = ({
  slot,
  size,
  theme,
  isDragOver,
  onSlotClick,
  onDragStart,
  onDragEnd,
  onDrop,
  animation,
}) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<[number, number]>([0, 0])

  // =========================================
  // Drag & Drop Setup
  // =========================================

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: slot.index.toString(),
    disabled: slot.isDisabled || Option.isNone(slot.item),
    data: {
      slotIndex: slot.index,
      item: slot.item,
    },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: slot.index.toString(),
    disabled: slot.isDisabled,
    data: {
      slotIndex: slot.index,
      slotType: slot.type,
    },
  })

  // =========================================
  // Event Handlers
  // =========================================

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      let button: 'left' | 'right' | 'middle' = 'left'
      if (e.button === 1) button = 'middle'
      else if (e.button === 2) button = 'right'

      onSlotClick(button)
    },
    [onSlotClick]
  )

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (Option.isSome(slot.item)) {
        const rect = e.currentTarget.getBoundingClientRect()
        setTooltipPosition([rect.right + 10, rect.top])
        setShowTooltip(true)
      }
    },
    [slot.item]
  )

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onSlotClick('right')
    },
    [onSlotClick]
  )

  // =========================================
  // Compute Styles
  // =========================================

  const slotStyle = {
    width: size,
    height: size,
    backgroundColor: slot.isDisabled
      ? theme.slotDisabled
      : slot.isHighlighted
        ? theme.slotSelected
        : isDragOver || isOver
          ? theme.slotHover
          : theme.slotBackground,
    border: `2px solid ${slot.isHighlighted ? theme.slotSelected : theme.slotBorder}`,
    borderRadius: '4px',
    position: 'relative' as const,
    cursor: slot.isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDragging ? 0.5 : (animation?.opacity ?? 1),
    transform: animation ? `scale(${animation.scale}) rotate(${animation.rotation}deg)` : undefined,
    boxShadow: animation?.glow ? `0 0 ${animation.glow * 20}px rgba(255, 255, 0, ${animation.glow})` : undefined,
    transition: 'all 0.2s ease',
  }

  // =========================================
  // Render
  // =========================================

  return (
    <>
      <motion.div
        ref={(node) => {
          setDragRef(node)
          setDropRef(node)
        }}
        className={`inventory-slot ${slot.section}-slot`}
        style={slotStyle}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: slot.isDisabled ? 1 : 1.05 }}
        whileTap={{ scale: slot.isDisabled ? 1 : 0.95 }}
        {...(animation && animation.shake
          ? {
              animate: {
                x: animation.shake * Math.sin(Date.now() / 100) * 5,
              },
            }
          : {})}
        {...(Option.isSome(slot.item) ? { ...attributes, ...listeners } : {})}
      >
        {/* Item Icon */}
        {Option.isSome(slot.item) && (
          <ItemIcon
            item={slot.item.value}
            size={size - 8}
            showCount={true}
            showDurability={true}
            animate={slot.isHighlighted}
          />
        )}

        {/* Slot Index (for debugging) */}
        {process.env['NODE_ENV'] === 'development' && (
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              fontSize: '8px',
              color: '#888',
              pointerEvents: 'none',
            }}
          >
            {slot.index}
          </div>
        )}

        {/* Highlight Overlay */}
        {slot.isHighlighted && (
          <motion.div
            className="slot-highlight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#ffff00',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Disabled Overlay */}
        {slot.isDisabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
        )}
      </motion.div>

      {/* Tooltip */}
      {showTooltip && Option.isSome(slot.item) && (
        <ItemTooltip item={slot.item.value} position={tooltipPosition} theme={theme} />
      )}
    </>
  )
}
