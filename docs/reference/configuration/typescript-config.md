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

    /* === Effect-TS 3.17+専用最適化 === */
    "moduleDetection": "force", // モジュール検出強制
    "noImplicitReturns": true, // Effect型戻り値の一貫性保証
    "noUnusedLocals": true, // 未使用変数検出（Effect-TS開発効率化）
    "noUnusedParameters": true, // 未使用パラメータ検出
    "useUnknownInCatchVariables": true // Effect error handling最適化
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

### Effect-TS 3.17+専用最適化設定

```json
// tsconfig.effect.json - Effect-TS 3.17+特化設定
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* Effect-TS 3.17+最適化 */
    "target": "ES2022", // Effect-TS推奨バージョン
    "module": "ESNext", // 最新モジュール
    "moduleResolution": "bundler", // Vite統合最適化

    /* 型システム強化（Effect-TS Schema対応） */
    "strict": true, // 厳格モード必須
    "exactOptionalPropertyTypes": true, // Option<T>型精度向上
    "noUncheckedIndexedAccess": true, // ReadonlyRecord安全性
    "useUnknownInCatchVariables": true, // Effect.catchAll最適化
    "noImplicitReturns": true, // Effect戻り値一貫性
    "noFallthroughCasesInSwitch": true, // Match.value対応

    /* Effect-TS型推論支援 */
    "noImplicitAny": true, // Schema.Unknown制限
    "strictNullChecks": true, // Option/Either型推論
    "strictFunctionTypes": true, // Effect関数型安全性
    "noImplicitOverride": true, // Service実装時の明示性
    "noPropertyAccessFromIndexSignature": true, // ReadonlyRecord型安全

    /* モジュール設定（Effect-TS 3.17+対応） */
    "esModuleInterop": true, // ESモジュール相互運用
    "allowSyntheticDefaultImports": true, // Effect再エクスポート対応
    "verbatimModuleSyntax": false, // Effect Tree-shaking最適化
    "isolatedModules": true, // 単独モジュール
    "allowImportingTsExtensions": true, // .ts拡張子許可

    /* パフォーマンス（Schema最適化） */
    "skipLibCheck": true, // ライブラリスキップ
    "incremental": true, // インクリメンタル
    "tsBuildInfoFile": "./.tsbuildinfo.effect", // Effect専用キャッシュ

    /* Schema・Brand型サポート */
    "experimentalDecorators": true, // Schema.Class用
    "emitDecoratorMetadata": true, // メタデータ生成
    "downlevelIteration": true, // ReadonlyArray iteration

    /* DDD + Effect-TS パス解決 */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/domain/*": ["src/domain/*"], // ドメイン層（Schema中心）
      "@/application/*": ["src/application/*"], // ユースケース（Effect中心）
      "@/infrastructure/*": ["src/infrastructure/*"], // インフラ層（Layer中心）
      "@/shared/*": ["src/shared/*"], // 共有型・ユーティリティ
      "@effect/*": ["node_modules/effect/*"], // Effect直接参照
      "@effect/schema": ["node_modules/@effect/schema"], // Schema専用
      "@effect/platform": ["node_modules/@effect/platform"] // Platform専用
    },

    /* Effect-TS開発支援型定義 */
    "types": [
      "node", // Node.js API
      "vitest/globals" // テスト環境
      // Effect型定義は自動解決される
    ]
  },

  "include": [
    "src/**/*",
    "test/**/*",
    "types/effect.d.ts" // Effect拡張型定義
  ],

  "exclude": [
    "node_modules", // 全依存関係除外（effectは自動解決）
    "dist",
    "coverage",
    "**/*.js", // JSファイル除外（型安全性重視）
    "**/*.mjs" // MJSファイル除外
  ]
}
```

#### Effect-TS専用カスタム型定義

```typescript
// types/effect.d.ts - Effect-TS拡張型定義
declare global {
  // Effect開発支援
  namespace Effect {
    // カスタムブランド型の拡張
    interface BrandRegistry {
      PlayerId: string
      ChunkCoordinate: number
      WorldCoordinate: number
      BlockId: string
      Health: number
      Vector3D: { x: number; y: number; z: number }
    }
  }

  // Schema拡張
  namespace Schema {
    // カスタムスキーマの型推論支援
    interface CustomSchemaRegistry {
      Player: import('@/domain/player/Player').Player
      Block: import('@/domain/world/Block').Block
      Chunk: import('@/domain/world/Chunk').Chunk
    }
  }
}

export {}
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

#### 1. Effect-TS 3.17+型エラー

**問題**: Effect types not properly inferred, Schema validation warnings

**解決策**:

```json
{
  "compilerOptions": {
    // 型推論強化（Effect-TS 3.17+対応）
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "useUnknownInCatchVariables": true,

    // Effect-TS Schema専用
    "exactOptionalPropertyTypes": true, // Option<T>型精度
    "noUncheckedIndexedAccess": true, // ReadonlyRecord安全性
    "noImplicitReturns": true, // Effect戻り値一貫性
    "noFallthroughCasesInSwitch": true, // Match.value対応

    // モジュール解決（重要）
    "moduleResolution": "bundler", // Vite統合
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": false, // Tree-shaking最適化

    // Effect-TS型定義（自動解決を優先）
    "types": ["node", "vitest/globals"],
    "skipLibCheck": true // Effect内部型チェックスキップ
  }
}
```

**追加の型推論支援**:

```typescript
// src/types/effect-helpers.ts - 型推論ヘルパー
import { Schema, Effect } from 'effect'

// Schema型推論ヘルパー
export const createTypedSchema = <A>(schema: Schema.Schema<A>) => ({
  schema,
  decode: Schema.decodeUnknown(schema),
  encode: Schema.encode(schema),
  validate: Schema.validate(schema),
})

// Effect型推論ヘルパー
export const createService = <T extends Record<string, any>>(implementation: T): { [K in keyof T]: T[K] } =>
  implementation

// 使用例
const PlayerSchemaHelper = createTypedSchema(PlayerSchema)
const playerService = createService({
  create: (data: unknown) => PlayerSchemaHelper.decode(data),
  // 他のメソッド...
})
```

#### 2. Effect-TS + ゲームエンジン統合エラー

**問題**: Cannot resolve Effect-TS with game libraries (Three.js, etc.)

**解決策**:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler", // Vite最適化
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,

    "paths": {
      // Effect-TS パス
      "@effect/*": ["node_modules/effect/*"],
      "@effect/schema": ["node_modules/@effect/schema"],
      "@effect/platform": ["node_modules/@effect/platform"],

      // ゲームエンジン パス
      "three": ["node_modules/three"],
      "three/examples/jsm/*": ["node_modules/three/examples/jsm/*"],

      // プロジェクト パス
      "@/*": ["src/*"],
      "@/domain/*": ["src/domain/*"],
      "@/infrastructure/*": ["src/infrastructure/*"]
    },

    "types": ["node", "vitest/globals"],
    "lib": ["ES2022", "DOM", "WebWorker"]
  }
}
```

**Effect-TS + Three.js統合パターン**:

```typescript
// src/infrastructure/rendering/ThreeJSService.ts
import { Effect, Context, Layer } from 'effect'
import * as THREE from 'three'

interface ThreeJSService {
  readonly createRenderer: () => Effect.Effect<THREE.WebGLRenderer, RendererError>
  readonly createScene: () => Effect.Effect<THREE.Scene, never>
}

const ThreeJSService = Context.GenericTag<ThreeJSService>('ThreeJSService')

const makeThreeJSService = Effect.succeed({
  createRenderer: () =>
    Effect.try({
      try: () => new THREE.WebGLRenderer({ antialias: true }),
      catch: (error) => new RendererError({ cause: error }),
    }),
  createScene: () => Effect.succeed(new THREE.Scene()),
})

export const ThreeJSServiceLive = Layer.effect(ThreeJSService, makeThreeJSService)
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

#### 4. Effect-TS モジュール解決エラー

**問題**: Cannot resolve Effect modules, tree-shaking issues

**解決策**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // Effect-TS 解決パス
      "@effect/*": ["node_modules/effect/*"],
      "@effect/schema": ["node_modules/@effect/schema"],
      "@effect/platform": ["node_modules/@effect/platform"],

      // プロジェクト解決パス
      "@/*": ["src/*"],
      "@/domain/*": ["src/domain/*"],
      "@/application/*": ["src/application/*"],
      "@/infrastructure/*": ["src/infrastructure/*"]
    },

    // Effect-TS最適化モジュール解決
    "moduleResolution": "bundler", // Vite統合重要
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,

    // Tree-shaking最適化
    "verbatimModuleSyntax": false,
    "isolatedModules": true,

    // TypeScript 5.x + Effect-TS
    "resolvePackageJsonExports": true,
    "resolvePackageJsonImports": true,
    "moduleDetection": "force"
  }
}
```

**Effect-TSインポート最適化パターン**:

```typescript
// ✅ 推奨: 名前付きインポート（Tree-shaking最適化）
import { Effect, Schema, Context, Layer } from 'effect'
import { Option, ReadonlyArray } from 'effect'

// ✅ 特定モジュールの直接インポート
import * as Schema from '@effect/schema/Schema'
import * as Effect from 'effect/Effect'

// ❌ 非推奨: デフォルトインポート
import Effect from 'effect' // Tree-shakingされない

// ✅ プロジェクト内インポート（パス解決最適化）
import { PlayerSchema } from '@/domain/player/Player'
import { GameService } from '@/application/game/GameService'
import { DatabaseLayer } from '@/infrastructure/database/DatabaseLayer'
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

## 📖 Effect-TS移行ガイド参照

### 設定変更の実践的アプローチ

Effect-TSに移行する際のTypeScript設定変更について、詳細な手順とパターンは[Effect-TS移行ガイド](../../how-to/migration/effect-ts-migration.md)を参照してください。

**移行時の重要な設定ポイント**:

1. **段階的移行**: 既存のtsconfig.jsonを保持しつつ、`tsconfig.effect.json`で段階的に移行
2. **Schema最適化**: `exactOptionalPropertyTypes`とBrand型設定の重要性
3. **パフォーマンス**: ゲーム開発での型チェック最適化戦略
4. **トラブルシューティング**: よくある型エラーとその解決方法

**設定ファイル例の活用**:

```bash
# 移行手順例
# 1. 現在の設定をバックアップ
cp tsconfig.json tsconfig.backup.json

# 2. Effect-TS専用設定を作成
cp tsconfig.json tsconfig.effect.json
# → 上記のEffect-TS専用設定を適用

# 3. 段階的に機能を移行
npx tsc -p tsconfig.effect.json --noEmit  # 型チェックのみ
npx tsc -p tsconfig.effect.json           # 実際のビルド
```

### 移行チェックリスト

移行時の設定確認項目については、[移行ガイドのチェックリスト](../../how-to/migration/effect-ts-migration.md#8-migration-checklist)を参照してください。

## 📚 関連ドキュメント

### 設定ファイル関連

- [Vite設定](./vite-config.md) - TypeScript統合とビルド設定
- [TypeScript実践設定](./typescript-config-practical.md) - Nix環境での詳細設定
- [開発設定](./development-config.md) - 開発効率化ツール
- [Project設定](./project-config.md) - プロジェクト全体設定

### Effect-TS統合ガイド

- **[Effect-TS移行ガイド](../../how-to/migration/effect-ts-migration.md)** - 包括的な移行手順
- [Effect-TSパターン](../../tutorials/effect-ts-fundamentals/effect-ts-patterns.md) - 実装パターン集
- [Schema API](../../reference/api/effect-ts-schema-api.md) - Schema設計ガイド
- [型安全性戦略](../../how-to/development/security-best-practices.md) - セキュリティ考慮事項

### 外部リファレンス

- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [Effect-TS公式ドキュメント](https://effect.website/docs/)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

### トラブルシューティング

- [パフォーマンス最適化](../troubleshooting/performance-issues.md) - 型チェック性能問題
- [一般的なエラー](../../how-to/troubleshooting/common-errors.md) - Effect-TS統合エラー
- [デバッグガイド](../../how-to/troubleshooting/debugging-guide.md) - 型推論問題の解決
