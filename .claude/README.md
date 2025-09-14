# .claude/ - Claude Code Configuration

## 📍 Single Source of Truth

**情報の一元管理により保守性と一貫性を確保**

- **プロジェクト仕様**: [`docs/`](../docs/INDEX.md)
- **自動化コマンド**: [`commands/`](commands/index.md)
- **実行スクリプト**: [`scripts/`](../scripts/README.md)
- **PRテンプレート**: `.github/pull_request_template.md`
- **Issueテンプレート**: `.github/ISSUE_TEMPLATE/ai-task.yml`

## 📁 構成

```
.claude/
├── CLAUDE.md      # Claude Agent用エントリーポイント
├── commands/      # カスタムコマンド定義
│   ├── index.md  # コマンドインデックス
│   ├── issue/    # Issue管理コマンド
│   ├── pr/       # PR管理コマンド
│   ├── test/     # テストコマンド
│   └── build/    # ビルドコマンド
└── README.md     # このファイル
```

## 🚀 使用方法

### よく使うワンライナー
```bash
# 自然言語からIssue作成→実装→PR作成まで一気に
claude "editorconfig lintを導入したい Issue を作って実装してPRまで作成して"
```

### 個別実行
```bash
# Issue作成
claude "/issue/create editorconfig lintを導入したい"

# Issue実装
claude "/issue/implement 123"

# PR作成
claude "/pr/create 123"
```

## ⚡ Claude Code Best Practices

1. **TodoWrite必須**: 3ステップ以上のタスクで使用
2. **並列実行**: 独立タスクは必ず並列で実行
3. **品質ゲート**: PR前に typecheck/lint/build を実行
4. **自動クローズ**: PR内に `Closes #xxx` を含める

## 🔄 ワークフロー

1. GitHub Issue取得
2. TodoWriteでタスク管理
3. 並列実装
4. 品質チェック（並列）
5. Git操作（ブランチ/コミット/プッシュ）
6. PR作成（テンプレート使用、`Closes #xxx` 付き）
7. Issue更新