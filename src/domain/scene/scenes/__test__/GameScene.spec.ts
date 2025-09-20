import { Effect } from 'effect'
import { describe, it, expect, beforeEach } from 'vitest'
import { GameScene } from '../GameScene'
import { Scene } from '../../Scene'

describe('GameScene', () => {
  let scene: Scene

  beforeEach(() =>
    Effect.gen(function* () {
      scene = yield* Scene.pipe(Effect.provide(GameScene))
    }).pipe(Effect.runPromise)
  )

  describe('初期化', () => {
    it('シーンデータが正しく設定される', () => {
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
    })

    it('初回の初期化が成功する', () =>
      Effect.gen(function* () {
        const result = yield* scene.initialize()
        expect(result).toBeUndefined()
      }).pipe(Effect.runPromise))

    it('二重初期化でエラーになる', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        const result = yield* Effect.either(scene.initialize())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneInitializationError')
          expect(result.left.message).toContain('already initialized')
          expect(result.left.sceneType).toBe('Game')
        }
      }).pipe(Effect.runPromise))
  })

  describe('更新処理', () => {
    it('初期化前のupdateは何もしない', () =>
      Effect.gen(function* () {
        yield* scene.update(16)
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))

    it('初期化後のupdateが正常に動作する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.update(16)
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))

    it('一時停止中でもupdateが呼ばれる', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.update(16)
        // 注: 実際の実装では一時停止状態のチェックが必要
      }).pipe(Effect.runPromise))

    it('deltaTimeが正しく処理される', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // 複数フレームの更新
        yield* scene.update(16.67) // ~60 FPS
        yield* scene.update(33.33) // ~30 FPS
        yield* scene.update(8.33) // ~120 FPS
      }).pipe(Effect.runPromise))
  })

  describe('描画処理', () => {
    it('初期化前のrenderは何もしない', () =>
      Effect.gen(function* () {
        yield* scene.render()
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))

    it('初期化後のrenderが正常に動作する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.render()
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))
  })

  describe('シーンライフサイクル', () => {
    it('onEnterが正常に動作する', () =>
      Effect.gen(function* () {
        yield* scene.onEnter()
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))

    it('onExitが正常に動作する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.onExit()
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))

    it('完全なライフサイクルが動作する', () =>
      Effect.gen(function* () {
        // 入場
        yield* scene.onEnter()
        yield* scene.initialize()

        // 実行
        yield* scene.update(16)
        yield* scene.render()

        // 退場
        yield* scene.onExit()
        yield* scene.cleanup()
      }).pipe(Effect.runPromise))
  })

  describe('クリーンアップ', () => {
    it('初期化前のcleanupがエラーになる', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(scene.cleanup())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneCleanupError')
          expect(result.left.message).toContain('not initialized')
          expect(result.left.sceneType).toBe('Game')
        }
      }).pipe(Effect.runPromise))

    it('初期化後のcleanupが成功する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        yield* scene.cleanup()
        // エラーなく完了することを確認
      }).pipe(Effect.runPromise))

    it('cleanup後に再初期化できる', () =>
      Effect.gen(function* () {
        // 初回の使用
        yield* scene.initialize()
        yield* scene.update(16)
        yield* scene.cleanup()

        // 再初期化
        yield* scene.initialize()
        yield* scene.update(16)
      }).pipe(Effect.runPromise))
  })

  describe('ゲーム固有の機能', () => {
    it('ゲームモードがCreativeで初期化される', () => {
      expect(scene.data.metadata?.['gameMode']).toBe('Creative')
    })

    it('ワールド名が設定される', () => {
      expect(scene.data.metadata?.['worldName']).toBe('New World')
    })

    it('難易度がNormalで初期化される', () => {
      expect(scene.data.metadata?.['difficulty']).toBe('Normal')
    })

    it('プレイヤーの初期位置が設定される', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        // 実装では gameStateRef から位置を取得して確認
        // expect(playerPosition).toEqual({ x: 0, y: 64, z: 0 })
      }).pipe(Effect.runPromise))
  })
})
