# TypeScript Minecraft Clone - Claude Agent Instructions

## 📚 Single Source of Truth

このプロジェクトは **Single Source of Truth** の原則に基づき、情報を以下のように集約しています：

- **プロジェクト仕様**: [`docs/`](../docs/INDEX.md) ディレクトリ
- **自動化コマンド**: [`commands/`](commands/index.md) ディレクトリ
- **実行スクリプト**: [`scripts/`](../scripts/README.md) ディレクトリ

## 🚀 クイックスタート

```bash
# よく使うワンライナー（CI確認付き）
claude "editorconfig lintを導入したい Issue を作って実装してPRまで作成してCIが通ることを確認して"

# Issue実装のみ
claude "Issue #124 を実装して"

# PR作成後のCI確認
claude "現在の変更でPRを作成してCIが通ることを確認して"

# CI失敗時の自動修正
claude "CIを修正して"

# テンプレート活用（Issue実行計画書）
claude "Issue実行計画書テンプレートを使ってP1-012のIssueを作成して実装して"
```

### 🔄 CI確認フロー

Issue実装後は**必ずCI結果を確認**します：

1. **自動確認**: PR作成時に自動でCI状態をチェック
2. **失敗時対応**: 自動修正可能な問題は即座に修正
3. **成功確認**: 全チェック項目のPASSを確認してから完了報告

### 📋 AI実行計画書テンプレート活用

**テンプレート場所**: GitHub Issues → New Issue → "AI実行計画書 - 詳細実装Issue"

**活用パターン**:
```bash
# ROADMAPタスクからIssue作成+実装
claude "P1-012のAI実行計画書Issueを作成して実装して"

# 既存Issue実装（Step 1-8自動実行）
claude "Issue #123 を実装して"

# 複数Issue並列実行
claude "Issue #123 と #124 を並列で実装して"
```

**詳細活用ガイド**: [`docs/how-to/development/github-issue-management.md`](../docs/how-to/development/github-issue-management.md#-ai実行計画書テンプレート活用ガイド)

## ⚠️ Issue実装時の必須確認事項

**Issue実装前に必ず以下を実行してください：**

1. **@docs/ 必読**: Issue実装前に必ず [`@docs/`](../docs/INDEX.md) を読んで設計方針・パターンを確認
2. **既存メモリ確認**: `list_memories` で過去の実装パターン・決定事項を確認
3. **ライブラリ仕様確認**: 使用予定ライブラリはContext7で最新仕様を確認

**実装順序厳守：**
```
@docs/読込 → memories確認 → ライブラリ仕様確認 → Issue実装開始
```

この手順を省略すると、プロジェクトの設計方針に反する実装になる可能性があります。

## 📖 参照優先順位

1. **GitHub Issue**: 具体的実装手順・完了条件
2. **docs/INDEX.md**: プロジェクト全体のエントリーポイント
3. **docs/how-to/**: 実装方法・トラブルシューティング
4. **docs/reference/**: API仕様・設定ファイル詳細
5. **src/shared/**: 実装済みコードパターン例

Claude AgentはGitHub Issueから以下を自動実行：

- **Pre-Step実装前確認**: `list_memories`・`@docs/`設計方針確認・Context7ライブラリ仕様確認
- **8段階実行ステップ**: 段階的な完全実装（Step 1-8）
- **詳細な実装コード**: Effect-TS Service/Layer/Schemaパターン
- **Post-Step実装後処理**: `@docs/`更新・`write_memory`保存・PR自動作成
- **自動検証**: pnpm typecheck/check/test/build
- **トラブルシューティング**: エラー時の自動修正手順

## 🔍 クイックリンク

- [プロジェクトインデックス](../docs/INDEX.md)
- [開発規約](../docs/how-to/development/development-conventions.md)
- [Effect-TSパターン](../docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
- [トラブルシューティング](../docs/how-to/troubleshooting/README.md)
