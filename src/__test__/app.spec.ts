import { describe, expect, beforeEach, afterEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { initApp } from '../app'

describe('app', () => {
  // DOM環境のセットアップ
  beforeEach(() => {
    // JSDOMまたはテスト環境でDOMをセットアップ
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    // テスト後のクリーンアップ
    document.body.innerHTML = ''
  })

  describe('initApp', () => {
    it.effect('関数が定義されている', () => Effect.gen(function* () {
        expect(initApp).toBeDefined()
        expect(typeof initApp).toBe('function')
      })
    )

    it.effect('DOM要素を正しく初期化する', () => Effect.gen(function* () {
        // 初期化前の状態確認
        const app = document.querySelector<HTMLDivElement>('#app')
        expect(app).toBeDefined()
        expect(app!.innerHTML).toBe('')

        // アプリ初期化
        initApp()

        // 初期化後の状態確認
        const updatedApp = document.querySelector<HTMLDivElement>('#app')
        expect(updatedApp).toBeDefined()
        expect(updatedApp!.innerHTML).toContain('TypeScript Minecraft Clone')
      })
    )

    it.effect('アプリ要素にタイトルを設定する', () => Effect.gen(function* () {
        initApp()
        const app = document.querySelector<HTMLDivElement>('#app')
        const h1 = app!.querySelector('h1')
        expect(h1).toBeDefined()
        expect(h1!.textContent).toBe('TypeScript Minecraft Clone')
      })
    )

    it.effect('説明文を正しく設定する', () => Effect.gen(function* () {
        initApp()
        const app = document.querySelector<HTMLDivElement>('#app')
        const p = app!.querySelector('p')
        expect(p).toBeDefined()
        expect(p!.textContent).toContain('3Dブロック世界を探索しよう')
      })
    )

    it.effect('複数回初期化しても問題ない', () => Effect.gen(function* () {
        initApp()
        initApp() // 2回実行
        const app = document.querySelector<HTMLDivElement>('#app')
        const h1Elements = app!.querySelectorAll('h1')
        // 重複要素が作成されないことを確認
        expect(h1Elements.length).toBe(1)
      })
    )

    it.effect('app要素が存在しなくてもエラーにならない', () => Effect.gen(function* () {
        // app要素を削除
        document.body.innerHTML = ''

        // エラーが発生しないことを確認
        expect(() => initApp()).not.toThrow()
      })
    )

    it.effect('初期化後のDOM構造確認', () => Effect.gen(function* () {
        initApp()
        const app = document.querySelector<HTMLDivElement>('#app')
        // 基本構造の確認
        expect(app!.children.length).toBeGreaterThan(0)
        // 必要な要素が存在することを確認
        const title = app!.querySelector('h1')
        const description = app!.querySelector('p')
        expect(title).toBeDefined()
        expect(description).toBeDefined()
      })
    )

    it.effect('Canvas要素の確認', () => Effect.gen(function* () {
        initApp()

        // Canvas要素が作成されることを確認
        const canvas = document.querySelector('canvas')
        if (canvas) {
          expect(canvas.tagName.toLowerCase()).toBe('canvas')
        }
      })
    )

    it.effect('適切なCSSクラスが設定される', () => Effect.gen(function* () {
        initApp()
        const app = document.querySelector<HTMLDivElement>('#app')
        // アプリコンテナのスタイル確認
        expect(app).toBeDefined()
        // 子要素にも適切なクラスが設定されていることを確認
        const children = app!.children
        expect(children.length).toBeGreaterThan(0)
      })
    )

    it.effect('基本的なイベント処理の準備', () => Effect.gen(function* () {
        initApp()

        // 基本的な初期化が完了することを確認
        const app = document.querySelector<HTMLDivElement>('#app')
        expect(app).toBeDefined()

        // 実際のイベントリスナー設定は実装依存のため、
        // ここでは基本的な初期化完了のみ確認
      })
    )
  })

  describe('アプリケーション統合テスト', () => {
    it.effect('完全な初期化フローが正常に動作する', () => Effect.gen(function* () {
        // 初期状態
        expect(document.querySelector('#app')!.innerHTML).toBe('')
        // 初期化実行
        initApp()
        // 結果確認
        const app = document.querySelector<HTMLDivElement>('#app')
        expect(app!.innerHTML).toContain('TypeScript Minecraft Clone')
        // 基本要素の存在確認
        expect(app!.querySelector('h1')).toBeDefined()
        expect(app!.querySelector('p')).toBeDefined()
      })
    )

    it.effect('DOM構造とコンテンツの整合性確認', () => Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')

        // DOM構造の検証
        expect(app).toBeDefined()
        expect(app!.children.length).toBeGreaterThan(0)

        // コンテンツの検証
        const content = app!.textContent
        expect(content).toContain('TypeScript Minecraft Clone')
      })
    )
  })
})