---
title: 'TypeScript設定 - 型安全性完全ガイド'
description: 'TypeScript 5.9+での厳格な型チェック、Effect-TS 3.17+最適化、Nix環境対応、パフォーマンス調整。'
category: 'reference'
difficulty: 'intermediate'
tags: ['typescript', 'type-safety', 'configuration', 'effect-ts', 'nix', 'node22']
prerequisites: ['basic-typescript']
estimated_reading_time: '25分'
dependencies: []
status: 'complete'
---

# TypeScript Configuration

> **TypeScript設定**: プロジェクトのTypeScript設定完全リファレンス

## 概要

TypeScript MinecraftプロジェクトのTypeScript 5.9+設定について詳しく解説します。Nix環境での厳格な型チェック、Effect-TS 3.17+最適化、Node.js 22対応、パフォーマンス調整など、実用的な設定例を豊富に提供します。

**プロジェクト技術スタック**:

- **TypeScript**: 5.9+ (最新機能対応)
- **Node.js**: 22 (最新LTS)
- **Effect-TS**: 3.17+ (関数型プログラミング)
- **開発環境**: Nix + devenv
- **アーキテクチャ**: DDD + ECS

**注意**: このプロジェクトはNix環境で開発されており、実際の設定ファイルは存在しませんが、以下は実用的な設定例です。

## 基本設定

### 完全なtsconfig.json設定例（Nix + Effect-TS最適化）

```json
{
  "compilerOptions": {
    /* === 基本設定（Node.js 22 + Nix最適化） === */
    "target": "ES2022", // Node.js 22対応出力
    "module": "NodeNext", // Node.js ESMサポート
    "moduleResolution": "NodeNext", // Node.js 22モジュール解決
    "lib": [
      // 利用可能なライブラリ
      "ES2023", // 最新ECMAScript機能
      "DOM",
      "DOM.Iterable",
      "WebWorker"
    ],

    /* === ファイル処理（Effect-TS最適化） === */
    "allowJs": false, // JavaScript許可（型安全性重視）
    "checkJs": false, // JavaScript型チェック
    "declaration": true, // 型定義ファイル生成
    "declarationMap": true, // 型定義ソースマップ
    "sourceMap": true, // ソースマップ生成
    "outDir": "./dist", // 出力ディレクトリ
    "rootDir": "./src", // ルートディレクトリ
    "removeComments": false, // コメント保持（開発効率重視）

    /* === Effect-TS用厳格な型チェック（最高レベル） === */
    "strict": true, // 全ての厳格チェック有効
    "noImplicitAny": true, // any型の暗黙的使用禁止
    "strictNullChecks": true, // null/undefined厳格チェック
    "strictFunctionTypes": true, // 関数型の厳格チェック
    "strictBindCallApply": true, // bind/call/apply厳格チェック
    "strictPropertyInitialization": true, // プロパティ初期化チェック
    "noImplicitThis": true, // this型の暗黙的any禁止
    "alwaysStrict": true, // strict mode強制
    "useUnknownInCatchVariables": true, // catch変数をunknown型に

    /* === Effect-TS用追加厳格チェック === */
    "exactOptionalPropertyTypes": true, // Effect-TS Option型精度向上
    "noImplicitReturns": true, // Effectモナド一貫性
    "noFallthroughCasesInSwitch": true, // Match.valueパターン強制
    "noUncheckedIndexedAccess": true, // インデックスアクセス安全性
    "noImplicitOverride": true, // クラス継承時の明示必須
    "noPropertyAccessFromIndexSignature": true, // インデックスシグネチャ安全性
    "allowUnreachableCode": false, // デッドコード禁止
    "allowUnusedLabels": false, // 未使用ラベル禁止
    "noUnusedLocals": true, // 未使用ローカル変数検出
    "noUnusedParameters": true, // 未使用パラメータ検出

    /* === モジュール設定（Node.js 22対応） === */
    "esModuleInterop": true, // ESモジュール相互運用
    "allowSyntheticDefaultImports": true, // 合成defaultインポート許可
    "forceConsistentCasingInFileNames": true, // ファイル名大文字小文字統一
    "isolatedModules": true, // 単独モジュールコンパイル
    "verbatimModuleSyntax": false, // Effect-TSインポート最適化

    /* === 実験的機能（Effect-TS用） === */
    "experimentalDecorators": true, // Effect Schema用デコレータ
    "emitDecoratorMetadata": true, // メタデータ出力

    /* === パフォーマンス最適化（Nix環境） === */
    "skipLibCheck": true, // ライブラリ型チェックスキップ
    "incremental": true, // インクリメンタルコンパイル
    "tsBuildInfoFile": "./.tsbuildinfo", // ビルド情報キャッシュ

    /* === DDDアーキテクチャ対応パス設定 === */
    "baseUrl": ".", // Nixプロジェクトルート
    "paths": {
      "@/*": ["src/*"], // ソースルート
      "@/domain/*": ["src/domain/*"], // ドメイン層（コアビジネスロジック）
      "@/application/*": ["src/application/*"], // アプリケーション層（ユースケース）
      "@/infrastructure/*": ["src/infrastructure/*"], // インフラ層（ECS・レンダリング）
      "@/presentation/*": ["src/presentation/*"], // プレゼンテーション層（UI）
      "@/shared/*": ["src/shared/*"], // 共有コード
      "@/types/*": ["src/types/*"], // ゲーム固有型定義
      "@/test/*": ["test/*"], // テストコード
      "@/workers/*": ["src/workers/*"] // Web Worker（チャンク・物理演算）
    },

    /* === Effect-TS + ゲーム用型定義 === */
    "types": [
      // 明示的型定義
      "node", // Node.js 22 API
      "vitest/globals" // Vitestグローバル関数
    ],
    "typeRoots": [
      // 型定義ルート
      "node_modules/@types",
      "src/types", // ゲーム固有型
      "types" // グローバル型定義
    ],

    /* === デバッグ支援 === */
    "sourceRoot": "./src", // ソースルート（デバッガ用）
    "mapRoot": "./dist", // マップルート（デバッガ用）
    "inlineSources": false, // インラインソース無効

    /* === コード生成設定 === */
    "newLine": "lf", // 改行コード（Unix系）
    "stripInternal": true, // internal注釈削除
    "preserveSymlinks": true, // Nixシンボリックリンク保持

    /* === Effect-TS 3.17+ 詳細最適化設定 === */
    "moduleDetection": "force", // モジュール検出強制
    "allowImportingTsExtensions": true, // .ts拡張子インポート許可（Vite対応）
    "resolvePackageJsonExports": true, // package.json exports解決
    "resolvePackageJsonImports": true, // package.json imports解決
    "allowArbitraryExtensions": false, // 任意拡張子制御
    "verbatimModuleSyntax": false, // Effect Tree-shaking最適化
    "preserveConstEnums": false, // enum最適化（Effect-TS Literal推奨）
    "importsNotUsedAsValues": "remove", // 未使用インポート自動削除
    "removeComments": false // Effect-TS JSDoc保持
  },

  /* === Nixプロジェクトファイル管理 === */
  "include": [
    "src/**/*", // ソースコード全体
    "test/**/*", // テストコード
    "types/**/*" // グローバル型定義
  ],

  "exclude": [
    "node_modules", // 依存関係
    "dist", // ビルド出力
    "coverage", // テストカバレッジ
    "docs", // ドキュメント
    ".devenv", // Nix devenvキャッシュ
    ".devenv.flake.nix", // Nix flakeキャッシュ
    "devenv.lock" // Nixロックファイル
  ],

  /* === TypeScript 5.9新機能 + Node.js 22対応 === */
  "compilerOptions": {
    /* 上記の全設定を継承 */
  },

  /* === Nix + Effect-TSプロジェクト構造 === */
  "references": [
    // モノレポ構造の場合のみ使用
    // 現在はシングルプロジェクト構造
  ],

  /* === コンパイラーウォッチャー設定 === */
  "watchOptions": {
    "excludeDirectories": [
      "**/node_modules",
      "**/.git",
      "**/dist",
      "**/.devenv" // Nixキャッシュ除外
    ],
    "excludeFiles": ["**/*.js.map", "**/*.d.ts.map"]
  }
}
```

## 🚀 環境・用途別設定

### Nix開発環境用設定（Effect-TS最適化）

```json
// tsconfig.dev.json - Nix開発時の型安全性最大化
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
    "types/**/*" // カスタム型定義
  ]
}
```

### 本番環境用設定（ゲーム最適化）

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
    "moduleResolution": "NodeNext", // 確実な解決
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
    "moduleResolution": "NodeNext", // Node.js解決

    /* 型定義設定 */
    "types": [
      "node", // Node.js API
      "vitest/globals", // Vitest globals
      "@testing-library/jest-dom" // DOM testing
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

### Effect-TS 3.17+ 実践最適化設定

```json
// tsconfig.effect.json - TypeScript Minecraft用Effect-TS特化設定
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* Effect-TS 3.17+ 最適化 */
    "target": "ES2022", // Effect-TS推奨バージョン
    "module": "ESNext", // 最新モジュール
    "moduleResolution": "bundler", // Vite統合最適化

    /* 型システム強化（Game Development向け） */
    "strict": true, // 厳格モード必須
    "exactOptionalPropertyTypes": true, // Option<T>型精度向上
    "noUncheckedIndexedAccess": true, // ReadonlyRecord安全性
    "useUnknownInCatchVariables": true, // Effect.catchAll最適化
    "noImplicitReturns": true, // Effect戻り値一貫性
    "noFallthroughCasesInSwitch": true, // Match.value対応

    /* Effect-TS型推論支援（ゲーム特化） */
    "noImplicitAny": true, // Schema.Unknown制限
    "strictNullChecks": true, // Option/Either型推論
    "strictFunctionTypes": true, // Effect関数型安全性
    "noImplicitOverride": true, // Service実装時の明示性
    "noPropertyAccessFromIndexSignature": true, // ReadonlyRecord型安全

    /* Effect-TS + ゲームエンジンモジュール設定 */
    "esModuleInterop": true, // ESモジュール相互運用
    "allowSyntheticDefaultImports": true, // Effect再エクスポート対応
    "verbatimModuleSyntax": false, // Effect Tree-shaking最適化
    "isolatedModules": true, // 単独モジュール
    "allowImportingTsExtensions": true, // .ts拡張子許可

    /* ゲーム開発パフォーマンス最適化 */
    "skipLibCheck": true, // ライブラリスキップ
    "incremental": true, // インクリメンタル
    "tsBuildInfoFile": "./.tsbuildinfo.effect", // Effect専用キャッシュ
    "preserveConstEnums": false, // Effect-TS Literal推奨

    /* Schema・Brand型サポート */
    "experimentalDecorators": true, // Schema.Class用
    "emitDecoratorMetadata": true, // メタデータ生成
    "downlevelIteration": true, // ReadonlyArray iteration

    /* ゲーム開発特化パス解決 */
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
      "node", // Node.js 22 API
      "vitest/globals" // テスト環境
      // Effect型定義は自動解決される
    ]
  },

  "include": [
    "src/**/*",
    "test/**/*",
    "types/minecraft.d.ts", // ゲーム固有型定義
    "types/effect-extensions.d.ts" // Effect拡張型定義
  ],

  "exclude": [
    "node_modules", // 全依存関係除外（effectは自動解決）
    "dist",
    "coverage",
    "**/*.js", // JSファイル除外（型安全性重視）
    "**/*.mjs", // MJSファイル除外
    ".devenv" // Nix環境ファイル除外
  ]
}
```

#### ゲーム開発特化カスタム型定義

```typescript
// types/minecraft.d.ts - Minecraft固有型定義
declare namespace Minecraft {
  // Effect-TSブランド型統合
  interface GameBrands {
    PlayerId: string & Effect.Brand<'PlayerId'>
    ChunkCoordinate: number & Effect.Brand<'ChunkCoordinate'>
    WorldCoordinate: number & Effect.Brand<'WorldCoordinate'>
    BlockId: string & Effect.Brand<'BlockId'>
    Health: number & Effect.Brand<'Health'>
  }

  // ゲームエンティティ型
  interface Player {
    readonly id: GameBrands['PlayerId']
    readonly name: string
    readonly position: Vector3D
    readonly health: GameBrands['Health']
    readonly isActive: boolean
  }

  interface Block {
    readonly id: GameBrands['BlockId']
    readonly type: BlockType
    readonly position: Vector3D
  }

  type BlockType = 'air' | 'stone' | 'grass' | 'dirt' | 'cobblestone'

  interface Vector3D {
    readonly x: GameBrands['WorldCoordinate']
    readonly y: GameBrands['WorldCoordinate']
    readonly z: GameBrands['WorldCoordinate']
  }
}

// types/effect-extensions.d.ts - Effect-TS拡張型定義
declare global {
  namespace Effect {
    // カスタムブランド型の拡張
    interface BrandRegistry extends Minecraft.GameBrands {}
  }

  namespace Schema {
    // カスタムスキーマの型推論支援
    interface CustomSchemaRegistry {
      Player: Minecraft.Player
      Block: Minecraft.Block
      Vector3D: Minecraft.Vector3D
    }
  }
}

export {}
```

## ⚡ ゲーム開発専用設定

### ゲームエンジン統合設定

```json
// tsconfig.game.json - TypeScript Minecraft専用設定
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    /* ゲーム最適化 */
    "target": "ES2022", // WebGL対応
    "module": "ESNext", // ESモジュール
    "lib": [
      "ES2022",
      "DOM", // DOM API
      "WebWorker" // Worker API
    ],

    /* ゲーム用型定義 */
    "types": [
      "node", // Node.js
      "vitest/globals", // テスト
      "webgl2" // WebGL2 API
    ],

    /* モジュール解決 */
    "moduleResolution": "NodeNext", // Node.js解決
    "allowSyntheticDefaultImports": true, // ゲームライブラリ互換

    /* 型チェック調整 */
    "skipLibCheck": true, // ゲームライブラリ型定義スキップ
    "strictPropertyInitialization": false, // ゲームオブジェクト用

    /* パス設定（ゲーム専用） */
    "baseUrl": ".",
    "paths": {
      "@game/*": ["src/game/*"], // ゲーム専用コード
      "@engine/*": ["src/engine/*"], // エンジン関連
      "@assets/*": ["public/assets/*"], // ゲームアセット
      "@workers/*": ["src/workers/*"], // Web Worker
      "@shaders/*": ["src/shaders/*"] // シェーダーファイル
    }
  },

  "include": [
    "src/**/*",
    "src/game/**/*", // ゲーム専用コード
    "src/workers/**/*", // Web Worker
    "types/game.d.ts" // ゲーム型定義
  ]
}
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. Effect-TS 3.17+ ゲーム開発型エラー

**問題**: Game entity schemas not properly inferred, Brand type warnings

**解決策**:

```json
{
  "compilerOptions": {
    // ゲーム開発型推論強化
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "useUnknownInCatchVariables": true,

    // Effect-TS Schema最適化
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

**ゲーム特化の型推論支援**:

```typescript
// src/shared/types/game-schema-helpers.ts
import { Schema, Effect } from 'effect'

// ゲームエンティティ型推論ヘルパー
export const createGameSchema = <A>(schema: Schema.Schema<A>) => ({
  schema,
  decode: Schema.decodeUnknown(schema),
  validate: Schema.validate(schema),
  // ゲームループ用高速バリデーション
  fastValidate: (input: unknown) => Schema.validateSync(schema)(input)
})

// ブランド型ヘルパー
export const createBrandedType = <T extends string>(brand: T) =>
  <A>(base: Schema.Schema<A>) =>
    base.pipe(Schema.brand(brand))

// 使用例
const PlayerId = createBrandedType('PlayerId')(Schema.String.pipe(Schema.nonEmpty()))
const PlayerSchemaHelper = createGameSchema(PlayerSchema)

// ゲーム用サービス型推論
export const createGameService = <T extends Record<string, any>>(
  implementation: T
): { [K in keyof T]: T[K] } => implementation
```

#### 2. Effect-TS + Nix環境 統合エラー

**問題**: Effect-TS with Nix devenv module resolution failures

**解決策**:

```json
{
  "compilerOptions": {
    // Nix + Effect-TS最適化
    "moduleResolution": "bundler", // Vite + Nix統合
    "module": "ESNext",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,

    // Nixシンボリックリンク対応
    "preserveSymlinks": true,

    "paths": {
      // Effect-TS解決パス
      "@effect/*": ["node_modules/effect/*"],
      "@effect/schema": ["node_modules/@effect/schema"],
      "@effect/platform": ["node_modules/@effect/platform"],
      "@/*": ["src/*"]
    },

    "resolvePackageJsonExports": true,
    "resolvePackageJsonImports": true,
    "moduleDetection": "force"
  },

  // Nix環境除外設定
  "exclude": [
    "node_modules",
    "dist",
    "coverage",
    ".devenv", // Nix devenvキャッシュ
    "devenv.lock", // Nixロックファイル
    ".devenv.flake.nix" // Nix flakeキャッシュ
  ],

  // Nixウォッチャー最適化
  "watchOptions": {
    "excludeDirectories": [
      "**/node_modules",
      "**/.git",
      "**/dist",
      "**/.devenv" // Nixキャッシュ除外
    ]
  }
}
```

**Nix + Effect-TS 開発環境設定**:

```bash
# devenv.nix の TypeScript設定
{ pkgs, ... }: {
  packages = with pkgs; [
    nodejs_22
    typescript
    nodePackages.pnpm
  ];

  scripts.type-check.exec = '''
    pnpm exec tsc --noEmit --project tsconfig.effect.json
  ''';

  # Effect-TS開発支援
  scripts.effect-check.exec = '''
    pnpm exec tsc --noEmit --strict --exactOptionalPropertyTypes
  ''';
}
```

#### 3. パフォーマンス問題（Nix環境）

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
  "exclude": [
    "node_modules",
    "dist",
    "coverage",
    "**/*.stories.ts",
    ".devenv" // Nix専用除外
  ],

  // ウォッチャー最適化
  "watchOptions": {
    "excludeDirectories": ["**/node_modules", "**/.devenv"]
  }
}
```

#### 4. Effect-TS ゲーム開発モジュール解決エラー

**問題**: Game services and schemas module resolution failures

**解決策**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // ゲーム開発アーキテクチャパス
      "@/*": ["src/*"],
      "@/domain/*": ["src/domain/*"], // ゲームエンティティ・ビジネスロジック
      "@/application/*": ["src/application/*"], // ゲームユースケース
      "@/infrastructure/*": ["src/infrastructure/*"], // レンダリング・物理演算
      "@/presentation/*": ["src/presentation/*"], // UI・入力制御
      "@/shared/*": ["src/shared/*"], // 共有ユーティリティ

      // Effect-TS解決パス（重要）
      "@effect/*": ["node_modules/effect/*"],
      "@effect/schema": ["node_modules/@effect/schema"],
      "@effect/platform": ["node_modules/@effect/platform"],

      // ゲームエンジン統合
      "three": ["node_modules/three"],
      "three/examples/jsm/*": ["node_modules/three/examples/jsm/*"]
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

    // TypeScript 5.9 + Effect-TS
    "resolvePackageJsonExports": true,
    "resolvePackageJsonImports": true,
    "moduleDetection": "force",

    // Nixシンボリックリンク対応
    "preserveSymlinks": true
  }
}
```

**ゲーム特化インポート最適化パターン**:

```typescript
// ✅ 推奨: Effect-TS ゲーム開発インポートパターン

// 1. Effect-TS コアライブラリ
import { Effect, Schema, Context, Layer, ReadonlyArray } from 'effect'
import { Option, Either, Match } from 'effect'

// 2. ドメイン層（Schema中心）
import { PlayerSchema, type Player } from '@/domain/player/Player'
import { BlockSchema, type Block } from '@/domain/world/Block'
import { ChunkSchema, type Chunk } from '@/domain/world/Chunk'

// 3. アプリケーション層（Effect中心）
import { GameService } from '@/application/game/GameService'
import { WorldService } from '@/application/world/WorldService'
import { PlayerService } from '@/application/player/PlayerService'

// 4. インフラ層（Layer中心）
import { DatabaseLayer } from '@/infrastructure/database/DatabaseLayer'
import { RendererLayer } from '@/infrastructure/rendering/RendererLayer'
import { PhysicsLayer } from '@/infrastructure/physics/PhysicsLayer'

// 5. ゲームエンジン統合
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ❌ 非推奨: デフォルトインポート
import Effect from 'effect' // Tree-shakingされない

// ❌ 非推奨: 相対パス
import { Player } from '../../../domain/player/Player' // パス解決複雑化
```

## 🔧 高度な設定例

### カスタム型定義統合

```json
// tsconfig.json - カスタム型定義対応
{
  "compilerOptions": {
    "typeRoots": [
      "node_modules/@types",
      "src/types", // プロジェクト固有型
      "types" // グローバル型定義
    ],

    "types": [
      "node",
      "vitest/globals",
      "minecraft-types" // カスタム型定義
    ]
  },

  "include": [
    "src/**/*",
    "types/**/*", // グローバル型定義
    "global.d.ts" // グローバル拡張
  ]
}
```

**カスタム型定義例**:

```typescript
// types/minecraft.d.ts - ゲーム専用型定義
declare namespace Minecraft {
  interface Block {
    readonly id: string
    readonly type: BlockType
    readonly position: Vector3
  }

  type BlockType = 'stone' | 'grass' | 'dirt' | 'cobblestone'

  interface Vector3 {
    readonly x: number
    readonly y: number
    readonly z: number
  }

  interface Chunk {
    readonly coordinate: ChunkCoordinate
    readonly blocks: ReadonlyMap<string, Block>
  }
}

// global.d.ts - グローバル拡張
declare global {
  const __DEV__: boolean
  const __GAME_VERSION__: string
  const __NIX_ENV__: boolean

  interface Window {
    __GAME_STATE__: Minecraft.GameState
    __GAME_DEBUG__: boolean
  }
}

export {}
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

## 📖 Effect-TSゲーム開発移行ガイド

### ゲーム開発特化移行手順

**TypeScript Minecraftプロジェクト**でのEffect-TS移行について、詳細な手順とゲーム開発固有の考慮事項は[Effect-TS移行ガイド](../../how-to/migration/effect-ts-migration.md)を参照してください。

**ゲーム開発特有の重要ポイント**:

1. **パフォーマンス重視**: 60FPSを維持しながらの型安全性向上
2. **ゲームエンティティSchema**: Player、Block、Chunkなどのコアエンティティの型安全性
3. **リアルタイム処理**: ゲームループでのバリデーション最適化
4. **Three.js統合**: WebGLレンダリングとEffect-TSの統合

**Nix + Effect-TS統合開発環境**:

```bash
# devenv.nix環境での移行作業
# 1. Effect-TS依存関係のインストール
devenv shell  # Nix環境に入る
pnpm add effect @effect/schema @effect/platform

# 2. TypeScript設定のテスト
pnpm exec tsc -p tsconfig.effect.json --noEmit
pnpm exec tsc -p tsconfig.effect.json

# 3. ゲームビルドテスト
pnpm run build:game    # ゲームエンジンビルド
pnpm run test:effect   # Effect-TS特化テスト
```

### ゲーム特化移行チェックリスト

ゲーム開発に特化した移行チェックリスト:

- [ ] **Entity Schema移行**: Player, Block, Chunk, Entityの型安全性
- [ ] **ゲームループ最適化**: フレームレート維持でのバリデーション
- [ ] **Three.js統合**: WebGLコンテキストとEffect-TSの連携
- [ ] **物理演算**: パフォーマンスを維持した型安全性
- [ ] **アセット管理**: リソース読み込みの型安全性
- [ ] **マルチプレイヤー**: ネットワーク通信のスキーマバリデーション

詳細な手順は[移行ガイドのゲーム開発セクション](../../how-to/migration/effect-ts-migration.md#6-real-world-migration-example)を参照してください。

## 📚 関連ドキュメント

### 設定ファイル関連

- [Vite設定](./vite-config.md) - TypeScript統合とビルド設定
- [TypeScript基本設定](./typescript-config.md) - 基本的な設定ガイド
- [開発設定](./development-config.md) - 開発効率化ツール
- [Project設定](./project-config.md) - プロジェクト全体設定

### Effect-TS + ゲーム開発ガイド

- **[Effect-TS移行ガイド](../../how-to/migration/effect-ts-migration.md)** - 完全な移行手順書
- [Effect-TSパターン](../../tutorials/effect-ts-fundamentals/effect-ts-patterns.md) - ゲーム開発実装パターン
- [Schema API](../../reference/api/effect-ts-schema-api.md) - ゲームエンティティスキーマ設計
- [パフォーマンス最適化](../../how-to/development/performance-debugging-guide.md) - ゲームパフォーマンス

### Nix + TypeScript統合

- [Nixプロジェクト設定](../../how-to/development/README.md) - devenv環境設定
- [開発環境ガイド](../../how-to/development/entry-points.md) - Nix環境での開発手順

### 外部リファレンス

- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Effect-TS公式ドキュメント](https://effect.website/docs/)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [Nix devenvドキュメント](https://devenv.sh/)

### トラブルシューティング

- [パフォーマンス最適化](../troubleshooting/performance-issues.md) - 型チェック性能問題
- [ゲーム開発エラー](../../how-to/troubleshooting/common-errors.md) - Effect-TS + ゲームエンジンエラー
- [Nix環境トラブルシューティング](../../how-to/troubleshooting/debugging-guide.md) - devenv固有の問題
