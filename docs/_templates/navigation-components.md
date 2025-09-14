---
title: "ナビゲーション統一コンポーネント"
description: "ドキュメント全体で使用する統一されたナビゲーション要素のテンプレート集"
category: "template"
version: "3.2"
updated: "Phase 3.2"
templates:
  - breadcrumb
  - next-previous
  - quick-access
  - table-of-contents
---

# 🧭 ナビゲーション統一コンポーネント

Phase 3.2で導入される統一されたナビゲーション要素のマスターテンプレート。

## 📍 Breadcrumb（統一パン屑リスト）

### 基本パターン
```markdown
> **📍 You are here**: [Home](../../README.md) → [Tutorials](../README.md) → [Basic Game Development](./README.md) → **Environment Setup**
```

### セクション別テンプレート

#### Tutorials用
```markdown
> **📍 You are here**: [Home](../../README.md) → [Tutorials](../README.md) → [Getting Started](./README.md) → **Quick Start**
```

#### How-to用
```markdown
> **📍 You are here**: [Home](../../README.md) → [How-to](../README.md) → [Development](./README.md) → **Debugging Techniques**
```

#### Reference用
```markdown
> **📍 You are here**: [Home](../../README.md) → [Reference](../README.md) → [API](./README.md) → **Effect-TS API**
```

#### Explanations用
```markdown
> **📍 You are here**: [Home](../../README.md) → [Explanations](../README.md) → [Architecture](./README.md) → **Domain Layer Design**
```

### 階層表示ルール
1. **Home**は常にルート（`../../README.md`）
2. **第2階層**はDiátaxisセクション（tutorials、how-to、reference、explanations）
3. **第3階層**は機能別カテゴリ（getting-started、development、api等）
4. **現在ページ**は太字で表示、リンクなし

## ⬅️➡️ Next/Previous Navigation（学習パス型ナビゲーション）

### Tutorial専用パターン
```markdown
## 🔄 Learning Path

### ⬅️ Previous Step
**[Environment Setup](./environment-setup.md)**
- ✅ Completed: Development environment ready
- ⏱️ Time invested: ~10 minutes

### ➡️ Next Step
**[Domain Layer Architecture](./domain-layer-architecture.md)**
- 🎯 Learning goal: Understanding DDD in Effect-TS
- ⏱️ Estimated time: ~20 minutes
- 📋 Prerequisites: Basic TypeScript knowledge

### 📊 Progress in this Series
**Basic Game Development (2/5 completed)**
- [x] [Environment Setup](./environment-setup.md)
- [x] **Current: Basic Components**
- [ ] [Domain Layer Architecture](./domain-layer-architecture.md)
- [ ] [Application Services](./application-services.md)
- [ ] [Interactive Learning Guide](./interactive-learning-guide.md)

**🎯 Series Goal**: Build a functional game prototype using Effect-TS and DDD patterns
**⏱️ Estimated remaining**: ~45 minutes
```

### How-to専用パターン（関連問題解決）
```markdown
## 🔗 Related Problem Solving

### ⬅️ Common Previous Issues
- **[Environment Issues](../troubleshooting/common-errors.md#environment)** - Setup problems
- **[TypeScript Errors](../troubleshooting/common-errors.md#typescript)** - Type issues

### ➡️ Typical Next Steps
- **[Performance Optimization](./performance-optimization.md)** - After debugging
- **[Code Review](./code-review-guide.md)** - Quality assurance

### 🎯 Problem-Solution Chain
**Debugging → Optimization → Quality Assurance → Deployment**
```

## 🚀 Quick Access（Jump to セクション）

### 全ドキュメント共通パターン
```markdown
## 🚀 Quick Access

### 📖 Essential References
- **[API Documentation](../../reference/api/README.md)** - Complete technical specifications
- **[Configuration Guide](../../reference/configuration/README.md)** - Setup and environment
- **[Troubleshooting](../../how-to/troubleshooting/README.md)** - Problem resolution

### 🔥 Most Used Resources
- **[Effect-TS Basics](../../tutorials/effect-ts-fundamentals/effect-ts-basics.md)** - Core concepts
- **[Common Errors](../../how-to/troubleshooting/common-errors.md)** - Quick fixes
- **[Development Workflow](../../how-to/development/README.md)** - Best practices

### 💡 Deep Understanding
- **[Architecture Overview](../../explanations/architecture/README.md)** - System design
- **[Design Patterns](../../explanations/design-patterns/README.md)** - Implementation philosophy

### 🎮 Game-Specific
- **[Game Systems](../../reference/game-systems/README.md)** - Technical specifications
- **[Game Mechanics](../../explanations/game-mechanics/README.md)** - Design principles
```

### コンテンツ別特化版

#### Tutorial用Quick Access
```markdown
## 🚀 Quick Access

### 🎯 Skip to Specific Learning
- **[Effect-TS Fundamentals](../../tutorials/effect-ts-fundamentals/README.md)** - Master the foundation
- **[Advanced Topics](../../tutorials/advanced-topics/README.md)** - Expert techniques

### 🔧 When You Need Help
- **[Common Issues](../../how-to/troubleshooting/common-getting-started-issues.md)** - Resolve setup problems
- **[Development FAQ](../../how-to/development/README.md)** - Development guidance

### 📚 Reference Materials
- **[API Quick Reference](../../reference/api/README.md)** - Function signatures
- **[Code Examples](../../reference/examples/README.md)** - Copy-paste ready code
```

## 📑 Table of Contents（統一目次）

### 自動生成対応パターン
```markdown
## 📑 Table of Contents

<!-- TOC start (generated with https://github.com/derlin/bitdowntoc) -->
- [🎯 Learning Objectives](#-learning-objectives)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Quick Start](#-quick-start)
  - [Step 1: Installation](#step-1-installation)
  - [Step 2: Configuration](#step-2-configuration)
- [💡 Core Concepts](#-core-concepts)
- [🛠️ Practical Implementation](#️-practical-implementation)
- [✅ Validation](#-validation)
- [🔗 What's Next](#-whats-next)
<!-- TOC end -->
```

### セクション別アンカー統一規則
- **🎯** - Learning Objectives / Goals
- **📋** - Prerequisites / Requirements
- **🚀** - Quick Start / Getting Started
- **💡** - Core Concepts / Theory
- **🛠️** - Implementation / Practical Steps
- **✅** - Testing / Validation
- **🔗** - Next Steps / Related Resources

## 🔄 Continue Learning（学習継続）

### Tutorial → 他セクション導線
```markdown
## 🎓 Continue Learning

### 🔧 Apply What You've Learned
**Ready to solve real problems?**
- **[Development Best Practices](../../how-to/development/README.md)** - Apply tutorial knowledge
- **[Common Implementation Issues](../../how-to/troubleshooting/common-errors.md)** - Overcome obstacles

### 📖 Dive Deeper into Details
**Need technical specifications?**
- **[Complete API Reference](../../reference/api/README.md)** - Detailed function documentation
- **[Configuration Options](../../reference/configuration/README.md)** - Advanced settings

### 🧠 Understand the Why
**Curious about design decisions?**
- **[Architecture Explanations](../../explanations/architecture/README.md)** - System design rationale
- **[Pattern Philosophy](../../explanations/design-patterns/README.md)** - Implementation reasoning
```

## 🎯 Context-Aware Recommendations（コンテキスト認識推薦）

### 学習進度別推薦
```markdown
## 🎯 Recommended Next Steps

### 👶 If you're just starting
- Complete this tutorial series first: **[Getting Started](../../tutorials/getting-started/README.md)**
- Build confidence with: **[Basic Components](./basic-components.md)**

### 🧑‍💼 If you're an experienced developer
- Jump to advanced topics: **[Effect-TS Advanced](../../tutorials/effect-ts-fundamentals/effect-ts-advanced.md)**
- Review architecture decisions: **[Design Patterns](../../explanations/design-patterns/README.md)**

### 🏗️ If you're implementing production code
- Study best practices: **[Development Workflow](../../how-to/development/README.md)**
- Ensure quality: **[Testing Strategy](../../how-to/testing/README.md)**
```

### 役割別推薦
```markdown
## 🎭 Role-Based Guidance

### 👨‍💻 **Developers**
- **Primary Focus**: [How-to Guides](../../how-to/README.md) for problem-solving
- **Reference**: [API Documentation](../../reference/api/README.md) for implementation details
- **Deep Dive**: [Design Patterns](../../explanations/design-patterns/README.md) for best practices

### 🏗️ **Architects**
- **Primary Focus**: [Explanations](../../explanations/README.md) for design rationale
- **Planning**: [Architecture Overview](../../explanations/architecture/README.md) for system design
- **Specifications**: [Game Systems](../../reference/game-systems/README.md) for technical requirements

### 🆕 **New Team Members**
- **Start Here**: [Getting Started](../../tutorials/getting-started/README.md) for onboarding
- **Build Skills**: [Basic Game Development](../../tutorials/basic-game-development/README.md) for hands-on experience
- **Get Help**: [Troubleshooting](../../how-to/troubleshooting/README.md) for common issues
```

---

## 📐 Implementation Guidelines

### 1. Consistency Rules
- すべてのナビゲーション要素は**同じスタイル**を使用
- アイコンの使用は**統一された意味**で実装
- リンクパスは**相対パス**を使用し、**正確性**を保証

### 2. Accessibility
- リンクテキストは**説明的**で理解しやすく
- ナビゲーション構造は**論理的順序**を維持
- **Skip to content**的な機能を考慮

### 3. Performance
- 長大なナビゲーションは**折りたたみ可能**に
- **関連度スコア**でコンテンツを優先順位付け
- **最頻使用リンク**を上位に配置

### 4. Maintenance
- テンプレートは**自動生成対応**を考慮
- リンク切れ検出のための**validation hooks**
- **A/B testing**対応のための構造化

---

**✨ Phase 3.2 Navigation Excellence**: 統一されたナビゲーション体験で学習効率を最大化