# 📖 Reference - 情報指向ドキュメント

このセクションは**情報指向**のドキュメントです。技術仕様、API詳細、設定オプションなど辞書的な情報を体系的に提供します。

## 🎯 このセクションの目的

- API仕様の詳細な説明
- 設定ファイルの完全なオプション一覧
- ゲームシステムの技術仕様
- CLI コマンドの詳細な使用方法

## 📚 リファレンス分類

### 🔌 [API](./api/)
**プログラムインターフェースの詳細仕様**

- [コアAPI](./api/core-apis.md)
- [ドメインAPI](./api/domain-apis.md)
- [インフラストラクチャAPI](./api/infrastructure-api-reference.md)
- [ユーティリティ関数](./api/utility-functions.md)
- [Effect-TS Effect API](./api/effect-ts-effect-api.md)
- [Effect-TS Schema API](./api/effect-ts-schema-api.md)
- [Effect-TS Context API](./api/effect-ts-context-api.md)

### 🏗️ [Architecture](./architecture-patterns.md)
**設計原則とベストプラクティス**

- [アーキテクチャパターン集](./architecture-patterns.md) - DDD・ECS・Effect-TS統合パターン

### ⚙️ [Configuration](./configuration/)
**設定ファイルとオプション詳細**

- [ビルド設定](./configuration/build-config.md)
- [TypeScript設定](./configuration/typescript-config.md)
- [Vite設定](./configuration/vite-config.md)
- [Vitest設定](./configuration/vitest-config.md)
- [開発環境設定](./configuration/development-config.md)
- [プロジェクト設定](./configuration/project-config.md)
- [パッケージ設定](./configuration/package-json.md)

### 🎮 [Game Systems](./game-systems/)
**ゲームシステムの技術仕様**

- [ワールドAPI](./game-systems/game-world-api.md)
- [ブロックAPI](./game-systems/game-block-api.md)
- [プレイヤーAPI](./game-systems/game-player-api.md)
- [ワールドデータ構造](./game-systems/world-data-structure.md)
- [チャンク形式](./game-systems/chunk-format.md)
- [セーブファイル形式](./game-systems/save-file-format.md)
- [ゲームロジック仕様書](./game-logic-specification.md) - Minecraft機能の完全技術仕様

### 📊 [Performance & Metrics](./performance-metrics.md)
**パフォーマンス計測と最適化**

- [パフォーマンスメトリクス](./performance-metrics.md) - 計測基準とベンチマーク指標

### 🔐 [Security](./security-guidelines.md)
**セキュリティとプライバシー**

- [セキュリティガイドライン](./security-guidelines.md) - 包括的セキュリティベストプラクティス

### 💻 [CLI](./cli/)
**コマンドラインインターフェース詳細**

- [開発コマンド](./cli/development-commands.md)
- [テストコマンド](./cli/testing-commands.md)

### 🔧 [Troubleshooting](./troubleshooting/)
**問題解決とデバッグ**

- [パフォーマンス診断](./troubleshooting/performance-diagnostics.md) - 実践的問題解決リファレンス

### 📝 [Glossary](./glossary.md)
**用語集とプロジェクト固有の専門用語解説**

## 🔍 使用方法

1. **検索性重視**: 特定のAPI・設定・仕様を素早く検索
2. **完全性**: 全てのオプション・パラメータを網羅
3. **正確性**: 実装と完全に一致した情報のみ記載

## 🔗 関連セクション

- **[Tutorials](../tutorials/)**: 基礎的な使い方を学ぶ
- **[How-to Guides](../how-to/)**: 実践的な問題解決方法
- **[Explanations](../explanations/)**: 設計背景と理論的説明

---

**🔍 検索のヒント**: 特定のAPIや設定項目を探している場合は、各サブセクションのREADMEからより詳細な情報にアクセスできます。