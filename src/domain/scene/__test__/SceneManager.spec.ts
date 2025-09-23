import { describe, expect, it as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Either } from 'effect'
import { SceneManager, processSceneType } from '../SceneManager'
import { SceneManagerLive } from '../SceneManagerLive'

describe('SceneManager', () => {
  describe('SceneManagerLive', () => {
    it.effect('should initialize with no current scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const currentScene = yield* manager.getCurrentScene()
        const state = yield* manager.getState()

        expect(currentScene).toBeUndefined()
        expect(state.currentScene).toBeUndefined()
        expect(state.sceneStack).toEqual([])
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(0)
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should get current state', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const state = yield* manager.getState()

        expect(state).toHaveProperty('currentScene')
        expect(state).toHaveProperty('sceneStack')
        expect(state).toHaveProperty('isTransitioning')
        expect(state).toHaveProperty('transitionProgress')
        expect(Array.isArray(state.sceneStack)).toBe(true)
        expect(typeof state.isTransitioning).toBe('boolean')
        expect(typeof state.transitionProgress).toBe('number')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should transition to MainMenu scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('MainMenu')

        const currentScene = yield* manager.getCurrentScene()
        const state = yield* manager.getState()

        expect(currentScene).toBeDefined()
        expect(currentScene?.type).toBe('MainMenu')
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(1)
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should transition to Game scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('Game')

        const currentScene = yield* manager.getCurrentScene()

        expect(currentScene).toBeDefined()
        expect(currentScene?.type).toBe('Game')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should transition to Loading scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('Loading')

        const currentScene = yield* manager.getCurrentScene()

        expect(currentScene).toBeDefined()
        expect(currentScene?.type).toBe('Loading')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should fail to transition to unimplemented scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        const result = yield* Effect.either(manager.transitionTo('Pause'))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.targetScene).toBe('Pause')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should handle scene transitions with custom transition data', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('MainMenu', {
          from: undefined,
          to: 'MainMenu',
          duration: 1000,
          fadeType: 'slide',
        })

        const currentScene = yield* manager.getCurrentScene()

        expect(currentScene).toBeDefined()
        expect(currentScene?.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should push and pop scenes correctly', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // 最初のシーンに遷移
        yield* manager.transitionTo('MainMenu')
        let state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('MainMenu')
        expect(state.sceneStack).toHaveLength(0)

        // 新しいシーンをプッシュ
        yield* manager.pushScene('Game')
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Game')
        expect(state.sceneStack).toHaveLength(1)
        expect(state.sceneStack[0]?.type).toBe('MainMenu')

        // さらに新しいシーンをプッシュ
        yield* manager.pushScene('Loading')
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Loading')
        expect(state.sceneStack).toHaveLength(2)
        expect(state.sceneStack[1]?.type).toBe('Game')

        // シーンをポップ
        yield* manager.popScene()
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Game')
        expect(state.sceneStack).toHaveLength(1)

        // 最後のシーンをポップ
        yield* manager.popScene()
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('MainMenu')
        expect(state.sceneStack).toHaveLength(0)
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should fail to pop scene when stack is empty', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        const result = yield* Effect.either(manager.popScene())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.message).toContain('No scene in stack to pop')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should handle concurrent transitions appropriately', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // 並行遷移を実行
        const results = yield* Effect.all(
          [Effect.either(manager.transitionTo('MainMenu')), Effect.either(manager.transitionTo('Game'))],
          { concurrency: 'unbounded' }
        )

        // 少なくとも1つは成功することを確認
        const hasSuccess = results.some((result) => Either.isRight(result))
        expect(hasSuccess).toBe(true)

        // 現在のシーンが適切に設定されていることを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene).toBeDefined()
        expect(['MainMenu', 'Game']).toContain(currentScene?.type)
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should update current scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('MainMenu')
        yield* manager.update(16.67) // 60FPS相当

        // エラーが発生しないことを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should render current scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('Game')
        yield* manager.render()

        // エラーが発生しないことを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('Game')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should cleanup properly', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // シーンを設定
        yield* manager.transitionTo('MainMenu')
        yield* manager.pushScene('Game')

        // クリーンアップ
        yield* manager.cleanup()

        // 状態がリセットされていることを確認
        const state = yield* manager.getState()
        expect(state.currentScene).toBeUndefined()
        expect(state.sceneStack).toHaveLength(0)
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(0)
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should handle update and render when no scene is active', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // アクティブなシーンがない状態でのupdate/render
        yield* manager.update(16.67)
        yield* manager.render()

        // エラーが発生しないことを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene).toBeUndefined()
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should create scenes correctly', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        const mainMenuScene = yield* manager.createScene('MainMenu')
        expect(mainMenuScene.data.type).toBe('MainMenu')

        const gameScene = yield* manager.createScene('Game')
        expect(gameScene.data.type).toBe('Game')

        const loadingScene = yield* manager.createScene('Loading')
        expect(loadingScene.data.type).toBe('Loading')
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })

  describe('Edge cases', () => {
    vitestIt('should handle unknown scene type in processSceneType', () => {
      // Force test the exhaustive check by using an invalid scene type
      expect(() => {
        const invalidSceneType = 'InvalidScene' as any
        processSceneType(invalidSceneType, {
          MainMenu: () => 'mainmenu',
          Game: () => 'game',
          Loading: () => 'loading',
          Pause: () => 'pause',
          Settings: () => 'settings',
        })
      }).toThrow('effect/Match/exhaustive: absurd')
    })

    it.effect('should fail to pop scene when stack is empty', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // Try to pop without any scene in stack should fail
        const result = yield* Effect.either(manager.popScene())

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.message).toBe('No scene in stack to pop')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })
})
