# Domain Layer - ビジネスロジック・コアドメイン

Domain層は、ビジネスルールとドメインロジックを表現するアプリケーションの中核部分です。Effect-TSを活用した関数型プログラミングにより、不変性と型安全性を保証しながら純粋なビジネスロジックを実装しています。

## ディレクトリ構成

```
src/domain/
├── entities/          # エンティティ（ビジネスオブジェクト）
│   ├── components/    # ECSコンポーネント
│   ├── world.entity.ts
│   ├── player.entity.ts
│   ├── chunk.entity.ts
│   └── block.entity.ts
├── value-objects/     # 値オブジェクト（不変オブジェクト）
│   ├── coordinates/   # 座標系
│   ├── math/          # 数学的値
│   └── physics/       # 物理系
├── services/          # ドメインサービス
├── ports/            # インターフェース定義（依存性逆転）
├── errors/           # ドメイン固有のエラー定義
├── constants/        # ドメイン定数
├── utils/           # ドメインユーティリティ
└── __tests__/       # ドメインテスト

## 1. エンティティ（Entities）

ゲーム世界のビジネスオブジェクトを表現するエンティティ群。

### 主要エンティティ

#### World Entity
```typescript
// src/domain/entities/world.entity.ts
import { Data } from "effect"
import * as S from "@effect/schema/Schema"

export class WorldState extends Data.Class<{
  readonly difficulty: Difficulty
  readonly weather: Weather
  readonly gameRules: ReadonlyMap<string, GameRuleValue>
  readonly seed: number
  readonly spawnPoint: Position
  readonly time: number
}> {
  static readonly schema = S.Struct({
    difficulty: DifficultySchema,
    weather: WeatherSchema,
    gameRules: S.Map(S.String, GameRuleValueSchema),
    seed: S.Number,
    spawnPoint: PositionSchema,
    time: S.Number
  })
}
```

**機能:**
- ゲーム世界の不変状態管理
- 難易度設定（Peaceful, Easy, Normal, Hard）
- 天候システム（Clear, Rain, Storm）
- ゲームルール管理
- スポーンポイント・時間管理

#### Player Entity
```typescript
// src/domain/entities/player.entity.ts
import { Data } from "effect"
import * as S from "@effect/schema/Schema"

export class Player extends Data.Class<{
  readonly id: EntityId
  readonly position: Position
  readonly inventory: PlayerInventory
  readonly gameMode: GameMode
  readonly health: number
  readonly experience: number
}> {
  static readonly schema = S.Struct({
    id: EntityIdSchema,
    position: PositionSchema,
    inventory: PlayerInventorySchema,
    gameMode: GameModeSchema,
    health: S.Number.pipe(S.between(0, 20)),
    experience: S.Number.pipe(S.nonNegative())
  })
}
```

**機能:**
- プレイヤーの不変状態管理
- インベントリ管理（アイテム保持）
- ゲームモード（Creative, Survival, Adventure）
- 体力・経験値システム

#### Chunk Entity
```typescript
// src/domain/entities/chunk.entity.ts
import { Data } from "effect"
import * as S from "@effect/schema/Schema"

export class ChunkData extends Data.Class<{
  readonly coordinate: ChunkCoordinate
  readonly blocks: ReadonlyArray<ReadonlyArray<ReadonlyArray<Block>>>
  readonly isGenerated: boolean
  readonly isLoaded: boolean
  readonly entities: ReadonlyArray<EntityId>
}> {
  static readonly schema = S.Struct({
    coordinate: ChunkCoordinateSchema,
    blocks: S.Array(S.Array(S.Array(BlockSchema))),
    isGenerated: S.Boolean,
    isLoaded: S.Boolean,
    entities: S.Array(EntityIdSchema)
  })
}
```

**機能:**
- チャンク（16x16x256ブロック）管理
- ブロックデータの不変格納
- エンティティ管理
- 生成・読み込み状態管理

#### Block Entity
```typescript
// src/domain/entities/block.entity.ts
import { Data } from "effect"
import * as S from "@effect/schema/Schema"

export class Block extends Data.Class<{
  readonly type: BlockType
  readonly position: Position
  readonly metadata: ReadonlyMap<string, unknown>
  readonly lightLevel: number
}> {
  static readonly schema = S.Struct({
    type: BlockTypeSchema,
    position: PositionSchema,
    metadata: S.Map(S.String, S.Unknown),
    lightLevel: S.Number.pipe(S.between(0, 15))
  })
}
```

**機能:**
- 個別ブロックの不変管理
- ブロックタイプ分類
- メタデータ管理（向き、状態等）
- 照明レベル管理

### コンポーネントシステム

ECSアーキテクチャに基づくコンポーネント群：

```typescript
// src/domain/entities/components/
├── world/            # ワールド関連コンポーネント
│   ├── chunk.ts
│   ├── terrain-block.ts
│   └── component-utils.ts
├── physics/          # 物理演算コンポーネント
│   ├── physics-components.ts
│   ├── physics-utils.ts
│   └── physics-factories.ts
├── rendering/        # レンダリング関連
│   ├── rendering-components.ts
│   ├── rendering-utils.ts
│   └── rendering-factories.ts
└── gameplay/         # ゲームプレイ要素
    ├── gameplay-components.ts
    ├── gameplay-utils.ts
    └── gameplay-factories.ts
```

## 2. Value Objects（値オブジェクト）

不変オブジェクトとして定義される値型群。

### 座標系 Value Objects

#### Position（3D座標）
```typescript
// src/domain/value-objects/coordinates/position.value-object.ts
export interface Position {
  readonly x: number
  readonly y: number  
  readonly z: number
}

export const PositionSchema = S.Struct({
  x: S.Number,
  y: S.Number,
  z: S.Number
})

export const makePosition = (x: number, y: number, z: number): Position => ({ x, y, z })
```

#### ChunkCoordinate（チャンク座標）
```typescript  
// src/domain/value-objects/coordinates/chunk-coordinate.value-object.ts
export interface ChunkCoordinate {
  readonly x: ChunkX
  readonly z: ChunkZ
}

export const ChunkCoordinateSchema = S.Struct({
  x: ChunkXSchema,
  z: ChunkZSchema
})
```

### 数学系 Value Objects

#### Vector3（3Dベクトル）
```typescript
// src/domain/value-objects/math/vector3.value-object.ts
export interface Vector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

// 数学的操作
export const magnitude = (v: Vector3): number
export const normalize = (v: Vector3): Vector3
export const multiply = (v: Vector3, scalar: number): Vector3
```

#### Quaternion（四元数）
```typescript
// src/domain/value-objects/math/quaternion.value-object.ts
export interface Quaternion {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}
```

### 物理演算 Value Objects

#### AABB（軸並行境界ボックス）
```typescript
// src/domain/value-objects/physics/aabb.value-object.ts
export interface AABB {
  readonly min: Vector3
  readonly max: Vector3
}
```

#### Velocity（速度）
```typescript
// src/domain/value-objects/physics/velocity.value-object.ts
export interface Velocity {
  readonly x: number
  readonly y: number
  readonly z: number
}
```

## 3. Domain Services（ドメインサービス）

複数のエンティティを扱う複雑なビジネスロジックを実装。

### ECSシステム

#### Component Service
```typescript
// src/domain/services/ecs/component.service.ts
- コンポーネント管理システム
- 型安全なコンポーネント操作
- パフォーマンス最適化
```

#### Query Builder Service
```typescript
// src/domain/services/ecs/query-builder.service.ts
- エンティティクエリ構築
- 高性能なクエリ実行
- 複雑な条件指定
```

#### Archetype Query Service  
```typescript
// src/domain/services/ecs/archetype-query.service.ts
- アーキタイプベースクエリ
- コンポーネント組み合わせ検索
- メモリ効率的な実装
```

### ワールド管理サービス

#### World Management Service
```typescript
// src/domain/services/world-management.domain-service.ts
- ワールド状態管理
- チャンクライフサイクル
- エンティティ管理
```

#### Chunk Loading Service
```typescript
// src/domain/services/chunk-loading.service.ts
- チャンク読み込み制御
- 遅延読み込み戦略
- メモリ管理
```

### 物理演算サービス

#### Physics Domain Service
```typescript
// src/domain/services/physics.domain-service.ts
- 物理シミュレーション
- 衝突検出・応答
- 重力・摩擦計算
```

#### Collision System Service
```typescript
// src/domain/services/collision-system.service.ts  
- 衝突判定システム
- AABB衝突検出
- 精密衝突応答
```

### 地形生成サービス

#### Terrain Generation Service
```typescript
// src/domain/services/terrain-generation.domain-service.ts
- 地形生成アルゴリズム
- ノイズベース生成
- バイオーム管理
```

#### Mesh Generation Service
```typescript
// src/domain/services/mesh-generation.domain-service.ts
- メッシュ生成ロジック
- 頂点・面データ作成
- 最適化アルゴリズム
```

## 4. Ports（ポート定義）

依存性逆転の原則に基づくインターフェース定義。

### インフラストラクチャポート

#### World Repository Port
```typescript
// src/domain/ports/world-repository.port.ts
export interface IWorldRepositoryPort {
  saveWorld(world: WorldState): Effect.Effect<void, WorldSaveError>
  loadWorld(id: string): Effect.Effect<WorldState, WorldLoadError>
  queryEntities<T>(query: Query): Effect.Effect<T[], QueryError>
}
```

#### Terrain Generator Port  
```typescript
// src/domain/ports/terrain-generator.port.ts
export interface ITerrainGeneratorPort {
  generateChunk(coord: ChunkCoordinate): Effect.Effect<ChunkData, TerrainGenError>
  generateNoise(settings: NoiseSettings): Effect.Effect<number[], NoiseError>
}
```

#### Mesh Generator Port
```typescript
// src/domain/ports/mesh-generator.port.ts
export interface IMeshGeneratorPort {
  generateMesh(chunk: ChunkData): Effect.Effect<MeshData, MeshGenError>
  optimizeMesh(mesh: MeshData): Effect.Effect<MeshData, OptimizationError>
}
```

### システムポート

#### Input Port
```typescript
// src/domain/ports/input.port.ts
export interface IInputPort {
  getKeyState(key: KeyCode): Effect.Effect<KeyState>
  getMousePosition(): Effect.Effect<Position>
  onKeyPress(callback: (key: KeyCode) => void): Effect.Effect<void>
}
```

#### Render Port
```typescript
// src/domain/ports/render.port.ts
export interface IRenderPort {
  renderChunk(mesh: MeshData): Effect.Effect<void, RenderError>
  updateCamera(camera: CameraState): Effect.Effect<void>
  setViewport(config: ViewportConfig): Effect.Effect<void>
}
```

## 5. エラー定義

ドメイン固有のエラー型定義。

### 統一エラーシステム

```typescript
// src/domain/errors/unified-errors.ts
export class DomainError extends Data.TaggedError("DomainError")<{
  message: string
  code: string
  context?: Record<string, unknown>
}> {}

export class ValidationError extends DomainError {}
export class BusinessRuleViolation extends DomainError {}
export class ResourceNotFound extends DomainError {}
```

### バリデーションエラー
```typescript
// src/domain/errors/validation-errors.ts
export class PositionValidationError extends ValidationError {}
export class ChunkValidationError extends ValidationError {}
export class BlockValidationError extends ValidationError {}
```

## 6. 定数定義

ドメイン固有の定数群。

### ワールド定数
```typescript
// src/domain/constants/world-constants.ts
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 256
export const WORLD_BOTTOM = 0
export const WORLD_TOP = 256
export const MAX_BUILD_HEIGHT = 320
```

### ブロック定数  
```typescript
// src/domain/constants/block-types.ts
export enum BlockType {
  AIR = 0,
  STONE = 1,
  DIRT = 2,
  GRASS = 3,
  WATER = 8,
  LAVA = 10
}

export const TRANSPARENT_BLOCKS = [BlockType.AIR, BlockType.WATER]
export const SOLID_BLOCKS = [BlockType.STONE, BlockType.DIRT, BlockType.GRASS]
```

## 7. 特徴的な実装パターン

### Effect-TS活用
- すべての副作用をEffect型で管理
- 型安全なエラーハンドリング
- 関数型プログラミングの原則遵守

### Schema-based Validation
- @effect/schemaによる厳密な型定義
- ランタイム型検証
- 型安全なデシリアライゼーション

### 不変性の保証
- すべてのデータ構造がimmutable
- 関数型アプローチによる状態管理
- 副作用の明示的管理

### ECSアーキテクチャ
- エンティティ・コンポーネント・システム分離
- 高性能なクエリシステム
- 柔軟なゲーム要素組み合わせ

Domain層は外部技術に依存しない純粋なビジネスロジックを提供し、アプリケーション全体の中核となる重要な層です。