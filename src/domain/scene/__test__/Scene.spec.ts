import { Effect, Schema } from 'effect'
import { describe, it, expect } from 'vitest'
import {
  SceneType,
  SceneData,
  SceneTransition,
  SceneTransitionError,
  SceneInitializationError,
  SceneCleanupError,
  SceneTransitionErrorSchema,
  SceneInitializationErrorSchema,
  SceneCleanupErrorSchema,
} from '../Scene'

describe('Scene', () => {
  describe('SceneType Schema', () => {
    it('有効なシーンタイプを受け入れる', () => {
      const validTypes = ['MainMenu', 'Game', 'Loading', 'Pause', 'Settings'] as const

      validTypes.forEach((type) => {
        const result = Schema.decodeSync(SceneType)(type)
        expect(result).toBe(type)
      })
    })

    it('無効なシーンタイプを拒否する', () => {
      const result = Effect.runSync(Effect.either(Schema.decodeUnknown(SceneType)('InvalidScene')))
      expect(result._tag).toBe('Left')
    })
  })

  describe('SceneData Schema', () => {
    it('有効なシーンデータを検証する', () => {
      const validSceneData = {
        id: 'scene-1',
        type: 'MainMenu' as const,
        isActive: true,
        metadata: { key: 'theme', value: 'dark' },
      }

      const result = Schema.decodeSync(SceneData)(validSceneData)
      expect(result).toEqual(validSceneData)
    })

    it('metadata無しのシーンデータを検証する', () => {
      const sceneDataWithoutMetadata = {
        id: 'scene-2',
        type: 'Game' as const,
        isActive: false,
      }

      const result = Schema.decodeSync(SceneData)(sceneDataWithoutMetadata)
      expect(result).toEqual(sceneDataWithoutMetadata)
    })

    it('不正なシーンデータを拒否する', () => {
      const invalidSceneData = {
        id: 123, // 文字列であるべき
        type: 'MainMenu',
        isActive: true,
      }

      const result = Effect.runSync(Effect.either(Schema.decodeUnknown(SceneData)(invalidSceneData)))
      expect(result._tag).toBe('Left')
    })
  })

  describe('SceneTransition Schema', () => {
    it('完全な遷移データを検証する', () => {
      const fullTransition = {
        from: 'MainMenu' as const,
        to: 'Game' as const,
        duration: 500,
        fadeType: 'fade' as const,
      }

      const result = Schema.decodeSync(SceneTransition)(fullTransition)
      expect(result).toEqual(fullTransition)
    })

    it('最小限の遷移データを検証する', () => {
      const minimalTransition = {
        to: 'Loading' as const,
      }

      const result = Schema.decodeSync(SceneTransition)(minimalTransition)
      expect(result).toEqual(minimalTransition)
    })

    it('負の期間を拒否する', () => {
      const invalidTransition = {
        to: 'Game' as const,
        duration: -100,
      }

      expect(() => Schema.decodeSync(SceneTransition)(invalidTransition)).toThrow()
    })

    it('無効なフェードタイプを拒否する', () => {
      const invalidTransition = {
        to: 'Game',
        fadeType: 'invalid',
      }

      const result = Effect.runSync(Effect.either(Schema.decodeUnknown(SceneTransition)(invalidTransition)))
      expect(result._tag).toBe('Left')
    })
  })

  describe('SceneTransitionError', () => {
    it('完全なエラーオブジェクトを作成する', () => {
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

    it('currentScene無しのエラーオブジェクトを作成する', () => {
      const error = SceneTransitionError({
        message: 'Initial transition failed',
        targetScene: 'MainMenu',
      })

      expect(error._tag).toBe('SceneTransitionError')
      expect(error.currentScene).toBeUndefined()
      expect(error.targetScene).toBe('MainMenu')
    })

    it('Schemaで検証できる', () => {
      const error = SceneTransitionError({
        message: 'Transition failed',
        targetScene: 'Game',
      })

      const result = Schema.decodeSync(SceneTransitionErrorSchema)(error)
      expect(result).toEqual(error)
    })
  })

  describe('SceneInitializationError', () => {
    it('エラーオブジェクトを作成する', () => {
      const error = SceneInitializationError({
        message: 'Failed to initialize scene',
        sceneType: 'Game',
      })

      expect(error._tag).toBe('SceneInitializationError')
      expect(error.message).toBe('Failed to initialize scene')
      expect(error.sceneType).toBe('Game')
    })

    it('Schemaで検証できる', () => {
      const error = SceneInitializationError({
        message: 'Initialization failed',
        sceneType: 'Loading',
      })

      const result = Schema.decodeSync(SceneInitializationErrorSchema)(error)
      expect(result).toEqual(error)
    })
  })

  describe('SceneCleanupError', () => {
    it('エラーオブジェクトを作成する', () => {
      const error = SceneCleanupError({
        message: 'Failed to cleanup resources',
        sceneType: 'Game',
      })

      expect(error._tag).toBe('SceneCleanupError')
      expect(error.message).toBe('Failed to cleanup resources')
      expect(error.sceneType).toBe('Game')
    })

    it('Schemaで検証できる', () => {
      const error = SceneCleanupError({
        message: 'Cleanup failed',
        sceneType: 'MainMenu',
      })

      const result = Schema.decodeSync(SceneCleanupErrorSchema)(error)
      expect(result).toEqual(error)
    })
  })
})
