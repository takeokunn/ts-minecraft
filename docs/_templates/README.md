---
title: "ドキュメントテンプレート - 統一フォーマットガイド"
description: "プロジェクト全体で一貫したドキュメント作成のためのテンプレート集。YAML frontmatter、相互参照パターン、品質ガイドライン。"
ai_context: "Templates and guidelines for maintaining documentation consistency across the TypeScript Minecraft project"
machine_readable:
  type: "reference"
  topics: ["documentation", "templates", "metadata", "guidelines"]
  complexity: "beginner"
prerequisites:
  - "basic-markdown"
  - "yaml-fundamentals"
estimated_reading_time: "3 minutes"
difficulty: "beginner"
related_docs:
  - "../README.md"
  - "../how-to/development/development-conventions.md"
  - "./yaml-frontmatter-enhanced.md"
internal_links:
  - "#利用可能なテンプレート"
  - "#品質ガイドライン"
  - "#使用方法"
---

# Documentation Templates

このディレクトリには、プロジェクト全体で一貫したドキュメントを作成するためのテンプレートが含まれています。

## 利用可能なテンプレート

### [Enhanced YAML Frontmatter Template](./yaml-frontmatter-enhanced.md)
- TSDoc準拠のメタデータテンプレート
- Diátaxisフレームワークに対応
- Context7最適化済み

### [Cross-reference Navigation Template](./cross-reference-navigation.md)
- ドキュメント間の相互参照パターン
- 一貫したナビゲーション構造

## 使用方法

1. 新しいドキュメント作成時は、該当するテンプレートを参考にする
2. YAMLフロントマターを適切に設定する
3. Diátaxisカテゴリ（Tutorial、How-to、Reference、Explanation）に従って分類する

## 品質ガイドライン

- **一貫性**: すべてのドキュメントで同じテンプレート形式を使用
- **メタデータ完備**: 検索性とナビゲーション性を向上
- **相互参照**: 関連ドキュメントへの適切なリンクを設置

## 関連リンク

- [Documentation Structure](../README.md)
- [Writing Guidelines](../how-to/development/development-conventions.md)