# TypeScript Minecraft ドキュメント

Effect-TS 3.17+を活用したTypeScript Minecraft Cloneプロジェクトの技術ドキュメント。DDD×ECS×関数型プログラミングによる高品質ゲーム開発を実現します。

> 📚 **最新ライブラリドキュメント**: 本プロジェクトで使用しているライブラリの最新ドキュメントはContext7を通じて参照可能です。
> - Effect-TS: `/effect/effect`
> - Schema: `/effect/schema`
> - Three.js: `/mrdoob/three.js`

## 📖 Diátaxisフレームワーク構成

ドキュメントは目的別に4つのセクションに整理されています。

---

## 📚 [Tutorials](./tutorials/README.md) - 学習指向
**🎯 段階的スキル習得専用セクション**

プロジェクト理解から実装まで体系的な学習パスを提供。初心者から上級者まで順序立てて学習できる構成。

- **🚀 [Getting Started](./tutorials/getting-started/README.md)** - プロジェクト理解・環境構築・基本概念習得
- **🎮 [Basic Game Development](./tutorials/basic-game-development/README.md)** - 実践的ゲーム機能実装・ハンズオン学習
- **⚡ [Effect-TS Fundamentals](./tutorials/effect-ts-fundamentals/README.md)** - 関数型プログラミング・Effect-TS完全習得
  - 📖 最新Effect-TS APIドキュメントはContext7で参照可能

**単一責務**: 学習体験の最適化のみに特化
**使用場面**: 初回学習、オンボーディング、基礎習得、スキルアップ

---

## 🔧 [How-to Guides](./how-to/README.md) - 問題解決指向
**🛠️ 実践的問題解決専用セクション**

開発中の具体的課題に対するステップバイステップの実践的解決策を提供。即座に実行可能な手順重視。

- **💻 [Development](./how-to/development/README.md)** - 開発効率化・ワークフロー最適化・規約適用
- **🧪 [Testing](./how-to/testing/README.md)** - 高品質テスト実装・テスト戦略・品質保証
- **🛠 [Troubleshooting](./how-to/troubleshooting/README.md)** - エラー診断・問題解決・デバッグ手法
- **🚀 [Deployment](./how-to/deployment/README.md)** - CI/CD設定・リリース自動化・運用

**単一責務**: 具体的問題の即座解決のみに特化
**使用場面**: 特定問題解決、実装方法調査、ベストプラクティス確認、緊急対応

---

## 📖 [Reference](./reference/README.md) - 情報指向
**📋 技術仕様・辞書的情報専用セクション**

API、設定、仕様の包括的・体系的情報を辞書形式で提供。検索性と正確性を重視した情報集約。

- **🔌 [API](./reference/api/README.md)** - 関数シグネチャ・型定義・インターフェース完全仕様
- **⚙️ [Configuration](./reference/configuration/README.md)** - 設定項目・環境変数・ビルド設定詳細
- **🎮 [Game Systems](./reference/game-systems/README.md)** - ゲームシステム技術仕様・データ構造定義
- **💻 [CLI](./reference/cli/README.md)** - コマンドライン引数・オプション・使用例
- **📝 [Glossary](./reference/glossary.md)** - プロジェクト専門用語・定義・概念辞典

**単一責務**: 正確な技術情報の体系的提供のみに特化
**使用場面**: API詳細確認、設定値調査、技術仕様参照、用語確認、開発時リファレンス

---

## 🧠 [Explanations](./explanations/README.md) - 理解指向
**💡 設計思想・背景知識専用セクション**

設計判断とアーキテクチャ選択の「なぜ」を深く説明。トレードオフ・比較検討・設計思想の理論的背景を提供。

- **🏗 [Architecture](./explanations/architecture/README.md)** - システム構造・設計原則・アーキテクチャ判断根拠
- **🎨 [Design Patterns](./explanations/design-patterns/README.md)** - パターン選択理由・実装思想・ベストプラクティス背景
- **🎮 [Game Mechanics](./explanations/game-mechanics/README.md)** - ゲーム設計理論・メカニクス設計・バランス調整思想

**単一責務**: 設計判断の理論的背景解説のみに特化
**使用場面**: アーキテクチャ理解、設計判断、コードレビュー、技術選定、教育・指導

---

## 🎯 クイックスタート

### 初めての方
1. [Tutorials](./tutorials/README.md) → [Getting Started](./tutorials/getting-started/README.md)
2. 実装体験: [Basic Game Development](./tutorials/basic-game-development/README.md)
3. 深い理解: [Effect-TS Fundamentals](./tutorials/effect-ts-fundamentals/README.md)

### 開発者
1. [How-to](./how-to/README.md) → [Development](./how-to/development/README.md)
2. 問題解決: [Troubleshooting](./how-to/troubleshooting/README.md)
3. 仕様確認: [Reference](./reference/README.md)

### 設計者
1. [Explanations](./explanations/README.md) → [Architecture](./explanations/architecture/README.md)
2. パターン学習: [Design Patterns](./explanations/design-patterns/README.md)
3. 詳細仕様: [Reference](./reference/README.md)

## 🎮 プロジェクト特徴

- **完全関数型設計**: クラス禁止、Effect-TSによる純粋関数アーキテクチャ
- **最新Effect-TSパターン**: Schema.Struct、Context.GenericTag採用
  - 🌐 Context7で最新のEffect-TSパターンとAPIドキュメントを確認
- **DDD + ECS統合**: 境界づけられたコンテキスト × 高性能データ構造
- **完全型安全**: Schema駆動開発とコンパイル時エラー検出

---

**🚀 準備完了！目的に応じて最適なセクションから TypeScript Minecraft 開発を始めましょう。**