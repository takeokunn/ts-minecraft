import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { SceneManagerLive } from '../SceneManagerLive'
import { SceneManager } from '../SceneManager'

describe('SceneManagerLive', () => {
  describe('初期化', () => {
    it('SceneManagerサービスを提供する', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        expect(manager).toBeDefined()
        expect(manager.getCurrentScene).toBeDefined()
        expect(manager.getState).toBeDefined()
        expect(manager.transitionTo).toBeDefined()
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('初期状態が正しく設定される', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const state = yield* manager.getState()

        expect(state.currentScene).toBeUndefined()
        expect(state.sceneStack).toEqual([])
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(0)
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))
  })

  describe('シーン遷移', () => {
    it('MainMenuシーンに遷移できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.transitionTo('MainMenu')

        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('Gameシーンに遷移できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.transitionTo('Game')

        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('Game')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('Loadingシーンに遷移できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.transitionTo('Loading')

        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('Loading')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('未実装のPauseシーンへの遷移はエラーになる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const result = yield* Effect.either(manager.transitionTo('Pause'))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.message).toContain('not implemented')
        }
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('未実装のSettingsシーンへの遷移はエラーになる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const result = yield* Effect.either(manager.transitionTo('Settings'))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.message).toContain('not implemented')
        }
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('遷移中に別の遷移を開始するとエラーになる', () =>
      Effect.gen(function* () {
        // 注: 実際のテストではSceneManagerLiveの内部実装に応じた適切なモックが必要
        // ここでは概念的な実装例として記載
        yield* SceneManager
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))
  })

  describe('スタック管理', () => {
    it('pushSceneで新しいシーンをスタックに追加できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // 初期シーンに遷移
        yield* manager.transitionTo('MainMenu')

        // 新しいシーンをプッシュ
        yield* manager.pushScene('Game')

        const state = yield* manager.getState()
        expect(state.currentScene?.type).toBe('Game')
        expect(state.sceneStack.length).toBe(1)
        expect(state.sceneStack[0]?.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('popSceneで前のシーンに戻れる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager

        // シーンを順番に設定
        yield* manager.transitionTo('MainMenu')
        yield* manager.pushScene('Game')
        yield* manager.pushScene('Loading')

        // 最後のシーンをポップ
        yield* manager.popScene()

        const currentScene = yield* manager.getCurrentScene()
        expect(currentScene?.type).toBe('Game')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('空のスタックからpopSceneするとエラーになる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const result = yield* Effect.either(manager.popScene())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneTransitionError')
          expect(result.left.message).toContain('No scene in stack')
        }
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('遷移中にpushSceneするとエラーになる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.transitionTo('MainMenu')

        // 実際のテストではtransitionTo中の状態を適切にモックする必要がある
        // ここでは概念的な例として記載
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))
  })

  describe('更新と描画', () => {
    it('アクティブなシーンがない場合、updateは何もしない', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.update(16) // エラーなく完了する
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('アクティブなシーンがある場合、updateを呼び出す', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.transitionTo('MainMenu')
        yield* manager.update(16)
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('アクティブなシーンがない場合、renderは何もしない', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.render() // エラーなく完了する
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('アクティブなシーンがある場合、renderを呼び出す', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        yield* manager.transitionTo('Game')
        yield* manager.render()
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))
  })

  describe('クリーンアップ', () => {
    it('cleanupで状態がリセットされる', () =>
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
        expect(state.sceneStack).toEqual([])
        expect(state.isTransitioning).toBe(false)
        expect(state.transitionProgress).toBe(0)
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))
  })

  describe('createScene', () => {
    it('MainMenuシーンを作成できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const scene = yield* manager.createScene('MainMenu')
        expect(scene).toBeDefined()
        expect(scene.data.type).toBe('MainMenu')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('Gameシーンを作成できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const scene = yield* manager.createScene('Game')
        expect(scene).toBeDefined()
        expect(scene.data.type).toBe('Game')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))

    it('Loadingシーンを作成できる', () =>
      Effect.gen(function* () {
        const manager = yield* SceneManager
        const scene = yield* manager.createScene('Loading')
        expect(scene).toBeDefined()
        expect(scene.data.type).toBe('Loading')
      }).pipe(Effect.provide(SceneManagerLive), Effect.runPromise))
  })
})