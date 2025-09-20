# TypeScript Minecraft Clone - ドキュメントインデックス

## Single Source of Truth（唯一の情報源）

この `docs/` ディレクトリは、プロジェクトのすべてのドキュメントにおける **Single Source of Truth（唯一の情報源）** として機能します。他のファイルは内容を複製するのではなく、この場所を参照する必要があります。

## プロジェクト概要

**TypeScript Minecraft Clone**: Effect-TS + DDD + ECS による完全関数型Minecraftクローン

### コア目標

- **パフォーマンス**: 60FPS / <2GB メモリ
- **品質**: 80%+ カバレッジ
- **アーキテクチャ**: 完全関数型・イベント駆動・DDD/ECS

### 技術的制約

- クラス禁止 (Effect-TS Service/Layerパターン使用)
- var,let,any,async禁止
- Effect.gen/Schema.Struct必須

## ドキュメント構造

### 📚 [チュートリアル](./tutorials/README.md)

はじめるためのステップバイステップガイド

- [入門ガイド](./tutorials/getting-started/README.md)
- [Effect-TS基礎](./tutorials/effect-ts-fundamentals/README.md)
- [基本ゲーム開発](./tutorials/basic-game-development/README.md)

### 🔧 [How-Toガイド](./how-to/README.md)

特定のタスクのための実践的ガイド

- [開発ワークフロー](./how-to/development/README.md)
- [テスト戦略](./how-to/testing/README.md)
- [トラブルシューティング](./how-to/troubleshooting/README.md)
- [デプロイメント](./how-to/deployment/README.md)

### 💡 [解説](./explanations/README.md)

概念の理解と設計上の決定

- [アーキテクチャ概要](./explanations/architecture/README.md)
- [デザインパターン](./explanations/design-patterns/README.md)
- [ゲームメカニクス](./explanations/game-mechanics/README.md)

### 📖 [リファレンス](./reference/README.md)

技術仕様とAPIドキュメント

- [APIリファレンス](./reference/api/README.md)
- [設定](./reference/configuration/README.md)
- [ゲームシステム](./reference/game-systems/README.md)
- [CLIコマンド](./reference/cli/README.md)

## クイックリンク

### 開発者向け

1. **環境構築**: [環境セットアップ](./tutorials/basic-game-development/environment-setup.md)
2. **開発規約**: [開発規約](./how-to/development/development-conventions.md)
3. **Effect-TSパターン**: [Effect-TSパターン](./tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
4. **テスト戦略**: [テストガイド](./how-to/testing/testing-guide.md)

### AIエージェント向け

1. **Issue実装フロー**: [GitHub Issue管理](./how-to/development/github-issue-management.md)
2. **エントリーポイント**: [エントリーポイント](./how-to/development/entry-points.md)
3. **実装パターン**: [サービスパターン](./explanations/design-patterns/service-patterns.md)
4. **トラブルシューティング**: [よくあるエラー](./how-to/troubleshooting/common-errors.md)

## Issue駆動開発

### AIタスク実装フロー

1. **Issue確認**: `.github/ISSUE_TEMPLATE/ai-task.yml`形式のIssue
2. **実装計画**: 8段階実行ステップ (Step 1-8)
3. **コード生成**: Effect-TS Service/Layer/Schemaパターン
4. **自動検証**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
5. **エラー修正**: トラブルシューティング手順に従う

### 参照優先順位

1. **GitHub Issue**: 具体的実装手順・完了条件
2. **docs/**: 詳細仕様・実装パターン
3. **src/shared/**: 実装済みパターン例
4. **ROADMAP.md**: 全体コンテキスト

## コマンドリファレンス

### 開発

```bash
pnpm dev        # 開発サーバー起動
pnpm build      # プロダクションビルド
pnpm preview    # ビルドプレビュー
```

### 品質保証

```bash
pnpm typecheck  # 型チェック
pnpm lint       # Biomeによる静的解析とフォーマットチェック
pnpm test       # Vitestによるテスト実行
pnpm coverage   # カバレッジレポート生成
```

### ドキュメント

```bash
# ドキュメント参照
cat docs/INDEX.md                 # このインデックス
cat docs/tutorials/README.md      # チュートリアル一覧
cat docs/how-to/README.md         # How-Toガイド一覧
cat docs/reference/README.md      # リファレンス一覧
```

## コントリビューション

1. **ドキュメント更新**: すべてのドキュメント変更は `docs/` で行う
2. **重複禁止**: コンテンツを複製せず、常に `docs/` を参照する
3. **一貫性**: 確立されたパターンと規約に従う
4. **検証**: すべてのコード例がコンパイルされ、テストが通ることを確認する

## ナビゲーション

- **[← プロジェクトルート](../README.md)**
- **[→ チュートリアル](./tutorials/README.md)**
- **[→ How-Toガイド](./how-to/README.md)**
- **[→ 解説](./explanations/README.md)**
- **[→ リファレンス](./reference/README.md)**
