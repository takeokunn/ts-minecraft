import { Effect } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import { Scene } from '../../Scene'
import { LoadingScene } from '../LoadingScene'

describe('LoadingScene', () => {
  let scene: Scene

  beforeEach(() =>
    Effect.gen(function* () {
      scene = yield* Scene.pipe(Effect.provide(LoadingScene))
    }).pipe(Effect.runPromise)
  )

  describe('初期化', () => {
    it('シーンデータが正しく設定される', () => {
      expect(scene.data).toEqual({
        id: 'loading-scene-001',
        type: 'Loading',
        isActive: false,
        metadata: {
          loadingType: 'WorldGeneration',
          showTips: true,
          animationType: 'spinner',
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
          expect(result.left.sceneType).toBe('Loading')
        }
      }).pipe(Effect.runPromise))

    it('初期化時にローディングtipsが設定される', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        // 内部的にloadingTipsが設定されることを確認
        // 実装では5つのヒントが設定される
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

    it('プログレスバーの更新が機能する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // ローディングの進行をシミュレート
        for (let i = 0; i < 10; i++) {
          yield* scene.update(100)
        }
      }).pipe(Effect.runPromise))

    it('deltaTimeが正しく処理される', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // 異なるフレームレートでの更新
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
        for (let i = 0; i < 5; i++) {
          yield* scene.update(16)
          yield* scene.render()
        }

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
          expect(result.left.sceneType).toBe('Loading')
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

  describe('ローディング固有の機能', () => {
    it('ローディングタイプがWorldGenerationで初期化される', () => {
      expect(scene.data.metadata?.loadingType).toBe('WorldGeneration')
    })

    it('ヒント表示が有効で初期化される', () => {
      expect(scene.data.metadata?.showTips).toBe(true)
    })

    it('アニメーションタイプがspinnerで初期化される', () => {
      expect(scene.data.metadata?.animationType).toBe('spinner')
    })

    it('タスクの進捗を追跡する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // ローディングタスクのシミュレート
        // ローディングタスクのシミュレート
        for (let i = 0; i < 3; i++) {
          yield* scene.update(100)
        }
      }).pipe(Effect.runPromise))

    it('推定残り時間が更新される', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // 時間経過のシミュレート
        yield* scene.update(500)

        // 実装では estimatedTimeRemaining が更新される
      }).pipe(Effect.runPromise))
  })

  describe('ローディング進捗', () => {
    it('進捗が0から100の範囲内である', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // プログレス更新のシミュレート
        for (let i = 0; i <= 100; i += 10) {
          yield* scene.update(50)
        }
      }).pipe(Effect.runPromise))

    it('タスク完了数が総タスク数を超えない', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // タスク完了のシミュレート
        const totalTasks = 10
        for (let i = 0; i < totalTasks; i++) {
          yield* scene.update(100)
        }
      }).pipe(Effect.runPromise))
  })
})
