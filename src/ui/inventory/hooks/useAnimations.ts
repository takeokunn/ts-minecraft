/**
 * useInventoryAnimations Hook
 *
 * Manages inventory slot animations and item transfer effects
 * Uses framer-motion and Effect-TS for animation orchestration
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Option, pipe, Match } from 'effect'
import type { InventorySlot, DragState, SlotAnimationState, ItemTransferAnimation } from '../types.js'

interface AnimationHookProps {
  readonly slots: ReadonlyArray<InventorySlot>
  readonly dragState: DragState
  readonly hoveredSlotIndex: Option.Option<number>
  readonly animationDuration: number
}

interface AnimationHookResult {
  readonly slotAnimations: Record<number, SlotAnimationState>
  readonly itemTransfers: ReadonlyArray<ItemTransferAnimation>
  readonly triggerPickupAnimation: (slotIndex: number) => void
  readonly triggerDropAnimation: (slotIndex: number) => void
  readonly triggerErrorAnimation: (slotIndex: number) => void
}

export const useInventoryAnimations = ({
  slots,
  dragState,
  hoveredSlotIndex,
  animationDuration
}: AnimationHookProps): AnimationHookResult => {
  const [slotAnimations, setSlotAnimations] = useState<Record<number, SlotAnimationState>>({})
  const [itemTransfers, setItemTransfers] = useState<ItemTransferAnimation[]>([])

  // =========================================
  // Compute Slot Animation States
  // =========================================

  const computedAnimations = useMemo(() => {
    const animations: Record<number, SlotAnimationState> = {}

    slots.forEach(slot => {
      let scale = 1
      let rotation = 0
      let opacity = 1
      let glow = 0
      let shake = 0

      // Dragging source slot
      if (dragState.isDragging && Option.isSome(dragState.sourceSlot)) {
        if (slot.index === dragState.sourceSlot.value) {
          opacity = 0.3
          scale = 0.9
        }
      }

      // Hovered slot
      if (Option.isSome(hoveredSlotIndex) && slot.index === hoveredSlotIndex.value) {
        scale = 1.1
        glow = 0.3
      }

      // Drag over slot
      if (dragState.isDragging && Option.isSome(dragState.hoveredSlot)) {
        if (slot.index === dragState.hoveredSlot.value) {
          scale = 1.15
          glow = 0.5
          rotation = Math.sin(Date.now() / 200) * 2
        }
      }

      // Highlighted/selected slot
      if (slot.isHighlighted) {
        glow = 0.4
      }

      // Disabled slot
      if (slot.isDisabled) {
        opacity = 0.5
        scale = 0.95
      }

      // Empty slot with drag over
      if (Option.isNone(slot.item) && dragState.isDragging) {
        if (Option.isSome(hoveredSlotIndex) && slot.index === hoveredSlotIndex.value) {
          glow = 0.6
        }
      }

      animations[slot.index] = {
        scale,
        rotation,
        opacity,
        glow,
        shake
      }
    })

    return animations
  }, [slots, dragState, hoveredSlotIndex])

  // =========================================
  // Animation Triggers
  // =========================================

  const triggerPickupAnimation = useCallback((slotIndex: number) => {
    setSlotAnimations(prev => ({
      ...prev,
      [slotIndex]: {
        scale: 1.3,
        rotation: 10,
        opacity: 1,
        glow: 0.8,
        shake: 0
      }
    }))

    // Reset after animation
    setTimeout(() => {
      setSlotAnimations(prev => {
        const updated = { ...prev }
        delete updated[slotIndex]
        return updated
      })
    }, animationDuration)
  }, [animationDuration])

  const triggerDropAnimation = useCallback((slotIndex: number) => {
    setSlotAnimations(prev => ({
      ...prev,
      [slotIndex]: {
        scale: 0.8,
        rotation: -5,
        opacity: 1,
        glow: 0.5,
        shake: 0
      }
    }))

    // Reset after animation
    setTimeout(() => {
      setSlotAnimations(prev => {
        const updated = { ...prev }
        delete updated[slotIndex]
        return updated
      })
    }, animationDuration)
  }, [animationDuration])

  const triggerErrorAnimation = useCallback((slotIndex: number) => {
    setSlotAnimations(prev => ({
      ...prev,
      [slotIndex]: {
        scale: 1,
        rotation: 0,
        opacity: 1,
        glow: 0,
        shake: 1
      }
    }))

    // Reset after animation
    setTimeout(() => {
      setSlotAnimations(prev => {
        const updated = { ...prev }
        delete updated[slotIndex]
        return updated
      })
    }, animationDuration * 2)
  }, [animationDuration])

  // =========================================
  // Item Transfer Animations
  // =========================================

  const addTransferAnimation = useCallback((
    fromSlot: number,
    toSlot: number,
    itemStack: any
  ) => {
    const fromSlotData = slots.find(s => s.index === fromSlot)
    const toSlotData = slots.find(s => s.index === toSlot)

    if (!fromSlotData || !toSlotData) return

    const animation: ItemTransferAnimation = {
      from: fromSlotData.position,
      to: toSlotData.position,
      item: itemStack,
      duration: animationDuration,
      easing: 'ease-in-out'
    }

    setItemTransfers(prev => [...prev, animation])

    // Remove animation after completion
    setTimeout(() => {
      setItemTransfers(prev => prev.filter(a => a !== animation))
    }, animationDuration)
  }, [slots, animationDuration])

  // =========================================
  // Merge Computed and Manual Animations
  // =========================================

  const mergedAnimations = useMemo(() => {
    return {
      ...computedAnimations,
      ...slotAnimations
    }
  }, [computedAnimations, slotAnimations])

  return {
    slotAnimations: mergedAnimations,
    itemTransfers,
    triggerPickupAnimation,
    triggerDropAnimation,
    triggerErrorAnimation
  }
}

/**
 * Animation presets for different item actions
 */
export const ANIMATION_PRESETS = {
  PICKUP: {
    scale: [1, 1.3, 1],
    rotate: [0, 10, 0],
    transition: { duration: 0.3 }
  },
  DROP: {
    scale: [1, 0.8, 1],
    rotate: [0, -5, 0],
    transition: { duration: 0.3 }
  },
  SWAP: {
    scale: [1, 1.1, 0.9, 1],
    transition: { duration: 0.4 }
  },
  ERROR: {
    x: [0, -5, 5, -5, 5, 0],
    transition: { duration: 0.4 }
  },
  HIGHLIGHT: {
    boxShadow: [
      '0 0 0 rgba(255, 255, 0, 0)',
      '0 0 20px rgba(255, 255, 0, 0.5)',
      '0 0 0 rgba(255, 255, 0, 0)'
    ],
    transition: { duration: 1, repeat: Infinity }
  }
} as const

/**
 * Helper to create slot pulse animation
 */
export const createPulseAnimation = (
  color: string = '#ffffff',
  intensity: number = 0.5
) => ({
  boxShadow: [
    `0 0 0 rgba(${hexToRgb(color)}, 0)`,
    `0 0 ${20 * intensity}px rgba(${hexToRgb(color)}, ${intensity})`,
    `0 0 0 rgba(${hexToRgb(color)}, 0)`
  ],
  transition: {
    duration: 1,
    repeat: Infinity,
    repeatType: 'reverse' as const
  }
})

/**
 * Helper to convert hex color to RGB
 */
const hexToRgb = (hex: string | undefined): string => {
  if (!hex) return '255, 255, 255'
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '255, 255, 255'

  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

/**
 * Create stagger animation for slot grid
 */
export const createStaggerAnimation = (
  index: number,
  columns: number,
  baseDelay: number = 0.05
) => {
  const row = Math.floor(index / columns)
  const col = index % columns
  const delay = (row + col) * baseDelay

  return {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { delay, duration: 0.3 }
  }
}