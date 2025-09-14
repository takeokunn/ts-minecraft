# Claude Code コマンドインデックス

TypeScript Minecraft Clone プロジェクトの自動化コマンド集です。

## 🎯 クイックスタート

### よく使うコマンド

```bash
# Issue作成から実装、PR作成まで一気に
claude "editorconfig lintを導入したい Issue を作って実装してPRまで作成して"

# Issue実装のみ
claude "Issue #123 を実装して"

# PR作成のみ
claude "現在の変更でPRを作成して"
```

## 📚 コマンドカテゴリ

### Issue管理
- [`/issue/create`](issue/create.md) - 自然言語からIssue作成
- [`/issue/implement`](issue/implement.md) - Issue自動実装
- `/issue/list` - Issue一覧表示

### PR管理
- [`/pr/create`](pr/create.md) - PR自動作成
- `/pr/review` - PRレビュー支援

### テスト
- [`/test/run`](test/run.md) - テスト実行
- `/test/coverage` - カバレッジ確認

### ビルド
- [`/build/dev`](build/dev.md) - 開発ビルド
- `/build/prod` - 本番ビルド

## 🔄 推奨ワークフロー

### 1. 新機能開発フロー

```mermaid
graph LR
    A[要望] --> B[Issue作成]
    B --> C[自動実装]
    C --> D[品質チェック]
    D --> E[PR作成]
    E --> F[マージ]
```

```bash
# Step 1: Issue作成
claude "/issue/create 新機能の説明"

# Step 2: 実装
claude "/issue/implement 123"

# Step 3: PR作成
claude "/pr/create 123"
```

### 2. バグ修正フロー

```bash
# 既存Issueの実装
claude "Issue #456 のバグを修正して"

# 品質チェック
claude "/test/run"

# PR作成
claude "/pr/create 456"
```

## ⚡ 並列実行の活用

Claude Code は複数のツールを並列実行できます：

```bash
# 品質チェックの並列実行
pnpm typecheck & pnpm lint & pnpm build
```

## 📋 TodoWrite の活用

3ステップ以上のタスクでは必ずTodoWriteを使用：

```bash
# 自動的にタスクが分解・追跡される
claude "複雑な機能を実装して"
```

## 🔧 カスタマイズ

### コマンド追加

1. `.claude/commands/` に新しいマークダウンファイルを作成
2. フロントマターで設定を定義
3. 実行スクリプトを記述

### フック設定

`.claude/hooks/` でワークフローをカスタマイズ：
- PreToolUse - ツール実行前
- PostToolUse - ツール実行後
- UserPromptSubmit - プロンプト送信時

## 📖 関連ドキュメント

- [プロジェクトCLAUDE.md](../CLAUDE.md)
- [開発ワークフロー](../../docs/how-to/development/README.md)
- [Claude Code公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code)