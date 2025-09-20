---
title: 'TypeScript設定 - 型安全性完全ガイド'
description: 'TypeScript 5.xでの厳格な型チェック、Effect-TS最適化、パフォーマンス調整、Three.js統合設定。'
category: 'reference'
difficulty: 'intermediate'
tags: ['typescript', 'type-safety', 'configuration', 'effect-ts', 'three.js']
prerequisites: ['basic-typescript']
estimated_reading_time: '18分'
dependencies: []
status: 'complete'
---

# TypeScript Configuration

> **TypeScript設定**: プロジェクトのTypeScript設定完全リファレンス

## 概要

TypeScript MinecraftプロジェクトのTypeScript 5.x設定について詳しく解説します。厳格な型チェック、Effect-TS最適化、パフォーマンス調整、Three.js統合など、実用的な設定例を豊富に提供します。

## 基本設定

### 完全なtsconfig.json設定例

```json
{
  "compilerOptions": {
    /* === 基本設定 === */
    "target": "ES2022", // 出力ECMAScriptバージョン
    "module": "ESNext", // モジュールシステム
    "moduleResolution": "bundler", // Vite用モジュール解決（bundler推奨）
    "lib": [
      // 利用可能なライブラリ
      "ES2022",
      "DOM",
      "DOM.Iterable",
      "WebWorker"
    ],

    /* === ファイル処理 === */
    "allowJs": false, // JavaScript許可（型安全性重視）
    "checkJs": false, // JavaScript型チェック
    "declaration": true, // 型定義ファイル生成
    "declarationMap": true, // 型定義ソースマップ
    "sourceMap": true, // ソースマップ生成
    "outDir": "./dist", // 出力ディレクトリ
    "rootDir": "./src", // ルートディレクトリ
    "removeComments": false, // コメント保持（開発効率重視）

    /* === 厳格な型チェック（最高レベル） === */
    "strict": true, // 全ての厳格チェック有効
    "noImplicitAny": true, // any型の暗黙的使用禁止
    "strictNullChecks": true, // null/undefined厳格チェック
    "strictFunctionTypes": true, // 関数型の厳格チェック
    "strictBindCallApply": true, // bind/call/apply厳格チェック
    "strictPropertyInitialization": true, // プロパティ初期化チェック
    "noImplicitThis": true, // this型の暗黙的any禁止
    "alwaysStrict": true, // strict mode強制
    "useUnknownInCatchVariables": true, // catch変数をunknown型に

    /* === 追加の厳格チェック === */
    "exactOptionalPropertyTypes": true, // オプショナルプロパティ厳格化
    "noImplicitReturns": true, // 暗黙的return禁止
    "noFallthroughCasesInSwitch": true, // switch文のfallthrough禁止
    "noUncheckedIndexedAccess": true, // インデックスアクセス厳格化
    "noImplicitOverride": true, // override修飾子必須
    "noPropertyAccessFromIndexSignature": true, // インデックスシグネチャアクセス厳格化
    "allowUnreachableCode": false, // 到達不可能コード禁止
    "allowUnusedLabels": false, // 未使用ラベル禁止

    /* === モジュール設定 === */
    "esModuleInterop": true, // ESモジュール相互運用
    "allowSyntheticDefaultImports": true, // 合成defaultインポート許可
    "forceConsistentCasingInFileNames": true, // ファイル名大文字小文字統一
    "isolatedModules": true, // 単独モジュールコンパイル
    "verbatimModuleSyntax": true, // モジュール構文保持

    /* === JSX設定（UI層で使用） === */
    "jsx": "react-jsx", // React 17+ JSX変換
    "jsxFactory": "React.createElement", // JSXファクトリ関数
    "jsxFragmentFactory": "React.Fragment", // Fragmentファクトリ

    /* === 実験的機能 === */
    "experimentalDecorators": true, // デコレータ有効化
    "emitDecoratorMetadata": true, // デコレータメタデータ出力

    /* === パフォーマンス最適化 === */
    "skipLibCheck": true, // ライブラリ型チェックスキップ
    "incremental": true, // インクリメンタルコンパイル
    "tsBuildInfoFile": "./.tsbuildinfo", // ビルド情報キャッシュ

    /* === パス設定（エイリアス） === */
    "baseUrl": ".", // ベースURL
    "paths": {
      "@/*": ["src/*"], // ソースルート
      "@/domain/*": ["src/domain/*"], // ドメイン層
      "@/application/*": ["src/application/*"], // アプリケーション層
      "@/infrastructure/*": ["src/infrastructure/*"], // インフラ層
      "@/presentation/*": ["src/presentation/*"], // プレゼンテーション層
      "@/shared/*": ["src/shared/*"], // 共有コード
      "@/types/*": ["src/types/*"], // 型定義
      "@/test/*": ["test/*"] // テストコード
    },

    /* === 型定義関連 === */
    "types": [
      // 明示的型定義
      "node", // Node.js
      "three", // Three.js
      "vitest/globals" // Vitest（テスト）
    ],
    "typeRoots": [
      // 型定義ルート
      "node_modules/@types",
      "src/types"
    ],

    /* === デバッグ支援 === */
    "sourceRoot": "./src", // ソースルート（デバッガ用）
    "mapRoot": "./dist", // マップルート（デバッガ用）
    "inlineSources": false, // インラインソース無効

    /* === コード生成設定 === */
    "newLine": "lf", // 改行コード（Unix系）
    "stripInternal": true, // internal注釈削除
    "preserveSymlinks": true, // シンボリックリンク保持

    /* === Effect-TS専用最適化 === */
    "moduleDetection": "force" // モジュール検出強制
  },

  /* === ファイル包含/除外 === */
  "include": [
    "src/**/*", // ソースコード全体
    "test/**/*" // テストコード
  ],

  "exclude": [
    "node_modules", // 依存関係
    "dist", // ビルド出力
    "coverage", // テストカバレッジ
    "**/*.spec.ts", // テストファイルは別設定
    "**/*.test.ts",
    "docs" // ドキュメント
  ],

  /* === プロジェクト参照（モノレポ対応） === */
  "references": [
    {
      "path": "./packages/core"
    },
    {
      "path": "./packages/renderer"
    }
  ],

  /* === TypeScript 5.x 新機能 === */
  "compilerOptions": {
    "allowImportingTsExtensions": false, // .ts拡張子インポート制御
    "noEmit": false, // 出力制御
    "customConditions": [], // カスタム条件
    "resolvePackageJsonExports": true, // package.json exports解決
    "resolvePackageJsonImports": true, // package.json imports解決
    "allowArbitraryExtensions": false // 任意拡張子制御
  }
}
```

## 🚀 環境・用途別設定

### 開発環境用設定（厳格度重視）

```json
// tsconfig.dev.json - 開発時の型安全性最大化
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* 開発効率化設定 */
    "noEmit": true, // 出力無効（型チェックのみ）
    "incremental": true, // 高速インクリメンタル
    "tsBuildInfoFile": "./.tsbuildinfo.dev", // 開発用キャッシュ

    /* デバッグ支援 */
    "sourceMap": true, // ソースマップ有効
    "declarationMap": true, // 宣言マップ有効
    "removeComments": false, // コメント保持
    "inlineSources": true, // インラインソース

    /* 厳格チェック強化 */
    "noUnusedLocals": true, // 未使用ローカル変数検出
    "noUnusedParameters": true, // 未使用パラメータ検出
    "allowUnreachableCode": false, // 到達不可能コード禁止
    "allowUnusedLabels": false, // 未使用ラベル禁止

    /* Effect-TS開発支援 */
    "experimentalDecorators": true, // デコレータ有効
    "emitDecoratorMetadata": true, // メタデータ出力

    /* 詳細エラー情報 */
    "pretty": true, // エラー表示の装飾
    "listFiles": false, // ファイルリスト表示無効
    "explainFiles": false // ファイル解析説明無効
  },

  "include": [
    "src/**/*",
    "test/**/*",
    "@types/**/*" // カスタム型定義
  ]
}
```

### 本番環境用設定（最適化重視）

```json
// tsconfig.prod.json - 本番ビルド最適化
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* 本番最適化 */
    "target": "ES2022", // モダンブラウザ対応
    "module": "ESNext", // 最新モジュール
    "removeComments": true, // コメント削除
    "sourceMap": false, // ソースマップ無効
    "declaration": true, // 型定義は出力
    "declarationMap": false, // 宣言マップ無効

    /* サイズ最適化 */
    "importHelpers": true, // tslib使用でサイズ削減
    "noEmitHelpers": false, // ヘルパー出力制御
    "stripInternal": true, // internal注釈削除

    /* 厳格チェック（本番品質保証） */
    "noUnusedLocals": true, // 未使用変数エラー
    "noUnusedParameters": true, // 未使用パラメータエラー
    "exactOptionalPropertyTypes": true, // 厳格オプショナル

    /* パフォーマンス */
    "skipLibCheck": true, // ライブラリチェックスキップ
    "skipDefaultLibCheck": true, // デフォルトライブラリスキップ

    /* モジュール最適化 */
    "moduleResolution": "node", // 確実な解決
    "esModuleInterop": true, // 相互運用性
    "allowSyntheticDefaultImports": true // 合成インポート
  },

  "exclude": [
    "node_modules",
    "test/**/*", // テストファイル除外
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/*.stories.ts", // Storybookファイル除外
    "docs",
    "coverage"
  ]
}
```

### テスト環境用設定（Vitest統合）

```json
// tsconfig.test.json - テスト専用設定
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* テスト環境最適化 */
    "target": "ES2022", // テスト実行環境対応
    "module": "ESNext", // モジュール互換性
    "moduleResolution": "node", // Node.js解決

    /* 型定義設定 */
    "types": [
      "node", // Node.js API
      "vitest/globals", // Vitest globals
      "@testing-library/jest-dom", // DOM testing
      "three" // Three.js
    ],

    /* テスト支援 */
    "esModuleInterop": true, // モジュール相互運用
    "allowSyntheticDefaultImports": true, // デフォルトインポート
    "resolveJsonModule": true, // JSON import

    /* デバッグ支援 */
    "sourceMap": true, // デバッグ用マップ
    "inlineSources": true, // ソース埋め込み

    /* 厳格度調整（テスト用） */
    "noUnusedLocals": false, // テスト用変数許可
    "noUnusedParameters": false, // テスト用パラメータ許可
    "strict": true, // 基本厳格性維持

    /* Effect-TSテスト支援 */
    "experimentalDecorators": true, // デコレータサポート
    "emitDecoratorMetadata": true // メタデータ出力
  },

  "include": [
    "src/**/*", // ソースコード
    "test/**/*", // テストコード
    "**/*.test.ts", // テストファイル
    "**/*.spec.ts", // スペックファイル
    "vitest.config.ts" // Vitest設定
  ],

  "exclude": ["node_modules", "dist", "coverage"]
}
```

### Effect-TS専用最適化設定

```json
// tsconfig.effect.json - Effect-TS特化設定
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* Effect-TS最適化 */
    "target": "ES2022", // Effect-TS推奨バージョン
    "module": "ESNext", // 最新モジュール
    "moduleResolution": "node", // 依存関係解決

    /* 型システム強化 */
    "strict": true, // 厳格モード必須
    "exactOptionalPropertyTypes": true, // 厳密オプショナル
    "noUncheckedIndexedAccess": true, // インデックス安全性
    "useUnknownInCatchVariables": true, // catch文型安全

    /* Effect-TS型推論支援 */
    "noImplicitAny": true, // any禁止
    "strictNullChecks": true, // null/undefined厳格
    "strictFunctionTypes": true, // 関数型厳格

    /* モジュール設定 */
    "esModuleInterop": true, // ESモジュール相互運用
    "allowSyntheticDefaultImports": true, // デフォルトインポート
    "verbatimModuleSyntax": true, // モジュール構文保持
    "isolatedModules": true, // 単独モジュール

    /* パフォーマンス */
    "skipLibCheck": true, // ライブラリスキップ
    "incremental": true, // インクリメンタル
    "tsBuildInfoFile": "./.tsbuildinfo.effect", // Effect専用キャッシュ

    /* デコレータサポート */
    "experimentalDecorators": true, // Effect Schema用
    "emitDecoratorMetadata": true, // メタデータ生成

    /* パス解決（Effect-TS向け） */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@effect/*": ["node_modules/effect/*"], // Effect直接参照
      "@fp-ts/*": ["node_modules/fp-ts/*"] // FP-TS互換
    }
  },

  "include": ["src/**/*", "test/**/*"],

  "exclude": [
    "node_modules/!(@effect|effect)", // Effect以外のnode_modules除外
    "dist",
    "coverage"
  ]
}
```

## ⚡ Three.js統合専用設定

### Three.js型定義最適化

```json
// tsconfig.three.json - Three.js統合設定
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* Three.js最適化 */
    "target": "ES2022", // WebGL対応
    "module": "ESNext", // ESモジュール
    "lib": [
      "ES2022",
      "DOM", // DOM API
      "WebGL", // WebGL API
      "WebGL2" // WebGL2 API
    ],

    /* Three.js型定義 */
    "types": [
      "three", // Three.js
      "@types/three", // 追加型定義
      "webxr" // WebXR（VR/AR）
    ],

    /* モジュール解決 */
    "moduleResolution": "node", // Node.js解決
    "allowSyntheticDefaultImports": true, // Three.js互換

    /* 型チェック調整 */
    "skipLibCheck": true, // Three.js型定義スキップ
    "strictPropertyInitialization": false, // Three.jsオブジェクト用

    /* パス設定（Three.js専用） */
    "baseUrl": ".",
    "paths": {
      "three": ["node_modules/three/build/three.module.js"],
      "three/examples/jsm/*": ["node_modules/three/examples/jsm/*"],
      "@three/*": ["src/three/*"] // Three.js専用コード
    }
  },

  "include": [
    "src/**/*",
    "src/three/**/*", // Three.js専用コード
    "@types/three.d.ts" // カスタム型定義
  ]
}
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. Effect-TS型エラー

**問題**: Effect types not properly inferred, `any` type warnings

**解決策**:

```json
{
  "compilerOptions": {
    // 型推論強化
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,

    // Effect-TS専用
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,

    // パス解決
    "moduleResolution": "node",
    "esModuleInterop": true,

    // 型定義明示
    "types": ["effect", "@effect/platform", "@effect/schema"]
  }
}
```

#### 2. Three.js import errors

**問題**: Cannot find module 'three/examples/jsm/\*'

**解決策**:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,

    "paths": {
      "three": ["node_modules/three"],
      "three/examples/jsm/*": ["node_modules/three/examples/jsm/*"]
    },

    "types": ["three", "@types/three"]
  }
}
```

#### 3. パフォーマンス問題

**問題**: 型チェックが遅い、メモリ不足

**解決策**:

```json
{
  "compilerOptions": {
    // パフォーマンス最適化
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo",

    // メモリ使用量削減
    "types": [], // 必要な型定義のみ明示的に指定

    // 並列処理
    "preserveWatchOutput": true
  },

  // ファイル除外によるパフォーマンス向上
  "exclude": ["node_modules", "dist", "coverage", "**/*.stories.ts"]
}
```

#### 4. モジュール解決エラー

**問題**: Cannot resolve module, path mapping not working

**解決策**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/domain/*": ["src/domain/*"],
      "@/application/*": ["src/application/*"]
    },

    // モジュール解決強化
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // TypeScript 5.x 新機能
    "resolvePackageJsonExports": true,
    "resolvePackageJsonImports": true
  }
}
```

## 🔧 高度な設定例

### プロジェクト参照（モノレポ対応）

```json
// tsconfig.json - ルート設定
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/renderer" },
    { "path": "./packages/ui" },
    { "path": "./apps/game" }
  ],
  "compilerOptions": {
    "composite": true,                        // プロジェクト参照有効
    "declaration": true,                      // 型定義生成
    "declarationMap": true,                   // 型定義マップ
    "incremental": true                       // インクリメンタル
  }
}

// packages/core/tsconfig.json - コアパッケージ
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*"],
  "references": []
}

// packages/renderer/tsconfig.json - レンダラーパッケージ
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }                     // coreパッケージに依存
  ]
}
```

### カスタム型定義統合

```json
// tsconfig.json - カスタム型定義対応
{
  "compilerOptions": {
    "typeRoots": [
      "node_modules/@types",
      "src/types",                           // プロジェクト固有型
      "types"                               // グローバル型定義
    ],

    "types": [
      "node",
      "three",
      "effect",
      "minecraft-types"                      // カスタム型定義
    ]
  },

  "include": [
    "src/**/*",
    "types/**/*",                           // グローバル型定義
    "global.d.ts"                          // グローバル拡張
  ]
}

// types/minecraft.d.ts - ゲーム専用型定義
declare namespace Minecraft {
  interface Block {
    id: string
    type: BlockType
    position: Vector3
  }

  type BlockType = 'stone' | 'grass' | 'dirt' | 'cobblestone'

  interface Vector3 {
    x: number
    y: number
    z: number
  }
}

// global.d.ts - グローバル拡張
declare global {
  const __DEV__: boolean
  const __VERSION__: string

  interface Window {
    __GAME_STATE__: Minecraft.GameState
  }
}
```

### 条件付きコンパイル設定

```json
// tsconfig.json - 環境別条件付き設定
{
  "compilerOptions": {
    // ベース設定...
  },

  // package.jsonで環境別実行
  "scripts": {
    "build:dev": "tsc -p tsconfig.dev.json",
    "build:prod": "tsc -p tsconfig.prod.json",
    "build:test": "tsc -p tsconfig.test.json",
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch"
  }
}
```

## 📚 関連ドキュメント

### 設定ファイル関連

- [Vite設定](./vite-config.md) - TypeScript統合とビルド設定
- [Vitest設定](./vitest-config.md) - テスト環境でのTypeScript設定
- [開発設定](./development-config.md) - 開発効率化ツール
- [Project設定](./project-config.md) - プロジェクト全体設定

### 外部リファレンス

- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [TypeScript Compiler Options](https://www.typescriptlang.org/docs/handbook/compiler-options.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

### プロジェクト固有

- [Effect-TSパターン](../../how-to/development/effect-ts-migration-guide.md)
- [Three.js統合ガイド](../../how-to/development/performance-optimization.md)
- [型安全性戦略](../../how-to/development/security-best-practices.md)
- [パフォーマンス最適化](../troubleshooting/performance-issues.md)
