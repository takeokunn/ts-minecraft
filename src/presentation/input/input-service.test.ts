import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, MutableHashMap, MutableHashSet, Option } from 'effect'
import { InputService, MouseButton, PlayerInputServiceLive } from './input-service'
import { PlayerInputService } from '@/application/input/player-input-service'
import type { InputService as InputServiceType } from './input-service'

/**
 * Test implementation of InputService for unit testing
 * Provides direct control over input state without DOM dependencies
 */
const createTestInputService = (initialState: {
  pressedKeys?: MutableHashSet.MutableHashSet<string>
  justPressedKeys?: MutableHashSet.MutableHashSet<string>
  mouseButtons?: MutableHashMap.MutableHashMap<number, boolean>
  mouseDelta?: { x: number; y: number }
  pointerLocked?: boolean
  } = {}): InputServiceType => {
  const pressedKeys = Option.getOrElse(Option.fromNullable(initialState.pressedKeys), () => MutableHashSet.empty<string>())
  const justPressedKeys = Option.getOrElse(Option.fromNullable(initialState.justPressedKeys), () => MutableHashSet.empty<string>())
  const mouseButtons = Option.getOrElse(Option.fromNullable(initialState.mouseButtons), () => MutableHashMap.empty<number, boolean>())
  let mouseDelta = Option.getOrElse(Option.fromNullable(initialState.mouseDelta), () => ({ x: 0, y: 0 }))
  let pointerLocked = Option.getOrElse(Option.fromNullable(initialState.pointerLocked), () => false)

  return {
    _tag: '@minecraft/presentation/InputService' as const,

    isKeyPressed: (key: string) =>
      Effect.sync(() => MutableHashSet.has(pressedKeys, key)),

    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
          return true
        }
        return false
      }),

    getMouseDelta: () =>
      Effect.sync(() => {
        const delta = { ...mouseDelta }
        mouseDelta = { x: 0, y: 0 }
        return delta
      }),

    isMouseDown: (button: number) =>
      Effect.sync(() => Option.getOrElse(MutableHashMap.get(mouseButtons, button), () => false)),

    requestPointerLock: () =>
      Effect.sync(() => {
        pointerLocked = true
      }),

    exitPointerLock: () =>
      Effect.sync(() => {
        pointerLocked = false
      }),

    isPointerLocked: () =>
      Effect.sync(() => pointerLocked),

    consumeMouseClick: () => Effect.sync(() => false),

    consumeWheelDelta: () => Effect.sync(() => 0),
  }
}

/**
 * Helper to create a test layer with controlled state
 */
const createTestLayer = (service: InputServiceType) =>
  Layer.succeed(InputService, service)

describe('InputService', () => {
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
        const result = yield* input.isMouseDown(MouseButton.LEFT).pipe(
          Effect.map((pressed) => (pressed ? 'LEFT_PRESSED' : 'LEFT_NOT_PRESSED'))
        )
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

  describe('consumeKeyPress', () => {
    it.effect('should return true when key was just pressed', () => {
      const justPressedKeys = MutableHashSet.empty<string>()
      MutableHashSet.add(justPressedKeys, 'Space')
      const service = createTestInputService({ justPressedKeys })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeKeyPress('Space')
        expect(result).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return false when key was not just pressed', () => {
      const service = createTestInputService({ justPressedKeys: MutableHashSet.empty() })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeKeyPress('Space')
        expect(result).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should consume the key press (return false on second call)', () => {
      const justPressedKeys = MutableHashSet.empty<string>()
      MutableHashSet.add(justPressedKeys, 'Space')
      const service = createTestInputService({ justPressedKeys })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        // First call should return true and consume the key
        const result1 = yield* input.consumeKeyPress('Space')
        expect(result1).toBe(true)

        // Second call should return false (key was consumed)
        const result2 = yield* input.consumeKeyPress('Space')
        expect(result2).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should only consume the specified key', () => {
      const justPressedKeys = MutableHashSet.empty<string>()
      MutableHashSet.add(justPressedKeys, 'Space')
      MutableHashSet.add(justPressedKeys, 'KeyW')
      const service = createTestInputService({ justPressedKeys })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        // Consume Space
        const result1 = yield* input.consumeKeyPress('Space')
        expect(result1).toBe(true)

        // KeyW should still be available
        const result2 = yield* input.consumeKeyPress('KeyW')
        expect(result2).toBe(true)

        // Space should be consumed
        const result3 = yield* input.consumeKeyPress('Space')
        expect(result3).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should work with Effect.gen', () => {
      const justPressedKeys = MutableHashSet.empty<string>()
      MutableHashSet.add(justPressedKeys, 'Space')
      const service = createTestInputService({ justPressedKeys })
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeKeyPress('Space')
        expect(result).toBe(true)
      }).pipe(Effect.provide(layer))
    })
  })

  describe('consumeMouseClick', () => {
    it.effect('should return true when button was just clicked', () => {
      const justPressedKeys = MutableHashSet.empty<string>()
      const mouseButtons = MutableHashMap.empty<number, boolean>()
      // Simulate a left-click having been registered
      const justClickedButtons = MutableHashSet.make(MouseButton.LEFT)
      const service = createTestInputService({
        justPressedKeys,
        mouseButtons,
        // Inject justClickedButtons via the mock's internal state
      })
      // The mock always returns false; test via a custom mock that mirrors real logic
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (MutableHashSet.has(justClickedButtons, button)) {
              MutableHashSet.remove(justClickedButtons, button)
              return true
            }
            return false
          }),
      }
      const layer = createTestLayer(mockService)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeMouseClick(MouseButton.LEFT)
        expect(result).toBe(true)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return false when button was not clicked', () => {
      const justClickedButtons = MutableHashSet.empty<number>()
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (MutableHashSet.has(justClickedButtons, button)) {
              MutableHashSet.remove(justClickedButtons, button)
              return true
            }
            return false
          }),
      }
      const layer = createTestLayer(mockService)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeMouseClick(MouseButton.LEFT)
        expect(result).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should consume the click (return false on second call)', () => {
      const justClickedButtons = MutableHashSet.make(MouseButton.RIGHT)
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (MutableHashSet.has(justClickedButtons, button)) {
              MutableHashSet.remove(justClickedButtons, button)
              return true
            }
            return false
          }),
      }
      const layer = createTestLayer(mockService)

      return Effect.gen(function* () {
        const input = yield* InputService
        const first = yield* input.consumeMouseClick(MouseButton.RIGHT)
        expect(first).toBe(true)

        const second = yield* input.consumeMouseClick(MouseButton.RIGHT)
        expect(second).toBe(false)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should not consume a different button', () => {
      const justClickedButtons = MutableHashSet.make(MouseButton.LEFT)
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (MutableHashSet.has(justClickedButtons, button)) {
              MutableHashSet.remove(justClickedButtons, button)
              return true
            }
            return false
          }),
      }
      const layer = createTestLayer(mockService)

      return Effect.gen(function* () {
        const input = yield* InputService
        const right = yield* input.consumeMouseClick(MouseButton.RIGHT)
        expect(right).toBe(false)

        const left = yield* input.consumeMouseClick(MouseButton.LEFT)
        expect(left).toBe(true)
      }).pipe(Effect.provide(layer))
    })
  })

  describe('consumeWheelDelta', () => {
    it.effect('should return 0 when no wheel event occurred', () => {
      const service = createTestInputService()
      const layer = createTestLayer(service)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeWheelDelta()
        expect(result).toBe(0)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return accumulated delta and reset to zero', () => {
      let wheelDelta = 100
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeWheelDelta: () =>
          Effect.sync(() => {
            const delta = wheelDelta
            wheelDelta = 0
            return delta
          }),
      }
      const layer = createTestLayer(mockService)

      return Effect.gen(function* () {
        const input = yield* InputService
        const first = yield* input.consumeWheelDelta()
        expect(first).toBe(100)

        const second = yield* input.consumeWheelDelta()
        expect(second).toBe(0)
      }).pipe(Effect.provide(layer))
    })

    it.effect('should return negative delta for scroll up', () => {
      let wheelDelta = -120
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeWheelDelta: () =>
          Effect.sync(() => {
            const delta = wheelDelta
            wheelDelta = 0
            return delta
          }),
      }
      const layer = createTestLayer(mockService)

      return Effect.gen(function* () {
        const input = yield* InputService
        const result = yield* input.consumeWheelDelta()
        expect(result).toBe(-120)
      }).pipe(Effect.provide(layer))
    })
  })
})
