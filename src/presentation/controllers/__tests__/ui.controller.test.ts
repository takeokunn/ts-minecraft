import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { 
  UIController,
  UIControllerLive,
  createUIController,
  type UIControllerInterface,
  type UIState,
  type HotbarItem,
  type Notification
} from '../ui.controller'
import { runEffect, expectEffect, presentationTestUtils } from '../../__tests__/setup'

describe('UIController', () => {
  let uiController: UIControllerInterface

  beforeEach(async () => {
    uiController = await runEffect(
      Effect.provide(UIController, UIControllerLive)
    )
  })

  describe('showHUD', () => {
    it('should show HUD when visible is true', async () => {
      await runEffect(uiController.showHUD(true))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hudVisible).toBe(true)
    })

    it('should hide HUD when visible is false', async () => {
      await runEffect(uiController.showHUD(false))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hudVisible).toBe(false)
    })

    it('should maintain other UI state when toggling HUD', async () => {
      // Set up initial state
      await runEffect(uiController.showInventory(true))
      await runEffect(uiController.showHUD(false))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hudVisible).toBe(false)
      expect(state.inventoryVisible).toBe(true)
    })
  })

  describe('showInventory', () => {
    it('should show inventory when visible is true', async () => {
      await runEffect(uiController.showInventory(true))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.inventoryVisible).toBe(true)
    })

    it('should hide inventory when visible is false', async () => {
      await runEffect(uiController.showInventory(true))
      await runEffect(uiController.showInventory(false))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.inventoryVisible).toBe(false)
    })
  })

  describe('showMainMenu', () => {
    it('should show main menu when visible is true', async () => {
      await runEffect(uiController.showMainMenu(true))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.mainMenuVisible).toBe(true)
    })

    it('should hide main menu when visible is false', async () => {
      await runEffect(uiController.showMainMenu(true))
      await runEffect(uiController.showMainMenu(false))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.mainMenuVisible).toBe(false)
    })
  })

  describe('showCrosshair', () => {
    it('should show crosshair when visible is true', async () => {
      await runEffect(uiController.showCrosshair(true))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.crosshairVisible).toBe(true)
    })

    it('should hide crosshair when visible is false', async () => {
      await runEffect(uiController.showCrosshair(false))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.crosshairVisible).toBe(false)
    })

    it('should start with crosshair visible by default', async () => {
      const state = await runEffect(uiController.getUIState())
      expect(state.crosshairVisible).toBe(true)
    })
  })

  describe('updateHotbar', () => {
    it('should update hotbar with provided items', async () => {
      const items: HotbarItem[] = [
        { id: 'item-1', type: 'stone', count: 64, slot: 0 },
        { id: 'item-2', type: 'dirt', count: 32, slot: 1 },
        { id: 'item-3', type: 'wood', count: 16, slot: 2 }
      ]
      
      await runEffect(uiController.updateHotbar(items))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hotbarItems).toEqual(items)
    })

    it('should replace existing hotbar items', async () => {
      const initialItems: HotbarItem[] = [
        { id: 'item-1', type: 'stone', count: 64, slot: 0 }
      ]
      
      const newItems: HotbarItem[] = [
        { id: 'item-2', type: 'dirt', count: 32, slot: 1 },
        { id: 'item-3', type: 'wood', count: 16, slot: 2 }
      ]
      
      await runEffect(uiController.updateHotbar(initialItems))
      await runEffect(uiController.updateHotbar(newItems))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hotbarItems).toEqual(newItems)
    })

    it('should handle empty hotbar items', async () => {
      await runEffect(uiController.updateHotbar([]))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hotbarItems).toEqual([])
    })
  })

  describe('showNotification', () => {
    it('should add notification with default duration', async () => {
      const message = 'Test notification'
      
      await runEffect(uiController.showNotification(message))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications).toHaveLength(1)
      expect(state.notifications[0].message).toBe(message)
      expect(state.notifications[0].duration).toBe(3000)
    })

    it('should add notification with custom duration', async () => {
      const message = 'Custom duration notification'
      const duration = 5000
      
      await runEffect(uiController.showNotification(message, duration))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications).toHaveLength(1)
      expect(state.notifications[0].message).toBe(message)
      expect(state.notifications[0].duration).toBe(duration)
    })

    it('should generate unique notification IDs', async () => {
      await runEffect(uiController.showNotification('First'))
      await runEffect(uiController.showNotification('Second'))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications).toHaveLength(2)
      expect(state.notifications[0].id).not.toBe(state.notifications[1].id)
    })

    it('should add timestamp to notifications', async () => {
      const beforeTime = Date.now()
      await runEffect(uiController.showNotification('Timestamped notification'))
      const afterTime = Date.now()
      
      const state = await runEffect(uiController.getUIState())
      const notification = state.notifications[0]
      expect(notification.timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(notification.timestamp).toBeLessThanOrEqual(afterTime)
    })

    it('should handle multiple notifications', async () => {
      await runEffect(uiController.showNotification('First notification'))
      await runEffect(uiController.showNotification('Second notification'))
      await runEffect(uiController.showNotification('Third notification'))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications).toHaveLength(3)
      expect(state.notifications.map(n => n.message)).toEqual([
        'First notification',
        'Second notification',
        'Third notification'
      ])
    })

    // Note: Testing auto-removal is challenging in synchronous tests
    // It would require TestClock or other time manipulation utilities
    it('should create notification with auto-removal structure', async () => {
      await runEffect(uiController.showNotification('Auto-remove test', 1000))
      
      const state = await runEffect(uiController.getUIState())
      const notification = state.notifications[0]
      expect(notification.duration).toBe(1000)
      expect(notification.id).toMatch(/^notification-\d+$/)
    })
  })

  describe('getUIState', () => {
    it('should return initial UI state', async () => {
      const state = await runEffect(uiController.getUIState())
      
      expect(state).toEqual({
        hudVisible: true,
        inventoryVisible: false,
        mainMenuVisible: false,
        crosshairVisible: true,
        hotbarItems: [],
        notifications: []
      })
    })

    it('should return updated UI state', async () => {
      await runEffect(uiController.showHUD(false))
      await runEffect(uiController.showInventory(true))
      await runEffect(uiController.showMainMenu(true))
      
      const items: HotbarItem[] = [
        { id: 'item-1', type: 'stone', count: 64, slot: 0 }
      ]
      await runEffect(uiController.updateHotbar(items))
      await runEffect(uiController.showNotification('Test'))
      
      const state = await runEffect(uiController.getUIState())
      
      expect(state.hudVisible).toBe(false)
      expect(state.inventoryVisible).toBe(true)
      expect(state.mainMenuVisible).toBe(true)
      expect(state.hotbarItems).toEqual(items)
      expect(state.notifications).toHaveLength(1)
    })

    it('should always return valid UIState structure', async () => {
      const state = await runEffect(uiController.getUIState())
      
      expect(state).toHaveProperty('hudVisible')
      expect(state).toHaveProperty('inventoryVisible')
      expect(state).toHaveProperty('mainMenuVisible')
      expect(state).toHaveProperty('crosshairVisible')
      expect(state).toHaveProperty('hotbarItems')
      expect(state).toHaveProperty('notifications')
      expect(Array.isArray(state.hotbarItems)).toBe(true)
      expect(Array.isArray(state.notifications)).toBe(true)
    })
  })

  describe('UIControllerLive layer', () => {
    it('should create UIController with correct interface', async () => {
      const controller = await runEffect(
        Effect.provide(UIController, UIControllerLive)
      )
      
      expect(controller).toBeDefined()
      expect(typeof controller.showHUD).toBe('function')
      expect(typeof controller.showInventory).toBe('function')
      expect(typeof controller.showMainMenu).toBe('function')
      expect(typeof controller.showCrosshair).toBe('function')
      expect(typeof controller.updateHotbar).toBe('function')
      expect(typeof controller.showNotification).toBe('function')
      expect(typeof controller.getUIState).toBe('function')
    })

    it('should maintain separate state for multiple instances', async () => {
      const controller1 = await runEffect(
        Effect.provide(UIController, UIControllerLive)
      )
      const controller2 = await runEffect(
        Effect.provide(UIController, UIControllerLive)
      )
      
      await runEffect(controller1.showHUD(false))
      await runEffect(controller2.showHUD(true))
      
      const state1 = await runEffect(controller1.getUIState())
      const state2 = await runEffect(controller2.getUIState())
      
      expect(state1.hudVisible).toBe(false)
      expect(state2.hudVisible).toBe(true)
    })
  })

  describe('createUIController factory', () => {
    it('should create controller instance directly', () => {
      const controller = createUIController()
      
      expect(controller).toBeDefined()
      expect(typeof controller.showHUD).toBe('function')
      expect(typeof controller.showInventory).toBe('function')
      expect(typeof controller.showMainMenu).toBe('function')
      expect(typeof controller.showCrosshair).toBe('function')
      expect(typeof controller.updateHotbar).toBe('function')
      expect(typeof controller.showNotification).toBe('function')
      expect(typeof controller.getUIState).toBe('function')
    })

    it('should work with factory created controller', async () => {
      const controller = createUIController()
      
      await runEffect(controller.showHUD(false))
      const state = await runEffect(controller.getUIState())
      
      expect(state.hudVisible).toBe(false)
    })
  })

  describe('Complex UI workflows', () => {
    it('should handle game session UI flow', async () => {
      // Start game - show HUD, hide menu
      await runEffect(uiController.showMainMenu(false))
      await runEffect(uiController.showHUD(true))
      await runEffect(uiController.showCrosshair(true))
      
      // Player gets items
      const items: HotbarItem[] = [
        { id: 'item-1', type: 'pickaxe', count: 1, slot: 0 },
        { id: 'item-2', type: 'stone', count: 64, slot: 1 }
      ]
      await runEffect(uiController.updateHotbar(items))
      
      // Show achievement notification
      await runEffect(uiController.showNotification('Achievement unlocked!', 5000))
      
      // Check final state
      const state = await runEffect(uiController.getUIState())
      
      expect(state.mainMenuVisible).toBe(false)
      expect(state.hudVisible).toBe(true)
      expect(state.crosshairVisible).toBe(true)
      expect(state.hotbarItems).toEqual(items)
      expect(state.notifications).toHaveLength(1)
    })

    it('should handle inventory management flow', async () => {
      // Open inventory
      await runEffect(uiController.showInventory(true))
      await runEffect(uiController.showHUD(false))
      
      // Update items while inventory is open
      const items: HotbarItem[] = [
        { id: 'item-1', type: 'sword', count: 1, slot: 0 },
        { id: 'item-2', type: 'bread', count: 8, slot: 1 }
      ]
      await runEffect(uiController.updateHotbar(items))
      
      // Close inventory
      await runEffect(uiController.showInventory(false))
      await runEffect(uiController.showHUD(true))
      
      const state = await runEffect(uiController.getUIState())
      
      expect(state.inventoryVisible).toBe(false)
      expect(state.hudVisible).toBe(true)
      expect(state.hotbarItems).toEqual(items)
    })

    it('should handle concurrent operations', async () => {
      const operations = [
        uiController.showHUD(false),
        uiController.showInventory(true),
        uiController.showNotification('Concurrent test'),
        uiController.updateHotbar([
          { id: 'item-1', type: 'stone', count: 64, slot: 0 }
        ])
      ]
      
      await runEffect(Effect.all(operations))
      
      const state = await runEffect(uiController.getUIState())
      
      expect(state.hudVisible).toBe(false)
      expect(state.inventoryVisible).toBe(true)
      expect(state.hotbarItems).toHaveLength(1)
      expect(state.notifications).toHaveLength(1)
    })
  })

  describe('Edge cases', () => {
    it('should handle duplicate hotbar items', async () => {
      const items: HotbarItem[] = [
        { id: 'item-1', type: 'stone', count: 32, slot: 0 },
        { id: 'item-1', type: 'stone', count: 32, slot: 1 } // Duplicate ID
      ]
      
      await runEffect(uiController.updateHotbar(items))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.hotbarItems).toEqual(items) // Should store as provided
    })

    it('should handle empty notification message', async () => {
      await runEffect(uiController.showNotification(''))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications[0].message).toBe('')
    })

    it('should handle zero duration notification', async () => {
      await runEffect(uiController.showNotification('Zero duration', 0))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications[0].duration).toBe(0)
    })

    it('should handle negative duration notification', async () => {
      await runEffect(uiController.showNotification('Negative duration', -1000))
      
      const state = await runEffect(uiController.getUIState())
      expect(state.notifications[0].duration).toBe(-1000)
    })
  })
})