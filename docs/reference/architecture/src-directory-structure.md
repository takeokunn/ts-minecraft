---
title: 'src/ ディレクトリ構造設計'
description: 'Effect-TS + DDD + ECS統合アーキテクチャに基づく理想的なソースコード構造'
category: 'architecture'
priority: 'critical'
related_docs:
  - 'docs/explanations/architecture/architecture-overview.md'
  - 'docs/how-to/development/development-conventions.md'
  - 'docs/tutorials/basic-game-development/domain-layer-architecture.md'
tags: ['architecture', 'ddd', 'ecs', 'effect-ts', 'directory-structure']
---

# src/ ディレクトリ構造設計

## 概要

TypeScript Minecraft Clone プロジェクトの`src/`ディレクトリは、Effect-TS 3.17+、DDD（ドメイン駆動設計）、ECS（Entity Component System）を統合したアーキテクチャに基づいて設計されています。

## 全体構造

```
src/
├── main.ts                      # アプリケーションエントリーポイント
├── domain/                      # ドメイン層（コアビジネスロジック）
├── application/                 # アプリケーション層（ユースケース・システム）
├── infrastructure/              # インフラストラクチャ層（ECS・レンダリング）
├── presentation/                # プレゼンテーション層（UI・入力制御）
├── shared/                      # 共有コンポーネント（横断的関心事）
├── types/                       # TypeScript型定義
├── workers/                     # Web Workers（並行処理）
└── config/                      # 設定・環境変数
```

## レイヤー詳細設計

### 1. Domain層 (`src/domain/`)

コアビジネスロジック、エンティティ、値オブジェクトを定義。すべてのファイルはEffect-TS 3.17+のパターンに従います。

```
src/domain/
├── index.ts                     # ドメイン層エクスポート統合
├── world/                       # ワールド管理ドメイン
│   ├── index.ts                # ワールドドメインエクスポート
│   ├── entities/
│   │   ├── index.ts            # エンティティエクスポート
│   │   ├── Block.ts            # ブロックエンティティ（種類・状態・プロパティ）
│   │   ├── Chunk.ts            # チャンクエンティティ（16x16x384ブロック）
│   │   ├── World.ts            # ワールドエンティティ（シード・設定・メタデータ）
│   │   └── Biome.ts            # バイオームエンティティ（地形生成・環境設定）
│   ├── values/
│   │   ├── index.ts            # 値オブジェクトエクスポート
│   │   ├── BlockType.ts        # ブロック種別（AIR, STONE, GRASS等）
│   │   ├── BlockState.ts       # ブロック状態（direction, waterlogged等）
│   │   ├── Position.ts         # 3D座標（x, y, z）
│   │   ├── ChunkCoordinate.ts  # チャンク座標（chunkX, chunkZ）
│   │   ├── WorldSeed.ts        # ワールドシード値
│   │   └── BiomeType.ts        # バイオーム種別（PLAINS, FOREST等）
│   ├── services/
│   │   ├── index.ts            # サービスエクスポート
│   │   ├── WorldGenerator.ts   # ワールド生成ロジック
│   │   ├── ChunkManager.ts     # チャンクの生成・アンロード管理
│   │   ├── BiomeGenerator.ts   # バイオーム生成・分布計算
│   │   └── BlockPlacer.ts      # ブロック配置・破壊ルール
│   ├── rules/                  # ビジネスルール
│   │   ├── index.ts            # ルールエクスポート
│   │   ├── PlacementRules.ts   # ブロック配置ルール
│   │   ├── PhysicsRules.ts     # 物理法則（重力、流体等）
│   │   └── GenerationRules.ts  # ワールド生成ルール
│   └── errors/
│       ├── index.ts            # エラーエクスポート
│       ├── ChunkError.ts       # チャンク関連エラー
│       ├── WorldError.ts       # ワールド関連エラー
│       └── BlockError.ts       # ブロック関連エラー
├── player/                      # プレイヤードメイン
│   ├── index.ts                # プレイヤードメインエクスポート
│   ├── entities/
│   │   ├── index.ts            # エンティティエクスポート
│   │   ├── Player.ts           # プレイヤーエンティティ（基本情報・状態）
│   │   └── PlayerStats.ts      # プレイヤー統計（プレイ時間・実績等）
│   ├── values/
│   │   ├── index.ts            # 値オブジェクトエクスポート
│   │   ├── Health.ts           # 体力（0-20、ハート10個）
│   │   ├── Hunger.ts           # 満腹度（0-20、食料バー）
│   │   ├── Experience.ts       # 経験値（レベル・経験値ポイント）
│   │   ├── PlayerMode.ts       # プレイヤーモード（SURVIVAL, CREATIVE等）
│   │   └── Velocity.ts         # 移動速度ベクトル
│   ├── services/
│   │   ├── index.ts            # サービスエクスポート
│   │   ├── PlayerMovement.ts   # 移動・ジャンプ・飛行ロジック
│   │   ├── PlayerActions.ts    # ブロック配置・破壊アクション
│   │   ├── PlayerHealth.ts     # 体力管理・ダメージ処理
│   │   └── PlayerHunger.ts     # 満腹度管理・食事処理
│   ├── rules/
│   │   ├── index.ts            # ルールエクスポート
│   │   ├── MovementRules.ts    # 移動制約・衝突判定ルール
│   │   ├── HealthRules.ts      # 体力回復・ダメージルール
│   │   └── HungerRules.ts      # 満腹度減少・回復ルール
│   └── errors/
│       ├── index.ts            # エラーエクスポート
│       ├── PlayerError.ts      # プレイヤー関連エラー
│       ├── MovementError.ts    # 移動関連エラー
│       └── HealthError.ts      # 体力関連エラー
├── inventory/                   # インベントリドメイン
│   ├── index.ts                # インベントリドメインエクスポート
│   ├── entities/
│   │   ├── index.ts            # エンティティエクスポート
│   │   ├── Inventory.ts        # インベントリエンティティ（36スロット）
│   │   ├── ItemStack.ts        # アイテムスタック（種類・数量・耐久値）
│   │   ├── Hotbar.ts           # ホットバーエンティティ（9スロット）
│   │   └── CraftingGrid.ts     # クラフトグリッドエンティティ（3x3）
│   ├── values/
│   │   ├── index.ts            # 値オブジェクトエクスポート
│   │   ├── Item.ts             # アイテム種別（WOOD, STONE, DIAMOND等）
│   │   ├── ItemCount.ts        # アイテム数量（1-64）
│   │   ├── SlotIndex.ts        # スロット番号（0-35）
│   │   ├── Durability.ts       # 耐久値（ツール・武器・防具）
│   │   └── EnchantmentLevel.ts # エンチャントレベル
│   ├── services/
│   │   ├── index.ts            # サービスエクスポート
│   │   ├── InventoryManager.ts # インベントリ操作・整理
│   │   ├── CraftingService.ts  # クラフトレシピ・作成処理
│   │   ├── ItemDrop.ts         # アイテムドロップ・収集
│   │   └── ItemUsage.ts        # アイテム使用・消費処理
│   ├── rules/
│   │   ├── index.ts            # ルールエクスポート
│   │   ├── CraftingRules.ts    # クラフトレシピルール
│   │   ├── StackingRules.ts    # アイテムスタックルール
│   │   └── UsageRules.ts       # アイテム使用可能条件
│   └── errors/
│       ├── index.ts            # エラーエクスポート
│       ├── InventoryError.ts   # インベントリ関連エラー
│       ├── CraftingError.ts    # クラフト関連エラー
│       └── ItemError.ts        # アイテム関連エラー
├── game/                        # ゲーム制御ドメイン
│   ├── index.ts                # ゲームドメインエクスポート
│   ├── entities/
│   │   ├── index.ts            # エンティティエクスポート
│   │   ├── GameSession.ts      # ゲームセッション（プレイヤー・ワールド・設定）
│   │   ├── GameTime.ts         # ゲーム内時間（日夜サイクル・tick）
│   │   └── GameSettings.ts     # ゲーム設定（難易度・ゲームルール）
│   ├── values/
│   │   ├── index.ts            # 値オブジェクトエクスポート
│   │   ├── GameMode.ts         # ゲームモード（SURVIVAL, CREATIVE, ADVENTURE）
│   │   ├── Difficulty.ts       # 難易度（PEACEFUL, EASY, NORMAL, HARD）
│   │   ├── TickCount.ts        # ゲームtick数（1秒=20tick）
│   │   └── DayTime.ts          # 日時（0-24000、24000tick=1日）
│   ├── services/
│   │   ├── index.ts            # サービスエクスポート
│   │   ├── GameLoop.ts         # メインゲームループ（60FPS）
│   │   ├── TimeManager.ts      # 時間進行・日夜サイクル
│   │   ├── SaveManager.ts      # セーブ・ロード処理
│   │   └── SettingsManager.ts  # 設定管理・変更適用
│   ├── rules/
│   │   ├── index.ts            # ルールエクスポート
│   │   ├── GameRules.ts        # ゲームルール（mobGriefing等）
│   │   ├── DifficultyRules.ts  # 難易度による挙動変更
│   │   └── TickRules.ts        # tick処理優先順位
│   └── errors/
│       ├── index.ts            # エラーエクスポート
│       ├── GameError.ts        # ゲーム関連エラー
│       ├── SaveError.ts        # セーブ・ロード関連エラー
│       └── SettingsError.ts    # 設定関連エラー
└── shared/                      # ドメイン横断共通要素
    ├── index.ts                # 共通要素エクスポート
    ├── values/
    │   ├── index.ts            # 共通値オブジェクトエクスポート
    │   ├── Coordinate.ts       # 汎用座標（2D/3D対応）
    │   ├── Direction.ts        # 方向（NORTH, SOUTH, EAST, WEST, UP, DOWN）
    │   ├── Color.ts            # 色値（RGB/RGBA）
    │   └── Timestamp.ts        # タイムスタンプ
    ├── events/
    │   ├── index.ts            # ドメインイベントエクスポート
    │   ├── WorldEvents.ts      # ワールド変更イベント
    │   ├── PlayerEvents.ts     # プレイヤー行動イベント
    │   ├── InventoryEvents.ts  # インベントリ変更イベント
    │   └── GameEvents.ts       # ゲーム状態変更イベント
    └── errors/
        ├── index.ts            # 共通エラーエクスポート
        ├── ValidationError.ts  # バリデーションエラー
        └── DomainError.ts      # ドメイン横断エラー
```

#### Domain層の具体的な実装例

**`src/domain/world/entities/Block.ts`** - ブロックエンティティ

```typescript
import { Schema } from '@effect/schema'
import { BlockType, BlockState, Position } from '../values'

export const Block = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('BlockId')),
  type: BlockType,
  state: BlockState,
  position: Position,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

export type Block = Schema.Schema.Type<typeof Block>

// ブロック操作関数（純関数）
export const createBlock = (
  type: Schema.Schema.Type<typeof BlockType>,
  position: Schema.Schema.Type<typeof Position>
) =>
  Effect.gen(function* () {
    const id = yield* generateBlockId()
    return Block.make({
      id,
      type,
      state: BlockState.default(),
      position,
    })
  })

export const isAir = (block: Block): boolean => block.type === 'AIR'

export const isSolid = (block: Block): boolean => !['AIR', 'WATER', 'LAVA'].includes(block.type)
```

**`src/domain/world/values/Position.ts`** - 座標値オブジェクト

```typescript
import { Schema } from '@effect/schema'
import { pipe } from 'effect'

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number.pipe(Schema.between(-64, 320)), // Minecraftの高度制限
  z: Schema.Number,
})

export type Position = Schema.Schema.Type<typeof Position>

// 座標計算関数
export const distance = (pos1: Position, pos2: Position): number =>
  Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2))

export const add = (pos1: Position, pos2: Position): Position => ({
  x: pos1.x + pos2.x,
  y: pos1.y + pos2.y,
  z: pos1.z + pos2.z,
})

export const toChunkCoordinate = (position: Position): ChunkCoordinate => ({
  chunkX: Math.floor(position.x / 16),
  chunkZ: Math.floor(position.z / 16),
})
```

**`src/domain/player/services/PlayerMovement.ts`** - プレイヤー移動サービス

```typescript
import { Context, Effect, Schema } from '@effect/platform'
import { Player } from '../entities'
import { Velocity, Position } from '../values'
import { MovementError } from '../errors'

export interface PlayerMovement {
  readonly move: (player: Player, velocity: Velocity, deltaTime: number) => Effect.Effect<Player, MovementError>

  readonly jump: (player: Player) => Effect.Effect<Player, MovementError>

  readonly validateMovement: (from: Position, to: Position) => Effect.Effect<boolean, MovementError>
}

export const PlayerMovement = Context.GenericTag<PlayerMovement>('PlayerMovement')

// 実装例
export const PlayerMovementLive = Layer.effect(
  PlayerMovement,
  Effect.gen(function* () {
    return PlayerMovement.of({
      move: (player, velocity, deltaTime) =>
        Effect.gen(function* () {
          const newPosition = calculateNewPosition(player.position, velocity, deltaTime)

          const isValidMove = yield* PlayerMovement.validateMovement(player.position, newPosition)

          if (!isValidMove) {
            return yield* Effect.fail(new MovementError('Invalid movement'))
          }

          return { ...player, position: newPosition }
        }),

      jump: (player) =>
        Effect.gen(function* () {
          if (player.velocity.y > 0) {
            return yield* Effect.fail(new MovementError('Already jumping'))
          }

          return {
            ...player,
            velocity: { ...player.velocity, y: 0.42 }, // Minecraftのジャンプ速度
          }
        }),

      validateMovement: (from, to) =>
        Effect.succeed(
          // 実際の衝突判定ロジック
          isValidMovement(from, to)
        ),
    })
  })
)
```

### 2. Application層 (`src/application/`)

ユースケース実装、システム統合、コーディネーション。

```
src/application/
├── index.ts                     # アプリケーション層エクスポート統合
├── services/                    # アプリケーションサービス
│   ├── WorldService.ts         # ワールド操作統合サービス
│   ├── PlayerService.ts        # プレイヤー操作統合サービス
│   ├── InventoryService.ts     # インベントリ操作統合サービス
│   └── GameService.ts          # ゲーム制御統合サービス
├── systems/                     # ECSシステム（ゲームロジック処理）
│   ├── PhysicsSystem.ts        # 物理演算システム
│   ├── RenderSystem.ts         # レンダリングシステム
│   ├── InputSystem.ts          # 入力処理システム
│   ├── CollisionSystem.ts      # 衝突判定システム
│   ├── InventorySystem.ts      # インベントリシステム
│   └── WorldUpdateSystem.ts    # ワールド更新システム
├── use-cases/                   # ユースケース実装
│   ├── PlaceBlock.ts           # ブロック配置ユースケース
│   ├── BreakBlock.ts           # ブロック破壊ユースケース
│   ├── MovePlayer.ts           # プレイヤー移動ユースケース
│   ├── ManageInventory.ts      # インベントリ管理ユースケース
│   └── SaveGame.ts             # ゲーム保存ユースケース
├── events/                      # イベント定義・ハンドラ
│   ├── GameEvents.ts           # ゲームイベント定義
│   ├── WorldEvents.ts          # ワールドイベント定義
│   └── PlayerEvents.ts         # プレイヤーイベント定義
└── errors/
    └── ApplicationError.ts      # アプリケーション層エラー
```

### 3. Infrastructure層 (`src/infrastructure/`)

ECS実装、レンダリング、外部システム統合。

```
src/infrastructure/
├── index.ts                     # インフラストラクチャ層エクスポート統合
├── ecs/                         # ECS（Entity Component System）実装
│   ├── World.ts                # ECSワールド
│   ├── Entity.ts               # エンティティ管理
│   ├── ComponentManager.ts     # コンポーネント管理
│   ├── SystemManager.ts        # システム管理
│   ├── QueryManager.ts         # クエリ管理
│   └── components/             # ECSコンポーネント定義
│       ├── Transform.ts        # 変換コンポーネント
│       ├── Mesh.ts             # メッシュコンポーネント
│       ├── Physics.ts          # 物理コンポーネント
│       ├── Collider.ts         # コライダーコンポーネント
│       └── PlayerController.ts # プレイヤーコントローラー
├── rendering/                   # レンダリングシステム
│   ├── ThreeJSRenderer.ts      # Three.jsレンダラー
│   ├── ChunkRenderer.ts        # チャンクレンダラー
│   ├── BlockRenderer.ts        # ブロックレンダラー
│   ├── PlayerRenderer.ts       # プレイヤーレンダラー
│   ├── ParticleRenderer.ts     # パーティクルレンダラー
│   ├── shaders/                # シェーダー
│   │   ├── block.vert.glsl     # ブロック頂点シェーダー
│   │   ├── block.frag.glsl     # ブロックフラグメントシェーダー
│   │   ├── water.vert.glsl     # 水頂点シェーダー
│   │   └── water.frag.glsl     # 水フラグメントシェーダー
│   └── materials/              # マテリアル定義
│       ├── BlockMaterial.ts    # ブロックマテリアル
│       └── WaterMaterial.ts    # 水マテリアル
├── storage/                     # データ永続化
│   ├── WorldStorage.ts         # ワールドデータ保存
│   ├── PlayerStorage.ts        # プレイヤーデータ保存
│   ├── ChunkStorage.ts         # チャンクデータ保存
│   └── GameStorage.ts          # ゲームデータ保存
├── physics/                     # 物理演算
│   ├── PhysicsEngine.ts        # 物理エンジン
│   ├── CollisionDetection.ts   # 衝突判定
│   ├── RigidBody.ts            # 剛体
│   └── CollisionShapes.ts      # 衝突形状
└── audio/                       # オーディオシステム
    ├── AudioManager.ts         # オーディオ管理
    ├── SoundEffects.ts         # 効果音
    └── BackgroundMusic.ts      # BGM
```

### 4. Presentation層 (`src/presentation/`)

UI、入力制御、ユーザーインタラクション。

```
src/presentation/
├── index.ts                     # プレゼンテーション層エクスポート統合
├── ui/                          # ユーザーインターフェース
│   ├── components/             # UIコンポーネント
│   │   ├── HUD.ts              # ヘッドアップディスプレイ
│   │   ├── Inventory.ts        # インベントリUI
│   │   ├── HealthBar.ts        # 体力バー
│   │   ├── Hotbar.ts           # ホットバー
│   │   └── Menu.ts             # メニュー
│   ├── layouts/                # レイアウト
│   │   ├── GameLayout.ts       # ゲーム画面レイアウト
│   │   └── MenuLayout.ts       # メニュー画面レイアウト
│   └── styles/                 # スタイル定義
│       ├── game.css            # ゲーム画面スタイル
│       └── menu.css            # メニュー画面スタイル
├── input/                       # 入力制御
│   ├── KeyboardInput.ts        # キーボード入力
│   ├── MouseInput.ts           # マウス入力
│   ├── TouchInput.ts           # タッチ入力（モバイル対応）
│   ├── InputManager.ts         # 入力管理統合
│   └── InputBindings.ts        # 入力バインディング設定
└── controllers/                 # プレゼンテーション制御
    ├── GameController.ts       # ゲーム制御
    ├── MenuController.ts       # メニュー制御
    └── InventoryController.ts  # インベントリ制御
```

### 5. Shared層 (`src/shared/`)

横断的関心事、共通ユーティリティ。

```
src/shared/
├── index.ts                     # 共有コンポーネントエクスポート統合
├── utils/                       # ユーティリティ関数
│   ├── math.ts                 # 数学計算ユーティリティ
│   ├── random.ts               # 乱数生成ユーティリティ
│   ├── validation.ts           # バリデーションユーティリティ
│   ├── serialization.ts        # シリアライゼーション
│   └── performance.ts          # パフォーマンス計測
├── constants/                   # 定数定義
│   ├── gameConstants.ts        # ゲーム関連定数
│   ├── worldConstants.ts       # ワールド関連定数
│   └── renderConstants.ts      # レンダリング関連定数
├── schemas/                     # Schema定義（Effect-TS）
│   ├── common.ts               # 共通スキーマ
│   ├── game.ts                 # ゲームスキーマ
│   └── world.ts                # ワールドスキーマ
├── errors/                      # 共通エラー定義
│   ├── BaseError.ts            # ベースエラークラス
│   ├── ValidationError.ts      # バリデーションエラー
│   └── NetworkError.ts         # ネットワークエラー
└── types/                       # 共通型定義
    ├── common.ts               # 共通型
    ├── events.ts               # イベント型
    └── api.ts                  # API型
```

### 6. Types層 (`src/types/`)

プロジェクト固有型定義、外部ライブラリ型拡張。

```
src/types/
├── index.ts                     # 型定義エクスポート統合
├── env.d.ts                    # 環境変数型定義
├── global.d.ts                 # グローバル型定義
├── three.d.ts                  # Three.js型拡張
├── vite-env.d.ts              # Vite環境型定義
└── game/                       # ゲーム固有型定義
    ├── entities.ts             # エンティティ型
    ├── components.ts           # コンポーネント型
    ├── systems.ts              # システム型
    └── world.ts                # ワールド型
```

### 7. Workers層 (`src/workers/`)

Web Worker実装（並行処理・重い処理の分離）。

```
src/workers/
├── chunk-worker.ts             # チャンク生成・処理ワーカー
├── physics-worker.ts           # 物理演算ワーカー
├── pathfinding-worker.ts       # パスファインディングワーカー
├── mesh-generation.worker.ts   # メッシュ生成ワーカー
└── asset-loader.worker.ts      # アセット読み込みワーカー
```

### 8. Config層 (`src/config/`)

設定管理、環境変数、初期化処理。

```
src/config/
├── index.ts                     # 設定エクスポート統合
├── env.ts                      # 環境変数管理
├── game-config.ts              # ゲーム設定
├── render-config.ts            # レンダリング設定
├── physics-config.ts           # 物理演算設定
└── development-config.ts       # 開発環境専用設定
```

## パスエイリアス設定

TypeScript設定（`tsconfig.json`）でのパスエイリアス：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@/domain/*": ["src/domain/*"],
      "@/application/*": ["src/application/*"],
      "@/infrastructure/*": ["src/infrastructure/*"],
      "@/presentation/*": ["src/presentation/*"],
      "@/shared/*": ["src/shared/*"],
      "@/types/*": ["src/types/*"],
      "@/workers/*": ["src/workers/*"],
      "@/config/*": ["src/config/*"]
    }
  }
}
```

## Effect-TS パターン適用

### Context.GenericTag使用例

```typescript
// src/domain/world/services/WorldGenerator.ts
export interface WorldGenerator {
  readonly generateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkError>
}
export const WorldGenerator = Context.GenericTag<WorldGenerator>('WorldGenerator')

// src/infrastructure/ecs/World.ts
export interface ECSWorld {
  readonly addEntity: (entity: Entity) => Effect.Effect<EntityId, ECSError>
}
export const ECSWorld = Context.GenericTag<ECSWorld>('ECSWorld')
```

### Schema.Struct使用例

```typescript
// src/domain/world/values/Position.ts
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Position = Schema.Schema.Type<typeof Position>

// src/domain/player/entities/Player.ts
export const Player = Schema.Struct({
  id: Schema.String,
  position: Position,
  health: Schema.Number,
  inventory: Schema.Array(ItemStack),
})
export type Player = Schema.Schema.Type<typeof Player>
```

### Schema.TaggedError使用例

```typescript
// src/domain/world/errors/ChunkError.ts
export const ChunkNotFoundError = Schema.TaggedError('ChunkNotFoundError')({
  coordinate: ChunkCoordinate,
  detail: Schema.String,
})

export const ChunkGenerationError = Schema.TaggedError('ChunkGenerationError')({
  coordinate: ChunkCoordinate,
  reason: Schema.String,
})

export type ChunkError = Schema.Schema.Type<typeof ChunkNotFoundError> | Schema.Schema.Type<typeof ChunkGenerationError>
```

## 実装優先順位

1. **Phase 1**: Core Domain + Basic Infrastructure
   - `src/domain/world/`, `src/domain/player/`
   - `src/infrastructure/ecs/`, `src/infrastructure/rendering/`
   - `src/main.ts`

2. **Phase 2**: Application Layer + Systems
   - `src/application/services/`, `src/application/systems/`
   - `src/application/use-cases/`

3. **Phase 3**: Presentation + Advanced Features
   - `src/presentation/ui/`, `src/presentation/input/`
   - `src/workers/`

4. **Phase 4**: Polish + Optimization
   - `src/shared/utils/`, `src/config/`
   - パフォーマンス最適化、品質向上

## 品質ゲート

- [ ] Effect-TS採用率95%以上
- [ ] TypeScript厳密設定準拠100%
- [ ] 循環依存0件
- [ ] テストカバレッジ100%
- [ ] ESLint警告0件
