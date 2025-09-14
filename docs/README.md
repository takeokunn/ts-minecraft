# TypeScript Minecraft ドキュメント

Effect-TS 3.17+を活用したTypeScript Minecraft Cloneプロジェクトの技術ドキュメント。DDD×ECS×関数型プログラミングによる高品質ゲーム開発を実現します。

## 📖 Diátaxisフレームワーク構成

ドキュメントは目的別に4つのセクションに整理されています。

---

## 📚 [Tutorials](./tutorials/) - 学習指向
**🎯 段階的スキル習得**

プロジェクト理解から実装まで体系的な学習パスを提供

- **🚀 [Getting Started](./tutorials/getting-started/)** - 基本理解と環境セットアップ
- **🎮 [Basic Game Development](./tutorials/basic-game-development/)** - 実践的ゲーム機能実装
- **⚡ [Effect-TS Fundamentals](./tutorials/effect-ts-fundamentals/)** - 関数型プログラミング習得

**使用場面**: 初回学習、オンボーディング、基礎習得

---

## 🔧 [How-to Guides](./how-to/) - 問題解決指向
**🛠️ 実践的解決方法**

具体的課題に対する実践的解決策を提供

- **💻 [Development](./how-to/development/)** - 効率的開発手法
- **🧪 [Testing](./how-to/testing/)** - 高品質テスト作成
- **🛠 [Troubleshooting](./how-to/troubleshooting/)** - 問題診断と解決
- **🚀 [Deployment](./how-to/deployment/)** - CI/CD・リリース

**使用場面**: 特定問題解決、実装方法調査、ベストプラクティス確認

---

## 📖 [Reference](./reference/) - 情報指向
**📋 技術仕様詳細**

API、設定、仕様の包括的情報を提供

- **🔌 [API](./reference/api/)** - 関数・型・インターフェース詳細
- **⚙️ [Configuration](./reference/configuration/)** - プロジェクト設定詳細
- **🎮 [Game Systems](./reference/game-systems/)** - ゲームシステム技術仕様
- **💻 [CLI](./reference/cli/)** - コマンドライン詳細
- **📝 [Glossary](./reference/00-glossary.md)** - 専門用語集

**使用場面**: API詳細確認、設定値調査、技術仕様参照

---

## 🧠 [Explanations](./explanations/) - 理解指向
**💡 設計思想と背景**

設計判断とアーキテクチャ選択の「なぜ」を説明

- **🏗 [Architecture](./explanations/architecture/)** - システム構造と設計思想
- **🎨 [Design Patterns](./explanations/design-patterns/)** - 設計パターン思想
- **🎮 [Game Mechanics](./explanations/game-mechanics/)** - ゲーム設計理論

**使用場面**: アーキテクチャ理解、設計判断、コードレビュー

---

## 🎯 クイックスタート

### 初めての方
1. [Tutorials](./tutorials/) → [Getting Started](./tutorials/getting-started/)
2. 実装体験: [Basic Game Development](./tutorials/basic-game-development/)
3. 深い理解: [Effect-TS Fundamentals](./tutorials/effect-ts-fundamentals/)

### 開発者
1. [How-to](./how-to/) → [Development](./how-to/development/)
2. 問題解決: [Troubleshooting](./how-to/troubleshooting/)
3. 仕様確認: [Reference](./reference/)

### 設計者
1. [Explanations](./explanations/) → [Architecture](./explanations/architecture/)
2. パターン学習: [Design Patterns](./explanations/design-patterns/)
3. 詳細仕様: [Reference](./reference/)

## 🎮 プロジェクト特徴

- **完全関数型設計**: クラス禁止、Effect-TSによる純粋関数アーキテクチャ
- **最新Effect-TSパターン**: Schema.Struct、Context.GenericTag採用
- **DDD + ECS統合**: 境界づけられたコンテキスト × 高性能データ構造
- **完全型安全**: Schema駆動開発とコンパイル時エラー検出

---

**🚀 準備完了！目的に応じて最適なセクションから TypeScript Minecraft 開発を始めましょう。**