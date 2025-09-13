# Core Features - Minecraftの基本機能

## 概要

Core Featuresは、Minecraftクローンとして必須となる基本機能群です。これらの機能は、Effect-TS 3.17+の最新パターン（Schema.Struct、@app/ServiceNameネームスペース）とDDDの境界づけられたコンテキストを使用して実装されています。

全ての機能はStructure of Arrays (SoA) ECSアーキテクチャに基づき、パフォーマンスを最大化しつつ、純粋関数型プログラミングの原則を維持しています。

## アーキテクチャ原則

### 1. 純粋関数型設計
- **クラス禁止**: 全てのロジックを純粋関数として実装
- **イミュータブル**: 全てのデータ構造を不変として扱い
- **Effect包含**: 全ての操作をEffect型で包含

### 2. 最新Effect-TSパターン
- **Schema.Struct**: Data.struct廃止、Schema.Structに統一
- **@app/ServiceName**: Context.GenericTag時の統一ネームスペース
- **早期リターン**: バリデーション失敗時の即座なEffect.fail

### 3. SoA ECSアーキテクチャ
- **コンポーネント分離**: Position、Velocity、Renderingなど個別管理
- **システム並列処理**: 独立したシステムの並列実行
- **メモリ効率**: 連続配列による高速アクセス

## Core Feature一覧

### 1. World System（世界システム）
- **チャンク生成と管理**: 16x16x384サイズチャンク
- **地形生成**: パーリンノイズベースの自然地形
- **バイオーム処理**: 温度・湿度による生態系管理
- **光源伝播**: ブロック・スカイライトの動的計算

### 2. Player System（プレイヤーシステム）
- **移動・ジャンプ**: 物理法則に準拠した移動系
- **視点制御**: First Person / Third Person切り替え
- **ブロック操作**: 配置・破壊のレイキャスト実装
- **インベントリ管理**: 36スロット+ホットバー管理

### 3. Block System（ブロックシステム）
- **ブロックタイプ定義**: 400+種類のブロック仕様
- **物理演算**: 重力・流体・爆発への応答
- **状態管理**: ブロック状態（向き・接続等）
- **更新システム**: 隣接ブロックの相互作用

### 4. Entity System（エンティティシステム）
- **動的スポーン**: バイオーム・時間・難易度連動
- **AI実装**: ステートマシンベースの行動制御
- **物理演算**: 重力・衝突・摩擦の統合処理
- **当たり判定**: AABB（Axis-Aligned Bounding Box）

### 5. Rendering System（レンダリングシステム）
- **メッシュ生成**: グリーディメッシング最適化
- **テクスチャ管理**: アトラス・ミップマップ対応
- **視錐台カリング**: フラストラムによる描画最適化
- **LOD管理**: 距離別の詳細度制御

### 6. Physics System（物理システム）
- **重力システム**: 9.8m/s²の統一重力処理
- **衝突検出**: 空間分割による高速検索
- **流体シミュレーション**: 水・溶岩の伝播系
- **爆発処理**: 球体範囲の破壊・ノックバック

### 7. Chunk System（チャンク管理システム）
- **動的ロード**: プレイヤー視野に基づく管理
- **圧縮保存**: NBT形式によるディスク保存
- **メモリ管理**: LRUキャッシュによる効率化
- **並列処理**: ワーカースレッドでの生成処理

### 8. Inventory System（インベントリシステム）
- **アイテム管理**: スタック・耐久度・エンチャント
- **GUI統合**: 各種コンテナとの連携
- **ドラッグ＆ドロップ**: 直感的操作インターフェース
- **永続化**: NBT形式でのセーブ・ロード

### 9. Crafting System（クラフトシステム）
- **レシピ管理**: JSON定義による柔軟な拡張性
- **クラフト台**: 3x3グリッドでの組み合わせ判定
- **かまど処理**: 燃料消費・精錬時間の管理
- **エンチャント**: 経験値消費による装備強化

### 10. Material System（マテリアルシステム）
- **マテリアル定義**: 各ブロック・アイテムのマテリアル属性
- **ツール効率**: マテリアル別の採掘速度・適正ツール
- **クラフト素材**: 素材の組み合わせとレシピ管理
- **耐久度システム**: マテリアル別の耐久性とエンチャント効果

### 11. Scene Management System（シーン管理システム）
- **シーン遷移制御**: スタート→メイン→ゲームオーバー画面の管理
- **状態機械パターン**: 関数型状態機械による型安全な遷移
- **ライフサイクル管理**: シーンの初期化・更新・終了処理
- **スタック管理**: シーン履歴とポップ・プッシュ操作

## ⚠️ 重要な未実装機能

以下の機能は**Minecraft体験にとって必須**ですが、現在のCore Featuresには含まれていません：

### 🔥 クリティカル機能（即実装が必要）
- **Health & Hunger System**: プレイヤーの生存システム
- **Combat System**: 戦闘・ダメージ・死亡処理
- **Mob Spawning**: モンスターの自動生成とルール
- **Death & Respawn**: 死亡処理とリスポーン地点
- **Sound & Music System**: 効果音・BGM・3D音響効果
- **Food & Agriculture System**: 農業・畜産・食料システム
- **Tool Durability System**: ツール耐久度とメンテナンス
- **Experience & Leveling**: 経験値・レベル・スキルシステム

### 🏗️ 高優先度機能（近期実装が望ましい）
- **Structure Generation**: 村・ダンジョン・要塞の生成
- **Extended Biomes**: 海洋・山岳・特殊バイオーム
- **Sign & Book System**: 看板・本・文字システム
- **Bed & Sleep System**: ベッド・睡眠・時間スキップ
- **Command & Debug System**: ゲーム内コマンド・デバッグ機能
- **Map & Navigation**: 地図・コンパス・座標システム

### 🌱 生態系・環境機能
- **Animal Breeding & Taming**: 動物の繁殖・手懐け
- **Plant Growth & Forestry**: 植物の成長・伐採システム
- **Advanced Redstone Components**: 比較器・中継器・高度な回路

### 🌐 マルチプレイヤー機能
- **Network Architecture**: クライアント・サーバー基盤
- **Player Synchronization**: マルチプレイヤー状態同期
- **Communication**: チャット・ボイス機能
- **The End Dimension**: エンダードラゴン・エンドシティ

詳細は [**不足機能一覧**](../07-missing-features.md) を参照してください。

## 実装ガイドライン

### 1. Layer構成パターン

```typescript
// Core機能の統合Layer
export const CoreFeaturesLayer = Layer.mergeAll(
  WorldSystemLayer,
  PlayerSystemLayer,
  BlockSystemLayer,
  EntitySystemLayer,
  RenderingSystemLayer,
  PhysicsSystemLayer,
  ChunkSystemLayer,
  InventorySystemLayer,
  CraftingSystemLayer,
  SceneSystemLayer
).pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(LoggingLayer),
  Layer.provide(MetricsLayer)
)

// 開発・テスト用の軽量Layer
export const CoreFeaturesTestLayer = Layer.mergeAll(
  TestWorldSystemLayer,
  TestPlayerSystemLayer,
  TestPhysicsSystemLayer,
  TestSceneSystemLayer
).pipe(
  Layer.provide(TestConfigLayer)
)
```

### 2. Service定義パターン（最新）

```typescript
// ❌ 古いパターン - classベース
export class WorldService extends Context.Tag("WorldService")<...>() {}

// ✅ 新しいパターン - @app/ネームスペース
export const WorldService = Context.GenericTag<{
  readonly generateChunk: (coord: ChunkCoordinate) =>
    Effect.Effect<Chunk, ChunkGenerationError>
  readonly loadChunk: (coord: ChunkCoordinate) =>
    Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coord: ChunkCoordinate) =>
    Effect.Effect<void, never>
  readonly getBlockAt: (pos: Position) =>
    Effect.Effect<Option.Option<Block>, never>
  readonly setBlockAt: (pos: Position, block: Block) =>
    Effect.Effect<void, WorldUpdateError>
}>("@app/WorldService")

// レイヤー実装
export const WorldServiceLive = Layer.succeed(
  WorldService,
  WorldService.of({
    generateChunk: (coord) => generateChunkImpl(coord),
    loadChunk: (coord) => loadChunkImpl(coord),
    unloadChunk: (coord) => unloadChunkImpl(coord),
    getBlockAt: (pos) => getBlockAtImpl(pos),
    setBlockAt: (pos, block) => setBlockAtImpl(pos, block)
  })
)
```

### 3. Schema定義パターン（最新）

```typescript
// 基本座標系
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
export type Position = Schema.Schema.Type<typeof Position>

// チャンク座標（整数制約付き）
export const ChunkCoordinate = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int())
})
export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

// ブロック定義
export const BlockType = Schema.Literal("air", "stone", "dirt", "wood", "leaves")
export const Block = Schema.Struct({
  type: BlockType,
  properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  metadata: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.min(0), Schema.max(15)))
})
export type Block = Schema.Schema.Type<typeof Block>

// エラー定義
export const ChunkGenerationError = Schema.Struct({
  _tag: Schema.Literal("ChunkGenerationError"),
  coordinate: ChunkCoordinate,
  reason: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
export type ChunkGenerationError = Schema.Schema.Type<typeof ChunkGenerationError>
```

### 4. 早期リターンパターン

```typescript
// バリデーション付き処理関数
const processPlayerMovement = (
  playerId: string,
  targetPosition: unknown
): Effect.Effect<void, PlayerMovementError> =>
  Effect.gen(function* () {
    // 早期リターン: プレイヤーID検証
    if (!playerId.trim()) {
      return yield* Effect.fail({
        _tag: "PlayerMovementError" as const,
        reason: "Invalid player ID",
        playerId,
        timestamp: Date.now()
      })
    }

    // Schema バリデーション
    const validPosition = yield* Schema.decodeUnknown(Position)(targetPosition).pipe(
      Effect.mapError((error) => ({
        _tag: "PlayerMovementError" as const,
        reason: `Invalid position: ${error}`,
        playerId,
        timestamp: Date.now()
      }))
    )

    // ビジネスロジック実行
    const playerService = yield* PlayerService
    yield* playerService.movePlayer(playerId, validPosition)
  })
```

## パフォーマンス考慮事項

### 1. SoA ECS最適化
- **コンポーネント分離**: Position[], Velocity[], Health[]の分離格納
- **システム並列実行**: MovementSystem、RenderSystemの独立処理
- **キャッシュ効率**: 連続メモリアクセスによる高速化
- **バッチ処理**: 同種操作の一括実行

### 2. チャンク管理最適化
- **視野距離管理**: プレイヤー中心16チャンクの動的ロード
- **段階的アンロード**: 距離24→32→48での段階的解放
- **圧縮保存**: zlib圧縮による70%ディスク使用量削減
- **LRUキャッシュ**: 最近使用1000チャンクのメモリ保持

### 3. レンダリング最適化
- **グリーディメッシング**: 隣接面結合による50%頂点削減
- **インスタンシング**: 同種ブロックの一括描画
- **視錐台カリング**: フラストラム外ブロックの描画除外
- **LOD制御**: 距離に応じた16→8→4段階の詳細度

### 4. 物理演算最適化
- **空間分割**: Octreeによる衝突検出範囲限定
- **休眠システム**: 静止エンティティの計算除外
- **段階的更新**: 距離による1/2/4フレーム分割更新
- **並列処理**: WebWorkerによる物理計算オフロード

## テスト戦略

### 1. 単体テスト（Pure Functions）

```typescript
import { Effect, TestContext, TestClock } from "effect"
import { describe, test, expect } from "@effect/vitest"

export const WorldSystemTests = describe("WorldSystem", () => {
  test("チャンク生成の純粋性", () =>
    Effect.gen(function* () {
      const coord = { x: 0, z: 0 }

      // 同じ座標での生成は同じ結果を返す
      const chunk1 = yield* generateChunk(coord)
      const chunk2 = yield* generateChunk(coord)

      expect(chunk1).toEqual(chunk2)
    }).pipe(
      Effect.provide(TestWorldServiceLayer),
      Effect.provide(TestContext.TestContext)
    ))

  test("ブロック配置のバリデーション", () =>
    Effect.gen(function* () {
      const invalidPos = { x: -1, y: -64, z: 999999 }

      // 無効座標でのブロック配置は失敗する
      const result = yield* setBlockAt(invalidPos, { type: "stone" }).pipe(
        Effect.either
      )

      expect(Either.isLeft(result)).toBe(true)
    }))
})
```

### 2. 統合テスト（System Interactions）

```typescript
export const SystemIntegrationTests = describe("System統合", () => {
  test("プレイヤー移動→チャンクロード→レンダリング連携", () =>
    Effect.gen(function* () {
      const testClock = yield* TestClock.TestClock

      // プレイヤーを新しいチャンクに移動
      const playerService = yield* PlayerService
      yield* playerService.movePlayer("test-player", { x: 256, y: 64, z: 256 })

      // 非同期チャンクロードの完了を待機
      yield* TestClock.adjust("5 seconds")

      // チャンクがロードされていることを確認
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.getChunk({ x: 16, z: 16 })

      expect(Option.isSome(chunk)).toBe(true)
    }).pipe(
      Effect.provide(CoreFeaturesTestLayer),
      Effect.provide(TestContext.TestContext),
      Effect.provide(TestClock.TestClock)
    ))
})
```

### 3. パフォーマンステスト

```typescript
export const PerformanceTests = describe("パフォーマンス", () => {
  test("1000エンティティの物理計算", () =>
    Effect.gen(function* () {
      // 1000エンティティを生成
      const entities = Array.from({ length: 1000 }, (_, i) =>
        createTestEntity(i, randomPosition()))

      const startTime = yield* Effect.sync(() => performance.now())

      // 物理システム1フレーム実行
      const physicsSystem = yield* PhysicsSystem
      yield* physicsSystem.updateAll(entities)

      const endTime = yield* Effect.sync(() => performance.now())
      const duration = endTime - startTime

      // 16msフレーム内での完了を確認
      expect(duration).toBeLessThan(16)
    }))
})
```

## システム間の依存関係

```mermaid
graph TD
    A[World System] --> B[Chunk System]
    A --> C[Block System]
    B --> D[Rendering System]
    C --> D
    E[Player System] --> F[Physics System]
    E --> G[Inventory System]
    F --> C
    G --> H[Crafting System]
    I[Entity System] --> F
    I --> D

    style A fill:#e1f5fe
    style E fill:#f3e5f5
    style D fill:#e8f5e8
    style F fill:#fff3e0
```

### 実装優先順位

**フェーズ1（基盤）**:
1. **World System** - 世界の基盤構築
2. **Block System** - ブロックデータ管理
3. **Chunk System** - メモリ・ディスク管理

**フェーズ2（プレイヤー）**:
4. **Player System** - プレイヤー操作
5. **Physics System** - 移動・衝突
6. **Rendering System** - 3D描画

**フェーズ3（拡張）**:
7. **Entity System** - NPC・モブ
8. **Inventory System** - アイテム管理
9. **Crafting System** - 製作システム
10. **Scene Management System** - 画面遷移制御

## 次のステップ

各Core Featureの詳細実装については、以下のドキュメントを参照：

**基盤システム**:
- [01-world-system.md](./01-world-system.md) - 世界・バイオーム・地形生成
- [03-block-system.md](./03-block-system.md) - ブロックタイプ・状態管理
- [07-chunk-system.md](./07-chunk-system.md) - チャンク分割・ロード管理

**プレイヤーシステム**:
- [02-player-system.md](./02-player-system.md) - 移動・操作・ステータス
- [06-physics-system.md](./06-physics-system.md) - 重力・衝突・流体
- [05-rendering-system.md](./05-rendering-system.md) - 3D描画・最適化

**拡張システム**:
- [04-entity-system.md](./04-entity-system.md) - エンティティ・AI・スポーン
- [08-inventory-system.md](./08-inventory-system.md) - インベントリ・アイテム
- [09-crafting-system.md](./09-crafting-system.md) - クラフト・レシピ・エンチャント
- [11-scene-management-system.md](./11-scene-management-system.md) - シーン管理・画面遷移