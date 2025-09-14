# 🤖 AI Coding Agent向け Issue作成システム

AI Coding Agentが実行可能な詳細な実行計画書付きのGitHub Issueを生成するシステム。

## 📁 ファイル構成

```
scripts/
├── lib/
│   ├── issue-core.sh         # コアライブラリ
│   └── ai-execution-plan.sh  # AI実行計画生成
├── create-issue.sh           # AI最適化Issue作成
├── create-sprint-issues.sh   # Sprint一括作成
├── sprint-start.sh           # Sprint開始・タスク確認
├── pre-pr-check.sh          # PR前品質チェック
├── validate-docs.sh         # ドキュメント検証
└── README.md                # このファイル
```

## 🚀 使用方法

### 基本使用
```bash
# AI実行計画付きIssue作成
./scripts/create-issue.sh P0-001

# プレビュー（作成せずに内容確認）
./scripts/create-issue.sh --dry-run P1-042

# 確認スキップで即座に作成
./scripts/create-issue.sh --force P2-015

# AI実行計画のみ生成・表示
./scripts/create-issue.sh --plan-only P0-001
```

### Sprint一括作成
```bash
# Sprint 1の全タスクでIssue作成
./scripts/create-sprint-issues.sh 1
```

## 🎯 AI Agent向け実行計画の特徴

### ✨ 段階的実行フロー
- **Phase 1**: 分析・準備（既存コード確認、パターン理解）
- **Phase 2**: 実装（具体的なコード作成指示）
- **Phase 3**: 検証（自動テスト・品質確認）
- **Phase 4**: 完了（統合・ドキュメント）

### 🔧 具体的な実行指示
```typescript
// AI Agentが実行すべき具体的なコード例
export const TaskNameSchema = Schema.Struct({
  // 具体的な型定義
});

export const TaskNameService = Context.GenericTag<TaskNameService>('TaskNameService');
```

### ✅ 自動検証コマンド
```bash
# AI Agentが実行すべき検証手順
pnpm typecheck    # TypeScript型安全性
pnpm test:coverage # テストカバレッジ80%以上
pnpm lint         # コード品質
pnpm build        # ビルド成功確認
```

### 📋 プロジェクト制約情報
- **禁止事項**: class, var/let/any, async/await使用禁止
- **必須パターン**: Effect-TS 3.17+, Schema.Struct, Context.GenericTag
- **パフォーマンス**: 60FPS維持, メモリ2GB以下
- **品質基準**: カバレッジ80%以上, TypeScript strict

## 🎨 GitHub Issue Template

`.github/ISSUE_TEMPLATE/ai-task.yml` - AI Agent向け専用テンプレート
- 実装複雑度評価（1-10段階）
- AI実装ガイダンスレベル設定
- 段階的実行フェーズ設計
- 自動検証可能な成功基準
- エラーハンドリング指針

## 🔗 関連ファイル

- `ROADMAP.md` - タスク定義の元データ
- `.claude/CLAUDE.md` - プロジェクト制約・規約
- `docs/reference/api/` - 実装パターン参照

## 💡 AI Agent実行時のポイント

1. **段階的実行**: Phase完了毎に検証実行
2. **既存パターン踏襲**: src/shared/以下の実装例を参考
3. **Context7活用**: 最新Effect-TS情報の確認
4. **品質ファースト**: 各Phase完了時の品質ゲート通過必須

---

**🤖 AI Coding Agent: このシステムで生成されたIssueは、あなたが効率的にタスクを実行できるよう最適化されています！**