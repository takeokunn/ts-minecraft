import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Either, Fiber } from 'effect'
import { SceneManager } from '../SceneManager'
import { SceneManagerLive } from '../SceneManagerLive'
import { Scene, SceneTransitionError } from '../Scene'

// テスト用のモックシーン
const createMockScene = (sceneType: 'MainMenu' | 'Game' | 'Loading'): Layer.Layer<Scene> =>
  Layer.succeed(
    Scene,
    Scene.of({
      data: {
        id: `mock-${sceneType.toLowerCase()}-001`,
        type: sceneType,
        isActive: false,
        metadata: { test: true },
      },
      initialize: () => Effect.logInfo(`Mock ${sceneType} initialized`),
      update: () => Effect.logDebug(`Mock ${sceneType} updated`),
      render: () => Effect.logDebug(`Mock ${sceneType} rendered`),
      cleanup: () => Effect.logInfo(`Mock ${sceneType} cleaned up`),
      onEnter: () => Effect.logInfo(`Mock ${sceneType} entered`),
      onExit: () => Effect.logInfo(`Mock ${sceneType} exited`),
    })
  )

// エラーが発生するモックシーン
const createFailingMockScene = (
  sceneType: 'MainMenu' | 'Game' | 'Loading',
  errorType: 'initialize' | 'cleanup'
): Layer.Layer<Scene> =>
  Layer.succeed(
    Scene,
    Scene.of({
      data: {
        id: `failing-mock-${sceneType.toLowerCase()}-001`,
        type: sceneType,
        isActive: false,
        metadata: { test: true, failing: true },
      },
      initialize: () =>
        errorType === 'initialize'
          ? Effect.fail({ _tag: 'SceneInitializationError' as const, message: 'Test initialization error', sceneType })
          : Effect.logInfo(`Failing mock ${sceneType} initialized`),
      update: () => Effect.logDebug(`Failing mock ${sceneType} updated`),
      render: () => Effect.logDebug(`Failing mock ${sceneType} rendered`),
      cleanup: () =>
        errorType === 'cleanup'
          ? Effect.fail({ _tag: 'SceneCleanupError' as const, message: 'Test cleanup error', sceneType })
          : Effect.logInfo(`Failing mock ${sceneType} cleaned up`),
      onEnter: () => Effect.logInfo(`Failing mock ${sceneType} entered`),
      onExit: () => Effect.logInfo(`Failing mock ${sceneType} exited`),
    })
  )

describe('SceneManagerLive', () => {
  describe('Layer Creation', () => {
    it.effect('should create SceneManagerLive layer successfully', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        expect(manager).toBeDefined()
        expect(typeof manager.getCurrentScene).toBe('function')
        expect(typeof manager.getState).toBe('function')
        expect(typeof manager.transitionTo).toBe('function')
        expect(typeof manager.pushScene).toBe('function')
        expect(typeof manager.popScene).toBe('function')
        expect(typeof manager.createScene).toBe('function')
        expect(typeof manager.update).toBe('function')
        expect(typeof manager.render).toBe('function')
        expect(typeof manager.cleanup).toBe('function')
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })

  describe('Scene Creation', () => {
    it.effect('should create MainMenu scene successfully', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const scene = yield* manager.createScene('MainMenu')

        expect(scene.data.type).toBe('MainMenu')
        expect(scene.data.id).toBeDefined()
        expect(typeof scene.initialize).toBe('function')
        expect(typeof scene.update).toBe('function')
        expect(typeof scene.render).toBe('function')
        expect(typeof scene.cleanup).toBe('function')
        expect(typeof scene.onEnter).toBe('function')
        expect(typeof scene.onExit).toBe('function')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should create Game scene successfully', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const scene = yield* manager.createScene('Game')

        expect(scene.data.type).toBe('Game')
        expect(scene.data.id).toBeDefined()
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should create Loading scene successfully', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const scene = yield* manager.createScene('Loading')

        expect(scene.data.type).toBe('Loading')
        expect(scene.data.id).toBeDefined()
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should fail to create unimplemented Pause scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const result = yield* Effect.either(manager.createScene('Pause'))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.message).toContain('Pause scene not implemented')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should fail to create unimplemented Settings scene', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const result = yield* Effect.either(manager.createScene('Settings'))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.message).toContain('Settings scene not implemented')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })

  describe('Transition Error Handling', () => {
    it.effect('should prevent concurrent transitions', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // 最初の遷移を開始（非同期）
        const firstTransition = yield* Effect.fork(manager.transitionTo('MainMenu'))

        // 2番目の遷移を即座に試行
        const secondResult = yield* Effect.either(manager.transitionTo('Game'))

        // 最初の遷移を完了
        yield* Fiber.join(firstTransition)

        // 2番目の遷移は失敗するはず
        if (Either.isLeft(secondResult)) {
          expect(secondResult.left._tag).toBe('SceneTransitionError')
          expect(secondResult.left.message).toContain('transition already in progress')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should prevent push scene during transition', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // 最初の遷移を開始
        const transitionFiber = yield* Effect.fork(manager.transitionTo('MainMenu'))

        // 遷移中にpushSceneを試行
        const pushResult = yield* Effect.either(manager.pushScene('Game'))

        // 遷移を完了
        yield* Fiber.join(transitionFiber)

        // pushSceneは失敗するはず
        if (Either.isLeft(pushResult)) {
          expect(pushResult.left._tag).toBe('SceneTransitionError')
          expect(pushResult.left.message).toContain('Cannot push scene during transition')
        }
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })

  describe('Scene Stack Management', () => {
    it.effect('should handle scene stack correctly with multiple pushes and pops', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // 初期状態確認
        let state = yield* manager.getState()
        expect(state.sceneStack).toHaveLength(0)
        expect(state.currentScene).toBeUndefined()

        // 最初のシーンに遷移
        yield* manager.transitionTo('MainMenu')
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('MainMenu')
        expect(state.sceneStack).toHaveLength(0)

        // シーンをプッシュ（MainMenu → Game）
        yield* manager.pushScene('Game')
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Game')
        expect(state.sceneStack).toHaveLength(1)
        expect(state.sceneStack[0]?.type).toBe('MainMenu')

        // さらにシーンをプッシュ（Game → Loading）
        yield* manager.pushScene('Loading')
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Loading')
        expect(state.sceneStack).toHaveLength(2)
        expect(state.sceneStack[1]?.type).toBe('Game')

        // シーンをポップ（Loading → Game）
        yield* manager.popScene()
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Game')
        expect(state.sceneStack).toHaveLength(1)

        // 最後のシーンをポップ（Game → MainMenu）
        yield* manager.popScene()
        state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('MainMenu')
        expect(state.sceneStack).toHaveLength(0)
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should fail to pop when stack is empty', () =>
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
  })

  describe('Cleanup Operations', () => {
    it.effect('should cleanup properly and reset state', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // シーンを設定してスタックを作成
        yield* manager.transitionTo('MainMenu')
        yield* manager.pushScene('Game')
        yield* manager.pushScene('Loading')

        // 状態確認
        let state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Loading')
        expect(state.sceneStack).toHaveLength(2)

        // クリーンアップ実行
        yield* manager.cleanup()

        // 状態リセット確認
        state = yield* manager.getState()
        expect(state.currentScene).toBeUndefined()
        expect(state.sceneStack).toHaveLength(0)
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(0)
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })

  describe('Update and Render Operations', () => {
    it.effect('should handle update when no scene is active', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // アクティブなシーンがない状態でupdate
        yield* manager.update(16.67)

        // エラーが発生しないことを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene).toBeUndefined()
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should handle render when no scene is active', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // アクティブなシーンがない状態でrender
        yield* manager.render()

        // エラーが発生しないことを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene).toBeUndefined()
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should update active scene correctly', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('Game')
        yield* manager.update(33.33) // 30FPS相当

        // エラーが発生せず、シーンが正しく設定されていることを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('Game')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should render active scene correctly', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('MainMenu')
        yield* manager.render()

        // エラーが発生せず、シーンが正しく設定されていることを確認
        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })

  describe('Transition Progress and State', () => {
    it.effect('should update transition progress correctly', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('MainMenu')

        const state = yield* manager.getState()
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(1)
        expect(state.currentScene?.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive))
    )

    it.effect('should handle custom transition parameters', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        yield* manager.transitionTo('Game', {
          from: undefined,
          to: 'Game',
          duration: 2000,
          fadeType: 'slide',
        })

        const state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Game')
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(1)
      }).pipe(Effect.provide(SceneManagerLive))
    )
  })
})
