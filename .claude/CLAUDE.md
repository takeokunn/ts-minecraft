# TypeScript Minecraft Clone - Claude Agent Instructions

## 📚 Single Source of Truth

このプロジェクトは **Single Source of Truth** の原則に基づき、情報を以下のように集約しています：

- **プロジェクト仕様**: [`docs/`](../docs/INDEX.md) ディレクトリ
- **自動化コマンド**: [`commands/`](commands/index.md) ディレクトリ
- **実行スクリプト**: [`scripts/`](../scripts/README.md) ディレクトリ

## 🚀 クイックスタート

```bash
# よく使うワンライナー
claude "editorconfig lintを導入したい Issue を作って実装してPRまで作成して"

# Issue実装のみ
claude "Issue #124 を実装して"

# PR作成のみ
claude "現在の変更でPRを作成して"
```

詳細なコマンドリファレンスは [`commands/index.md`](commands/index.md) を参照してください。

## 📖 参照優先順位

1. **GitHub Issue**: 具体的実装手順・完了条件
2. **docs/INDEX.md**: プロジェクト全体のエントリーポイント
3. **docs/how-to/**: 実装方法・トラブルシューティング
4. **docs/reference/**: API仕様・設定ファイル詳細
5. **src/shared/**: 実装済みコードパターン例

## 🔍 クイックリンク

- [プロジェクトインデックス](../docs/INDEX.md)
- [開発規約](../docs/how-to/development/development-conventions.md)
- [Effect-TSパターン](../docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
- [トラブルシューティング](../docs/how-to/troubleshooting/README.md)
