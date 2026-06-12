import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, MutableHashMap, MutableHashSet } from 'effect'
import { afterEach } from 'vitest'
import { MouseButton, PlayerInputServiceLive } from '@ts-minecraft/presentation/input/input-service'
import { InputService } from '@ts-minecraft/presentation/input/input-service'
import { PlayerInputService } from '@ts-minecraft/entity'
import { createTestInputService, createTestLayer } from '@ts-minecraft/presentation/input/input-service-test-utils'

const restoreDomGlobals = () => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLCanvasElement')
}

const installPointerLockDom = () => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  class TestCanvasElement {
    requestPointerLock() {}
  }

  const canvas = new TestCanvasElement()
  const fakeDocument = {
    pointerLockElement: null,
    getElementById: (id: string) => id === 'game-canvas' ? canvas : null,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      const registered = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
      registered.add(listener)
      listeners.set(type, registered)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener)
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
      return true
    },
    exitPointerLock: () => {},
  }

  // window shares the same listener registry as the document mock so a dispatched
  // 'blur' fires the input-service blur handler (stuck-key clearing).
  const fakeWindow = {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      const registered = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
      registered.add(listener)
      listeners.set(type, registered)
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener)
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
      return true
    },
  }

  Reflect.set(globalThis, 'window', fakeWindow)
  Reflect.set(globalThis, 'document', fakeDocument)
  Reflect.set(globalThis, 'HTMLCanvasElement', TestCanvasElement)

  return { fakeDocument, fakeWindow }
}

afterEach(() => {
  restoreDomGlobals()
})

describe('InputService', () => {
  describe('pointer lock DOM events', () => {
    it.effect('should clear fallback lock state when pointerlockchange loses the canvas', () => {
      const { fakeDocument } = installPointerLockDom()

      return Effect.scoped(Effect.gen(function* () {
        const input = yield* InputService
        yield* input.requestPointerLock()

        const locked = yield* input.isPointerLocked()
        expect(locked).toBe(true)

        fakeDocument.dispatchEvent(new Event('pointerlockchange'))

        const unlocked = yield* input.isPointerLocked()
        expect(unlocked).toBe(false)
      }).pipe(Effect.provide(InputService.Default)))
    })
  })

  describe('window blur clears held input', () => {
    it.effect('clears pressed keys on window blur (prevents stuck keys on tab/window switch)', () => {
      const { fakeDocument, fakeWindow } = installPointerLockDom()
      return Effect.scoped(Effect.gen(function* () {
        const input = yield* InputService
        // Player holds forward.
        fakeDocument.dispatchEvent({ type: 'keydown', code: 'KeyW', repeat: false, target: null, preventDefault: () => {} } as unknown as Event)
        expect(yield* input.isKeyPressed('KeyW')).toBe(true)
        // Window loses focus (alt-tab / click another window). The browser sends no
        // keyup, so without the blur handler 'KeyW' would stay pressed forever.
        fakeWindow.dispatchEvent(new Event('blur'))
        expect(yield* input.isKeyPressed('KeyW')).toBe(false)
      }).pipe(Effect.provide(InputService.Default)))
    })
  })

  describe('keydown default-action prevention', () => {
    const dispatchKey = (
      fakeDocument: { dispatchEvent: (e: Event) => boolean },
      code: string,
      target: unknown,
    ): { prevented: number } => {
      const counter = { prevented: 0 }
      const ev = { type: 'keydown', code, repeat: false, target, preventDefault: () => { counter.prevented++ } }
      fakeDocument.dispatchEvent(ev as unknown as Event)
      return counter
    }

    it.effect('preventDefault fires for Space/arrows when no text field is focused (fixes jump + page-scroll)', () => {
      const { fakeDocument } = installPointerLockDom()
      return Effect.scoped(Effect.gen(function* () {
        const input = yield* InputService
        for (const code of ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
          const { prevented } = dispatchKey(fakeDocument, code, null)
          expect(prevented).toBe(1)
          expect(yield* input.isKeyPressed(code)).toBe(true)
        }
      }).pipe(Effect.provide(InputService.Default)))
    })

    it.effect('does NOT preventDefault while a text input is focused (preserves world-name typing)', () => {
      const { fakeDocument } = installPointerLockDom()
      return Effect.scoped(Effect.gen(function* () {
        const input = yield* InputService
        const { prevented } = dispatchKey(fakeDocument, 'Space', { tagName: 'INPUT', isContentEditable: false })
        expect(prevented).toBe(0)
        void input
      }).pipe(Effect.provide(InputService.Default)))
    })

    it.effect('does NOT preventDefault for non-blocked keys like WASD', () => {
      const { fakeDocument } = installPointerLockDom()
      return Effect.scoped(Effect.gen(function* () {
        const input = yield* InputService
        const { prevented } = dispatchKey(fakeDocument, 'KeyW', null)
        expect(prevented).toBe(0)
        expect(yield* input.isKeyPressed('KeyW')).toBe(true)
      }).pipe(Effect.provide(InputService.Default)))
    })
  })

  describe('PlayerInputServiceLive', () => {
    it.effect('should delegate to the input service implementation', () => {
      const pressedKeys = MutableHashSet.empty<string>()
      MutableHashSet.add(pressedKeys, 'KeyW')
      const justPressedKeys = MutableHashSet.empty<string>()
      MutableHashSet.add(justPressedKeys, 'KeyW')
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      const inputLayer = createTestLayer(createTestInputService({ pressedKeys, justPressedKeys, mouseButtons, pointerLocked: true }))
      const testLayer = PlayerInputServiceLive.pipe(Layer.provide(inputLayer))

      return Effect.gen(function* () {
        const playerInput = yield* PlayerInputService
        const keyPressed = yield* playerInput.isKeyPressed('KeyW')
        const pointerLocked = yield* playerInput.isPointerLocked()
        const buttonPressed = yield* playerInput.consumeKeyPress('KeyW')

        expect(keyPressed).toBe(true)
        expect(pointerLocked).toBe(true)
        expect(buttonPressed).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('isMouseDown', () => {
    it.effect('should return false when no buttons are pressed', () => {
      const service = createTestInputService()
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const leftPressed = yield* input.isMouseDown(MouseButton.LEFT)
        const rightPressed = yield* input.isMouseDown(MouseButton.RIGHT)
        const middlePressed = yield* input.isMouseDown(MouseButton.MIDDLE)
        expect(leftPressed).toBe(false)
        expect(rightPressed).toBe(false)
        expect(middlePressed).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return true for left mouse button when pressed', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.isMouseDown(MouseButton.LEFT)
        expect(result).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return true for right mouse button when pressed', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.RIGHT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.isMouseDown(MouseButton.RIGHT)
        expect(result).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return true for middle mouse button when pressed', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.MIDDLE, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.isMouseDown(MouseButton.MIDDLE)
        expect(result).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return false for unpressed button when other buttons are pressed', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      MutableHashMap.set(mouseButtons, MouseButton.RIGHT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.isMouseDown(MouseButton.MIDDLE)
        expect(result).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return false for invalid button number', () => {
      const service = createTestInputService()
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.isMouseDown(99)
        expect(result).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should track multiple buttons simultaneously', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      MutableHashMap.set(mouseButtons, MouseButton.RIGHT, true)
      MutableHashMap.set(mouseButtons, MouseButton.MIDDLE, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const left = yield* input.isMouseDown(MouseButton.LEFT)
        const right = yield* input.isMouseDown(MouseButton.RIGHT)
        const middle = yield* input.isMouseDown(MouseButton.MIDDLE)
        expect(left).toBe(true)
        expect(right).toBe(true)
        expect(middle).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return false for button explicitly set to false', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, false)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.isMouseDown(MouseButton.LEFT)
        expect(result).toBe(false)
      }).pipe(Effect.provide(layer))
    })
  })

  describe('MouseButton constants', () => {
    it('should have LEFT as 0', () => {
      expect(MouseButton.LEFT).toBe(0)
    })

    it('should have MIDDLE as 1', () => {
      expect(MouseButton.MIDDLE).toBe(1)
    })

    it('should have RIGHT as 2', () => {
      expect(MouseButton.RIGHT).toBe(2)
    })

    it('should be readonly values', () => {
      // TypeScript enforces readonly at compile time
      // At runtime, we verify the expected values exist
      const buttons = [MouseButton.LEFT, MouseButton.MIDDLE, MouseButton.RIGHT]
      expect(buttons).toEqual([0, 1, 2])
    })
  })

  describe('mousedown/mouseup transitions', () => {
    it.effect('should simulate button press and release (state change)', () => {
      // Test that state can transition from pressed to not pressed
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)

      const servicePressed = createTestInputService({ mouseButtons })
      const layerPressed = createTestLayer(servicePressed)

      return Effect.gen(function* () {
        const inputPressed = yield* InputService
        const resultPressed = yield* inputPressed.isMouseDown(MouseButton.LEFT)
        expect(resultPressed).toBe(true)
      }).pipe(Effect.provide(layerPressed))
    })

    it.effect('should simulate button release after press', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, false)

      const serviceReleased = createTestInputService({ mouseButtons })
      const layerReleased = createTestLayer(serviceReleased)

      return Effect.gen(function* () {
        const inputReleased = yield* InputService
        const resultReleased = yield* inputReleased.isMouseDown(MouseButton.LEFT)
        expect(resultReleased).toBe(false)
      }).pipe(Effect.provide(layerReleased))
    })

    it('should handle rapid press/release cycles', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()

      // Press
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      const service1 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service1.isMouseDown(MouseButton.LEFT))).toBe(true)

      // Release
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, false)
      const service2 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service2.isMouseDown(MouseButton.LEFT))).toBe(false)

      // Press again
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      const service3 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service3.isMouseDown(MouseButton.LEFT))).toBe(true)

      // Release again
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, false)
      const service4 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service4.isMouseDown(MouseButton.LEFT))).toBe(false)
    })

    it('should handle independent button state transitions', () => {
      // Test that buttons can be pressed/released independently
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      MutableHashMap.set(mouseButtons, MouseButton.RIGHT, true)

      const serviceBoth = createTestInputService({ mouseButtons })
      expect(Effect.runSync(serviceBoth.isMouseDown(MouseButton.LEFT))).toBe(true)
      expect(Effect.runSync(serviceBoth.isMouseDown(MouseButton.RIGHT))).toBe(true)

      // Release only left
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, false)
      const serviceRightOnly = createTestInputService({ mouseButtons })
      expect(Effect.runSync(serviceRightOnly.isMouseDown(MouseButton.LEFT))).toBe(false)
      expect(Effect.runSync(serviceRightOnly.isMouseDown(MouseButton.RIGHT))).toBe(true)

      // Press left again, release right
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      MutableHashMap.set(mouseButtons, MouseButton.RIGHT, false)
      const serviceLeftOnly = createTestInputService({ mouseButtons })
      expect(Effect.runSync(serviceLeftOnly.isMouseDown(MouseButton.LEFT))).toBe(true)
      expect(Effect.runSync(serviceLeftOnly.isMouseDown(MouseButton.RIGHT))).toBe(false)
    })
  })

  describe('isMouseDown with Effect composition', () => {
    it.effect('should work with Effect.gen', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const isPressed = yield* input.isMouseDown(MouseButton.LEFT)
        expect(isPressed).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should work with Effect.all for checking multiple buttons', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      MutableHashMap.set(mouseButtons, MouseButton.RIGHT, false)
      MutableHashMap.set(mouseButtons, MouseButton.MIDDLE, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const [left, right, middle] = yield* Effect.all([
          input.isMouseDown(MouseButton.LEFT),
          input.isMouseDown(MouseButton.RIGHT),
          input.isMouseDown(MouseButton.MIDDLE),
        ])
        expect(left).toBe(true)
        expect(right).toBe(false)
        expect(middle).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should work with Effect.map for transformations', () => {
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      MutableHashMap.set(mouseButtons, MouseButton.LEFT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const pressed = yield* input.isMouseDown(MouseButton.LEFT)
        const result = pressed ? 'LEFT_PRESSED' : 'LEFT_NOT_PRESSED'
        expect(result).toBe('LEFT_PRESSED')
      }).pipe(Effect.provide(layer))
    })
  })

  describe('InputService interface completeness', () => {
    it('should implement all required methods', () => {
      const service = createTestInputService()

      // Verify all interface methods exist
      expect(typeof service.isKeyPressed).toBe('function')
      expect(typeof service.consumeKeyPress).toBe('function')
      expect(typeof service.getMouseDelta).toBe('function')
      expect(typeof service.isMouseDown).toBe('function')
      expect(typeof service.requestPointerLock).toBe('function')
      expect(typeof service.exitPointerLock).toBe('function')
      expect(typeof service.isPointerLocked).toBe('function')
      expect(typeof service.consumeMouseClick).toBe('function')
      expect(typeof service.consumeWheelDelta).toBe('function')
    })

    it('should return Effect for isMouseDown', () => {
      const service = createTestInputService()
      const effect = service.isMouseDown(MouseButton.LEFT)

      // Verify it returns an Effect (Effect objects have pipe method)
      expect(typeof effect.pipe).toBe('function')
    })
  })
})
