import { describe, it, expect, beforeEach, afterEach } from '@effect/vitest'
import { Effect, Stream, pipe } from 'effect'
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
    it.effect('関数が定義されている', () =>
      Effect.gen(function* () {
        expect(initApp).toBeDefined()
        expect(typeof initApp).toBe('function')
      })
    )

    it.effect('HTMLアプリケーションを正しく初期化する', () =>
      Effect.gen(function* () {
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

    it.effect('アプリ要素にタイトルを設定する', () =>
      Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')
        const h1 = app!.querySelector('h1')

        expect(h1).toBeDefined()
        expect(h1!.textContent).toBe('TypeScript Minecraft Clone')
      })
    )

    it.effect('アプリ要素に説明文を設定する', () =>
      Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')
        const p = app!.querySelector('p')

        expect(p).toBeDefined()
        expect(p!.textContent).toBe('Vite + TypeScript project initialized successfully!')
      })
    )

    it.effect('正しいHTML構造を作成する', () =>
      Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')
        expect(app).toBeDefined()

        // 外側のdiv要素が存在する
        const outerDiv = app!.querySelector('div')
        expect(outerDiv).toBeDefined()

        // h1とp要素が正しい順序で存在する
        const children = outerDiv!.children
        expect(children.length).toBe(2)
        expect(children[0]?.tagName).toBe('H1')
        expect(children[1]?.tagName).toBe('P')
      })
    )

    it.effect('複数回呼び出しても安全', () =>
      Effect.gen(function* () {
        // 1回目の初期化
        initApp()
        const firstContent = document.querySelector<HTMLDivElement>('#app')!.innerHTML

        // 2回目の初期化
        initApp()
        const secondContent = document.querySelector<HTMLDivElement>('#app')!.innerHTML

        // 内容が同じであることを確認（置き換えられる）
        expect(secondContent).toBe(firstContent)
        expect(secondContent).toContain('TypeScript Minecraft Clone')
      })
    )

    it.effect('アプリ要素が存在しない場合の動作', () =>
      Effect.gen(function* () {
        // app要素を削除
        document.body.innerHTML = ''

        // initApp()はエラーを投げるはず（!演算子のため）
        expect(() => initApp()).toThrow()
      })
    )

    it.effect('app要素がnullでない場合のみ動作する', () =>
      Effect.gen(function* () {
        // DOM環境を確実にセットアップ
        document.body.innerHTML = '<div id="app"></div>'

        // 正常なapp要素が存在する場合
        const app = document.querySelector<HTMLDivElement>('#app')
        expect(app).not.toBeNull()

        // 初期化が成功することを確認
        expect(() => initApp()).not.toThrow()

        // HTMLが正しく設定されることを確認
        expect(app!.innerHTML).toContain('TypeScript Minecraft Clone')
      })
    )

    it.effect('innerHTML設定の検証', () =>
      Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')!
        const innerHTML = app.innerHTML

        // HTMLの基本構造を確認
        expect(innerHTML).toContain('<div>')
        expect(innerHTML).toContain('<h1>')
        expect(innerHTML).toContain('<p>')
        expect(innerHTML).toContain('</div>')
        expect(innerHTML).toContain('</h1>')
        expect(innerHTML).toContain('</p>')

        // 必要なテキストコンテンツを確認
        expect(innerHTML).toContain('TypeScript Minecraft Clone')
        expect(innerHTML).toContain('Vite + TypeScript project initialized successfully!')
      })
    )

    it.effect('DOM構造の完全性', () =>
      Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')!

        // 子要素が正確に1つのdivであることを確認
        expect(app.children.length).toBe(1)
        expect(app.children[0]?.tagName).toBe('DIV')

        const mainDiv = app.children[0]

        // mainDivが正確に2つの子要素（h1とp）を持つことを確認
        expect(mainDiv?.children.length).toBe(2)
        expect(mainDiv?.children[0]?.tagName).toBe('H1')
        expect(mainDiv?.children[1]?.tagName).toBe('P')

        // テキストコンテンツが正確であることを確認
        expect(mainDiv?.children[0]?.textContent).toBe('TypeScript Minecraft Clone')
        expect(mainDiv?.children[1]?.textContent).toBe('Vite + TypeScript project initialized successfully!')
      })
    )

    it.effect('要素のアクセシビリティ', () =>
      Effect.gen(function* () {
        initApp()

        const app = document.querySelector<HTMLDivElement>('#app')!
        const h1 = app.querySelector('h1')!
        const p = app.querySelector('p')!

        // 要素が適切にアクセス可能であることを確認
        expect(h1.textContent).toBeTruthy()
        expect(p.textContent).toBeTruthy()

        // テキストが空でないことを確認
        expect(h1.textContent!.trim().length).toBeGreaterThan(0)
        expect(p.textContent!.trim().length).toBeGreaterThan(0)
      })
    )

    it.effect('CSS挿入の副作用がない', () =>
      Effect.gen(function* () {
        // initApp関数はHTMLのみを操作し、スタイルは変更しない
        const initialStyleSheets = document.styleSheets.length

        initApp()

        const afterStyleSheets = document.styleSheets.length

        // スタイルシートの数が変わらないことを確認
        expect(afterStyleSheets).toBe(initialStyleSheets)
      })
    )

    it.effect('メモリリークの防止', () =>
      Effect.gen(function* () {
        // 複数回の初期化でメモリリークが発生しないことを確認
        const initialChildCount = document.body.children.length

        yield* pipe(
          Stream.range(0, 9),
          Stream.runForEach(() => Effect.sync(() => initApp()))
        )

        const finalChildCount = document.body.children.length

        // 子要素の数が変わらないことを確認（リークしていない）
        expect(finalChildCount).toBe(initialChildCount)

        // app要素が正しい内容を持つことを確認
        const app = document.querySelector<HTMLDivElement>('#app')!
        expect(app.innerHTML).toContain('TypeScript Minecraft Clone')
      })
    )

    it.effect('型安全性の確認', () =>
      Effect.gen(function* () {
        // TypeScriptの型アサーション（!）が正しく動作することを確認
        const app = document.querySelector<HTMLDivElement>('#app')

        // app要素が存在することを前提とした型安全な操作
        expect(app).toBeDefined()
        expect(app).not.toBeNull()

        // 型アサーション後の操作が安全であることを確認
        expect(() => {
          const typedApp = app as HTMLDivElement
          typedApp.innerHTML = 'test'
        }).not.toThrow()

        // 実際のinitApp関数が型安全であることを確認
        expect(() => initApp()).not.toThrow()
      })
    )
  })

  describe('アプリケーション統合', () => {
    it.effect('initApp関数がエクスポートされている', () =>
      Effect.gen(function* () {
        // モジュールエクスポートが正しく動作することを確認
        expect(initApp).toBeDefined()
        expect(typeof initApp).toBe('function')

        // 関数の名前が正しいことを確認
        expect(initApp.name).toBe('initApp')
      })
    )

    it.effect('戻り値がvoidである', () =>
      Effect.gen(function* () {
        const result = initApp()
        expect(result).toBeUndefined()
      })
    )

    it.effect('副作用のみを実行する純粋でない関数', () =>
      Effect.gen(function* () {
        // 関数実行前のDOM状態
        const appBefore = document.querySelector<HTMLDivElement>('#app')!
        const beforeHTML = appBefore.innerHTML

        // 関数実行
        const result = initApp()

        // 関数実行後のDOM状態
        const appAfter = document.querySelector<HTMLDivElement>('#app')!
        const afterHTML = appAfter.innerHTML

        // 副作用が発生したことを確認
        expect(afterHTML).not.toBe(beforeHTML)
        expect(afterHTML).toContain('TypeScript Minecraft Clone')

        // 戻り値がvoidであることを確認
        expect(result).toBeUndefined()
      })
    )
  })
})
