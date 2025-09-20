# Claude Code カスタムコマンド

Claude Code のベストプラクティスに基づいた、プロジェクト専用のカスタムコマンド集です。

## 📁 ディレクトリ構造

```
.claude/commands/
├── README.md          # このファイル
├── issue/            # Issue管理コマンド
│   ├── create.md     # Issue作成
│   ├── implement.md  # Issue実装
│   └── list.md       # Issue一覧
├── pr/               # PR管理コマンド
│   ├── create.md     # PR作成
│   └── review.md     # PRレビュー
├── test/             # テストコマンド
│   ├── run.md        # テスト実行
│   └── coverage.md   # カバレッジ確認
└── build/            # ビルドコマンド
    ├── dev.md        # 開発ビルド
    └── prod.md       # 本番ビルド
```

## 🎯 コマンド命名規則

### ネームスペース

- `issue/*` - Issue関連操作
- `pr/*` - Pull Request操作
- `test/*` - テスト実行
- `build/*` - ビルド操作

### 引数

- `$ARGUMENTS` - 全引数
- `$1`, `$2`, ... - 位置引数
- フロントマター内で詳細設定

## 🚀 使用例

```bash
# Issue作成
claude "/issue/create editorconfig lintを導入したい"

# Issue実装
claude "/issue/implement 123"

# PR作成
claude "/pr/create 123"

# テスト実行
claude "/test/run unit"
```

## 📝 コマンド作成ガイドライン

### 1. モジュール性

- 単一責任原則に従う
- 再利用可能な小さなコマンドに分割

### 2. エラーハンドリング

- 適切なエラーメッセージ
- 失敗時の復旧手順を提示

### 3. プログレス表示

- TodoWriteツールを活用
- 長時間タスクには進捗表示

### 4. ドキュメント

- 各コマンドに使用例を記載
- 引数と戻り値を明確に定義

## 🔗 関連ドキュメント

- [Claude Code公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code)
- [プロジェクトCLAUDE.md](../CLAUDE.md)
- [開発ワークフロー](../../docs/how-to/development/README.md)
