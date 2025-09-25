/**
 * useInventoryKeyboardShortcuts Hook
 *
 * Handles keyboard input for inventory interactions
 * Follows Effect-TS patterns for event handling
 */

import { useEffect, useCallback } from 'react'
import { Effect } from 'effect'

interface KeyboardShortcutsProps {
  readonly enabled: boolean
  readonly onHotbarSelect: (index: number) => void
  readonly onQuickMove: (slotIndex: number) => void
  readonly onQuickDrop: (slotIndex: number, all: boolean) => void
  readonly onClose: () => void
}

export const useInventoryKeyboardShortcuts = ({
  enabled,
  onHotbarSelect,
  onQuickMove,
  onQuickDrop,
  onClose
}: KeyboardShortcutsProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Hotbar selection (1-9 keys)
    if (event.key >= '1' && event.key <= '9') {
      const index = parseInt(event.key) - 1
      onHotbarSelect(index)
      event.preventDefault()
      return
    }

    // Close inventory (ESC or E)
    if (event.key === 'Escape' || event.key.toLowerCase() === 'e') {
      onClose()
      event.preventDefault()
      return
    }

    // Quick move (Shift + Click is handled in component)
    // But we can add Shift + Number for quick move from hotbar
    if (event.shiftKey && event.key >= '1' && event.key <= '9') {
      const slotIndex = parseInt(event.key) - 1
      onQuickMove(slotIndex)
      event.preventDefault()
      return
    }

    // Quick drop (Q for single, Ctrl+Q for stack)
    if (event.key.toLowerCase() === 'q') {
      // This would need the currently hovered slot index
      // For now, we'll handle this in the component
      event.preventDefault()
      return
    }
  }, [enabled, onHotbarSelect, onQuickMove, onQuickDrop, onClose])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])

  return {
    handleKeyDown
  }
}

/**
 * Keyboard shortcut configurations
 */
export const INVENTORY_SHORTCUTS = {
  HOTBAR_SELECT: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  CLOSE: ['Escape', 'e', 'E'],
  QUICK_MOVE: 'Shift+Click',
  QUICK_DROP_SINGLE: 'q',
  QUICK_DROP_ALL: 'Ctrl+q',
  SPLIT_STACK: 'Right Click',
  TAKE_HALF: 'Shift+Right Click',
  SPREAD_ITEMS: 'Left Click Drag',
  SPREAD_SINGLE: 'Right Click Drag'
} as const

/**
 * Helper to check if a keyboard event matches a shortcut
 */
export const matchesShortcut = (
  event: KeyboardEvent,
  shortcut: keyof typeof INVENTORY_SHORTCUTS
): boolean => {
  const shortcuts = INVENTORY_SHORTCUTS[shortcut]

  if (Array.isArray(shortcuts)) {
    return shortcuts.includes(event.key)
  }

  // Handle compound shortcuts
  switch (shortcut) {
    case 'QUICK_DROP_SINGLE':
      return event.key.toLowerCase() === 'q' && !event.ctrlKey && !event.metaKey
    case 'QUICK_DROP_ALL':
      return event.key.toLowerCase() === 'q' && (event.ctrlKey || event.metaKey)
    default:
      return false
  }
}

/**
 * Get keyboard shortcut display string
 */
export const getShortcutDisplay = (shortcut: keyof typeof INVENTORY_SHORTCUTS): string => {
  const shortcuts = INVENTORY_SHORTCUTS[shortcut]

  if (Array.isArray(shortcuts)) {
    return shortcuts.join(' / ')
  }

  return shortcuts as string
}