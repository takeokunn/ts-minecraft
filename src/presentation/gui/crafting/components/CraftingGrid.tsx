import React, { useCallback, useState, useRef, useEffect } from 'react'
import { Effect, pipe, Option } from 'effect'
import type { CraftingItemStack, CraftingGrid as CraftingGridType } from '../../../../domain/crafting/RecipeTypes'
import type { CraftingSlotState, CraftingGUIEvent } from '../CraftingGUITypes'
import { Brand } from 'effect'

interface CraftingGridProps {
  grid: CraftingGridType
  onSlotClick?: (event: CraftingGUIEvent) => void
  onItemDrop?: (event: CraftingGUIEvent) => void
  onItemDragStart?: (event: CraftingGUIEvent) => void
  onItemDragEnd?: (event: CraftingGUIEvent) => void
  isReadOnly?: boolean
  showTooltips?: boolean
  highlightPattern?: boolean[][]
  className?: string
}

interface SlotProps {
  item?: CraftingItemStack
  index: number
  position: { x: number; y: number }
  isHighlighted?: boolean
  isReadOnly?: boolean
  onSlotClick?: (event: CraftingGUIEvent) => void
  onDragStart?: (event: CraftingGUIEvent) => void
  onDragEnd?: (event: CraftingGUIEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (event: CraftingGUIEvent) => void
}

const CraftingSlot: React.FC<SlotProps> = ({
  item,
  index,
  position,
  isHighlighted = false,
  isReadOnly = false,
  onSlotClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const slotRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isReadOnly || !onSlotClick) return

      const button = e.button === 0 ? 'left' : 'right'
      const event: CraftingGUIEvent = {
        _tag: 'SlotClicked',
        slotIndex: index,
        position,
        button: button as 'left' | 'right',
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
      }
      onSlotClick(event)
    },
    [index, position, isReadOnly, onSlotClick]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (isReadOnly || !item || !onDragStart) return

      setIsDragging(true)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({
          slotIndex: index,
          item,
        })
      )

      const event: CraftingGUIEvent = {
        _tag: 'ItemDragStart',
        slotIndex: index,
        item,
      }
      onDragStart(event)
    },
    [index, item, isReadOnly, onDragStart]
  )

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      setIsDragging(false)
      if (!onDragEnd) return

      const event: CraftingGUIEvent = {
        _tag: 'ItemDragEnd',
        targetSlotIndex: null,
      }
      onDragEnd(event)
    },
    [onDragEnd]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (isReadOnly) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (onDragOver) onDragOver(e)
    },
    [isReadOnly, onDragOver]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (isReadOnly || !onDrop) return

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'))
        const event: CraftingGUIEvent = {
          _tag: 'ItemDrop',
          sourceSlot: data.slotIndex,
          targetSlot: index,
          item: data.item,
        }
        onDrop(event)
      } catch (error) {
        console.error('Failed to parse drag data:', error)
      }
    },
    [index, isReadOnly, onDrop]
  )

  return (
    <div
      ref={slotRef}
      className={`
        crafting-slot
        ${isHovered ? 'hovered' : ''}
        ${isDragging ? 'dragging' : ''}
        ${isHighlighted ? 'highlighted' : ''}
        ${item ? 'has-item' : 'empty'}
        ${isReadOnly ? 'readonly' : ''}
      `}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        handleClick(e as any)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      draggable={!isReadOnly && !!item}
      data-slot-index={index}
      data-position={`${position.x},${position.y}`}
    >
      {item && (
        <div className="slot-content">
          <div className="item-icon" data-item-id={item.itemId}>
            {/* Item icon would be rendered here */}
            <span className="item-placeholder">{item.itemId.split(':').pop()?.charAt(0).toUpperCase()}</span>
          </div>
          {item.count > 1 && <span className="item-count">{item.count}</span>}
        </div>
      )}
    </div>
  )
}

export const CraftingGrid: React.FC<CraftingGridProps> = ({
  grid,
  highlightPattern,
  onSlotClick,
  onItemDragStart,
  onItemDragEnd,
  onItemDrop,
  isReadOnly = false,
}) => {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // slotIndexはCraftingSlotコンポーネントから取得される
    const slotIndex = parseInt((e.target as HTMLElement).getAttribute('data-slot-index') || '-1', 10)
    if (slotIndex >= 0) {
      setDragOverSlot(slotIndex)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // グリッド外に出た場合のみリセット
    const rect = e.currentTarget.getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverSlot(null)
    }
  }

  return (
    <div
      className="crafting-grid"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
        gridTemplateRows: `repeat(${grid.height}, 1fr)`,
        gap: '4px',
        padding: '8px',
        background: 'rgba(139, 69, 19, 0.8)',
        borderRadius: '4px',
        border: '2px solid #4a2511',
      }}
    >
      {grid.slots.map((row, y) =>
        row.map((item, x) => {
          const index = y * grid.width + x
          const isHighlighted = highlightPattern?.[y]?.[x] || false
          const isDragTarget = dragOverSlot === index

          const slotProps: SlotProps = {
            index,
            position: { x, y },
            isHighlighted: isHighlighted || isDragTarget,
            isReadOnly,
            ...(item && { item }),
            ...(onSlotClick && { onSlotClick }),
            ...(onItemDragStart && { onDragStart: onItemDragStart }),
            ...(onItemDragEnd && { onDragEnd: onItemDragEnd }),
            ...(handleDragOver && { onDragOver: handleDragOver }),
            ...(onItemDrop && { onDrop: onItemDrop }),
          }

          return <CraftingSlot key={`slot-${x}-${y}`} {...slotProps} />
        })
      )}
    </div>
  )
}

// Styles for the crafting grid
const styles = `
.crafting-slot {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #6b4423 0%, #4a2f1a 100%);
  border: 2px solid #3d2515;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  user-select: none;
}

.crafting-slot.empty {
  background: linear-gradient(135deg, #524135 0%, #3d3229 100%);
}

.crafting-slot.hovered {
  border-color: #ffeb3b;
  box-shadow: 0 0 8px rgba(255, 235, 59, 0.5);
  transform: scale(1.05);
}

.crafting-slot.dragging {
  opacity: 0.5;
}

.crafting-slot.highlighted {
  background: linear-gradient(135deg, #7d5a3a 0%, #5a3f2a 100%);
  border-color: #ffc107;
}

.crafting-slot.readonly {
  cursor: default;
  opacity: 0.7;
}

.slot-content {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  image-rendering: pixelated;
  font-size: 20px;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
}

.item-placeholder {
  background: linear-gradient(135deg, #8b7355 0%, #6b5a45 100%);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.item-count {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: bold;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
  min-width: 16px;
  text-align: center;
}

@keyframes craftingPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.crafting-slot.crafting-animation {
  animation: craftingPulse 0.5s ease-in-out;
}
`

// Export styles as a component for injection
export const CraftingGridStyles = () => <style dangerouslySetInnerHTML={{ __html: styles }} />
