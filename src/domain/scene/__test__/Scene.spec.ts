import { Schema } from '@effect/schema'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import {
  SceneCleanupError,
  SceneCleanupErrorSchema,
  SceneData,
  SceneInitializationError,
  SceneInitializationErrorSchema,
  SceneTransition,
  SceneTransitionError,
  SceneTransitionErrorSchema,
  SceneType,
} from '../scenes/base'

describe('Scene', () => {
  describe('SceneType', () => {
    it.effect('should validate valid scene types', () =>
      Effect.gen(function* () {
        const validTypes = ['MainMenu', 'Game', 'Loading', 'Pause', 'Settings']

        validTypes.forEach((type) => {
          const result = Schema.decodeUnknownSync(SceneType)(type)
          expect(result).toBe(type)
        })
      })
    )

    it.effect('should reject invalid scene types', () =>
      Effect.gen(function* () {
        const invalidTypes = ['Invalid', 'Unknown', '', null, undefined, 123]

        invalidTypes.forEach((type) => {
          expect(() => Schema.decodeUnknownSync(SceneType)(type)).toThrow()
        })
      })
    )
  })

  describe('SceneData', () => {
    it.effect('should validate valid scene data', () =>
      Effect.gen(function* () {
        const validData = {
          id: 'test-scene-001',
          type: 'MainMenu' as const,
          isActive: true,
          metadata: { level: '1', difficulty: 'easy' },
        }

        const result = Schema.decodeUnknownSync(SceneData)(validData)
        expect(result).toEqual(validData)
      })
    )

    it.effect('should validate scene data without optional metadata', () =>
      Effect.gen(function* () {
        const validData = {
          id: 'test-scene-002',
          type: 'Game' as const,
          isActive: false,
        }

        const result = Schema.decodeUnknownSync(SceneData)(validData)
        expect(result).toEqual(validData)
      })
    )

    it.effect('should reject invalid scene data', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('SceneTransition', () => {
    it.effect('should validate valid scene transition with all fields', () =>
      Effect.gen(function* () {
        const validTransition = {
          from: 'MainMenu' as const,
          to: 'Game' as const,
          duration: 1000,
          fadeType: 'fade' as const,
        }

        const result = Schema.decodeUnknownSync(SceneTransition)(validTransition)
        expect(result).toEqual(validTransition)
      })
    )

    it.effect('should validate scene transition with only required fields', () =>
      Effect.gen(function* () {
        const minimalTransition = {
          to: 'Loading' as const,
        }

        const result = Schema.decodeUnknownSync(SceneTransition)(minimalTransition)
        expect(result).toEqual(minimalTransition)
      })
    )

    it.effect('should reject negative duration', () =>
      Effect.gen(function* () {
        const invalidTransition = {
          to: 'Game' as const,
          duration: -100,
        }

        expect(() => Schema.decodeUnknownSync(SceneTransition)(invalidTransition)).toThrow()
      })
    )

    it.effect('should reject invalid fadeType', () =>
      Effect.gen(function* () {
        const invalidTransition = {
          to: 'Game' as const,
          fadeType: 'invalid',
        }

        expect(() => Schema.decodeUnknownSync(SceneTransition)(invalidTransition)).toThrow()
      })
    )
  })

  describe('SceneTransitionError', () => {
    it.effect('should create scene transition error correctly', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should validate scene transition error schema', () =>
      Effect.gen(function* () {
        const errorData = {
          _tag: 'SceneTransitionError' as const,
          message: 'Transition failed',
          currentScene: 'MainMenu' as const,
          targetScene: 'Game' as const,
        }

        const result = Schema.decodeUnknownSync(SceneTransitionErrorSchema)(errorData)
        expect(result).toEqual(errorData)
      })
    )

    it.effect('should create scene transition error without current scene', () =>
      Effect.gen(function* () {
        const error = SceneTransitionError({
          message: 'No current scene',
          targetScene: 'MainMenu',
        })

        expect(error._tag).toBe('SceneTransitionError')
        expect(error.message).toBe('No current scene')
        expect(error.currentScene).toBeUndefined()
        expect(error.targetScene).toBe('MainMenu')
      })
    )
  })

  describe('SceneInitializationError', () => {
    it.effect('should create scene initialization error correctly', () =>
      Effect.gen(function* () {
        const error = SceneInitializationError({
          message: 'Failed to initialize scene',
          sceneType: 'Game',
        })

        expect(error._tag).toBe('SceneInitializationError')
        expect(error.message).toBe('Failed to initialize scene')
        expect(error.sceneType).toBe('Game')
      })
    )

    it.effect('should validate scene initialization error schema', () =>
      Effect.gen(function* () {
        const errorData = {
          _tag: 'SceneInitializationError' as const,
          message: 'Initialization failed',
          sceneType: 'Loading' as const,
        }

        const result = Schema.decodeUnknownSync(SceneInitializationErrorSchema)(errorData)
        expect(result).toEqual(errorData)
      })
    )
  })

  describe('SceneCleanupError', () => {
    it.effect('should create scene cleanup error correctly', () =>
      Effect.gen(function* () {
        const error = SceneCleanupError({
          message: 'Failed to cleanup scene',
          sceneType: 'MainMenu',
        })

        expect(error._tag).toBe('SceneCleanupError')
        expect(error.message).toBe('Failed to cleanup scene')
        expect(error.sceneType).toBe('MainMenu')
      })
    )

    it.effect('should validate scene cleanup error schema', () =>
      Effect.gen(function* () {
        const errorData = {
          _tag: 'SceneCleanupError' as const,
          message: 'Cleanup failed',
          sceneType: 'Settings' as const,
        }

        const result = Schema.decodeUnknownSync(SceneCleanupErrorSchema)(errorData)
        expect(result).toEqual(errorData)
      })
    )
  })
})
