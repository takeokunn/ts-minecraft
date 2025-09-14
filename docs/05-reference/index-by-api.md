# API別インデックス

TypeScript MinecraftプロジェクトのAPI・モジュール別にドキュメントを整理したリファレンスガイドです。

## Core APIs

### World API
ゲームワールドの管理と操作を行う基幹API群です。

**主要クラス・関数**:
- `World` - ワールドアグリゲートルート
- `WorldService` - ワールド操作サービス
- `ChunkManager` - チャンク管理
- `BlockRegistry` - ブロック登録管理

**詳細ドキュメント**:
- [ワールドAPI詳細](game-world-api.md)
- [ワールド管理システム](../02-specifications/00-core-features/01-world-management-system.md)
- [チャンクシステム](../02-specifications/00-core-features/07-chunk-system.md)

**使用例**:
- [簡単ブロック配置](../06-examples/01-basic-usage/01-simple-block-placement.md)

### Player API
プレイヤーキャラクターの状態管理と操作を行うAPI群です。

**主要クラス・関数**:
- `Player` - プレイヤーエンティティ
- `PlayerService` - プレイヤー操作サービス
- `PlayerController` - 入力制御
- `PlayerStats` - プレイヤー統計

**詳細ドキュメント**:
- [プレイヤーAPI詳細](game-player-api.md)
- [プレイヤーシステム](../02-specifications/00-core-features/02-player-system.md)
- [入力制御](../02-specifications/00-core-features/18-input-controls.md)

**使用例**:
- [プレイヤー移動](../06-examples/01-basic-usage/02-player-movement.md)

### Block API
ブロックの種類、状態、操作を管理するAPI群です。

**主要クラス・関数**:
- `Block` - ブロック値オブジェクト
- `BlockType` - ブロック種類定義
- `BlockState` - ブロック状態管理
- `BlockService` - ブロック操作サービス

**詳細ドキュメント**:
- [ブロックAPI詳細](game-block-api.md)
- [ブロックシステム](../02-specifications/00-core-features/03-block-system.md)

**使用例**:
- [簡単ブロック配置](../06-examples/01-basic-usage/01-simple-block-placement.md)

### Entity API
ECSエンティティシステムの管理API群です。

**主要クラス・関数**:
- `Entity` - エンティティ識別子
- `Component` - コンポーネント基底クラス
- `System` - システム基底クラス
- `World` - ECSワールドコンテナ

**詳細ドキュメント**:
- [Core API](api-reference/core-apis.md)
- [エンティティシステム](../02-specifications/00-core-features/04-entity-system.md)
- [ECS統合](../01-architecture/05-ecs-integration.md)

## Domain APIs

### Inventory System
プレイヤーのアイテム管理システムAPI群です。

**主要クラス・関数**:
- `Inventory` - インベントリアグリゲート
- `InventoryService` - インベントリ操作サービス
- `ItemStack` - アイテムスタック値オブジェクト
- `Item` - アイテム定義

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [インベントリシステム](../02-specifications/00-core-features/01-inventory-system.md)

**使用例**:
- [インベントリ管理](../06-examples/01-basic-usage/03-inventory-management.md)

### Crafting System
アイテムの製作・レシピシステムAPI群です。

**主要クラス・関数**:
- `CraftingRecipe` - レシピ定義
- `CraftingService` - クラフト処理サービス
- `CraftingTable` - 作業台エンティティ
- `RecipeRegistry` - レシピ登録管理

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [クラフトシステム](../02-specifications/00-core-features/02-crafting-system.md)

### Physics System
物理シミュレーション・衝突検知API群です。

**主要クラス・関数**:
- `PhysicsWorld` - 物理ワールド
- `RigidBody` - 剛体コンポーネント
- `Collider` - 衝突判定コンポーネント
- `PhysicsSystem` - 物理シミュレーションシステム

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [物理システム](../02-specifications/00-core-features/06-physics-system.md)

### Rendering System
3Dグラフィックス描画システムAPI群です。

**主要クラス・関数**:
- `Renderer` - メインレンダラー
- `MeshComponent` - メッシュコンポーネント
- `MaterialComponent` - マテリアルコンポーネント
- `RenderSystem` - 描画システム

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)
- [シーン管理システム](../02-specifications/00-core-features/11-scene-management-system.md)

### Health & Hunger System
プレイヤーの体力・満腹度管理API群です。

**主要クラス・関数**:
- `HealthComponent` - 体力コンポーネント
- `HungerComponent` - 満腹度コンポーネント
- `HealthService` - 体力管理サービス
- `FoodItem` - 食べ物アイテム

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [体力・満腹度システム](../02-specifications/00-core-features/12-health-hunger-system.md)
- [食料・農業システム](../02-specifications/00-core-features/19-food-agriculture-system.md)

### Combat System
戦闘・ダメージ処理システムAPI群です。

**主要クラス・関数**:
- `CombatService` - 戦闘処理サービス
- `Weapon` - 武器アイテム
- `Damage` - ダメージ値オブジェクト
- `AttackSystem` - 攻撃処理システム

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [戦闘システム](../02-specifications/00-core-features/13-combat-system.md)

### Mob System
Mob（モンスター・動物）管理システムAPI群です。

**主要クラス・関数**:
- `Mob` - Mobエンティティ
- `MobAI` - AI行動システム
- `SpawnService` - スポーン管理サービス
- `MobRegistry` - Mob種類登録

**詳細ドキュメント**:
- [Domain API](api-reference/domain-apis.md)
- [Mobスポーンシステム](../02-specifications/00-core-features/16-mob-spawning-system.md)
- [Mob AIシステム](../02-specifications/01-enhanced-features/04-mob-ai-system.md)

## Infrastructure APIs

### Effect-TS Integration
Effect-TSフレームワークとの統合API群です。

**主要クラス・関数**:
- `Context` - 依存性コンテキスト
- `Layer` - サービスレイヤー
- `Effect` - エフェクト型
- `Schema` - データスキーマ

**詳細ドキュメント**:
- [Infrastructure API](api-reference/infrastructure-apis.md)
- [Effect API詳細](effect-ts-effect-api.md)
- [Context API詳細](effect-ts-context-api.md)
- [Schema API詳細](effect-ts-schema-api.md)

**使用例**:
- [Effect合成パターン](../06-examples/02-advanced-patterns/01-effect-composition.md)
- [スキーマバリデーション](../06-examples/02-advanced-patterns/02-schema-validation.md)

### Three.js Integration
Three.js 3Dライブラリとの統合API群です。

**主要クラス・関数**:
- `ThreeRenderer` - Three.jsレンダラーラッパー
- `SceneManager` - シーン管理
- `MeshFactory` - メッシュ生成ファクトリー
- `MaterialFactory` - マテリアル生成ファクトリー

**詳細ドキュメント**:
- [Infrastructure API](api-reference/infrastructure-apis.md)
- [レンダリングシステム](../02-specifications/00-core-features/05-rendering-system.md)

### ECS System
Entity-Component-Systemアーキテクチャの実装API群です。

**主要クラス・関数**:
- `ComponentRegistry` - コンポーネント登録
- `SystemManager` - システム実行管理
- `Query` - エンティティクエリ
- `Archetype` - アーキタイプ管理

**詳細ドキュメント**:
- [Infrastructure API](api-reference/infrastructure-apis.md)
- [ECS統合](../01-architecture/05-ecs-integration.md)
- [エンティティシステム](../02-specifications/00-core-features/04-entity-system.md)

### Persistence Layer
データの永続化・保存システムAPI群です。

**主要クラス・関数**:
- `WorldRepository` - ワールドデータ永続化
- `PlayerRepository` - プレイヤーデータ永続化
- `SaveService` - セーブ管理サービス
- `LoadService` - ロード管理サービス

**詳細ドキュメント**:
- [Infrastructure API](api-reference/infrastructure-apis.md)
- [セーブファイル形式](../02-specifications/03-data-models/02-save-file-format.md)

### Event Bus
ドメインイベントの配信・購読システムAPI群です。

**主要クラス・関数**:
- `EventBus` - イベントバス本体
- `DomainEvent` - ドメインイベント基底クラス
- `EventHandler` - イベントハンドラー
- `EventSubscription` - イベント購読管理

**詳細ドキュメント**:
- [Infrastructure API](api-reference/infrastructure-apis.md)
- [イベントバス仕様](../02-specifications/02-api-design/02-event-bus-specification.md)

### Networking (Future)
マルチプレイヤー対応のネットワーキングAPI群です（将来実装予定）。

**詳細ドキュメント**:
- [マルチプレイヤーアーキテクチャ](../02-specifications/01-enhanced-features/10-multiplayer-architecture.md)

## Utility APIs

### 数学・計算ユーティリティ

**主要関数**:
- `Vector3` - 3Dベクトル計算
- `Matrix4` - 4x4行列演算
- `Quaternion` - クォータニオン計算
- `NoiseFunction` - ノイズ生成関数

**詳細ドキュメント**:
- [ユーティリティ関数](api-reference/utility-functions.md)

### データ変換ユーティリティ

**主要関数**:
- `Serialization` - オブジェクトシリアライゼーション
- `Validation` - データ検証
- `TypeGuards` - 型ガード関数
- `Converters` - データ型変換

**詳細ドキュメント**:
- [ユーティリティ関数](api-reference/utility-functions.md)

### パフォーマンスユーティリティ

**主要関数**:
- `ObjectPool` - オブジェクトプール
- `Memoization` - メモ化
- `Debounce` - デバウンス処理
- `Throttle` - スロットル処理

**詳細ドキュメント**:
- [ユーティリティ関数](api-reference/utility-functions.md)
- [最適化パターン](../07-pattern-catalog/06-optimization-patterns.md)

## 拡張機能 APIs (Enhanced Features)

### Redstone System
レッドストーン回路システムAPI群です。

**詳細ドキュメント**:
- [レッドストーンシステム](../02-specifications/01-enhanced-features/01-redstone-system.md)

### Weather System
天候・気象システムAPI群です。

**詳細ドキュメント**:
- [天候システム](../02-specifications/01-enhanced-features/02-weather-system.md)

### Day/Night Cycle
昼夜サイクル・時間管理システムAPI群です。

**詳細ドキュメント**:
- [昼夜サイクル](../02-specifications/01-enhanced-features/03-day-night-cycle.md)

### Villager Trading
村人取引システムAPI群です。

**詳細ドキュメント**:
- [村人取引](../02-specifications/01-enhanced-features/05-villager-trading.md)

### Enchantment System
エンチャント（魔法付与）システムAPI群です。

**詳細ドキュメント**:
- [エンチャントシステム](../02-specifications/01-enhanced-features/06-enchantment-system.md)

### Potion Effects
ポーション・ステータス効果システムAPI群です。

**詳細ドキュメント**:
- [ポーション効果](../02-specifications/01-enhanced-features/07-potion-effects.md)

## テスト・モックAPI

### テストユーティリティ

**主要クラス・関数**:
- `TestWorld` - テスト用ワールド
- `MockPlayer` - プレイヤーモック
- `TestRenderer` - テスト用レンダラー
- `AssertionHelpers` - アサーションヘルパー

**詳細ドキュメント**:
- [テストパターン](../07-pattern-catalog/05-test-patterns.md)
- [Effect-TSテストパターン](../03-guides/07-effect-ts-testing-patterns.md)
- [高度なテスト技法](../03-guides/06-advanced-testing-techniques.md)

## API使用順序の推奨

### 基本的な開発フロー
1. **Core APIs** から開始（World、Player、Block）
2. **Domain APIs** で機能拡張（Inventory、Crafting、Physics）
3. **Infrastructure APIs** でシステム統合（Effect-TS、Three.js、ECS）
4. **Utility APIs** でコード最適化

### 学習順序
1. [Effect-TS基礎](../01-architecture/06a-effect-ts-basics.md) - Effect-TS APIの理解
2. [Core API](api-reference/core-apis.md) - 基幹システム理解
3. [Domain API](api-reference/domain-apis.md) - ビジネスロジック理解
4. [Infrastructure API](api-reference/infrastructure-apis.md) - 技術的詳細理解

## 関連リソース

- [トピック別インデックス](index-by-topic.md) - 機能別ドキュメント整理
- [用語集](glossary.md) - 技術用語の定義
- [API設計原則](../02-specifications/02-api-design/00-domain-application-apis.md) - API設計の基本方針