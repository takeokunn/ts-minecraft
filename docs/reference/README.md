---
title: "リファレンス概要 - 情報指向専用ドキュメント"
description: "API、設定、仕様の包括的・体系的情報を辞書形式で提供。検索性と正確性を重視した技術情報集約。"
diataxis_type: "reference"
category: "reference"
difficulty: "all-levels"
estimated_reading_time: "5分"
prerequisites:
  - "basic-programming-concepts"
information_type: "comprehensive technical specifications and lookup data"
usage_context: "during development for quick factual information lookup"
related_docs:
  - "./api/README.md"
  - "./configuration/README.md"
  - "./game-systems/README.md"
  - "./cli/README.md"
internal_links:
  - "../tutorials/README.md"
  - "../how-to/README.md"
  - "../explanations/README.md"
tags: ["reference", "api", "specifications", "lookup", "factual-information", "technical-details"]
ai_context:
  purpose: "reference"
  audience: "developers seeking factual technical information and specifications"
  key_concepts: ["comprehensive specifications", "lookup information", "factual accuracy", "systematic organization"]
machine_readable: true
---

# 📖 Reference - 情報指向専用ドキュメント

**🎯 単一責務**: 正確な技術情報の体系的提供のみに特化

技術仕様、API詳細、設定オプションの辞書的・検索可能な情報を専門的に提供する専用セクション。開発時の正確なリファレンスとしての役割に完全特化。

## 🎯 このセクションの単一責務

**技術情報提供のみに特化した構成:**
- API仕様・シグネチャの完全・正確な詳細記述
- 設定ファイル・オプションの網羅的一覧と仕様
- ゲームシステム技術仕様の辞書的・検索可能な整理
- CLIコマンド詳細・引数・オプションの完全仕様

## 📚 リファレンス分類

### 🔌 [API](./api/README.md)
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

### ⚙️ [Configuration](./configuration/README.md)
**設定ファイルとオプション詳細**

- [ビルド設定](./configuration/build-config.md)
- [TypeScript設定](./configuration/typescript-config.md)
- [Vite設定](./configuration/vite-config.md)
- [Vitest設定](./configuration/vitest-config.md)
- [開発環境設定](./configuration/development-config.md)
- [プロジェクト設定](./configuration/project-config.md)
- [パッケージ設定](./configuration/package-json.md)

### 🎮 [Game Systems](./game-systems/README.md)
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

### 💻 [CLI](./cli/README.md)
**コマンドラインインターフェース詳細**

- [開発コマンド](./cli/development-commands.md)
- [テストコマンド](./cli/testing-commands.md)

### 🔧 [Troubleshooting](./troubleshooting/README.md)
**問題解決とデバッグ**

- [パフォーマンス診断](./troubleshooting/performance-diagnostics.md) - 実践的問題解決リファレンス

### 📝 [Glossary](./glossary.md)
**用語集とプロジェクト固有の専門用語解説**

## 🔍 使用方法

1. **検索性重視**: 特定のAPI・設定・仕様を素早く検索
2. **完全性**: 全てのオプション・パラメータを網羅
3. **正確性**: 実装と完全に一致した情報のみ記載

## 🔗 関連セクション

- **[Tutorials](../tutorials/README.md)**: 基礎的な使い方を学ぶ
- **[How-to Guides](../how-to/README.md)**: 実践的な問題解決方法
- **[Explanations](../explanations/README.md)**: 設計背景と理論的説明

---

**🔍 検索のヒント**: 特定のAPIや設定項目を探している場合は、各サブセクションのREADMEからより詳細な情報にアクセスできます。