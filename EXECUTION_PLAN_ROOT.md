# 実行計画書：src直下ファイルのリファクタリング

## 概要

src直下のファイル（`main.ts`、`layers.ts`）に対する包括的なリファクタリング計画。
Effect-TSへの完全準拠、未使用コードの削除、100%のテストカバレッジ達成を目標とする。

## 現状分析

### ファイル構成
- `src/main.ts`: アプリケーションのエントリーポイント
- `src/layers.ts`: Effect-TSのレイヤー定義

### 良好な点
1. **既にEffect-TS準拠**: 両ファイルとも完全にEffect-TSで実装済み
2. **クラス未使用**: 関数型プログラミングスタイルで実装済み
3. **命名規則準拠**: ファイル名は既にケバブケース

### 問題点
1. **未使用エクスポート**: layers.tsの多くのレイヤー定義が未使用
2. **テスト不足**: 両ファイルのテストが存在しない
3. **型定義の不完全性**: 一部の型推論に依存している箇所がある

## 実行計画

### フェーズ1: 未使用コードの特定と削除（並列実行可能）

#### タスク1.1: layers.ts の未使用エクスポート削除
```typescript
// 削除対象のエクスポート（他から参照されていない）
- getAutoLayer
- getLegacyAutoLayer  
- createCustomLayer
- createOptimizedLayer
- MinimalClientLayer
- ServerLayer
- ComputeLayer
- RenderingLayer
- DevLayer
- TestLayer
```

#### タスク1.2: main.ts の最適化
```typescript
// 型定義の明確化
- player パラメータの型を明示的に定義
- gameLoop, gameSystems の型を厳密化
```

### フェーズ2: Effect-TS準拠の強化（並列実行可能）

#### タスク2.1: エラーハンドリングの統一
```typescript
// TaggedErrorパターンの導入
export class MainError extends S.TaggedError<MainError>()('MainError', {
  message: S.String,
  cause: S.optional(S.Unknown),
}) {}

export class LayerError extends S.TaggedError<LayerError>()('LayerError', {
  message: S.String,
  layer: S.String,
  cause: S.optional(S.Unknown),
}) {}
```

#### タスク2.2: レイヤー合成の最適化
```typescript
// 使用されているレイヤーのみを再構成
export const AppLayer = Layer.mergeAll(
  DomainLayer,
  InfrastructureLayer,
  ApplicationServicesLayer,
  PresentationLayer,
)

export const ProductionLayer = pipe(
  AppLayer,
  Layer.provideMerge(ProdLayer),
)
```

### フェーズ3: テスト実装（並列実行可能）

#### タスク3.1: main.ts のテスト
```typescript
// vitest.config.root.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
```

#### タスク3.2: テストケース実装
```typescript
// src/main.test.ts
describe('main', () => {
  it('should initialize application with player', async () => {
    // Effect.runPromiseテストケース
  })
  
  it('should handle initialization errors', async () => {
    // エラーハンドリングテスト
  })
})

// src/layers.test.ts
describe('layers', () => {
  it('should compose layers correctly', () => {
    // レイヤー合成テスト
  })
  
  it('should provide all required services', () => {
    // サービス提供テスト
  })
})
```

### フェーズ4: リファクタリング実装

#### タスク4.1: main.ts のリファクタリング
```typescript
import { pipe } from 'effect/Function'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Exit from 'effect/Exit'
import * as Cause from 'effect/Cause'
import { World } from '@infrastructure/layers/unified.layer'
import { AppLayer } from './layers'
import type { Archetype } from '@domain/constants/archetypes'

// 型定義
interface GameSystem {
  readonly update: Effect.Effect<void, never, World>
  readonly priority: number
}

interface AppConfig {
  readonly player: Archetype
  readonly systems: ReadonlyArray<GameSystem>
}

// エラー定義
export class AppInitError extends S.TaggedError<AppInitError>()('AppInitError', {
  message: S.String,
  phase: S.Literal('startup', 'initialization', 'gameLoop'),
  cause: S.optional(S.Unknown),
}) {}

// メイン関数
export const runApp = (config: AppConfig): Effect.Effect<void, AppInitError, AppLayer> =>
  pipe(
    Effect.Do,
    Effect.bind('world', () => World),
    Effect.tap(({ world }) => 
      Effect.logInfo(`Starting application with player: ${config.player.id}`)
    ),
    Effect.bind('initialized', ({ world }) => 
      world.initialize().pipe(
        Effect.mapError((e) => 
          new AppInitError({ 
            message: 'World initialization failed', 
            phase: 'initialization', 
            cause: e 
          })
        )
      )
    ),
    Effect.flatMap(() => runGameLoop(config.systems)),
    Effect.catchAll((error) => 
      Effect.logError(`Application error: ${error}`).pipe(
        Effect.flatMap(() => Effect.fail(error))
      )
    )
  )
```

#### タスク4.2: layers.ts のリファクタリング
```typescript
import * as Layer from 'effect/Layer'
import { pipe } from 'effect/Function'

// 基本レイヤー（必須）
export const CoreLayers = Layer.mergeAll(
  DomainLayer,
  InfrastructureLayer,
)

// アプリケーションレイヤー
export const ApplicationLayer = Layer.mergeAll(
  CoreLayers,
  ApplicationServicesLayer,
)

// フルスタックレイヤー
export const FullStackLayer = Layer.mergeAll(
  ApplicationLayer,
  PresentationLayer,
)

// 環境別レイヤー
export const createEnvironmentLayer = (env: 'production' | 'development') =>
  env === 'production' 
    ? Layer.provideMerge(FullStackLayer, ProdLayer)
    : Layer.provideMerge(FullStackLayer, Layer.mergeAll(
        GameLogicLayer,
        EssentialLayer,
      ))
```

## 並列実行戦略

### サブエージェント1: 未使用コード削除
- layers.ts の未使用エクスポート削除
- 依存関係の整理

### サブエージェント2: Effect-TS準拠
- エラー型の定義と実装
- 型定義の厳密化

### サブエージェント3: テスト実装
- テスト設定ファイルの作成
- main.test.ts の実装
- layers.test.ts の実装

### サブエージェント4: ドキュメント更新
- JSDocコメントの追加
- 使用例の追加

## 成功指標

1. **TypeScript**
   - `tsc --noEmit` がエラーなしで通過
   - strict modeで全チェック通過

2. **テストカバレッジ**
   - Statement Coverage: 100%
   - Branch Coverage: 100%
   - Function Coverage: 100%
   - Line Coverage: 100%

3. **コード品質**
   - 未使用エクスポート: 0
   - クラス使用: 0
   - @deprecated: 0

## 実行順序

1. **即座に実行可能**（並列）
   - 未使用コード削除
   - 型定義の厳密化
   - テストファイル作成

2. **第2フェーズ**（並列）
   - エラーハンドリング実装
   - レイヤー再構成
   - テストケース実装

3. **最終フェーズ**
   - 統合テスト
   - カバレッジ確認
   - リリース準備

## 推定作業時間

- フェーズ1: 30分（並列実行）
- フェーズ2: 45分（並列実行）
- フェーズ3: 60分（並列実行）
- フェーズ4: 45分
- 統合・検証: 30分

**合計: 約3.5時間（並列実行により実質2時間程度）**

## リスクと対策

### リスク1: レイヤー削除による影響
**対策**: 段階的な削除と各ステップでのテスト実行

### リスク2: 型の厳密化による既存コードへの影響
**対策**: 型エラーを一つずつ解決し、必要に応じて型アサーションを使用

### リスク3: テストカバレッジ100%の達成困難
**対策**: カバレッジレポートを活用し、未カバー部分を特定して対処

## 次のステップ

1. この計画書の承認
2. サブエージェントへのタスク割り当て
3. 並列実行の開始
4. 進捗の定期的な確認
5. 統合テストの実施