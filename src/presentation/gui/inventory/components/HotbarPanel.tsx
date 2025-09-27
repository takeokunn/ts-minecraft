/**
 * HotbarPanel Component
 *
 * Bottom hotbar with quick access slots (1-9)
 * Supports keyboard navigation and selection highlighting
 */

import React from 'react'
import { motion } from 'framer-motion'
import type { InventorySlot, InventoryGUIConfig } from '../types.js'
import { ItemSlot } from './ItemSlot.js'

interface HotbarPanelProps {
  readonly slots: ReadonlyArray<InventorySlot>
  readonly selectedIndex: number
  readonly config: InventoryGUIConfig
  readonly onSlotClick: (slotIndex: number, button: 'left' | 'right' | 'middle') => void
  readonly onHotbarSelect: (index: number) => void
}

export const HotbarPanel: React.FC<HotbarPanelProps> = ({
  slots,
  selectedIndex,
  config,
  onSlotClick,
  onHotbarSelect,
}) => {
  return (
    <motion.div
      className="hotbar-panel"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      style={{
        display: 'flex',
        gap: `${config.slotSpacing}px`,
        padding: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '8px',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        marginTop: '10px',
      }}
    >
      {slots.map((slot, index) => (
        <div
          key={slot.index}
          style={{
            position: 'relative',
          }}
        >
          {/* Slot Number Indicator */}
          <div
            className="hotbar-number"
            style={{
              position: 'absolute',
              top: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '12px',
              fontWeight: 'bold',
              color: index === selectedIndex ? '#ffff00' : '#999999',
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {index + 1}
          </div>

          {/* Selection Highlight Ring */}
          {index === selectedIndex && (
            <motion.div
              className="selection-ring"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                inset: '-4px',
                border: '3px solid #ffff00',
                borderRadius: '6px',
                pointerEvents: 'none',
                boxShadow: '0 0 10px rgba(255, 255, 0, 0.5)',
              }}
            />
          )}

          {/* The actual slot */}
          <ItemSlot
            slot={{
              ...slot,
              isHighlighted: index === selectedIndex,
            }}
            size={config.slotSize}
            theme={config.theme}
            isDragOver={false}
            onSlotClick={(button) => {
              onSlotClick(slot.index, button)
              if (button === 'left') {
                onHotbarSelect(index)
              }
            }}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onDrop={() => {}}
          />
        </div>
      ))}
    </motion.div>
  )
}
