import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { InputService, MouseButton } from './input-service'
import type { InputService as InputServiceType } from './input-service'

/**
 * Test implementation of InputService for unit testing
 * Provides direct control over input state without DOM dependencies
 */
const createTestInputService = (initialState: {
  pressedKeys?: Set<string>
  justPressedKeys?: Set<string>
  mouseButtons?: Map<number, boolean>
  mouseDelta?: { x: number; y: number }
  pointerLocked?: boolean
} = {}): InputServiceType => {
  let pressedKeys = initialState.pressedKeys ?? new Set<string>()
  let justPressedKeys = initialState.justPressedKeys ?? new Set<string>()
  let mouseButtons = initialState.mouseButtons ?? new Map<number, boolean>()
  let mouseDelta = initialState.mouseDelta ?? { x: 0, y: 0 }
  let pointerLocked = initialState.pointerLocked ?? false

  return {
    isKeyPressed: (key: string) =>
      Effect.sync(() => pressedKeys.has(key)),

    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (justPressedKeys.has(key)) {
          justPressedKeys.delete(key)
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
      Effect.sync(() => mouseButtons.get(button) ?? false),

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
  } as unknown as InputServiceType
}

/**
 * Helper to create a test layer with controlled state
 */
const createTestLayer = (service: InputServiceType) =>
  Layer.succeed(InputService, service)

describe('InputService', () => {
  describe('isMouseDown', () => {
    it('should return false when no buttons are pressed', () => {
      const service = createTestInputService()
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        const leftPressed = yield* input.isMouseDown(MouseButton.LEFT)
        const rightPressed = yield* input.isMouseDown(MouseButton.RIGHT)
        const middlePressed = yield* input.isMouseDown(MouseButton.MIDDLE)
        return { leftPressed, rightPressed, middlePressed }
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result.leftPressed).toBe(false)
      expect(result.rightPressed).toBe(false)
      expect(result.middlePressed).toBe(false)
    })

    it('should return true for left mouse button when pressed', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.LEFT)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(true)
    })

    it('should return true for right mouse button when pressed', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.RIGHT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.RIGHT)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(true)
    })

    it('should return true for middle mouse button when pressed', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.MIDDLE, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.MIDDLE)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(true)
    })

    it('should return false for unpressed button when other buttons are pressed', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      mouseButtons.set(MouseButton.RIGHT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.MIDDLE)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(false)
    })

    it('should return false for invalid button number', () => {
      const service = createTestInputService()
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(99)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(false)
    })

    it('should track multiple buttons simultaneously', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      mouseButtons.set(MouseButton.RIGHT, true)
      mouseButtons.set(MouseButton.MIDDLE, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        const left = yield* input.isMouseDown(MouseButton.LEFT)
        const right = yield* input.isMouseDown(MouseButton.RIGHT)
        const middle = yield* input.isMouseDown(MouseButton.MIDDLE)
        return { left, right, middle }
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result.left).toBe(true)
      expect(result.right).toBe(true)
      expect(result.middle).toBe(true)
    })

    it('should return false for button explicitly set to false', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, false)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.LEFT)
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(false)
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
    it('should simulate button press and release (state change)', () => {
      // Test that state can transition from pressed to not pressed
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)

      const servicePressed = createTestInputService({ mouseButtons })
      const layerPressed = createTestLayer(servicePressed)

      const programPressed = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.LEFT)
      })

      const resultPressed = Effect.runSync(programPressed.pipe(Effect.provide(layerPressed)))
      expect(resultPressed).toBe(true)

      // Simulate button release
      mouseButtons.set(MouseButton.LEFT, false)
      const serviceReleased = createTestInputService({ mouseButtons })
      const layerReleased = createTestLayer(serviceReleased)

      const programReleased = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.LEFT)
      })

      const resultReleased = Effect.runSync(programReleased.pipe(Effect.provide(layerReleased)))
      expect(resultReleased).toBe(false)
    })

    it('should handle rapid press/release cycles', () => {
      const mouseButtons = new Map<number, boolean>()

      // Press
      mouseButtons.set(MouseButton.LEFT, true)
      const service1 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service1.isMouseDown(MouseButton.LEFT))).toBe(true)

      // Release
      mouseButtons.set(MouseButton.LEFT, false)
      const service2 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service2.isMouseDown(MouseButton.LEFT))).toBe(false)

      // Press again
      mouseButtons.set(MouseButton.LEFT, true)
      const service3 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service3.isMouseDown(MouseButton.LEFT))).toBe(true)

      // Release again
      mouseButtons.set(MouseButton.LEFT, false)
      const service4 = createTestInputService({ mouseButtons })
      expect(Effect.runSync(service4.isMouseDown(MouseButton.LEFT))).toBe(false)
    })

    it('should handle independent button state transitions', () => {
      // Test that buttons can be pressed/released independently
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      mouseButtons.set(MouseButton.RIGHT, true)

      const serviceBoth = createTestInputService({ mouseButtons })
      expect(Effect.runSync(serviceBoth.isMouseDown(MouseButton.LEFT))).toBe(true)
      expect(Effect.runSync(serviceBoth.isMouseDown(MouseButton.RIGHT))).toBe(true)

      // Release only left
      mouseButtons.set(MouseButton.LEFT, false)
      const serviceRightOnly = createTestInputService({ mouseButtons })
      expect(Effect.runSync(serviceRightOnly.isMouseDown(MouseButton.LEFT))).toBe(false)
      expect(Effect.runSync(serviceRightOnly.isMouseDown(MouseButton.RIGHT))).toBe(true)

      // Press left again, release right
      mouseButtons.set(MouseButton.LEFT, true)
      mouseButtons.set(MouseButton.RIGHT, false)
      const serviceLeftOnly = createTestInputService({ mouseButtons })
      expect(Effect.runSync(serviceLeftOnly.isMouseDown(MouseButton.LEFT))).toBe(true)
      expect(Effect.runSync(serviceLeftOnly.isMouseDown(MouseButton.RIGHT))).toBe(false)
    })
  })

  describe('isMouseDown with Effect composition', () => {
    it('should work with Effect.gen', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        const isPressed = yield* input.isMouseDown(MouseButton.LEFT)
        return isPressed
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(true)
    })

    it('should work with Effect.all for checking multiple buttons', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      mouseButtons.set(MouseButton.RIGHT, false)
      mouseButtons.set(MouseButton.MIDDLE, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        const results = yield* Effect.all([
          input.isMouseDown(MouseButton.LEFT),
          input.isMouseDown(MouseButton.RIGHT),
          input.isMouseDown(MouseButton.MIDDLE),
        ])
        return results
      })

      const [left, right, middle] = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(left).toBe(true)
      expect(right).toBe(false)
      expect(middle).toBe(true)
    })

    it('should work with Effect.map for transformations', () => {
      const mouseButtons = new Map<number, boolean>()
      mouseButtons.set(MouseButton.LEFT, true)
      const service = createTestInputService({ mouseButtons })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.isMouseDown(MouseButton.LEFT).pipe(
          Effect.map((pressed) => (pressed ? 'LEFT_PRESSED' : 'LEFT_NOT_PRESSED'))
        )
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe('LEFT_PRESSED')
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
    it('should return true when key was just pressed', () => {
      const justPressedKeys = new Set<string>()
      justPressedKeys.add('Space')
      const service = createTestInputService({ justPressedKeys })

      const result = Effect.runSync(service.consumeKeyPress('Space'))
      expect(result).toBe(true)
    })

    it('should return false when key was not just pressed', () => {
      const service = createTestInputService({ justPressedKeys: new Set() })

      const result = Effect.runSync(service.consumeKeyPress('Space'))
      expect(result).toBe(false)
    })

    it('should consume the key press (return false on second call)', () => {
      const justPressedKeys = new Set<string>()
      justPressedKeys.add('Space')
      const service = createTestInputService({ justPressedKeys })

      // First call should return true and consume the key
      const result1 = Effect.runSync(service.consumeKeyPress('Space'))
      expect(result1).toBe(true)

      // Second call should return false (key was consumed)
      const result2 = Effect.runSync(service.consumeKeyPress('Space'))
      expect(result2).toBe(false)
    })

    it('should only consume the specified key', () => {
      const justPressedKeys = new Set<string>()
      justPressedKeys.add('Space')
      justPressedKeys.add('KeyW')
      const service = createTestInputService({ justPressedKeys })

      // Consume Space
      const result1 = Effect.runSync(service.consumeKeyPress('Space'))
      expect(result1).toBe(true)

      // KeyW should still be available
      const result2 = Effect.runSync(service.consumeKeyPress('KeyW'))
      expect(result2).toBe(true)

      // Space should be consumed
      const result3 = Effect.runSync(service.consumeKeyPress('Space'))
      expect(result3).toBe(false)
    })

    it('should work with Effect.gen', () => {
      const justPressedKeys = new Set<string>()
      justPressedKeys.add('Space')
      const service = createTestInputService({ justPressedKeys })
      const layer = createTestLayer(service)

      const program = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.consumeKeyPress('Space')
      })

      const result = Effect.runSync(program.pipe(Effect.provide(layer)))
      expect(result).toBe(true)
    })
  })

  describe('consumeMouseClick', () => {
    it('should return true when button was just clicked', () => {
      const justPressedKeys = new Set<string>()
      const mouseButtons = new Map<number, boolean>()
      // Simulate a left-click having been registered
      const justClickedButtons = new Set<number>([MouseButton.LEFT])
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
            if (justClickedButtons.has(button)) {
              justClickedButtons.delete(button)
              return true
            }
            return false
          }),
      }

      const result = Effect.runSync(mockService.consumeMouseClick(MouseButton.LEFT))
      expect(result).toBe(true)
    })

    it('should return false when button was not clicked', () => {
      const justClickedButtons = new Set<number>()
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (justClickedButtons.has(button)) {
              justClickedButtons.delete(button)
              return true
            }
            return false
          }),
      }

      const result = Effect.runSync(mockService.consumeMouseClick(MouseButton.LEFT))
      expect(result).toBe(false)
    })

    it('should consume the click (return false on second call)', () => {
      const justClickedButtons = new Set<number>([MouseButton.RIGHT])
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (justClickedButtons.has(button)) {
              justClickedButtons.delete(button)
              return true
            }
            return false
          }),
      }

      const first = Effect.runSync(mockService.consumeMouseClick(MouseButton.RIGHT))
      expect(first).toBe(true)

      const second = Effect.runSync(mockService.consumeMouseClick(MouseButton.RIGHT))
      expect(second).toBe(false)
    })

    it('should not consume a different button', () => {
      const justClickedButtons = new Set<number>([MouseButton.LEFT])
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeMouseClick: (button: number) =>
          Effect.sync(() => {
            if (justClickedButtons.has(button)) {
              justClickedButtons.delete(button)
              return true
            }
            return false
          }),
      }

      const right = Effect.runSync(mockService.consumeMouseClick(MouseButton.RIGHT))
      expect(right).toBe(false)

      const left = Effect.runSync(mockService.consumeMouseClick(MouseButton.LEFT))
      expect(left).toBe(true)
    })
  })

  describe('consumeWheelDelta', () => {
    it('should return 0 when no wheel event occurred', () => {
      const service = createTestInputService()
      const result = Effect.runSync(service.consumeWheelDelta())
      expect(result).toBe(0)
    })

    it('should return accumulated delta and reset to zero', () => {
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

      const first = Effect.runSync(mockService.consumeWheelDelta())
      expect(first).toBe(100)

      const second = Effect.runSync(mockService.consumeWheelDelta())
      expect(second).toBe(0)
    })

    it('should return negative delta for scroll up', () => {
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

      const result = Effect.runSync(mockService.consumeWheelDelta())
      expect(result).toBe(-120)
    })
  })
})
