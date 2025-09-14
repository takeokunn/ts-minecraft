# TypeScript Minecraft Clone
## プロジェクト概要

Effect-TS + DDD + ECS による完全関数型Minecraftクローン

**目標**: 60FPS / <2GB メモリ / 80%+ カバレッジ
**制約**: クラス禁止 / var,let,any,async禁止 / Effect.gen/Schema.Struct必須

## Issue実装フロー
### 基本コマンド
```
claude "Issue #123 を実装して"  → GitHub Issue実行計画に従って自動実装
```

### Issue実行計画の参照

**AI Task Issueテンプレート**（`.github/ISSUE_TEMPLATE/ai-task.yml`）使用

Claude AgentはGitHub Issueから以下を自動実行：
- **8段階実行ステップ**: 80分で完全実装（Step 1-8）
- **詳細な実装コード**: Effect-TS Service/Layer/Schemaパターン
- **自動検証**: pnpm typecheck/lint/test/build
- **トラブルシューティング**: エラー時の自動修正手順

## 参照優先順位

1. **GitHub Issue実行計画**（ai-task.ymlテンプレート）- 具体的実装手順・完了条件
2. **docs/** - Issue内で指定された詳細仕様
3. **src/shared/** - Issue内で指定された実装パターン例
4. **ROADMAP.md** - 全体コンテキスト
