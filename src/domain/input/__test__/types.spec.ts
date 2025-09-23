import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import {
  MouseDelta,
  KeyState,
  MouseButtonState,
  InputEventType,
  InputEvent,
  InputSystemError,
  InputSystemErrorSchema,
  InputHandlerRegistrationError,
  InputHandlerRegistrationErrorSchema,
} from '../types'

describe('Input Types', () => {
  describe('MouseDelta', () => {
    it('should validate valid mouse delta', () => {
      const validDelta = {
        deltaX: 10.5,
        deltaY: -5.2,
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(MouseDelta)(validDelta)
      expect(result).toEqual(validDelta)
    })

    it('should reject negative timestamp', () => {
      const invalidDelta = {
        deltaX: 10.5,
        deltaY: -5.2,
        timestamp: -1,
      }

      expect(() => Schema.decodeUnknownSync(MouseDelta)(invalidDelta)).toThrow()
    })

    it('should reject zero timestamp', () => {
      const invalidDelta = {
        deltaX: 10.5,
        deltaY: -5.2,
        timestamp: 0,
      }

      expect(() => Schema.decodeUnknownSync(MouseDelta)(invalidDelta)).toThrow()
    })

    it('should handle zero delta values', () => {
      const validDelta = {
        deltaX: 0,
        deltaY: 0,
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(MouseDelta)(validDelta)
      expect(result).toEqual(validDelta)
    })
  })

  describe('KeyState', () => {
    it('should validate valid key state', () => {
      const validKeyState = {
        key: 'w',
        isPressed: true,
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(KeyState)(validKeyState)
      expect(result).toEqual(validKeyState)
    })

    it('should reject empty key', () => {
      const invalidKeyState = {
        key: '',
        isPressed: true,
        timestamp: 1234567890,
      }

      expect(() => Schema.decodeUnknownSync(KeyState)(invalidKeyState)).toThrow()
    })

    it('should validate multi-character keys', () => {
      const validKeyState = {
        key: 'Space',
        isPressed: false,
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(KeyState)(validKeyState)
      expect(result).toEqual(validKeyState)
    })
  })

  describe('MouseButtonState', () => {
    it('should validate valid mouse button states', () => {
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

    it('should reject invalid button numbers', () => {
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
  })

  describe('InputEventType', () => {
    it('should validate all valid input event types', () => {
      const validTypes = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove']

      validTypes.forEach((type) => {
        const result = Schema.decodeUnknownSync(InputEventType)(type)
        expect(result).toBe(type)
      })
    })

    it('should reject invalid event types', () => {
      const invalidTypes = ['click', 'hover', 'scroll', '', null, undefined]

      invalidTypes.forEach((type) => {
        expect(() => Schema.decodeUnknownSync(InputEventType)(type)).toThrow()
      })
    })
  })

  describe('InputEvent', () => {
    it('should validate key event', () => {
      const validKeyEvent = {
        type: 'keydown' as const,
        key: 'w',
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(InputEvent)(validKeyEvent)
      expect(result).toEqual(validKeyEvent)
    })

    it('should validate mouse event', () => {
      const validMouseEvent = {
        type: 'mousedown' as const,
        button: 0,
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(InputEvent)(validMouseEvent)
      expect(result).toEqual(validMouseEvent)
    })

    it('should validate mouse move event', () => {
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

    it('should validate event with all optional fields', () => {
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

    it('should validate minimal event', () => {
      const validMinimalEvent = {
        type: 'keyup' as const,
        timestamp: 1234567890,
      }

      const result = Schema.decodeUnknownSync(InputEvent)(validMinimalEvent)
      expect(result).toEqual(validMinimalEvent)
    })
  })

  describe('InputSystemError', () => {
    it('should create input system error correctly', () => {
      const error = InputSystemError({
        message: 'Key not found',
        key: 'invalid-key',
      })

      expect(error._tag).toBe('InputSystemError')
      expect(error.message).toBe('Key not found')
      expect(error.key).toBe('invalid-key')
      expect(error.button).toBeUndefined()
    })

    it('should create error with button', () => {
      const error = InputSystemError({
        message: 'Invalid button',
        button: 5,
      })

      expect(error._tag).toBe('InputSystemError')
      expect(error.message).toBe('Invalid button')
      expect(error.button).toBe(5)
      expect(error.key).toBeUndefined()
    })

    it('should validate against schema', () => {
      const error = InputSystemError({
        message: 'Test error',
      })

      const result = Schema.decodeUnknownSync(InputSystemErrorSchema)(error)
      expect(result).toEqual(error)
    })

    it('should reject invalid error structure', () => {
      const invalidError = {
        message: 'Test error',
        // missing _tag
      }

      expect(() => Schema.decodeUnknownSync(InputSystemErrorSchema)(invalidError)).toThrow()
    })
  })

  describe('InputHandlerRegistrationError', () => {
    it('should create handler registration error correctly', () => {
      const error = InputHandlerRegistrationError({
        message: 'Handler already registered',
        handlerId: 'handler-123',
      })

      expect(error._tag).toBe('InputHandlerRegistrationError')
      expect(error.message).toBe('Handler already registered')
      expect(error.handlerId).toBe('handler-123')
    })

    it('should create error without handler id', () => {
      const error = InputHandlerRegistrationError({
        message: 'Registration failed',
      })

      expect(error._tag).toBe('InputHandlerRegistrationError')
      expect(error.message).toBe('Registration failed')
      expect(error.handlerId).toBeUndefined()
    })

    it('should validate against schema', () => {
      const error = InputHandlerRegistrationError({
        message: 'Test registration error',
        handlerId: 'test-handler',
      })

      const result = Schema.decodeUnknownSync(InputHandlerRegistrationErrorSchema)(error)
      expect(result).toEqual(error)
    })
  })
})
