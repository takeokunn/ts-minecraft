# Enhanced YAML Frontmatter Template (TSDoc準拠)

Context7から取得した最新のTSDoc標準とDiátaxisベストプラクティスに基づく統一メタデータテンプレート。

## 基本構造（TSDoc準拠）

```yaml
---
# === TSDoc標準メタデータ ===
title: '明確で検索最適化されたタイトル (50文字以内)'
description: '具体的で有用な1-2行説明 (140文字以内)'
author: 'TypeScript Minecraft Team'
version: '1.0.0'
lastModified: '2024-XX-XX'

# === Diátaxisカテゴリ分類 ===
diataxis_type: 'tutorial|how-to|reference|explanation' # 必須: 単一責務の原則
category: 'architecture|specification|guide|reference|example|quickstart|troubleshooting'
subcategory: 'core-features|enhanced-features|infrastructure|patterns'

# === 学習メタデータ ===
difficulty: 'beginner|intermediate|advanced'
estimated_reading_time: 'X分'
prerequisites: ['prerequisite1', 'prerequisite2']
learning_objectives: ['目標1', '目標2', '目標3']

# === 技術メタデータ ===
tags: ['effect-ts', 'typescript', 'ddd'] # 3-7個推奨
tech_stack: ['Effect-TS 3.17+', 'TypeScript 5.0+', 'Node.js 20+']
patterns_used: ['service-patterns', 'error-handling-patterns']

# === 関連性メタデータ ===
related_docs:
  - path: '../related-doc.md'
    relationship: 'prerequisite|follows|extends|alternative'
    description: '関連性の説明'
cross_references:
  - section: 'tutorials'
    docs: ['getting-started.md', 'basic-concepts.md']
  - section: 'reference'
    docs: ['api-reference.md']

# === Context7最適化 ===
search_keywords: ['キーワード1', 'キーワード2'] # 検索最適化
content_type: 'conceptual|procedural|reference|narrative'
audience: ['beginner-developers', 'architects', 'contributors']
---
```

## Diátaxisタイプ別特化テンプレート

### 📚 Tutorial用（学習指向）

```yaml
---
title: 'Effect-TSでプレイヤーシステムを作る'
description: 'ステップバイステップでプレイヤーの基本機能を実装し、Effect-TSパターンを習得'
diataxis_type: 'tutorial'
category: 'guide'
subcategory: 'core-features'
difficulty: 'beginner'
estimated_reading_time: '20分'
prerequisites: ['typescript-basics', 'effect-ts-fundamentals']
learning_objectives:
  - 'プレイヤーエンティティの作成方法を理解する'
  - 'Effect-TSのContextパターンを実装できる'
  - '基本的なゲームループを構築できる'
tags: ['player-system', 'effect-ts', 'tutorial', 'hands-on']
patterns_used: ['service-patterns', 'context-patterns']
related_docs:
  - path: '../../reference/api/player-api.md'
    relationship: 'reference'
    description: 'プレイヤーAPI詳細仕様'
---
```

### 🔧 How-to用（問題解決指向）

```yaml
---
title: 'インベントリ同期エラーのデバッグ方法'
description: 'マルチプレイヤー環境でのインベントリ同期問題の特定と解決手順'
diataxis_type: 'how-to'
category: 'troubleshooting'
subcategory: 'core-features'
difficulty: 'intermediate'
estimated_reading_time: '15分'
prerequisites: ['inventory-system-basics', 'effect-ts-error-handling']
problem_statement: 'マルチプレイヤーでインベントリが正しく同期されない'
solution_approach: '段階的診断とEffect-TSエラーハンドリング活用'
tags: ['inventory', 'multiplayer', 'debugging', 'synchronization']
patterns_used: ['error-handling-patterns', 'async-patterns']
tools_required: ['Developer Console', 'Network Inspector']
---
```

### 📖 Reference用（情報指向）

```yaml
---
title: 'World API Reference'
description: 'ワールド管理に関するすべてのAPI、型定義、設定オプションの包括的リファレンス'
diataxis_type: 'reference'
category: 'reference'
subcategory: 'core-features'
difficulty: 'intermediate'
estimated_reading_time: '参照用'
prerequisites: ['schema-basics', 'effect-ts-context']
api_version: '3.17.0'
api_stability: 'stable|experimental|deprecated'
tags: ['world-api', 'reference', 'schema', 'types']
related_docs:
  - path: '../../explanations/game-mechanics/core-features/world-management-system.md'
    relationship: 'explanation'
    description: 'ワールドシステムの設計思想'
---
```

### 🧠 Explanation用（理解指向）

```yaml
---
title: 'なぜDDD + ECS統合を選んだか'
description: 'ドメイン駆動設計とEntity Component Systemを統合した設計判断の背景と利点'
diataxis_type: 'explanation'
category: 'architecture'
subcategory: 'patterns'
difficulty: 'advanced'
estimated_reading_time: '25分'
prerequisites: ['ddd-concepts', 'ecs-basics', 'effect-ts-advanced']
concepts_explained: ['Domain Modeling', 'Component Architecture', 'Functional Composition']
design_decisions:
  - decision: 'DDDエンティティとECSコンポーネントの統合'
    rationale: '型安全性と性能の両立'
    tradeoffs: '学習コストの増加 vs 長期保守性'
tags: ['ddd', 'ecs', 'architecture', 'design-decisions']
patterns_used: ['domain-modeling-patterns', 'component-patterns']
---
```

## コンテンツ品質保証テンプレート

```yaml
---
# === 品質メタデータ ===
review_status: 'draft|review|approved|needs_update'
reviewers: ['reviewer1', 'reviewer2']
accuracy_level: 'high|medium|low'
completeness: 'complete|partial|outline'

# === 保守メタデータ ===
maintenance_frequency: 'weekly|monthly|quarterly|as_needed'
deprecation_date: 'YYYY-MM-DD' # 該当する場合
migration_guide: 'path/to/migration.md' # 該当する場合

# === アナリティクス ===
usage_analytics: true # 使用状況追跡の有効化
feedback_enabled: true # ユーザーフィードバック収集
---
```

## TSDoc準拠のコメントブロックテンプレート

````typescript
/**
 * プレイヤーインベントリの管理システム
 *
 * @remarks
 * このモジュールは {@link core-systems#Inventory | インベントリシステム} の
 * 中核実装を提供します。Effect-TSのContextパターンを活用し、
 * 型安全なアイテム管理を実現しています。
 *
 * @example
 * ```typescript
 * import { PlayerInventory } from './inventory'
 * import { Effect, Context } from 'effect'
 *
 * const inventory = Effect.gen(function* (_) {
 *   const inv = yield* _(PlayerInventory)
 *   return yield* _(inv.addItem({ id: 'stone', count: 64 }))
 * })
 * ```
 *
 * @see {@link ../how-to/inventory-management.md} - 実装ガイド
 * @see {@link ../reference/api/inventory-api.md} - API詳細
 *
 * @alpha
 */
````

## 自動化スクリプト統合

```yaml
---
# === 自動化メタデータ ===
auto_generated: false # 自動生成フラグ
generation_source: 'path/to/source.ts' # 該当する場合
validation_rules: ['yaml-lint', 'markdown-lint', 'link-check']
build_integration: true # ビルドプロセス統合
---
```

`★ Insight ─────────────────────────────────────`
このテンプレートの特徴：

1. **TSDoc完全準拠**: Microsoft標準に従ったメタデータ構造
2. **Diátaxis純粋分離**: 4つのタイプを明確に区別するメタデータ
3. **Context7最適化**: 最新の検索・発見可能性パターンを適用
   `─────────────────────────────────────────────────`
