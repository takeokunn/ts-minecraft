import { Effect, Either, pipe } from 'effect'
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { GameScene } from '../GameScene'
import { Scene } from '../../Scene'

describe('GameScene', () => {
  // Helper function to create a fresh scene instance for each test
  const createFreshScene = () =>
    Effect.gen(function* () {
      return yield* Scene.pipe(Effect.provide(GameScene))
    })

  describe('初期化', () => {
    it('シーンデータが正しく設定される', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        expect(scene.data).toEqual({
          id: 'game-scene-001',
          type: 'Game',
          isActive: false,
          metadata: {
            gameMode: 'Creative',
            worldName: 'New World',
            difficulty: 'Normal',
          },
        })
      }).pipe(Effect.runSync))

    it('初回の初期化が成功する', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        const result = yield* scene.initialize()
        expect(result).toBeUndefined()
      }).pipe(Effect.runSync))

    it('二重初期化でエラーになる', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        yield* scene.initialize()
        const result = yield* Effect.either(scene.initialize())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneInitializationError')
          expect(result.left.message).toContain('already initialized')
          expect(result.left.sceneType).toBe('Game')
        }
      }).pipe(Effect.runSync))
  })

  describe('更新処理', () => {
    it('初期化前のupdateは何もしない', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        yield* scene.update(16)
        // エラーなく完了することを確認
      }).pipe(Effect.runSync))

    it('初期化後のupdateが正常に動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        yield* scene.initialize()
        yield* scene.update(16)
        // エラーなく完了することを確認
      }).pipe(Effect.runSync))

    it('ゲーム一時停止中はupdateが早期リターンする', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        yield* scene.initialize()

        // onExitを呼ぶことでisPaused: trueにする
        yield* scene.onExit()

        // 一時停止状態でupdateを呼ぶ（isPausedの条件をテスト）
        yield* scene.update(16)
        // エラーなく完了することを確認（早期リターンが動作）
      }).pipe(Effect.runSync))
  })

  describe('描画処理', () => {
    it('初期化後のrenderが正常に動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        yield* scene.initialize()
        yield* scene.render()
        // エラーなく完了することを確認
      }).pipe(Effect.runSync))
  })

  describe('ライフサイクル管理', () => {
    it('完全なライフサイクルが動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        // 入場
        yield* scene.onEnter()
        yield* scene.initialize()

        // 実行
        yield* scene.update(16)
        yield* scene.render()

        // 退場
        yield* scene.onExit()
        yield* scene.cleanup()
      }).pipe(Effect.runSync))

    it('ゲーム状態管理（再開と一時停止）', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        yield* scene.initialize()

        // ゲーム開始
        yield* scene.onEnter()
        yield* scene.update(16)

        // 一時停止
        yield* scene.onExit()
        yield* scene.update(16) // 一時停止中の更新は早期リターン

        // 再開
        yield* scene.onEnter()
        yield* scene.update(16)
      }).pipe(Effect.runSync))
  })

  describe('エラーハンドリング', () => {
    it('初期化前のcleanupがエラーになる', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        const result = yield* Effect.either(scene.cleanup())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneCleanupError')
          expect(result.left.message).toContain('not initialized')
          expect(result.left.sceneType).toBe('Game')
        }
      }).pipe(Effect.runSync))

    it('cleanup後に再初期化できる', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        // 初回の使用
        yield* scene.initialize()
        yield* scene.update(16)
        yield* scene.cleanup()

        // 再初期化
        yield* scene.initialize()
        yield* scene.update(16)
      }).pipe(Effect.runSync))
  })

  describe('ゲーム設定の検証', () => {
    it('ゲームメタデータが正しく設定される', () =>
      Effect.gen(function* () {
        const scene = yield* createFreshScene()
        expect(scene.data.metadata?.['gameMode']).toBe('Creative')
        expect(scene.data.metadata?.['worldName']).toBe('New World')
        expect(scene.data.metadata?.['difficulty']).toBe('Normal')
      }).pipe(Effect.runSync))
  })
})
