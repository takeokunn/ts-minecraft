# 開発ワークフロー - Issue実装中心

## 基本フロー

```mermaid
flowchart LR
    A[GitHub Issue作成] --> B[claude "Issue #123 を実装して"]
    B --> C[自動実装・テスト]
    C --> D[実装完了通知]
    D --> E[PR作成・GitHub Actions]
```

## Issue作成

### 方法1: 自動作成（ROADMAP連携）
```bash
# Claude Agent経由
claude "ROADMAP Phase 0 のIssueを作成して"

# 直接実行
./scripts/create-phase-issues.sh 0

# Dry-runテスト
DRY_RUN=true ./scripts/create-phase-issues.sh 0
```

### 方法2: 手動作成（AI Task Issueテンプレート）
GitHub Issues > New issue > **AI Agent Task** を選択

**テンプレート構成:**
1. **実行ステップ（8段階・80分）**
   - Step 1: 事前調査・分析（10分）
   - Step 2: ディレクトリ構造作成（5分）
   - Step 3: 型定義・データ構造（15分）
   - Step 4: Service実装（20分）
   - Step 5: ECSシステム統合（15分）
   - Step 6: テスト実装（20分）
   - Step 7: 統合・エクスポート（5分）
   - Step 8: 品質確認・最適化（10分）

2. **詳細な実装コード例**
   - Effect-TS Service/Layerパターン
   - Schema.Struct型定義
   - vitest テストケース
   - 完全なコード例（コピペ可能）

3. **自動実行コマンドシーケンス**
   - エラー時の自動修正
   - 段階的な品質チェック
   - パフォーマンス確認

**テンプレートの利点:**
- Claude Agentが迷わず実装可能な詳細度
- 80分で完全な機能実装が可能
- Effect-TSベストプラクティス準拠
- 自動検証・自動修正機能

## Issue実装コマンド

### 基本
```bash
claude "Issue #123 を実装して"
```

**自動実行内容:**
1. GitHub Issue内の実行計画解析（Step 1, 2, 3...）
2. 各ステップを順次実行（指定された参照ドキュメント使用）
3. Acceptance Criteria全項目検証
4. 実行計画完了報告（GitHub Actions連携）

### 品質チェック（GitHub Actions自動実行）
- TypeScript型チェック
- Lint・コード品質
- テストカバレッジ 80%+
- ビルド・パフォーマンステスト

## 実装パターン（Effect-TS必須）

```typescript
// Service定義
export const GameService = Context.GenericTag<GameService>("@minecraft/GameService")

// Data構造
export const Player = Schema.Struct({
  id: Schema.String,
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })
})

// Error定義
export const GameError = Schema.TaggedError("GameError")({
  type: Schema.String,
  details: Schema.String
})

// Layer実装
export const GameServiceLive = Layer.effect(GameService, Effect.succeed({
  // 実装
}))
```

## 完了フロー

### 実装完了後
```
✅ Issue #123: 実行計画完了
📋 実行済み: Step 1✅ Step 2✅ Step 3✅ Step 4✅
📊 品質: TypeScript✅ Lint✅ Coverage:87% Performance✅
🎯 Acceptance Criteria: 全項目達成
💡 次: PR作成準備完了
```

### PR作成（別環境）
- 実装完了コードをPR環境に移行
- PR作成・レビュー申請
- 人間レビュー・承認
- マージ・デプロイ

## ディレクトリ構造
```
src/domain/           # DDD ドメインロジック
src/systems/          # ECS システム実装
src/shared/           # 共通パターン・ユーティリティ
docs/                 # 完全仕様書
```

## 参照優先順位
1. **GitHub Issue実行計画** - ステップバイステップ実装手順
2. **Issue指定docs/** - 実行計画で指定された詳細仕様
3. **Issue指定src/shared/** - 実行計画で指定された実装パターン
4. **Acceptance Criteria** - Issue記載の完了条件・テスト要件

## 設定ファイル
```
.claude/
├── CLAUDE.md         # プロジェクト情報・パターン
├── automation.md     # Issue実装自動化
└── README.md         # 使用方法

scripts/
├── quality-check.sh  # 4段階品質ゲート
└── README.md         # 品質チェック詳細
```

---

**哲学**: GitHub Issue実行計画をベースに、Claude AgentがStep-by-Stepで確実に実装完了まで自動実行