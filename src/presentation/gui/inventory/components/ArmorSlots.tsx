/**
 * ArmorSlots Component
 *
 * Displays armor equipment slots (helmet, chestplate, leggings, boots)
 * Plus offhand slot with type validation
 */

import type { ItemStack } from '@domain/inventory/InventoryTypes.js'
import { Option } from 'effect'
import { motion } from 'framer-motion'
import React from 'react'
import type { InventoryTheme } from '../types.js'
import { ItemSlot } from './ItemSlot.js'

interface ArmorSlotsProps {
  readonly armor: {
    readonly helmet: ItemStack | null
    readonly chestplate: ItemStack | null
    readonly leggings: ItemStack | null
    readonly boots: ItemStack | null
  }
  readonly offhand: ItemStack | null
  readonly theme: InventoryTheme
  readonly slotSize: number
  readonly onSlotClick: (slotIndex: number, button: 'left' | 'right' | 'middle') => void
}

const ARMOR_SLOT_ICONS = {
  helmet: '🪖',
  chestplate: '👔',
  leggings: '👖',
  boots: '👢',
  offhand: '🛡️',
}

export const ArmorSlots: React.FC<ArmorSlotsProps> = ({ armor, offhand, theme, slotSize, onSlotClick }) => {
  const armorSlots = [
    { type: 'armor-helmet' as const, item: armor.helmet, icon: ARMOR_SLOT_ICONS.helmet, index: 103 },
    { type: 'armor-chestplate' as const, item: armor.chestplate, icon: ARMOR_SLOT_ICONS.chestplate, index: 102 },
    { type: 'armor-leggings' as const, item: armor.leggings, icon: ARMOR_SLOT_ICONS.leggings, index: 101 },
    { type: 'armor-boots' as const, item: armor.boots, icon: ARMOR_SLOT_ICONS.boots, index: 100 },
  ]

  return (
    <motion.div
      className="armor-slots"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      style={{
        position: 'absolute',
        right: '20px',
        top: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {/* Armor Slots */}
      {armorSlots.map((armorSlot) => (
        <div
          key={armorSlot.type}
          style={{
            position: 'relative',
          }}
        >
          {/* Background Icon when empty */}
          {!armorSlot.item && (
            <div
              className="slot-placeholder"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: slotSize * 0.5,
                opacity: 0.2,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {armorSlot.icon}
            </div>
          )}

          <ItemSlot
            slot={{
              index: armorSlot.index,
              section: 'armor',
              type: armorSlot.type,
              position: [0, 0] as any,
              item: Option.fromNullable(armorSlot.item),
              isHighlighted: false,
              isDisabled: false,
              acceptsItem: (item) => {
                // Validate armor type
                const metadata = item.metadata as any
                return metadata?.category === 'armor' && metadata?.armorType === armorSlot.type.replace('armor-', '')
              },
            }}
            size={slotSize}
            theme={theme}
            isDragOver={false}
            onSlotClick={(button) => onSlotClick(armorSlot.index, button)}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onDrop={() => {}}
          />

          {/* Armor Type Label */}
          <div
            className="armor-label"
            style={{
              position: 'absolute',
              right: `${slotSize + 8}px`,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              color: '#888888',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {armorSlot.type.replace('armor-', '')}
          </div>
        </div>
      ))}

      {/* Separator */}
      <div
        style={{
          height: '1px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          margin: '8px 0',
        }}
      />

      {/* Offhand Slot */}
      <div style={{ position: 'relative' }}>
        {/* Background Icon when empty */}
        {!offhand && (
          <div
            className="slot-placeholder"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: slotSize * 0.5,
              opacity: 0.2,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {ARMOR_SLOT_ICONS.offhand}
          </div>
        )}

        <ItemSlot
          slot={{
            index: 40, // Standard offhand slot index
            section: 'offhand',
            type: 'offhand',
            position: [0, 0] as any,
            item: Option.fromNullable(offhand),
            isHighlighted: false,
            isDisabled: false,
            acceptsItem: () => true, // Offhand accepts any item
          }}
          size={slotSize}
          theme={theme}
          isDragOver={false}
          onSlotClick={(button) => onSlotClick(40, button)}
          onDragStart={() => {}}
          onDragEnd={() => {}}
          onDrop={() => {}}
        />

        {/* Offhand Label */}
        <div
          className="offhand-label"
          style={{
            position: 'absolute',
            right: `${slotSize + 8}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: '#888888',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          offhand
        </div>
      </div>
    </motion.div>
  )
}
