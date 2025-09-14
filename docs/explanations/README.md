# 🧠 Explanations - 理解指向ドキュメント

このセクションは**理解指向**のドキュメントです。なぜその設計にしたのか、どのような思想に基づいているかを深く説明し、プロジェクトの背景知識を提供します。

## 🎯 このセクションの目的

- アーキテクチャ設計の背景と理由の説明
- 採用したデザインパターンの思想と原則
- ゲーム機能の設計判断とトレードオフの説明
- 技術選択の根拠と比較検討結果

## 🏛 知識体系

### 🏗 [Architecture](./architecture/)
**システムアーキテクチャの設計思想**

- [API設計概要](./architecture/00-overview.md)
- [ドメイン・アプリケーションAPI](./architecture/00-domain-application-apis.md)
- [インフラストラクチャAPI](./architecture/01-infrastructure-apis.md)
- [イベントバス仕様](./architecture/02-event-bus-specification.md)
- [HTTP API仕様](./architecture/03-http-api-specification.md)
- [セキュリティ仕様](./architecture/04-security-specification.md)
- [パフォーマンスガイドライン](./architecture/05-performance-guidelines.md)

### 🎨 [Design Patterns](./design-patterns/)
**採用したデザインパターンの思想**

- [サービスパターン](./design-patterns/01-service-patterns.md)
- [エラーハンドリングパターン](./design-patterns/02-error-handling-patterns.md)
- [データモデルパターン](./design-patterns/03-data-model-patterns.md)
- [データモデリングパターン](./design-patterns/03-data-modeling-patterns.md)
- [非同期パターン](./design-patterns/04-asynchronous-patterns.md)
- [テストパターン](./design-patterns/05-test-patterns.md)
- [最適化パターン](./design-patterns/06-optimization-patterns.md)
- [統合パターン](./design-patterns/07-integration-patterns.md)

### 🎮 [Game Mechanics](./game-mechanics/)
**ゲームシステムの設計思想と実装判断**

#### コア機能
- [アーキテクチャ原則](./game-mechanics/00-core-features/00-architecture-principles.md)
- [実装パターン](./game-mechanics/00-core-features/00-implementation-patterns.md)
- [インベントリシステム](./game-mechanics/00-core-features/01-inventory-system.md)
- [ワールド管理システム](./game-mechanics/00-core-features/01-world-management-system.md)
- [プレイヤーシステム](./game-mechanics/00-core-features/02-player-system.md)
- [ブロックシステム](./game-mechanics/00-core-features/03-block-system.md)
- [エンティティシステム](./game-mechanics/00-core-features/04-entity-system.md)
- [レンダリングシステム](./game-mechanics/00-core-features/05-rendering-system.md)
- [物理システム](./game-mechanics/00-core-features/06-physics-system.md)
- [チャンクシステム](./game-mechanics/00-core-features/07-chunk-system.md)

#### 拡張機能
- [レッドストーンシステム](./game-mechanics/01-enhanced-features/01-redstone-system.md)
- [天候システム](./game-mechanics/01-enhanced-features/02-weather-system.md)
- [村人取引](./game-mechanics/01-enhanced-features/05-villager-trading.md)
- [エンチャントシステム](./game-mechanics/01-enhanced-features/06-enchantment-system.md)
- [ネザーポータル](./game-mechanics/01-enhanced-features/08-nether-portals.md)
- [パーティクルシステム](./game-mechanics/01-enhanced-features/14-particle-system.md)

## 🤔 このセクションが解決する疑問

- なぜEffect-TSを採用したのか？
- なぜDDD（ドメイン駆動設計）を選んだのか？
- なぜECS（Entity Component System）を統合したのか？
- 各ゲーム機能の設計トレードオフは何か？
- パフォーマンスと開発効率のバランスをどう取ったか？

## 💡 理解を深めるために

1. **文脈を理解する**: 技術選択の背景と制約条件
2. **比較検討を把握する**: 他の選択肢との比較結果
3. **トレードオフを認識する**: 利点と制限の両面理解

## 🔗 関連セクション

- **[Tutorials](../tutorials/)**: 実際の使い方を学ぶ
- **[How-to Guides](../how-to/)**: 問題解決の実践方法
- **[Reference](../reference/)**: 詳細な技術仕様

---

**🎓 学習効果**: このセクションを理解することで、プロジェクトの設計判断を適切に評価し、将来的な拡張や修正において適切な意思決定ができるようになります。