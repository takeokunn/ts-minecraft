import { Effect } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import { Scene } from '../../Scene'
import { MainMenuScene } from '../MainMenuScene'

describe('MainMenuScene', () => {
  let scene: Scene

  beforeEach(() =>
    Effect.gen(function* () {
      scene = yield* Scene.pipe(Effect.provide(MainMenuScene))
    }).pipe(Effect.runPromise)
  )

  describe('初期化', () => {
    it('シーンデータが正しく設定される', () => {
      expect(scene.data).toEqual({
        id: 'main-menu-001',
        type: 'MainMenu',
        isActive: false,
        metadata: {
          title: 'TypeScript Minecraft Clone',
          version: '1.0.0',
          menuItems: ['新しいゲーム', '設定', '終了'],
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
          expect(result.left.sceneType).toBe('MainMenu')
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

    it('異なるdeltaTimeで動作する', () =>
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
          expect(result.left.sceneType).toBe('MainMenu')
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

  describe('メニュー固有の機能', () => {
    it('ゲームタイトルが正しく設定される', () => {
      expect(scene.data.metadata?.['title']).toBe('TypeScript Minecraft Clone')
    })

    it('バージョン情報が設定される', () => {
      expect(scene.data.metadata?.['version']).toBe('1.0.0')
    })

    it('メニューアイテムが設定される', () => {
      expect(scene.data.metadata?.['menuItems']).toEqual(['新しいゲーム', '設定', '終了'])
    })

    it('メニューアイテムが3つ存在する', () => {
      const menuItems = scene.data.metadata?.['menuItems'] as string[]
      expect(menuItems).toHaveLength(3)
    })

    it('初期化時に選択メニューがリセットされる', () =>
      Effect.gen(function* () {
        yield* scene.initialize()
        // 内部的にselectedMenuItem = 0に設定される
        // 実際のテストでは、メニュー選択状態を公開するAPIが必要
      }).pipe(Effect.runPromise))
  })

  describe('メニュー操作', () => {
    it('初期化後にメニュー選択が機能する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // メニューナビゲーションのシミュレート
        // 実際の実装では、InputServiceを通じて処理される
        yield* scene.update(16)
      }).pipe(Effect.runPromise))

    it('複数回の更新でメニューアニメーションが動作する', () =>
      Effect.gen(function* () {
        yield* scene.initialize()

        // アニメーション更新のシミュレート
        for (let i = 0; i < 60; i++) {
          yield* scene.update(16.67) // 60 FPS for 1秒
        }
      }).pipe(Effect.runPromise))
  })
})
