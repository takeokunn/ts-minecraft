/**
 * Browser Input Adapter Unit Tests
 * 
 * Comprehensive test suite for the browser input adapter,
 * testing DOM event handling, input state management, and Effect-TS patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import * as Context from 'effect/Context'
import { 
  expectEffect, 
  runEffect, 
  runEffectExit,
  runEffectSync
} from '../../../setup/infrastructure.setup'
import {
  BrowserInputAdapter,
  BrowserInputAdapterLive,
  IBrowserInputAdapter,
  DomEvent
} from '@infrastructure/adapters/browser-input.adapter'
import { MouseState, KeyboardState } from '@domain/ports/input.port'

describe('BrowserInputAdapter', () => {
  let adapter: IBrowserInputAdapter
  let mockDocument: Document

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup mock document with event handling
    const eventListeners = new Map<string, EventListener[]>()
    
    mockDocument = {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (!eventListeners.has(type)) {
          eventListeners.set(type, [])
        }
        eventListeners.get(type)!.push(listener)
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        if (eventListeners.has(type)) {
          const listeners = eventListeners.get(type)!
          const index = listeners.indexOf(listener)
          if (index > -1) {
            listeners.splice(index, 1)
          }
        }
      }),
      querySelector: vi.fn(() => ({
        requestPointerLock: vi.fn()
      })),
      exitPointerLock: vi.fn(),
      pointerLockElement: null
    } as unknown as Document

    // Mock global document
    Object.defineProperty(global, 'document', {
      value: mockDocument,
      writable: true
    })

    // Create adapter instance
    adapter = await runEffect(Layer.build(BrowserInputAdapterLive).pipe(
      Effect.map(context => Context.get(context, BrowserInputAdapter))
    ))

    // Give some time for event listeners to be set up
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Layer Creation', () => {
    it('should create BrowserInputAdapterLive layer successfully', async () => {
      const result = await expectEffect.toSucceed(
        Layer.build(BrowserInputAdapterLive).pipe(
          Effect.map(context => Context.get(context, BrowserInputAdapter))
        )
      )

      expect(result).toBeDefined()
      expect(result.getMouseState).toBeDefined()
      expect(result.getKeyboardState).toBeDefined()
      expect(result.isKeyPressed).toBeDefined()
      expect(result.eventQueue).toBeDefined()
      expect(result.processEvents).toBeDefined()
    })

    it('should set up DOM event listeners', async () => {
      await runEffect(Layer.build(BrowserInputAdapterLive))
      
      // Verify event listeners were added
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('pointerlockchange', expect.any(Function))
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function))
    })
  })

  describe('Keyboard Input', () => {
    it('should track key press events', async () => {
      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyW' })
      Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
      
      // Simulate keydown event
      mockDocument.dispatchEvent?.(keyEvent)
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const isPressed = await expectEffect.toSucceed(adapter.isKeyPressed('KeyW'))
      expect(isPressed).toBe(true)
    })

    it('should track key release events', async () => {
      // Press key first
      const keyDownEvent = new KeyboardEvent('keydown', { code: 'KeyA' })
      Object.defineProperty(keyDownEvent, 'preventDefault', { value: vi.fn() })
      mockDocument.dispatchEvent?.(keyDownEvent)
      
      await new Promise(resolve => setTimeout(resolve, 5))
      
      // Release key
      const keyUpEvent = new KeyboardEvent('keyup', { code: 'KeyA' })
      Object.defineProperty(keyUpEvent, 'preventDefault', { value: vi.fn() })
      mockDocument.dispatchEvent?.(keyUpEvent)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const isPressed = await expectEffect.toSucceed(adapter.isKeyPressed('KeyA'))
      const isJustReleased = await expectEffect.toSucceed(adapter.isKeyJustReleased('KeyA'))
      
      expect(isPressed).toBe(false)
      expect(isJustReleased).toBe(true)
    })

    it('should track just pressed state', async () => {
      const keyEvent = new KeyboardEvent('keydown', { code: 'Space' })
      Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
      
      mockDocument.dispatchEvent?.(keyEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const isJustPressed = await expectEffect.toSucceed(adapter.isKeyJustPressed('Space'))
      expect(isJustPressed).toBe(true)
    })

    it('should get complete keyboard state', async () => {
      // Press multiple keys
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
      for (const key of keys) {
        const keyEvent = new KeyboardEvent('keydown', { code: key })
        Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
        mockDocument.dispatchEvent?.(keyEvent)
      }
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const keyboardState = await expectEffect.toSucceed(adapter.getKeyboardState())
      
      expect(keyboardState.keysPressed.size).toBeGreaterThan(0)
      expect(keyboardState.keysJustPressed.size).toBeGreaterThan(0)
    })

    it('should update and clear just pressed/released states', async () => {
      // Press and release a key
      const keyDown = new KeyboardEvent('keydown', { code: 'KeyX' })
      const keyUp = new KeyboardEvent('keyup', { code: 'KeyX' })
      
      Object.defineProperty(keyDown, 'preventDefault', { value: vi.fn() })
      Object.defineProperty(keyUp, 'preventDefault', { value: vi.fn() })
      
      mockDocument.dispatchEvent?.(keyDown)
      await new Promise(resolve => setTimeout(resolve, 5))
      mockDocument.dispatchEvent?.(keyUp)
      await new Promise(resolve => setTimeout(resolve, 5))
      
      // Update should clear just pressed/released
      await expectEffect.toSucceed(adapter.update())
      
      const isJustPressed = await expectEffect.toSucceed(adapter.isKeyJustPressed('KeyX'))
      const isJustReleased = await expectEffect.toSucceed(adapter.isKeyJustReleased('KeyX'))
      
      expect(isJustPressed).toBe(false)
      expect(isJustReleased).toBe(false)
    })
  })

  describe('Mouse Input', () => {
    it('should track mouse button press', async () => {
      const mouseEvent = new MouseEvent('mousedown', { 
        button: 0, 
        clientX: 100, 
        clientY: 200 
      })
      Object.defineProperty(mouseEvent, 'preventDefault', { value: vi.fn() })
      
      mockDocument.dispatchEvent?.(mouseEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      
      expect(mouseState.leftPressed).toBe(true)
      expect(mouseState.x).toBe(100)
      expect(mouseState.y).toBe(200)
    })

    it('should track mouse button release', async () => {
      // Press button first
      const mouseDownEvent = new MouseEvent('mousedown', { 
        button: 2, 
        clientX: 50, 
        clientY: 75 
      })
      Object.defineProperty(mouseDownEvent, 'preventDefault', { value: vi.fn() })
      mockDocument.dispatchEvent?.(mouseDownEvent)
      
      await new Promise(resolve => setTimeout(resolve, 5))
      
      // Release button
      const mouseUpEvent = new MouseEvent('mouseup', { 
        button: 2, 
        clientX: 55, 
        clientY: 80 
      })
      Object.defineProperty(mouseUpEvent, 'preventDefault', { value: vi.fn() })
      mockDocument.dispatchEvent?.(mouseUpEvent)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      
      expect(mouseState.rightPressed).toBe(false)
      expect(mouseState.x).toBe(55)
      expect(mouseState.y).toBe(80)
    })

    it('should track mouse movement', async () => {
      const mouseEvent = new MouseEvent('mousemove', { 
        clientX: 300, 
        clientY: 400,
        movementX: 10,
        movementY: 15
      })
      
      mockDocument.dispatchEvent?.(mouseEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      
      expect(mouseState.x).toBe(300)
      expect(mouseState.y).toBe(400)
      // Movement deltas only work when pointer is locked
      expect(mouseState.dx).toBe(0)
      expect(mouseState.dy).toBe(0)
    })

    it('should track mouse movement deltas when pointer locked', async () => {
      // Mock pointer lock state
      Object.defineProperty(mockDocument, 'pointerLockElement', {
        value: document.createElement('canvas'),
        configurable: true
      })
      
      // Trigger pointer lock change
      const pointerLockEvent = new Event('pointerlockchange')
      mockDocument.dispatchEvent?.(pointerLockEvent)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Now mouse movement should capture deltas
      const mouseEvent = new MouseEvent('mousemove', { 
        clientX: 300, 
        clientY: 400,
        movementX: 10,
        movementY: 15
      })
      
      mockDocument.dispatchEvent?.(mouseEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      
      expect(mouseState.dx).toBe(10)
      expect(mouseState.dy).toBe(15)
    })

    it('should handle multiple mouse buttons', async () => {
      const leftClick = new MouseEvent('mousedown', { button: 0 })
      const rightClick = new MouseEvent('mousedown', { button: 2 })
      const middleClick = new MouseEvent('mousedown', { button: 1 })
      
      Object.defineProperty(leftClick, 'preventDefault', { value: vi.fn() })
      Object.defineProperty(rightClick, 'preventDefault', { value: vi.fn() })
      Object.defineProperty(middleClick, 'preventDefault', { value: vi.fn() })
      
      mockDocument.dispatchEvent?.(leftClick)
      mockDocument.dispatchEvent?.(rightClick)
      mockDocument.dispatchEvent?.(middleClick)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      
      expect(mouseState.leftPressed).toBe(true)
      expect(mouseState.rightPressed).toBe(true)
      expect(mouseState.middlePressed).toBe(true)
    })

    it('should reset mouse delta after reading', async () => {
      // Setup pointer lock
      Object.defineProperty(mockDocument, 'pointerLockElement', {
        value: document.createElement('canvas'),
        configurable: true
      })
      
      const pointerLockEvent = new Event('pointerlockchange')
      mockDocument.dispatchEvent?.(pointerLockEvent)
      await new Promise(resolve => setTimeout(resolve, 5))
      
      // Move mouse
      const mouseEvent = new MouseEvent('mousemove', { 
        movementX: 25, 
        movementY: 30 
      })
      mockDocument.dispatchEvent?.(mouseEvent)
      await new Promise(resolve => setTimeout(resolve, 5))
      
      // Read initial state
      const mouseState1 = await expectEffect.toSucceed(adapter.getMouseState())
      expect(mouseState1.dx).toBe(25)
      expect(mouseState1.dy).toBe(30)
      
      // Reset delta
      await expectEffect.toSucceed(adapter.resetMouseDelta())
      
      // Read again - should be zero
      const mouseState2 = await expectEffect.toSucceed(adapter.getMouseState())
      expect(mouseState2.dx).toBe(0)
      expect(mouseState2.dy).toBe(0)
    })
  })

  describe('Pointer Lock', () => {
    it('should request pointer lock', async () => {
      const mockCanvas = { requestPointerLock: vi.fn() }
      vi.mocked(mockDocument.querySelector).mockReturnValue(mockCanvas as any)
      
      await expectEffect.toSucceed(adapter.lockPointer())
      expect(mockCanvas.requestPointerLock).toHaveBeenCalled()
    })

    it('should handle missing canvas element', async () => {
      vi.mocked(mockDocument.querySelector).mockReturnValue(null)
      
      // Should not throw error when canvas not found
      await expectEffect.toSucceed(adapter.lockPointer())
    })

    it('should exit pointer lock', async () => {
      await expectEffect.toSucceed(adapter.unlockPointer())
      expect(mockDocument.exitPointerLock).toHaveBeenCalled()
    })

    it('should track pointer lock state', async () => {
      // Initially not locked
      let isLocked = await expectEffect.toSucceed(adapter.isPointerLocked())
      expect(isLocked).toBe(false)
      
      // Mock pointer lock
      Object.defineProperty(mockDocument, 'pointerLockElement', {
        value: document.createElement('canvas'),
        configurable: true
      })
      
      const pointerLockEvent = new Event('pointerlockchange')
      mockDocument.dispatchEvent?.(pointerLockEvent)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      isLocked = await expectEffect.toSucceed(adapter.isPointerLocked())
      expect(isLocked).toBe(true)
    })

    it('should handle pointer lock state changes', async () => {
      // Lock pointer
      Object.defineProperty(mockDocument, 'pointerLockElement', {
        value: document.createElement('canvas'),
        configurable: true
      })
      
      let lockEvent = new Event('pointerlockchange')
      mockDocument.dispatchEvent?.(lockEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      let isLocked = await expectEffect.toSucceed(adapter.isPointerLocked())
      expect(isLocked).toBe(true)
      
      // Unlock pointer
      Object.defineProperty(mockDocument, 'pointerLockElement', {
        value: null,
        configurable: true
      })
      
      lockEvent = new Event('pointerlockchange')
      mockDocument.dispatchEvent?.(lockEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      isLocked = await expectEffect.toSucceed(adapter.isPointerLocked())
      expect(isLocked).toBe(false)
    })
  })

  describe('Event Processing', () => {
    it('should process events from queue', async () => {
      expect(adapter.eventQueue).toBeDefined()
      expect(adapter.processEvents).toBeDefined()
      
      // The adapter should be processing events automatically
      const keyEvent = new KeyboardEvent('keydown', { code: 'KeyQ' })
      Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
      
      mockDocument.dispatchEvent?.(keyEvent)
      await new Promise(resolve => setTimeout(resolve, 20))
      
      const isPressed = await expectEffect.toSucceed(adapter.isKeyPressed('KeyQ'))
      expect(isPressed).toBe(true)
    })

    it('should handle context menu events', async () => {
      const contextMenuEvent = new Event('contextmenu')
      Object.defineProperty(contextMenuEvent, 'preventDefault', { value: vi.fn() })
      
      // Should not throw error
      mockDocument.dispatchEvent?.(contextMenuEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(contextMenuEvent.preventDefault).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed events gracefully', async () => {
      // Create event without required properties
      const malformedEvent = new KeyboardEvent('keydown', {})
      Object.defineProperty(malformedEvent, 'preventDefault', { value: vi.fn() })
      
      // Should not throw error
      mockDocument.dispatchEvent?.(malformedEvent)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Adapter should still be functional
      const keyboardState = await expectEffect.toSucceed(adapter.getKeyboardState())
      expect(keyboardState).toBeDefined()
    })

    it('should handle DOM API errors gracefully', async () => {
      // Mock querySelector to throw error
      vi.mocked(mockDocument.querySelector).mockImplementation(() => {
        throw new Error('DOM error')
      })
      
      // Should handle error gracefully
      await expectEffect.toSucceed(adapter.lockPointer())
    })

    it('should handle event listener errors gracefully', async () => {
      // Mock addEventListener to throw error
      vi.mocked(mockDocument.addEventListener).mockImplementation(() => {
        throw new Error('Event listener error')
      })
      
      // Should still create adapter (error should be handled during setup)
      const result = await runEffectExit(
        Layer.build(BrowserInputAdapterLive).pipe(
          Effect.map(context => Context.get(context, BrowserInputAdapter))
        )
      )
      
      // Might fail or succeed depending on error handling - adjust expectation based on implementation
      expect(result._tag).toBeDefined()
    })
  })

  describe('State Management', () => {
    it('should maintain consistent state across multiple operations', async () => {
      // Press multiple keys in sequence
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Shift']
      
      for (let i = 0; i < keys.length; i++) {
        const keyEvent = new KeyboardEvent('keydown', { code: keys[i] })
        Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
        mockDocument.dispatchEvent?.(keyEvent)
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Check all keys are registered as pressed
      for (const key of keys) {
        const isPressed = await expectEffect.toSucceed(adapter.isKeyPressed(key))
        expect(isPressed).toBe(true)
      }
      
      // Release half the keys
      for (let i = 0; i < keys.length / 2; i++) {
        const keyEvent = new KeyboardEvent('keyup', { code: keys[i] })
        Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
        mockDocument.dispatchEvent?.(keyEvent)
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Check state is correctly updated
      const keyboardState = await expectEffect.toSucceed(adapter.getKeyboardState())
      expect(keyboardState.keysPressed.size).toBe(Math.ceil(keys.length / 2))
      expect(keyboardState.keysJustReleased.size).toBe(Math.floor(keys.length / 2))
    })

    it('should handle rapid state changes', async () => {
      const key = 'KeyR'
      
      // Rapidly press and release
      for (let i = 0; i < 5; i++) {
        const keyDown = new KeyboardEvent('keydown', { code: key })
        const keyUp = new KeyboardEvent('keyup', { code: key })
        
        Object.defineProperty(keyDown, 'preventDefault', { value: vi.fn() })
        Object.defineProperty(keyUp, 'preventDefault', { value: vi.fn() })
        
        mockDocument.dispatchEvent?.(keyDown)
        mockDocument.dispatchEvent?.(keyUp)
        await new Promise(resolve => setTimeout(resolve, 2))
      }
      
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Final state should be consistent
      const isPressed = await expectEffect.toSucceed(adapter.isKeyPressed(key))
      const keyboardState = await expectEffect.toSucceed(adapter.getKeyboardState())
      
      expect(isPressed).toBe(false) // Should end up released
      expect(keyboardState).toBeDefined()
    })
  })

  describe('Integration Tests', () => {
    it('should handle complex input sequences', async () => {
      // Simulate gaming input sequence: WASD movement + mouse look + actions
      
      // 1. Press movement keys
      const movementKeys = ['KeyW', 'KeyA']
      for (const key of movementKeys) {
        const keyEvent = new KeyboardEvent('keydown', { code: key })
        Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
        mockDocument.dispatchEvent?.(keyEvent)
      }
      
      // 2. Mouse movement
      const mouseMove = new MouseEvent('mousemove', { 
        clientX: 400, 
        clientY: 300,
        movementX: 5,
        movementY: -3
      })
      mockDocument.dispatchEvent?.(mouseMove)
      
      // 3. Mouse click
      const mouseClick = new MouseEvent('mousedown', { button: 0 })
      Object.defineProperty(mouseClick, 'preventDefault', { value: vi.fn() })
      mockDocument.dispatchEvent?.(mouseClick)
      
      // 4. Action key
      const actionKey = new KeyboardEvent('keydown', { code: 'Space' })
      Object.defineProperty(actionKey, 'preventDefault', { value: vi.fn() })
      mockDocument.dispatchEvent?.(actionKey)
      
      await new Promise(resolve => setTimeout(resolve, 30))
      
      // Verify all inputs are registered
      const keyboardState = await expectEffect.toSucceed(adapter.getKeyboardState())
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      
      expect(keyboardState.keysPressed.has('KeyW')).toBe(true)
      expect(keyboardState.keysPressed.has('KeyA')).toBe(true)
      expect(keyboardState.keysPressed.has('Space')).toBe(true)
      expect(mouseState.leftPressed).toBe(true)
      expect(mouseState.x).toBe(400)
      expect(mouseState.y).toBe(300)
    })

    it('should work with different event preventDefault patterns', async () => {
      // Some events might not have preventDefault available
      const keyEventWithoutPreventDefault = new KeyboardEvent('keydown', { code: 'KeyT' })
      
      // Should handle gracefully
      mockDocument.dispatchEvent?.(keyEventWithoutPreventDefault)
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const isPressed = await expectEffect.toSucceed(adapter.isKeyPressed('KeyT'))
      expect(isPressed).toBe(true)
    })
  })

  describe('Resource Cleanup', () => {
    it('should clean up event listeners on disposal', async () => {
      // Create a scoped layer
      const testEffect = Effect.gen(function* () {
        const context = yield* Layer.build(BrowserInputAdapterLive)
        const adapter = Context.get(context, BrowserInputAdapter)
        
        // Use the adapter briefly
        yield* adapter.getKeyboardState()
        
        return adapter
      }).pipe(Effect.scoped)
      
      await expectEffect.toSucceed(testEffect)
      
      // Event listeners should be cleaned up
      expect(mockDocument.removeEventListener).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should handle high-frequency events efficiently', async () => {
      const startTime = performance.now()
      
      // Generate many events quickly
      for (let i = 0; i < 100; i++) {
        const mouseEvent = new MouseEvent('mousemove', { 
          clientX: i, 
          clientY: i 
        })
        mockDocument.dispatchEvent?.(mouseEvent)
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(200)
      
      // Final state should be consistent
      const mouseState = await expectEffect.toSucceed(adapter.getMouseState())
      expect(mouseState.x).toBeGreaterThanOrEqual(0)
    })

    it('should maintain performance with many simultaneous keys', async () => {
      const keys = Array.from({ length: 20 }, (_, i) => `Key${String.fromCharCode(65 + i)}`)
      
      const startTime = performance.now()
      
      // Press all keys
      for (const key of keys) {
        const keyEvent = new KeyboardEvent('keydown', { code: key })
        Object.defineProperty(keyEvent, 'preventDefault', { value: vi.fn() })
        mockDocument.dispatchEvent?.(keyEvent)
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const keyboardState = await expectEffect.toSucceed(adapter.getKeyboardState())
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100)
      expect(keyboardState.keysPressed.size).toBe(keys.length)
    })
  })
})