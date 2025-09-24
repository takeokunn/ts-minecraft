---
name: AI実行計画書 - 詳細実装Issue
about: AI Agentによる自動実装のための詳細な実行計画書
title: '[P?-???] [機能名] ⭐️ - AI実行計画書'
labels: ai-execution, implementation
assignees: ''
---

# 🎯 AI実行計画書 - [機能名]

## 📋 実装概要

[実装する機能の概要を2-3文で記述]

## 🔧 技術仕様

### Effect-TS実装方針

**⚠️ 重要: Effect-TSの最新パターンでガチガチに実装すること**

- **Schema.Struct**: すべてのデータ構造に型安全なスキーマ定義を使用
- **Context.GenericTag**: クラスを使わずContext.Tagパターンで依存性注入
- **Tagged Unions**: すべてのUnion型をTagged Unionで網羅的にパターンマッチング
- **Branded Types**: プリミティブ型にはBrand付けして型安全性を確保
- **STM**: 並行処理にはSTM (Software Transactional Memory)を活用
- **Layer Composition**: 依存関係は明示的なLayerで構成
- **Error Handling**: Data.TaggedErrorまたはSchema.TaggedErrorで完全な型安全エラー
- **FiberRef/Queue/Stream**: 非同期処理とイベント処理に活用

### ファイル構成

```typescript
src/domain/[feature]/[Feature]Types.ts      // Branded Types, Tagged Unions定義
src/domain/[feature]/[Feature]Service.ts    // Service Interface (Context.Tag)
src/domain/[feature]/[Feature]ServiceLive.ts // Service実装とLayer
src/domain/[feature]/__tests__/[Feature]Types.test.ts      // 型定義のテスト
src/domain/[feature]/__tests__/[Feature]Service.test.ts    // Service Interfaceのテスト
src/domain/[feature]/__tests__/[Feature]ServiceLive.test.ts // Service実装のテスト
```

**⚠️ テストファイル作成ルール**:
- **必須**: 実装ファイルと1対1対応するテストファイルを作成
- **除外**: `index.ts`はバレルエクスポートのみのため不要
- **命名**: `[実装ファイル名].test.ts`形式で統一
- **配置**: 同一ディレクトリの`__tests__/`フォルダ内に配置

### データ構造例

```typescript
// Branded Types
export const FeatureId = Schema.String.pipe(
  Schema.brand('FeatureId'),
  Schema.annotations({ title: 'FeatureId' })
)

// Tagged Union
export const FeatureAction = Schema.TaggedUnion('_tag', {
  Create: Schema.Struct({ _tag: Schema.Literal('Create'), ... }),
  Update: Schema.Struct({ _tag: Schema.Literal('Update'), ... }),
  Delete: Schema.Struct({ _tag: Schema.Literal('Delete'), ... })
})

// Service Interface
export interface FeatureService {
  readonly process: (action: FeatureAction) => Effect.Effect<Result, FeatureError>
}
export const FeatureService = Context.GenericTag<FeatureService>('@app/FeatureService')
```

## 📚 関連ドキュメント・実装例

- **設計ドキュメント**: `docs/explanations/[feature].md`
- **Effect-TSパターン**: `docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md`
- **既存Service実装例**:
  - `src/domain/player/PlayerServiceV2.ts` (最新Effect-TSパターン)
  - `src/shared/services/ConfigService.ts` (Service/Layerパターン例)

## 📝 Pre-Step: 実装前確認

1. `list_memories`で関連する既存実装パターンを確認
2. `@docs/`で設計方針を確認
3. Context7でEffect-TS最新仕様を確認（特にSchema, STM, Layer）

## 🚀 実装ステップ

### Step 1: Types定義

- [ ] Branded Typesの定義
- [ ] Tagged Unionsの定義
- [ ] Schema.Structでのデータ構造定義
- [ ] Error型の定義（Schema.TaggedError）

### Step 2: Service Interface定義

- [ ] Context.GenericTagでService定義
- [ ] 各メソッドのシグネチャ定義（Effect.Effect型）
- [ ] 依存Serviceの識別

### Step 3: Service実装

- [ ] Effect.genでの実装
- [ ] STMでのトランザクショナル処理
- [ ] Match.valueでのパターンマッチング
- [ ] pipeでの関数合成

### Step 4: Layer構成

- [ ] Service Layer実装
- [ ] 依存関係の明示的な構成
- [ ] Layer.mergeAllでの統合

### Step 5: エラーハンドリング

- [ ] TaggedErrorの適切な使用
- [ ] Either/Optionでのエラー処理
- [ ] Causeチェーンの構築

### Step 6: 非同期処理

- [ ] Queue/Streamの活用
- [ ] FiberRefでの状態管理
- [ ] Scheduleでのリトライ処理

### Step 7: テスト実装

- [ ] 実装ファイルと1対1対応するテストファイル作成
  - [ ] Types.test.ts - Schema/型定義の検証
  - [ ] Service.test.ts - Interface契約の検証
  - [ ] ServiceLive.test.ts - 実装の振る舞い検証
- [ ] @effect/vitestでのEffect対応テスト
- [ ] Property-based testing (fast-check)
  - [ ] 入力データの網羅的検証
  - [ ] 不変条件の保証
- [ ] Test Layer構成
  - [ ] Mock依存関係の注入
  - [ ] TestContext/TestClock活用
- [ ] カバレッジ80%以上の確認

### Step 8: ドキュメント更新

- [ ] API Reference作成
- [ ] 実装パターンの文書化
- [ ] JSDoc完備

## ✅ Post-Step: 実装後処理

- [ ] すべての実装ファイルに対応するテストファイルの確認
- [ ] テストカバレッジレポートの生成と確認
- [ ] `write_memory`で新規パターンを保存
- [ ] `@docs/`の更新
- [ ] PR作成とCI確認

## 🎯 成功基準

- [ ] TypeScript型チェック通過（strictモード）
- [ ] すべてのユニオンが網羅的にハンドリングされている
- [ ] エラーがすべて型として表現されている
- [ ] **すべての実装ファイルに対応するテストファイルが存在**
- [ ] テストカバレッジ80%以上
- [ ] Property-based testingによる網羅的検証
- [ ] Effect-TSベストプラクティス準拠

## 🔗 依存関係

- 依存Issue: #[番号]
- ブロッカー: なし/[詳細]

---

**実装者向けノート**: このIssueはAI Agentによる自動実装を前提としています。
実装時は必ず`claude "Issue #[番号] を実装して"`コマンドで開始してください。
**Effect-TSの最新パターンでガチガチに実装することが必須要件です。**
