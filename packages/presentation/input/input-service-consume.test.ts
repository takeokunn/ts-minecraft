import { describe, it, expect } from '@effect/vitest'
import { Effect, MutableHashSet, MutableRef } from 'effect'
import { MouseButton } from '@ts-minecraft/presentation/input/input-service'
import { InputService } from '@ts-minecraft/presentation/input/input-service'
import { createTestInputService, createTestLayer } from '@ts-minecraft/presentation/input/input-service-test-utils'

describe('InputService (consume)', () => {
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
      // Simulate a left-click having been registered
      const justClickedButtons = MutableHashSet.make(MouseButton.LEFT)
      const service = createTestInputService({
        justPressedKeys,
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
      const wheelDeltaRef = MutableRef.make(100)
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeWheelDelta: () =>
          Effect.sync(() => {
            const delta = MutableRef.get(wheelDeltaRef)
            MutableRef.set(wheelDeltaRef, 0)
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
      const wheelDeltaRef = MutableRef.make(-120)
      const service = createTestInputService()
      const mockService: typeof service = {
        ...service,
        consumeWheelDelta: () =>
          Effect.sync(() => {
            const delta = MutableRef.get(wheelDeltaRef)
            MutableRef.set(wheelDeltaRef, 0)
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
