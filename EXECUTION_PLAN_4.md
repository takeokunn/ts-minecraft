# EXECUTION PLAN 4: docsディレクトリサンプルコード洗練計画

## 🎯 目的・概要

docsディレクトリ内の全TypeScriptサンプルコードを最新のEffect-TSパターンに準拠させ、以下の要件を満たす高品質なコードに洗練する：

- **Effect-TSの最新書き方**: 3.17+の最新パターンを活用
- **PBT対応**: Property-Based Testingしやすい粒度の純粋関数
- **Early Return**: ガード節と早期リターンによる可読性向上
- **単一責務**: 各関数が一つの責務を持つ設計
- **厳密な型**: Effect-TSの型システムを最大限活用
- **高度なマッチング**: if/else/switchの代わりにMatch.value活用
- **浅いネスト**: ネスト深度を最小化

## 📊 現状分析結果

### 対象ファイル統計
- **総対象ファイル**: 100+個のmarkdownファイル
- **TypeScriptコードブロック**: 1,000+箇所
- **主要カテゴリ**:
  - 基本使用例: `docs/06-examples/01-basic-usage/` (3ファイル)
  - アーキテクチャ解説: `docs/01-architecture/` (10ファイル)
  - API仕様: `docs/05-reference/` (20+ファイル)
  - 仕様書: `docs/02-specifications/` (50+ファイル)
  - ガイド: `docs/03-guides/` (10ファイル)

### 特定された問題点分類

#### 🔴 Critical Issues (緊急度: 高)
1. **古いEffect-TS構文**:
   - `Effect.succeed/fail` → `Effect.gen` + `yield*`
   - Context.Tag古い定義方式
   - Schema.Struct以前の型定義

2. **分岐構造**:
   - if/else文の多用
   - switch文の使用
   - Match.value不使用

3. **ネスト深度**:
   - 3段階以上のネスト
   - コールバック地獄
   - 複雑な条件分岐

#### 🟡 Medium Issues (緊急度: 中)
4. **関数責務**:
   - 複数の責務を持つ大きな関数
   - PBTに適さない関数設計
   - 副作用の分離不足

5. **型安全性**:
   - any型の使用
   - 型アサーション多用
   - Brand型の未活用

#### 🟢 Low Issues (緊急度: 低)
6. **コード品質**:
   - 冗長な記述
   - 命名規則の不統一
   - コメント不足

## 🛠️ サブエージェント戦略

### エージェントA: パターン分析エージェント
**責務**: 各ファイルの問題パターン特定と分類
```typescript
interface AnalysisResult {
  file: string
  issues: {
    critical: CriticalIssue[]
    medium: MediumIssue[]
    low: LowIssue[]
  }
  complexity: 'low' | 'medium' | 'high'
  priority: number
}
```

### エージェントB: Effect-TS最新化エージェント
**責務**: Context7参照によるEffect-TS最新パターン適用
```typescript
interface ModernizationTask {
  targetFile: string
  patterns: {
    oldPattern: string
    newPattern: string
    reason: string
  }[]
}
```

### エージェントC: リファクタリングエージェント
**責務**: 構造的改善（関数分割、ネスト解消、Early Return適用）
```typescript
interface RefactoringTask {
  function: string
  improvements: {
    type: 'extract_function' | 'early_return' | 'flatten_nest' | 'single_responsibility'
    description: string
  }[]
}
```

### エージェントD: 型安全性強化エージェント
**責務**: Brand型、Schema検証、型制約の強化
```typescript
interface TypeSafetyTask {
  target: string
  enhancements: {
    brandTypes: string[]
    schemaValidations: string[]
    typeConstraints: string[]
  }
}
```

### エージェントE: Match.valueマッチング変換エージェント
**責務**: if/else/switch → Match.valueパターンマッチング変換
```typescript
interface MatchingConversion {
  location: string
  oldBranching: string
  newMatching: string
  exhaustivenessCheck: boolean
}
```

### エージェントF: PBTテストサポートエージェント
**責務**: 関数をPBT可能な形に分割・改善
```typescript
interface PBTOptimization {
  function: string
  testableUnits: {
    name: string
    signature: string
    properties: string[]
  }[]
}
```

## 📋 詳細実行計画

### Phase 1: 調査・分析フェーズ (1-2日)

#### Step 1.1: ファイル優先度付け
- **エージェントA**: 全markdownファイルをスキャン
- **出力**: 優先度付きファイルリスト
- **基準**:
  - 使用頻度 (参照数)
  - 複雑度 (コード量、ネスト深度)
  - 教育的価値 (examples/, guides/)

#### Step 1.2: 問題パターン特定
- **エージェントA**: 各ファイルの問題を分類
- **出力**: 問題パターンカタログ
- **分析対象**:
  - 古いEffect-TS構文
  - 分岐構造の複雑さ
  - 関数の単一責務違反
  - 型安全性の問題

### Phase 2: 最新化フェーズ (3-4日)

#### Step 2.1: Effect-TS最新パターン適用
- **エージェントB**: Context7でEffect-TS最新仕様確認
- **適用対象**:
  ```typescript
  // Before: 古い書き方
  Effect.succeed(value).pipe(
    Effect.flatMap(processValue),
    Effect.mapError(handleError)
  )

  // After: 最新書き方
  Effect.gen(function* () {
    const result = yield* Effect.succeed(value)
    return yield* processValue(result)
  }).pipe(Effect.catchTag("ErrorType", handleError))
  ```

#### Step 2.2: Schema.Struct最新化
- **エージェントB**: データ型定義の最新化
- **適用対象**:
  ```typescript
  // Before: 古い定義
  interface User {
    id: string
    name: string
  }

  // After: Schema.Struct
  export const User = Schema.Struct({
    id: Schema.String.pipe(Schema.brand<UserId>("UserId")),
    name: Schema.String.pipe(Schema.minLength(1))
  })
  export type User = typeof User.Type
  ```

### Phase 3: 構造改善フェーズ (3-4日)

#### Step 3.1: 関数責務の分離
- **エージェントC**: 大きな関数を単一責務に分割
- **原則**:
  - 1関数1責務
  - 10行以下目安
  - PBTしやすい純粋関数化

#### Step 3.2: Early Return適用
- **エージェントC**: ガード節によるネスト解消
- **パターン**:
  ```typescript
  // Before: ネストした分岐
  function process(data: Data) {
    if (data.isValid) {
      if (data.hasPermission) {
        if (data.isActive) {
          return processActive(data)
        } else {
          return processInactive(data)
        }
      } else {
        throw new PermissionError()
      }
    } else {
      throw new ValidationError()
    }
  }

  // After: Early Return + Effect
  const process = (data: Data) =>
    Effect.gen(function* () {
      if (!data.isValid) return yield* Effect.fail(new ValidationError())
      if (!data.hasPermission) return yield* Effect.fail(new PermissionError())

      return data.isActive
        ? yield* processActive(data)
        : yield* processInactive(data)
    })
  ```

### Phase 4: Match.value変換フェーズ (2-3日)

#### Step 4.1: if/else → Match.value変換
- **エージェントE**: 分岐をパターンマッチングに変換
- **変換例**:
  ```typescript
  // Before: if/else
  if (status === 'loading') {
    return showSpinner()
  } else if (status === 'error') {
    return showError(error)
  } else if (status === 'success') {
    return showData(data)
  }

  // After: Match.value
  return pipe(
    status,
    Match.value,
    Match.when('loading', () => showSpinner()),
    Match.when('error', () => showError(error)),
    Match.when('success', () => showData(data)),
    Match.exhaustive
  )
  ```

#### Step 4.2: switch → Match.value変換
- **エージェントE**: switch文の完全置き換え
- **網羅性チェック**: Match.exhaustiveによる型レベル保証

### Phase 5: 型安全性強化フェーズ (2-3日)

#### Step 5.1: Brand型導入
- **エージェントD**: ID型などをBrand型に変換
- **対象**:
  ```typescript
  // Before: 単純な文字列
  type UserId = string
  type PlayerId = string

  // After: Brand型
  type UserId = string & { readonly _tag: "UserId" }
  type PlayerId = string & { readonly _tag: "PlayerId" }

  export const UserId = Schema.String.pipe(Schema.brand<UserId>("UserId"))
  export const PlayerId = Schema.String.pipe(Schema.brand<PlayerId>("PlayerId"))
  ```

#### Step 5.2: Schema検証強化
- **エージェントD**: 実行時検証の追加
- **パターン**: decode/encodeによる境界での検証

### Phase 6: PBTサポート最適化フェーズ (2日)

#### Step 6.1: テスタブル関数設計
- **エージェントF**: PBT可能な純粋関数への分割
- **原則**:
  - 副作用の完全分離
  - 参照透明性の保証
  - プロパティ記述可能な関数シグネチャ

#### Step 6.2: テスト例の追加
- **エージェントF**: 主要関数のPBTテスト例を併記

## 🔄 並列実行戦略

### バッチ1: 基礎例とガイド (高優先度)
- `docs/06-examples/01-basic-usage/`
- `docs/03-guides/`
- **担当**: エージェントA, B, C

### バッチ2: アーキテクチャドキュメント (高優先度)
- `docs/01-architecture/`
- **担当**: エージェントB, D, E

### バッチ3: API仕様 (中優先度)
- `docs/05-reference/api-reference/`
- **担当**: エージェントD, E, F

### バッチ4: システム仕様 (中優先度)
- `docs/02-specifications/00-core-features/`
- **担当**: エージェントC, E, F

### バッチ5: 拡張機能仕様 (低優先度)
- `docs/02-specifications/01-enhanced-features/`
- **担当**: エージェントF

## 📈 成功指標・品質基準

### コード品質指標
- **Cyclomatic Complexity**: ≤ 5
- **関数行数**: ≤ 10行
- **ネスト深度**: ≤ 2段階
- **型カバレッジ**: 100% (any型排除)

### Effect-TSパターン適合度
- **Effect.gen使用率**: 90%+
- **Match.value使用率**: 80%+ (分岐箇所)
- **Schema.Struct使用率**: 100% (データ定義)
- **Brand型使用率**: 100% (ID型)

### テスタビリティ指標
- **純粋関数率**: 80%+
- **PBT対応率**: 主要ビジネスロジック100%
- **副作用分離率**: 100%

## 🚀 実行開始コマンド

### エージェント起動テンプレート

```bash
# Phase 1: 分析開始
Task.launch(agent: "general-purpose", task: "docsディレクトリ分析", parallel: false)

# Phase 2-6: 並列実行
Task.launch([
  {agent: "general-purpose", task: "Effect-TS最新化", target: "batch1"},
  {agent: "general-purpose", task: "構造改善", target: "batch2"},
  {agent: "general-purpose", task: "Match.value変換", target: "batch3"},
  {agent: "general-purpose", task: "型安全性強化", target: "batch4"},
  {agent: "general-purpose", task: "PBTサポート", target: "batch5"}
], parallel: true)
```

## 📝 完了確認チェックリスト

### Phase完了チェック
- [ ] Phase 1: 全ファイル分析完了、優先度付けリスト作成
- [ ] Phase 2: Effect-TS 3.17+パターン適用完了
- [ ] Phase 3: 関数分割・Early Return適用完了
- [ ] Phase 4: Match.valueパターン変換完了
- [ ] Phase 5: Brand型・Schema検証強化完了
- [ ] Phase 6: PBTサポート最適化完了

### 品質確認チェック
- [ ] 全コードがlintエラーなし
- [ ] 全コードがtype checkパス
- [ ] サンプルコードの実行可能性確認
- [ ] ドキュメントの一貫性確認

---

**このプランにより、docsディレクトリ内の全TypeScriptサンプルコードが最新のEffect-TSパターンに準拠した高品質なコードに生まれ変わります。各エージェントが専門領域で並列作業を行うことで、効率的な洗練を実現します。**