import { Schema } from '@effect/schema'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import {
  InputEvent,
  InputEventType,
  InputHandlerRegistrationError,
  InputHandlerRegistrationErrorSchema,
  InputSystemError,
  InputSystemErrorSchema,
  KeyState,
  MouseButtonState,
  MouseDelta,
} from '../types'

describe('Input Types', () => {
  describe('MouseDelta', () => {
    it.effect('should validate valid mouse delta', () =>
      Effect.gen(function* () {
        const validDelta = {
          deltaX: 10.5,
          deltaY: -5.2,
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(MouseDelta)(validDelta)
        expect(result).toEqual(validDelta)
      })
    )

    it.effect('should reject negative timestamp', () =>
      Effect.gen(function* () {
        const invalidDelta = {
          deltaX: 10.5,
          deltaY: -5.2,
          timestamp: -1,
        }

        expect(() => Schema.decodeUnknownSync(MouseDelta)(invalidDelta)).toThrow()
      })
    )

    it.effect('should reject zero timestamp', () =>
      Effect.gen(function* () {
        const invalidDelta = {
          deltaX: 10.5,
          deltaY: -5.2,
          timestamp: 0,
        }

        expect(() => Schema.decodeUnknownSync(MouseDelta)(invalidDelta)).toThrow()
      })
    )

    it.effect('should handle zero delta values', () =>
      Effect.gen(function* () {
        const validDelta = {
          deltaX: 0,
          deltaY: 0,
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(MouseDelta)(validDelta)
        expect(result).toEqual(validDelta)
      })
    )
  })

  describe('KeyState', () => {
    it.effect('should validate valid key state', () =>
      Effect.gen(function* () {
        const validKeyState = {
          key: 'w',
          isPressed: true,
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(KeyState)(validKeyState)
        expect(result).toEqual(validKeyState)
      })
    )

    it.effect('should reject empty key', () =>
      Effect.gen(function* () {
        const invalidKeyState = {
          key: '',
          isPressed: true,
          timestamp: 1234567890,
        }

        expect(() => Schema.decodeUnknownSync(KeyState)(invalidKeyState)).toThrow()
      })
    )

    it.effect('should validate multi-character keys', () =>
      Effect.gen(function* () {
        const validKeyState = {
          key: 'Space',
          isPressed: false,
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(KeyState)(validKeyState)
        expect(result).toEqual(validKeyState)
      })
    )
  })

  describe('MouseButtonState', () => {
    it.effect('should validate valid mouse button states', () =>
      Effect.gen(function* () {
        const validButtons = [0, 1, 2] // left, middle, right

        validButtons.forEach((button) => {
          const validButtonState = {
            button,
            isPressed: true,
            timestamp: 1234567890,
          }

          const result = Schema.decodeUnknownSync(MouseButtonState)(validButtonState)
          expect(result).toEqual(validButtonState)
        })
      })
    )

    it.effect('should reject invalid button numbers', () =>
      Effect.gen(function* () {
        const invalidButtons = [-1, 3, 1.5, 'left']

        invalidButtons.forEach((button) => {
          const invalidButtonState = {
            button,
            isPressed: true,
            timestamp: 1234567890,
          }

          expect(() => Schema.decodeUnknownSync(MouseButtonState)(invalidButtonState)).toThrow()
        })
      })
    )
  })

  describe('InputEventType', () => {
    it.effect('should validate all valid input event types', () =>
      Effect.gen(function* () {
        const validTypes = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove']

        validTypes.forEach((type) => {
          const result = Schema.decodeUnknownSync(InputEventType)(type)
          expect(result).toBe(type)
        })
      })
    )

    it.effect('should reject invalid event types', () =>
      Effect.gen(function* () {
        const invalidTypes = ['click', 'hover', 'scroll', '', null, undefined]

        invalidTypes.forEach((type) => {
          expect(() => Schema.decodeUnknownSync(InputEventType)(type)).toThrow()
        })
      })
    )
  })

  describe('InputEvent', () => {
    it.effect('should validate key event', () =>
      Effect.gen(function* () {
        const validKeyEvent = {
          type: 'keydown' as const,
          key: 'w',
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(InputEvent)(validKeyEvent)
        expect(result).toEqual(validKeyEvent)
      })
    )

    it.effect('should validate mouse event', () =>
      Effect.gen(function* () {
        const validMouseEvent = {
          type: 'mousedown' as const,
          button: 0,
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(InputEvent)(validMouseEvent)
        expect(result).toEqual(validMouseEvent)
      })
    )

    it.effect('should validate mouse move event', () =>
      Effect.gen(function* () {
        const validMouseMoveEvent = {
          type: 'mousemove' as const,
          delta: {
            deltaX: 10.5,
            deltaY: -5.2,
            timestamp: 1234567890,
          },
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(InputEvent)(validMouseMoveEvent)
        expect(result).toEqual(validMouseMoveEvent)
      })
    )

    it.effect('should validate event with all optional fields', () =>
      Effect.gen(function* () {
        const validComplexEvent = {
          type: 'keydown' as const,
          key: 'Space',
          button: 0,
          delta: {
            deltaX: 0,
            deltaY: 0,
            timestamp: 1234567890,
          },
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(InputEvent)(validComplexEvent)
        expect(result).toEqual(validComplexEvent)
      })
    )

    it.effect('should validate minimal event', () =>
      Effect.gen(function* () {
        const validMinimalEvent = {
          type: 'keyup' as const,
          timestamp: 1234567890,
        }

        const result = Schema.decodeUnknownSync(InputEvent)(validMinimalEvent)
        expect(result).toEqual(validMinimalEvent)
      })
    )
  })

  describe('InputSystemError', () => {
    it.effect('should create input system error correctly', () =>
      Effect.gen(function* () {
        const error = InputSystemError({
          message: 'Key not found',
          key: 'invalid-key',
        })

        expect(error._tag).toBe('InputSystemError')
        expect(error.message).toBe('Key not found')
        expect(error.key).toBe('invalid-key')
        expect(error.button).toBeUndefined()
      })
    )

    it.effect('should create error with button', () =>
      Effect.gen(function* () {
        const error = InputSystemError({
          message: 'Invalid button',
          button: 5,
        })

        expect(error._tag).toBe('InputSystemError')
        expect(error.message).toBe('Invalid button')
        expect(error.button).toBe(5)
        expect(error.key).toBeUndefined()
      })
    )

    it.effect('should validate against schema', () =>
      Effect.gen(function* () {
        const error = InputSystemError({
          message: 'Test error',
        })

        const result = Schema.decodeUnknownSync(InputSystemErrorSchema)(error)
        expect(result).toEqual(error)
      })
    )

    it.effect('should reject invalid error structure', () =>
      Effect.gen(function* () {
        const invalidError = {
          message: 'Test error',
          // missing _tag
        }

        expect(() => Schema.decodeUnknownSync(InputSystemErrorSchema)(invalidError)).toThrow()
      })
    )
  })

  describe('InputHandlerRegistrationError', () => {
    it.effect('should create handler registration error correctly', () =>
      Effect.gen(function* () {
        const error = InputHandlerRegistrationError({
          message: 'Handler already registered',
          handlerId: 'handler-123',
        })

        expect(error._tag).toBe('InputHandlerRegistrationError')
        expect(error.message).toBe('Handler already registered')
        expect(error.handlerId).toBe('handler-123')
      })
    )

    it.effect('should create error without handler id', () =>
      Effect.gen(function* () {
        const error = InputHandlerRegistrationError({
          message: 'Registration failed',
        })

        expect(error._tag).toBe('InputHandlerRegistrationError')
        expect(error.message).toBe('Registration failed')
        expect(error.handlerId).toBeUndefined()
      })
    )

    it.effect('should validate against schema', () =>
      Effect.gen(function* () {
        const error = InputHandlerRegistrationError({
          message: 'Test registration error',
          handlerId: 'test-handler',
        })

        const result = Schema.decodeUnknownSync(InputHandlerRegistrationErrorSchema)(error)
        expect(result).toEqual(error)
      })
    )
  })
})
