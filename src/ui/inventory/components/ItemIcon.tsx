/**
 * ItemIcon Component
 *
 * Renders item icon with count and durability indicators
 * Supports animations and custom item textures
 */

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { ItemIconProps } from '../types.js'

// Item texture mapping (would normally load from texture atlas)
const ITEM_TEXTURES: Record<string, string> = {
  stone: '🪨',
  dirt: '🟫',
  grass_block: '🟩',
  wood: '🪵',
  diamond: '💎',
  iron_ingot: '🔧',
  gold_ingot: '🟨',
  coal: '⚫',
  apple: '🍎',
  bread: '🍞',
  sword_iron: '🗡️',
  sword_diamond: '⚔️',
  pickaxe_iron: '⛏️',
  pickaxe_diamond: '⛏️',
  axe_iron: '🪓',
  shovel_iron: '🔨',
  helmet_iron: '🪖',
  chestplate_iron: '🛡️',
  leggings_iron: '👖',
  boots_iron: '👢',
  torch: '🔦',
  crafting_table: '🔨',
  furnace: '🔥',
  chest: '📦',
  bed: '🛏️',
  door: '🚪',
  ladder: '🪜',
  rail: '🛤️',
  minecart: '🚃',
  tnt: '🧨',
  emerald: '💚',
  book: '📖',
  paper: '📄',
  compass: '🧭',
  map: '🗺️',
  clock: '🕐',
  bucket: '🪣',
  water_bucket: '💧',
  lava_bucket: '🔥',
  default: '📦',
}

export const ItemIcon: React.FC<ItemIconProps> = ({ item, size, showCount, showDurability, animate }) => {
  // =========================================
  // Compute Item Texture
  // =========================================

  const itemTexture = useMemo(() => {
    return ITEM_TEXTURES[item.itemId] || ITEM_TEXTURES['default']
  }, [item.itemId])

  // =========================================
  // Compute Durability Color
  // =========================================

  const durabilityColor = useMemo(() => {
    if (!item.metadata?.durability) return undefined

    const durability = item.metadata.durability
    if (durability > 0.6) return '#00ff00'
    if (durability > 0.3) return '#ffff00'
    if (durability > 0.1) return '#ff8800'
    return '#ff0000'
  }, [item.metadata?.durability])

  const durabilityWidth = useMemo(() => {
    return (item.metadata?.durability || 1) * 100
  }, [item.metadata?.durability])

  // =========================================
  // Animation Variants
  // =========================================

  const animationVariants = {
    idle: {
      rotate: 0,
      scale: 1,
    },
    hover: {
      rotate: [0, -5, 5, -5, 0],
      scale: 1.1,
      transition: {
        rotate: {
          duration: 0.5,
          repeat: Infinity,
          repeatType: 'reverse' as const,
        },
      },
    },
    selected: {
      scale: [1, 1.2, 1],
      transition: {
        duration: 0.3,
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  }

  // =========================================
  // Render
  // =========================================

  return (
    <motion.div
      className="item-icon"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
      variants={animationVariants}
      initial="idle"
      animate={animate ? 'selected' : 'idle'}
      {...(!animate && { whileHover: 'hover' })}
    >
      {/* Item Texture/Icon */}
      <div
        className="item-texture"
        style={{
          fontSize: size * 0.7,
          lineHeight: 1,
          filter: item.metadata?.enchantments?.length ? 'drop-shadow(0 0 4px #b300ff)' : undefined,
        }}
      >
        {itemTexture}
      </div>

      {/* Item Count */}
      {showCount && item.count > 1 && (
        <div
          className="item-count"
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            fontSize: Math.max(10, size * 0.25),
            fontWeight: 'bold',
            color: '#ffffff',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
            pointerEvents: 'none',
          }}
        >
          {item.count > 99 ? '99+' : item.count}
        </div>
      )}

      {/* Durability Bar */}
      {showDurability && item.metadata?.durability !== undefined && item.metadata.durability < 1 && (
        <div
          className="item-durability"
          style={{
            position: 'absolute',
            bottom: '2px',
            left: '2px',
            right: '2px',
            height: '3px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          <motion.div
            className="durability-fill"
            initial={{ width: '0%' }}
            animate={{ width: `${durabilityWidth}%` }}
            transition={{ duration: 0.3 }}
            style={{
              height: '100%',
              backgroundColor: durabilityColor,
              boxShadow: `0 0 4px ${durabilityColor}`,
            }}
          />
        </div>
      )}

      {/* Enchantment Glow */}
      {item.metadata?.enchantments?.length && (
        <motion.div
          className="enchantment-glow"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            position: 'absolute',
            inset: '-4px',
            border: '2px solid #b300ff',
            borderRadius: '4px',
            pointerEvents: 'none',
            filter: 'blur(2px)',
          }}
        />
      )}

      {/* Stack Size Indicator for large stacks */}
      {item.count >= 64 && (
        <div
          className="stack-indicator"
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '6px',
            height: '6px',
            backgroundColor: '#00ff00',
            borderRadius: '50%',
            boxShadow: '0 0 4px #00ff00',
          }}
        />
      )}
    </motion.div>
  )
}
