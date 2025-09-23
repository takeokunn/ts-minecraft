import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { MainMenuScene } from '../MainMenuScene'
import { Scene } from '../../Scene'

describe('MainMenuScene', () => {
  // ヘルパー関数: 新しいシーンインスタンスを作成
  const createScene = () => Scene.pipe(Effect.provide(MainMenuScene))

  describe('初期化', () => {
    it.effect('シーンデータが正しく設定される', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()

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
    )

    it.effect('初回の初期化が成功する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        const result = yield* scene.initialize()
        expect(result).toBeUndefined()
      })
    )

    it.effect('二重初期化でエラーになる', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.initialize()
        const result = yield* Effect.either(scene.initialize())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneInitializationError')
          expect(result.left.message).toContain('already initialized')
          expect(result.left.sceneType).toBe('MainMenu')
        }
      })
    )
  })

  describe('更新処理', () => {
    it.effect('初期化前のupdateは何もしない', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.update(16)
        // エラーなく完了することを確認
      })
    )

    it.effect('初期化後のupdateが正常に動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.initialize()
        yield* scene.update(16)
        // エラーなく完了することを確認
      })
    )

    it.effect('異なるdeltaTimeで動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.initialize()

        // 異なるフレームレートでの更新
        yield* scene.update(16.67) // ~60 FPS
        yield* scene.update(33.33) // ~30 FPS
        yield* scene.update(8.33) // ~120 FPS
      })
    )
  })

  describe('描画処理', () => {
    it.effect('初期化前のrenderは何もしない', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.render()
        // エラーなく完了することを確認
      })
    )

    it.effect('初期化後のrenderが正常に動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.initialize()
        yield* scene.render()
        // エラーなく完了することを確認
      })
    )
  })

  describe('シーンライフサイクル', () => {
    it.effect('onEnterが正常に動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.onEnter()
        // エラーなく完了することを確認
      })
    )

    it.effect('onExitが正常に動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.initialize()
        yield* scene.onExit()
        // エラーなく完了することを確認
      })
    )

    it.effect('完全なライフサイクルが動作する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()

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
      })
    )
  })

  describe('クリーンアップ', () => {
    it.effect('初期化前のcleanupがエラーになる', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        const result = yield* Effect.either(scene.cleanup())

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SceneCleanupError')
          expect(result.left.message).toContain('not initialized')
          expect(result.left.sceneType).toBe('MainMenu')
        }
      })
    )

    it.effect('初期化後のcleanupが成功する', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        yield* scene.initialize()
        yield* scene.cleanup()
        // エラーなく完了することを確認
      })
    )

    it.effect('cleanup後に再初期化できる', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()

        // 初回の使用
        yield* scene.initialize()
        yield* scene.update(16)
        yield* scene.cleanup()

        // 再初期化
        yield* scene.initialize()
        yield* scene.update(16)
      })
    )
  })

  describe('メニュー固有の機能', () => {
    it.effect('ゲームタイトルが正しく設定される', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        expect(scene.data.metadata?.['title']).toBe('TypeScript Minecraft Clone')
      })
    )

    it.effect('バージョン情報が設定される', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        expect(scene.data.metadata?.['version']).toBe('1.0.0')
      })
    )

    it.effect('メニューアイテムが設定される', () =>
      Effect.gen(function* () {
        const scene = yield* createScene()
        expect(scene.data.metadata?.['menuItems']).toEqual(['新しいゲーム', '設定', '終了'])
      })
    )
  })
})
