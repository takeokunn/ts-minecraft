# TypeScript Minecraft Clone - ドキュメントインデックス

## Single Source of Truth（唯一の情報源）

この `docs/` ディレクトリは、プロジェクトのすべてのドキュメントにおける **Single Source of Truth（唯一の情報源）** として機能します。他のファイルは内容を複製するのではなく、この場所を参照する必要があります。

## プロジェクト概要

**TypeScript Minecraft Clone**: Effect-TS + DDD + ECS による完全関数型Minecraftクローン

### コア目標

- **パフォーマンス**: 60FPS / <2GB メモリ
- **品質**: 80%+ カバレッジ
- **アーキテクチャ**: 完全関数型・イベント駆動・DDD/ECS

### 技術的制約・設計方針

- **クラス禁止**: Effect-TS Service/Layerパターンによる関数型設計
- **変数制約**: var,let,any,async禁止（const + Effect.gen必須）
- **型安全性**: Effect.gen/Schema.Struct必須
- **ランタイム検証**: 外部データはすべてSchemaによる検証必須
- **エラーハンドリング**: 例外禁止・Effect型によるエラー表現

### Effect-TS採用理由

1. **型安全性の向上**: Brand型により同種プリミティブの混同を防止
2. **ランタイム安全性**: Schemaによる実行時データ検証
3. **関数型エラーハンドリング**: Effect型による予測可能なエラー処理
4. **コンポーザビリティ**: 小さな関数を組み合わせた堅牢なシステム構築
5. **テスタビリティ**: 依存性注入により100%モック可能な設計

## ドキュメント構造

### 📚 [チュートリアル](./tutorials/README.md)

はじめるためのステップバイステップガイド

- [入門ガイド](./tutorials/getting-started/README.md)
- [Effect-TS基礎](./tutorials/effect-ts-fundamentals/README.md)
- [基本ゲーム開発](./tutorials/basic-game-development/README.md)

### ⚡ [Effect-TS型システム](./tutorials/effect-ts-fundamentals/effect-ts-type-system.md)

**完全関数型プログラミング基盤**

プロジェクトのコア技術基盤であるEffect-TSによる型安全性とランタイム検証の包括的システム。ブランド型・Schema・関数型エラーハンドリングによって、コンパイル時・実行時の両方で堅牢性を保証します。

- [**型システム基礎**](./tutorials/effect-ts-fundamentals/effect-ts-type-system.md) - ブランド型・Schema・Immutable Collections
- [**型リファレンス**](./reference/effect-ts-types/type-reference.md) - 50+のBrand型定義とSchema
- [**マイグレーションガイド**](./how-to/migration/effect-ts-migration.md) - 従来TypeScriptからの移行手順
- [**型安全パターン**](./tutorials/design-patterns/type-safety-patterns.md) - 設計パターンとベストプラクティス

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
3. **Effect-TS型システム**: [型システム基礎](./tutorials/effect-ts-fundamentals/effect-ts-type-system.md)
4. **Effect-TSパターン**: [Effect-TSパターン](./tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
5. **型リファレンス**: [Brand型・Schema一覧](./reference/effect-ts-types/type-reference.md)
6. **テスト戦略**: [テストガイド](./how-to/testing/testing-guide.md)

### AIエージェント向け

1. **Issue実装フロー**: [GitHub Issue管理](./how-to/development/github-issue-management.md)
2. **エントリーポイント**: [エントリーポイント](./how-to/development/entry-points.md)
3. **Effect-TS実装ガイドライン**: [実装ガイドライン](./how-to/development/effect-ts-guidelines.md) - TestClock/catchTags/Supervisor/Metric
4. **Effect-TS完全準拠**: [完全準拠ガイドライン](./reference/effect-ts-compliance.md) - 禁止/推奨パターン一覧
5. **Effect-TS移行**: [移行ガイド](./tutorials/effect-ts-migration-guide.md) - Before/After実例
6. **実装パターン**: [サービスパターン](./explanations/design-patterns/service-patterns.md)
7. **型安全設計**: [型安全パターン](./tutorials/design-patterns/type-safety-patterns.md)
8. **トラブルシューティング**: [よくあるエラー](./how-to/troubleshooting/common-errors.md)

## Issue駆動開発

### AIタスク実装フロー

1. **Issue確認**: `.github/ISSUE_TEMPLATE/ai-task.yml`形式のIssue
2. **実装計画**: 8段階実行ステップ (Step 1-8)
3. **コード生成**: Effect-TS Service/Layer/Schemaパターン
4. **自動検証**: `pnpm typecheck && pnpm check && pnpm test && pnpm build`
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
pnpm check      # 総合的なコード品質チェック
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
