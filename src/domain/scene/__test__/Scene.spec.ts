import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Schema } from 'effect'
import {
  SceneType,
  SceneData,
  SceneTransition,
  SceneTransitionError,
  SceneTransitionErrorSchema,
  SceneInitializationError,
  SceneInitializationErrorSchema,
  SceneCleanupError,
  SceneCleanupErrorSchema,
} from '../Scene'

describe('Scene', () => {
  describe('SceneType', () => {
    it('should validate valid scene types', () => {
      const validTypes = ['MainMenu', 'Game', 'Loading', 'Pause', 'Settings']

      validTypes.forEach((type) => {
        const result = Schema.decodeUnknownSync(SceneType)(type)
        expect(result).toBe(type)
      })
    })

    it('should reject invalid scene types', () => {
      const invalidTypes = ['Invalid', 'Unknown', '', null, undefined, 123]

      invalidTypes.forEach((type) => {
        expect(() => Schema.decodeUnknownSync(SceneType)(type)).toThrow()
      })
    })
  })

  describe('SceneData', () => {
    it('should validate valid scene data', () => {
      const validData = {
        id: 'test-scene-001',
        type: 'MainMenu' as const,
        isActive: true,
        metadata: { level: '1', difficulty: 'easy' },
      }

      const result = Schema.decodeUnknownSync(SceneData)(validData)
      expect(result).toEqual(validData)
    })

    it('should validate scene data without optional metadata', () => {
      const validData = {
        id: 'test-scene-002',
        type: 'Game' as const,
        isActive: false,
      }

      const result = Schema.decodeUnknownSync(SceneData)(validData)
      expect(result).toEqual(validData)
    })

    it('should reject invalid scene data', () => {
      const invalidDataList = [
        { type: 'MainMenu', isActive: true }, // missing id
        { id: 'test', isActive: true }, // missing type
        { id: 'test', type: 'MainMenu' }, // missing isActive
        { id: '', type: 'MainMenu', isActive: true }, // empty id
        { id: 'test', type: 'Invalid', isActive: true }, // invalid type
        { id: 'test', type: 'MainMenu', isActive: 'true' }, // invalid isActive type
      ]

      invalidDataList.forEach((data) => {
        expect(() => Schema.decodeUnknownSync(SceneData)(data)).toThrow()
      })
    })
  })

  describe('SceneTransition', () => {
    it('should validate valid scene transition with all fields', () => {
      const validTransition = {
        from: 'MainMenu' as const,
        to: 'Game' as const,
        duration: 1000,
        fadeType: 'fade' as const,
      }

      const result = Schema.decodeUnknownSync(SceneTransition)(validTransition)
      expect(result).toEqual(validTransition)
    })

    it('should validate scene transition with only required fields', () => {
      const minimalTransition = {
        to: 'Loading' as const,
      }

      const result = Schema.decodeUnknownSync(SceneTransition)(minimalTransition)
      expect(result).toEqual(minimalTransition)
    })

    it('should reject negative duration', () => {
      const invalidTransition = {
        to: 'Game' as const,
        duration: -100,
      }

      expect(() => Schema.decodeUnknownSync(SceneTransition)(invalidTransition)).toThrow()
    })

    it('should reject invalid fadeType', () => {
      const invalidTransition = {
        to: 'Game' as const,
        fadeType: 'invalid',
      }

      expect(() => Schema.decodeUnknownSync(SceneTransition)(invalidTransition)).toThrow()
    })
  })

  describe('SceneTransitionError', () => {
    it('should create scene transition error correctly', () => {
      const error = SceneTransitionError({
        message: 'Failed to transition',
        currentScene: 'MainMenu',
        targetScene: 'Game',
      })

      expect(error._tag).toBe('SceneTransitionError')
      expect(error.message).toBe('Failed to transition')
      expect(error.currentScene).toBe('MainMenu')
      expect(error.targetScene).toBe('Game')
    })

    it('should validate scene transition error schema', () => {
      const errorData = {
        _tag: 'SceneTransitionError' as const,
        message: 'Transition failed',
        currentScene: 'MainMenu' as const,
        targetScene: 'Game' as const,
      }

      const result = Schema.decodeUnknownSync(SceneTransitionErrorSchema)(errorData)
      expect(result).toEqual(errorData)
    })

    it('should create scene transition error without current scene', () => {
      const error = SceneTransitionError({
        message: 'No current scene',
        targetScene: 'MainMenu',
      })

      expect(error._tag).toBe('SceneTransitionError')
      expect(error.message).toBe('No current scene')
      expect(error.currentScene).toBeUndefined()
      expect(error.targetScene).toBe('MainMenu')
    })
  })

  describe('SceneInitializationError', () => {
    it('should create scene initialization error correctly', () => {
      const error = SceneInitializationError({
        message: 'Failed to initialize scene',
        sceneType: 'Game',
      })

      expect(error._tag).toBe('SceneInitializationError')
      expect(error.message).toBe('Failed to initialize scene')
      expect(error.sceneType).toBe('Game')
    })

    it('should validate scene initialization error schema', () => {
      const errorData = {
        _tag: 'SceneInitializationError' as const,
        message: 'Initialization failed',
        sceneType: 'Loading' as const,
      }

      const result = Schema.decodeUnknownSync(SceneInitializationErrorSchema)(errorData)
      expect(result).toEqual(errorData)
    })
  })

  describe('SceneCleanupError', () => {
    it('should create scene cleanup error correctly', () => {
      const error = SceneCleanupError({
        message: 'Failed to cleanup scene',
        sceneType: 'MainMenu',
      })

      expect(error._tag).toBe('SceneCleanupError')
      expect(error.message).toBe('Failed to cleanup scene')
      expect(error.sceneType).toBe('MainMenu')
    })

    it('should validate scene cleanup error schema', () => {
      const errorData = {
        _tag: 'SceneCleanupError' as const,
        message: 'Cleanup failed',
        sceneType: 'Settings' as const,
      }

      const result = Schema.decodeUnknownSync(SceneCleanupErrorSchema)(errorData)
      expect(result).toEqual(errorData)
    })
  })
})
