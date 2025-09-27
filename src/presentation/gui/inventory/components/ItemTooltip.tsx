/**
 * ItemTooltip Component
 *
 * Displays detailed item information on hover
 * Shows name, description, enchantments, and metadata
 */

import { motion } from 'framer-motion'
import React from 'react'
import type { ItemTooltipProps } from '../types.js'

// Item name mapping (would normally come from localization)
const ITEM_NAMES: Record<string, string> = {
  stone: 'Stone',
  dirt: 'Dirt',
  grass_block: 'Grass Block',
  wood: 'Wood',
  diamond: 'Diamond',
  iron_ingot: 'Iron Ingot',
  gold_ingot: 'Gold Ingot',
  coal: 'Coal',
  apple: 'Apple',
  bread: 'Bread',
  sword_iron: 'Iron Sword',
  sword_diamond: 'Diamond Sword',
  pickaxe_iron: 'Iron Pickaxe',
  pickaxe_diamond: 'Diamond Pickaxe',
  axe_iron: 'Iron Axe',
  shovel_iron: 'Iron Shovel',
  helmet_iron: 'Iron Helmet',
  chestplate_iron: 'Iron Chestplate',
  leggings_iron: 'Iron Leggings',
  boots_iron: 'Iron Boots',
  torch: 'Torch',
  crafting_table: 'Crafting Table',
  furnace: 'Furnace',
  chest: 'Chest',
  default: 'Unknown Item',
}

// Enchantment descriptions
const ENCHANTMENT_NAMES: Record<string, string> = {
  sharpness: 'Sharpness',
  efficiency: 'Efficiency',
  unbreaking: 'Unbreaking',
  fortune: 'Fortune',
  protection: 'Protection',
  fire_protection: 'Fire Protection',
  blast_protection: 'Blast Protection',
  projectile_protection: 'Projectile Protection',
  respiration: 'Respiration',
  aqua_affinity: 'Aqua Affinity',
  thorns: 'Thorns',
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, position, theme }) => {
  const itemName = item.metadata?.customName || ITEM_NAMES[item.itemId] || ITEM_NAMES['default']

  const hasEnchantments = item.metadata?.enchantments && item.metadata.enchantments.length > 0

  const hasDurability = item.metadata?.durability !== undefined && item.metadata.durability < 1

  return (
    <motion.div
      className="item-tooltip"
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        left: position[0],
        top: position[1],
        backgroundColor: theme.tooltipBackground,
        color: theme.tooltipText,
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        fontSize: '14px',
        fontFamily: 'monospace',
        whiteSpace: 'nowrap',
        zIndex: 10000,
        pointerEvents: 'none',
        maxWidth: '300px',
      }}
    >
      {/* Item Name */}
      <div
        className="tooltip-title"
        style={{
          fontWeight: 'bold',
          fontSize: '16px',
          marginBottom: '4px',
          color: hasEnchantments
            ? '#b300ff'
            : (item.metadata as any)?.rarity === 'legendary'
              ? '#ff8800'
              : (item.metadata as any)?.rarity === 'epic'
                ? '#b300ff'
                : (item.metadata as any)?.rarity === 'rare'
                  ? '#0099ff'
                  : (item.metadata as any)?.rarity === 'uncommon'
                    ? '#00ff00'
                    : '#ffffff',
        }}
      >
        {itemName}
      </div>

      {/* Item Type/Category */}
      {(item.metadata as any)?.category && (
        <div
          className="tooltip-category"
          style={{
            fontSize: '12px',
            color: '#999999',
            marginBottom: '4px',
          }}
        >
          {(item.metadata as any).category.charAt(0).toUpperCase() + (item.metadata as any).category.slice(1)}
        </div>
      )}

      {/* Stack Size */}
      {item.count > 1 && (
        <div
          className="tooltip-count"
          style={{
            fontSize: '12px',
            color: '#cccccc',
            marginBottom: '4px',
          }}
        >
          Stack Size: {item.count}/64
        </div>
      )}

      {/* Durability */}
      {hasDurability && (
        <div
          className="tooltip-durability"
          style={{
            fontSize: '12px',
            marginBottom: '4px',
            color:
              item.metadata!.durability! > 0.3 ? '#00ff00' : item.metadata!.durability! > 0.1 ? '#ffff00' : '#ff0000',
          }}
        >
          Durability: {Math.round(item.metadata!.durability! * 100)}%
        </div>
      )}

      {/* Enchantments */}
      {hasEnchantments && (
        <div
          className="tooltip-enchantments"
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {item.metadata!.enchantments!.map((enchant, i) => {
            const name = enchant.id
            const level = enchant.level
            return (
              <div
                key={i}
                style={{
                  fontSize: '12px',
                  color: '#b300ff',
                  marginBottom: '2px',
                }}
              >
                {ENCHANTMENT_NAMES[name] || name} {level && `${level}`}
              </div>
            )
          })}
        </div>
      )}

      {/* Lore/Description */}
      {item.metadata?.lore && item.metadata.lore.length > 0 && (
        <div
          className="tooltip-lore"
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            fontSize: '12px',
            fontStyle: 'italic',
            color: '#aaaaaa',
            whiteSpace: 'pre-wrap',
          }}
        >
          {item.metadata.lore.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Additional Metadata */}
      {(item.metadata as any)?.damage && (
        <div
          className="tooltip-damage"
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: '#ff9999',
          }}
        >
          Attack Damage: +{(item.metadata as any).damage}
        </div>
      )}

      {(item.metadata as any)?.armor && (
        <div
          className="tooltip-armor"
          style={{
            marginTop: '4px',
            fontSize: '12px',
            color: '#9999ff',
          }}
        >
          Armor: +{(item.metadata as any).armor}
        </div>
      )}

      {/* Item ID (debug mode) */}
      {process.env['NODE_ENV'] === 'development' && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            fontSize: '10px',
            color: '#666666',
            fontFamily: 'monospace',
          }}
        >
          ID: {item.itemId}
        </div>
      )}
    </motion.div>
  )
}
