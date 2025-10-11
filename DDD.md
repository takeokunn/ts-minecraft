# TypeScript Minecraft Clone - DDD実装ガイド

## 1. プロジェクト概要

### 1.1 プロジェクト目標

**TypeScript Minecraft Clone**: Effect-TS + DDD + ECS による完全関数型Minecraftクローン

#### コア目標

- **パフォーマンス**: 60FPS / <2GB メモリ
- **品質**: 80%+ カバレッジ
- **アーキテクチャ**: 完全関数型・イベント駆動・DDD/ECS

### 1.2 技術スタック

- **Effect-TS 3.17+**: 完全関数型プログラミング基盤
- **Three.js**: 3Dレンダリング
- **Cannon-es**: 物理演算
- **Vite**: ビルドツール
- **Vitest**: テストフレームワーク

### 1.3 技術的制約・設計方針

プロジェクト全体で厳密に守られる技術的制約：

- **クラス禁止**: Effect-TS Service/Layerパターンによる関数型設計
- **変数制約**: var, let, any, async禁止（const + Effect.gen必須）
- **型安全性**: Effect.gen/Schema.Struct必須
- **ランタイム検証**: 外部データはすべてSchemaによる検証必須
- **エラーハンドリング**: 例外禁止・Effect型によるエラー表現
- **遅延評価原則**: Effect.runSync/Schema.decodeUnknownSync最小化

### 1.4 アーキテクチャ哲学

1. **Effect-TS中心設計**: すべての副作用をEffect型で表現
2. **型安全性の徹底**: Brand型により同種プリミティブの混同を防止
3. **ランタイム安全性**: Schemaによる実行時データ検証
4. **関数型エラーハンドリング**: Effect型による予測可能なエラー処理
5. **テスタビリティ**: 依存性注入により100%モック可能な設計

## 2. Effect-TS統合アーキテクチャ

### 2.1 Effect-TS中心設計

プロジェクトは従来のDDD文献ではなく、**Effect-TSを中心としたDDD実装**を採用：

```typescript
// ❌ 従来のDDDパターン（未採用）
class UserService {
  constructor(private repository: UserRepository) {}
  async createUser(data: UserData): Promise<User> { ... }
}

// ✅ Effect-TS + DDDパターン（採用）
export interface UserService {
  readonly createUser: (data: UserData) => Effect.Effect<User, UserError>
}

export const UserService = Context.GenericTag<UserService>('@domain/UserService')

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const repository = yield* UserRepository
    return UserService.of({
      createUser: (data) => Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(UserDataSchema)(data)
        return yield* repository.save(validated)
      })
    })
  })
)
```

### 2.2 Service/Layer/Liveパターン

プロジェクト全体で統一された3層パターン：

#### Pattern 1: Service定義（interface）

```typescript
// Service = ドメインサービスのインターフェース定義
export interface CameraService {
  readonly updatePosition: (
    cameraId: CameraId,
    position: Vector3
  ) => Effect.Effect<Camera, CameraError>

  readonly getCamera: (
    cameraId: CameraId
  ) => Effect.Effect<Option.Option<Camera>, never>
}

export const CameraService = Context.GenericTag<CameraService>(
  '@domain/camera/CameraService'
)
```

#### Pattern 2: Live実装

```typescript
// Live = 実装の提供（各レイヤーに配置）
export const CameraServiceLive = Layer.effect(
  CameraService,
  Effect.gen(function* () {
    const repository = yield* CameraRepository
    const validator = yield* CameraValidator

    return CameraService.of({
      updatePosition: (cameraId, position) => Effect.gen(function* () {
        const camera = yield* repository.findById(cameraId)
        return yield* Option.match(camera, {
          onNone: () => Effect.fail(CameraError.notFound(cameraId)),
          onSome: (cam) => Effect.gen(function* () {
            const validated = yield* validator.validatePosition(position)
            const updated = { ...cam, position: validated }
            return yield* repository.save(updated)
          })
        })
      }),
      getCamera: (cameraId) => repository.findById(cameraId)
    })
  })
)
```

#### Pattern 3: Layer統合（bootstrap/infrastructure.ts）

```typescript
// 全サービスを統合したMainLayer
export const MainLayer = Layer.mergeAll(
  // Domain Services
  CameraServiceLive,
  InventoryServiceLive,
  ChunkServiceLive,

  // Repositories
  CameraRepositoryLive,
  InventoryRepositoryLive,
  ChunkRepositoryLive,

  // Infrastructure
  WebGLRendererServiceLive,
  PhysicsWorldServiceLive
)

// main.tsでの使用
const program = Effect.gen(function* () {
  const camera = yield* CameraService
  yield* camera.updatePosition(cameraId, newPosition)
})

Effect.runPromise(program.pipe(Effect.provide(MainLayer)))
```

### 2.3 遅延評価原則

#### 原則: Effect.runSync禁止

**現状**: 2箇所のみ（目標達成、96.4%削減完了）

```typescript
// ❌ 禁止パターン
const config = Effect.runSync(loadConfig())

// ✅ 推奨パターン A: Effect返却
export const makeConfig = (): Effect.Effect<Config, ConfigError> => loadConfig()

// ✅ 推奨パターン B: Layer統合
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const config = yield* loadConfig()
    return ConfigService.of({ config })
  })
)
```

#### 原則: Schema.decodeUnknownSync最小化

**現状**: 94箇所残存（優先的削減対象）

```typescript
// ❌ 禁止パターン
const config = Schema.decodeUnknownSync(ConfigSchema)(rawConfig)

// ✅ 推奨パターン
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const config = yield* Schema.decodeUnknown(ConfigSchema)(rawConfig)
    return ConfigService.of({ config })
  })
)
```

### 2.4 Layer設計ガイドライン

#### Layer.effect vs Layer.scoped判断フロー

```
Layer内でリソース生成？
├─ 外部リソース（ファイル、ネットワーク、WebGL）
│  └─ ✅ Layer.scoped + Effect.acquireRelease
├─ 長時間Fiber（Effect.forever等）
│  └─ ✅ Layer.scoped + Effect.forkScoped
├─ Pool
│  └─ ✅ Layer.scoped（Poolは自動的にScoped）
├─ Ref.make
│  └─ ❌ Layer.effect（GC管理で十分）
├─ Queue.unbounded
│  └─ ❌ Layer.effect（GC管理で十分）
└─ Queue.bounded
   ├─ 実行中Effectの早期中断が必要？
   │  ├─ YES → ✅ Layer.scoped + shutdown
   │  └─ NO  → ❌ Layer.effect（GC管理で十分）
   └─ デフォルト: Layer.effect
```

#### 実装例: Layer.effect（Ref.make）

```typescript
export const CameraStateRepositoryLive = Layer.effect(
  CameraStateRepository,
  Effect.gen(function* () {
    const storageRef = yield* Ref.make(initialState)  // GC管理
    return CameraStateRepository.of({
      save: (camera) => Ref.update(storageRef, ...),
      findById: (id) => Ref.get(storageRef)
    })
  })
)
```

#### 実装例: Layer.scoped（外部リソース）

```typescript
export const WebGLRendererServiceLive = Layer.scoped(
  WebGLRendererService,
  Effect.gen(function* () {
    const resource = yield* Resource.manual(
      Effect.acquireRelease(
        createRenderer(params),
        (renderer) => Effect.sync(() => renderer.dispose())
      )
    )
    return WebGLRendererService.of({ resource })
  })
)
```

## 3. レイヤーアーキテクチャ

### 3.1 レイヤー構成

```
┌──────────────────────────────────────┐
│     Presentation Layer (UI/Input)    │
│         React Components             │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│    Application Layer (Orchestrator)  │
│  システム統合・ユースケース調整       │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│      Domain Layer (Business Logic)   │
│  Aggregate/ValueObject/Service       │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│  Infrastructure Layer (Tech Details) │
│    Three.js/Cannon.js/IndexedDB      │
└──────────────────────────────────────┘
```

### 3.2 依存方向の制約

- **Domain** → Domain のみ（技術依存禁止）
- **Application** → Application / Domain
- **Infrastructure** → Infrastructure / Application / Domain
- **Presentation** → Application（Domainへの直接依存は警告）
- **Bootstrap** → 全レイヤー（Layer組み立て）

### 3.3 各レイヤーの責務

#### Domain層

- ビジネスロジックの実装
- Aggregate/ValueObject/DomainService定義
- Repository Interface定義（実装はInfrastructure層）
- ドメインイベント定義

#### Application層

- 複数ドメインサービスの統合
- システム全体のオーケストレーション
- CQRS実装（Commands/Queries分離）
- イベント駆動アーキテクチャ

#### Infrastructure層

- 技術的詳細の実装
- Three.js/Cannon.jsラッパー
- Repository実装（IndexedDB/Memory）
- ECS（Entity Component System）実装

#### Presentation層

- UIコンポーネント（React）
- ユーザー入力処理
- 状態管理
- Application層ファサード経由でドメインにアクセス

## 4. ディレクトリ構造

### 4.1 実際の構造

```
src/
├── main.ts                      # アプリケーションエントリーポイント
├── domain/                      # ドメイン層（24 Bounded Contexts）
│   ├── agriculture/            # 農業BC
│   ├── biome/                  # バイオームBC
│   ├── camera/                 # カメラBC
│   ├── chunk/                  # チャンクBC
│   ├── chunk_manager/          # チャンク管理BC
│   ├── chunk_system/           # チャンクシステムBC
│   ├── crafting/               # クラフティングBC
│   ├── entities/               # エンティティBC
│   ├── interaction/            # インタラクションBC
│   ├── inventory/              # インベントリBC（最成熟）
│   ├── performance/            # パフォーマンスBC
│   ├── physics/                # 物理BC
│   ├── player/                 # プレイヤーBC
│   ├── scene/                  # シーンBC
│   ├── shared/                 # 共有要素
│   ├── view_distance/          # 視界距離BC
│   ├── world/                  # ワールドBC
│   └── world_generation/       # ワールド生成BC
├── application/                # アプリケーション層
│   ├── camera/                 # カメラシステム統合
│   ├── chunk/                  # チャンク管理統合
│   ├── config.ts               # アプリケーション設定
│   ├── game_loop/              # ゲームループ
│   ├── inventory/              # インベントリシステム統合
│   ├── world/                  # ワールドシステム統合
│   └── world_generation/       # ワールド生成統合
├── infrastructure/             # インフラストラクチャ層
│   ├── audio/                  # オーディオシステム
│   ├── cannon/                 # Cannon.jsラッパー
│   ├── ecs/                    # ECSシステム
│   ├── inventory/              # インベントリ永続化
│   └── three/                  # Three.jsラッパー
├── presentation/               # プレゼンテーション層
│   └── inventory/              # インベントリUI
├── shared/                     # 共有コンポーネント
│   ├── browser/                # ブラウザAPI
│   ├── schema/                 # 共通Schema
│   └── services/               # 共通サービス
└── bootstrap/                  # ブートストラップ
    └── infrastructure.ts       # MainLayer統合
```

### 4.2 Bounded Context一覧

プロジェクトは24のBounded Contextで構成：

| BC名 | 成熟度 | 説明 |
|------|--------|------|
| inventory | ★★★★★ | インベントリ管理（CQRS完全実装） |
| camera | ★★★★☆ | カメラシステム（Repository分離完了） |
| chunk | ★★★★☆ | チャンク管理 |
| world_generation | ★★★★☆ | ワールド生成 |
| biome | ★★★☆☆ | バイオーム生成 |
| physics | ★★★☆☆ | 物理演算 |
| player | ★★★☆☆ | プレイヤー管理 |
| その他17個 | ★★☆☆☆ | 開発中 |

### 4.3 成熟度別実装状況

#### 成熟度 ★★★★★: inventory BC

**完全実装された機能**:

- ✅ CQRS完全分離（Commands/Queries）
- ✅ Repository Pattern（interface/memory/persistent）
- ✅ Factory Pattern（ItemFactory/ContainerFactory/InventoryFactory）
- ✅ DomainService（ValidationService/TransferService/StackingService/CraftingIntegration）
- ✅ Schema.TaggedStruct完全統合
- ✅ Effect.gen/Layer.effect統一
- ✅ Application層統合（api-service.ts）

**ディレクトリ構造**:

```
src/domain/inventory/
├── aggregate/
│   ├── container/              # Container Aggregate
│   ├── inventory/              # Inventory Aggregate
│   └── item_stack/             # ItemStack Aggregate
├── value_object/
│   ├── inventory_type/         # インベントリ種別
│   ├── item_metadata/          # アイテムメタデータ
│   ├── slot/                   # スロット
│   ├── slot_position/          # スロット位置
│   └── stack_size/             # スタック数
├── domain_service/
│   ├── crafting_integration/   # クラフティング統合
│   ├── stacking_service/       # スタック処理
│   ├── transfer_service/       # アイテム転送
│   └── validation_service/     # バリデーション
├── factory/
│   ├── container_factory/      # Containerファクトリ
│   ├── inventory_factory/      # Inventoryファクトリ
│   └── item_factory/           # Itemファクトリ
├── repository/
│   ├── container_repository/   # Container Repository
│   │   ├── interface.ts
│   │   ├── memory.ts
│   │   └── persistent.ts
│   ├── inventory_repository/   # Inventory Repository
│   │   ├── interface.ts
│   │   ├── memory.ts
│   │   └── persistent.ts
│   └── types/
│       └── repository_error.ts # Repository共通エラー
├── types/
│   ├── commands.ts             # CQRS Commands
│   ├── queries.ts              # CQRS Queries
│   ├── core.ts                 # コア型定義
│   ├── errors.ts               # エラー定義
│   ├── events.ts               # ドメインイベント
│   └── specifications.ts       # 仕様パターン
├── inventory-service.ts        # InventoryService定義
└── inventory-service-live.ts   # InventoryServiceLive実装
```

#### 成熟度 ★★★★☆: camera BC

**実装完了機能**:

- ✅ Repository Pattern分離完了
- ✅ 4つの独立Repository（CameraState/AnimationHistory/SettingsStorage/ViewModePreferences）
- ✅ DomainService（AnimationEngine/CameraControl/ViewModeManager）
- ✅ Aggregate（Camera）
- ✅ ValueObject（AnimationState/CameraMode/ViewMode）

**既知の技術的負債**:

- ⚠️ Domain層にThree.js依存が残存（Camera/FirstPersonCamera/ThirdPersonCamera）
- 📋 リファクタリング計画: Three.js依存をInfrastructure層へ移動

**ディレクトリ構造**:

```
src/domain/camera/
├── aggregate/
│   └── camera/                 # Camera Aggregate
│       ├── camera.ts
│       └── factory.ts
├── value_object/
│   ├── animation_state/        # アニメーション状態
│   ├── camera_mode/            # カメラモード
│   └── view_mode/              # ビューモード
├── domain_service/
│   ├── animation_engine/       # アニメーションエンジン
│   ├── camera_control/         # カメラ制御
│   └── view_mode_manager/      # ビューモード管理
├── repository/
│   ├── animation_history/      # アニメーション履歴Repository
│   ├── camera_state/           # カメラ状態Repository
│   ├── settings_storage/       # 設定保存Repository
│   └── view_mode_preferences/  # ビューモード設定Repository
├── types/
│   ├── errors.ts               # エラー定義
│   └── events.ts               # ドメインイベント
├── first_person.ts             # ⚠️ Three.js依存（要リファクタリング）
├── third_person.ts             # ⚠️ Three.js依存（要リファクタリング）
└── service.ts                  # CameraService定義
```

## 5. Bounded Context標準構造

### 5.1 標準ディレクトリ構成

各Bounded Contextは以下の標準構造に従う：

```
src/domain/<bounded-context>/
├── aggregate/                  # 集約（Aggregate Root）
│   └── <aggregate-name>/
│       ├── types.ts           # 型定義
│       ├── factory.ts         # ファクトリ関数
│       └── operations.ts      # 操作関数
├── value_object/              # 値オブジェクト
│   └── <value-object-name>/
│       ├── types.ts           # 型定義
│       └── operations.ts      # 操作関数
├── domain_service/            # ドメインサービス
│   └── <service-name>/
│       └── service.ts         # サービス実装
├── repository/                # Repositoryインターフェース
│   └── <repository-name>/
│       ├── interface.ts       # Repository Interface
│       ├── memory.ts          # メモリ実装
│       └── persistent.ts      # 永続化実装（IndexedDB）
├── factory/                   # ファクトリ
│   └── <factory-name>/
│       └── factory.ts         # ファクトリ実装
└── types/
    ├── core.ts                # コア型定義
    ├── errors.ts              # エラー定義
    └── events.ts              # ドメインイベント
```

### 5.2 aggregate/

**責務**: ビジネスルールを実装する集約

**実装パターン**:

```typescript
// types.ts - Schema.Structで型定義
import { Schema } from '@effect/schema'

export const ItemStack = Schema.Struct({
  itemId: ItemId,
  quantity: Quantity,
  metadata: Schema.optional(ItemMetadata)
})

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// factory.ts - ファクトリ関数
export const createItemStack = (
  itemId: ItemId,
  quantity: Quantity
): Effect.Effect<ItemStack, ItemStackError> =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknown(ItemStack)({
      itemId,
      quantity,
      metadata: Option.none()
    })
    return validated
  })

// operations.ts - ドメインロジック
export const combineStacks = (
  stack1: ItemStack,
  stack2: ItemStack
): Effect.Effect<ItemStack, ItemStackError> =>
  Effect.gen(function* () {
    if (stack1.itemId !== stack2.itemId) {
      return yield* Effect.fail(ItemStackError.incompatibleItems())
    }
    const newQuantity = stack1.quantity + stack2.quantity
    return yield* createItemStack(stack1.itemId, newQuantity)
  })
```

### 5.3 value_object/

**責務**: 不変な値オブジェクトの定義

**実装パターン**:

```typescript
// types.ts - Brand型で型安全性確保
import { Schema, Brand } from '@effect/schema'

export const ItemId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand('ItemId')
)
export type ItemId = Schema.Schema.Type<typeof ItemId>

export const Quantity = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.brand('Quantity')
)
export type Quantity = Schema.Schema.Type<typeof Quantity>

// operations.ts - 値オブジェクト操作
export const createItemId = (): Effect.Effect<ItemId, never> =>
  Effect.gen(function* () {
    const uuid = yield* Random.nextUUID
    return yield* Schema.decodeUnknown(ItemId)(uuid)
  })

export const addQuantity = (
  q1: Quantity,
  q2: Quantity
): Effect.Effect<Quantity, QuantityError> =>
  Effect.gen(function* () {
    const sum = Brand.nominal<Quantity>()(q1 + q2)
    if (sum > 64) {
      return yield* Effect.fail(QuantityError.exceedsMaxStack())
    }
    return sum
  })
```

### 5.4 domain_service/

**責務**: 複数の集約にまたがるドメインロジック

**実装パターン**:

```typescript
// service.ts - Service Interface + Live実装
import { Context, Effect, Layer } from 'effect'

export interface TransferService {
  readonly transfer: (
    from: Container,
    to: Container,
    itemStack: ItemStack
  ) => Effect.Effect<TransferResult, TransferError>
}

export const TransferService = Context.GenericTag<TransferService>(
  '@domain/inventory/TransferService'
)

// Live実装（Domain層またはApplication層に配置）
export const TransferServiceLive = Layer.effect(
  TransferService,
  Effect.gen(function* () {
    const validator = yield* ValidationService
    const stacker = yield* StackingService

    return TransferService.of({
      transfer: (from, to, itemStack) => Effect.gen(function* () {
        // バリデーション
        yield* validator.canTransfer(from, to, itemStack)

        // 転送処理
        const removed = yield* from.removeItem(itemStack)
        const added = yield* to.addItem(itemStack)

        return { from: removed, to: added }
      })
    })
  })
)
```

### 5.5 repository/

**責務**: 集約の永続化インターフェース

**標準実装パターン**: interface.ts / memory.ts / persistent.ts の3ファイル構成

#### interface.ts - Repository Interface定義

```typescript
import { Context, Effect, Option } from 'effect'

export interface InventoryRepository {
  readonly save: (
    inventory: Inventory
  ) => Effect.Effect<void, RepositoryError>

  readonly findById: (
    id: InventoryId
  ) => Effect.Effect<Option.Option<Inventory>, RepositoryError>

  readonly findAll: () => Effect.Effect<
    ReadonlyArray<Inventory>,
    RepositoryError
  >

  readonly delete: (
    id: InventoryId
  ) => Effect.Effect<void, RepositoryError>
}

export const InventoryRepository = Context.GenericTag<InventoryRepository>(
  '@domain/inventory/InventoryRepository'
)
```

#### memory.ts - メモリ実装（テスト用）

```typescript
import { Ref, Layer, Effect, Option } from 'effect'

export const InventoryRepositoryMemory = Layer.effect(
  InventoryRepository,
  Effect.gen(function* () {
    const storage = yield* Ref.make(
      new Map<InventoryId, Inventory>()
    )

    return InventoryRepository.of({
      save: (inventory) =>
        Ref.update(storage, (map) =>
          new Map(map).set(inventory.id, inventory)
        ),

      findById: (id) =>
        Ref.get(storage).pipe(
          Effect.map((map) => Option.fromNullable(map.get(id)))
        ),

      findAll: () =>
        Ref.get(storage).pipe(
          Effect.map((map) => Array.from(map.values()))
        ),

      delete: (id) =>
        Ref.update(storage, (map) => {
          const newMap = new Map(map)
          newMap.delete(id)
          return newMap
        })
    })
  })
)
```

#### persistent.ts - 永続化実装（IndexedDB）

```typescript
import { Layer, Effect, Option } from 'effect'

export const InventoryRepositoryPersistent = Layer.effect(
  InventoryRepository,
  Effect.gen(function* () {
    const db = yield* IndexedDBService

    return InventoryRepository.of({
      save: (inventory) => Effect.gen(function* () {
        const encoded = yield* Schema.encode(InventorySchema)(inventory)
        yield* db.put('inventories', encoded, inventory.id)
      }),

      findById: (id) => Effect.gen(function* () {
        const raw = yield* db.get('inventories', id)
        return yield* Option.match(raw, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (data) =>
            Schema.decodeUnknown(InventorySchema)(data).pipe(
              Effect.map(Option.some)
            )
        })
      }),

      findAll: () => Effect.gen(function* () {
        const rawArray = yield* db.getAll('inventories')
        return yield* Effect.all(
          rawArray.map((raw) =>
            Schema.decodeUnknown(InventorySchema)(raw)
          )
        )
      }),

      delete: (id) => db.delete('inventories', id)
    })
  })
)
```

### 5.6 factory/

**責務**: 複雑な集約の生成ロジック

**実装パターン**:

```typescript
// factory.ts - Builder Patternの代替
import { Effect } from 'effect'

export interface ItemFactoryConfig {
  readonly itemType: ItemType
  readonly quantity: number
  readonly durability?: number
  readonly enchantments?: ReadonlyArray<Enchantment>
}

export const createItem = (
  config: ItemFactoryConfig
): Effect.Effect<ItemStack, ItemFactoryError> =>
  Effect.gen(function* () {
    // バリデーション
    const validatedConfig = yield* Schema.decodeUnknown(
      ItemFactoryConfigSchema
    )(config)

    // ItemStack生成
    const itemId = yield* generateItemId()
    const quantity = yield* Quantity.make(validatedConfig.quantity)

    const metadata = yield* createMetadata({
      durability: validatedConfig.durability,
      enchantments: validatedConfig.enchantments
    })

    return yield* Schema.decodeUnknown(ItemStack)({
      itemId,
      quantity,
      metadata
    })
  })
```

## 6. Repository Pattern標準

### 6.1 実装パターン

プロジェクト全体で統一された3ファイルパターン：

1. **interface.ts**: Repository Interface定義
2. **memory.ts**: Ref.makeベースのメモリ実装（テスト用）
3. **persistent.ts**: IndexedDBベースの永続化実装（本番用）

### 6.2 interface.ts

```typescript
export interface XxxRepository {
  readonly save: (entity: Xxx) => Effect.Effect<void, RepositoryError>
  readonly findById: (id: XxxId) => Effect.Effect<Option.Option<Xxx>, RepositoryError>
  readonly findAll: () => Effect.Effect<ReadonlyArray<Xxx>, RepositoryError>
  readonly delete: (id: XxxId) => Effect.Effect<void, RepositoryError>
}

export const XxxRepository = Context.GenericTag<XxxRepository>(
  '@domain/<bc>/XxxRepository'
)
```

### 6.3 memory.ts

```typescript
export const XxxRepositoryMemory = Layer.effect(
  XxxRepository,
  Effect.gen(function* () {
    const storage = yield* Ref.make(new Map<XxxId, Xxx>())
    return XxxRepository.of({
      save: (entity) => Ref.update(storage, (map) => new Map(map).set(entity.id, entity)),
      findById: (id) => Ref.get(storage).pipe(Effect.map((map) => Option.fromNullable(map.get(id)))),
      findAll: () => Ref.get(storage).pipe(Effect.map((map) => Array.from(map.values()))),
      delete: (id) => Ref.update(storage, (map) => { const newMap = new Map(map); newMap.delete(id); return newMap })
    })
  })
)
```

### 6.4 persistent.ts

```typescript
export const XxxRepositoryPersistent = Layer.effect(
  XxxRepository,
  Effect.gen(function* () {
    const db = yield* IndexedDBService

    return XxxRepository.of({
      save: (entity) => Effect.gen(function* () {
        const encoded = yield* Schema.encode(XxxSchema)(entity)
        yield* db.put('xxxs', encoded, entity.id)
      }),

      findById: (id) => Effect.gen(function* () {
        const raw = yield* db.get('xxxs', id)
        return yield* Option.match(raw, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (data) => Schema.decodeUnknown(XxxSchema)(data).pipe(Effect.map(Option.some))
        })
      }),

      findAll: () => Effect.gen(function* () {
        const rawArray = yield* db.getAll('xxxs')
        return yield* Effect.all(rawArray.map((raw) => Schema.decodeUnknown(XxxSchema)(raw)))
      }),

      delete: (id) => db.delete('xxxs', id)
    })
  })
)
```

## 7. Application層設計

### 7.1 システム統合の役割

Application層は複数のDomainサービスを統合し、システム全体のオーケストレーションを担当：

**責務**:

- 複数Bounded Contextの調整
- トランザクション管理
- イベント駆動アーキテクチャ
- CQRS実装（Commands/Queries分離）
- パフォーマンス監視

### 7.2 Orchestrator実装例

```typescript
// src/application/world/world_state_stm.ts
import { Effect, Layer, Context, STM, TRef } from 'effect'

export interface WorldStateOrchestrator {
  readonly updateWorld: (
    delta: number
  ) => Effect.Effect<WorldState, WorldError>
}

export const WorldStateOrchestrator = Context.GenericTag<WorldStateOrchestrator>(
  '@application/WorldStateOrchestrator'
)

export const WorldStateOrchestratorLive = Layer.effect(
  WorldStateOrchestrator,
  Effect.gen(function* () {
    // 複数ドメインサービスの統合
    const chunkService = yield* ChunkService
    const biomeService = yield* BiomeService
    const physicsService = yield* PhysicsService
    const eventQueue = yield* GameEventQueue

    // STMによるトランザクション管理
    const worldStateRef = yield* TRef.make(initialWorldState)

    return WorldStateOrchestrator.of({
      updateWorld: (delta) => Effect.gen(function* () {
        // トランザクション実行
        return yield* STM.commit(
          STM.gen(function* () {
            const currentState = yield* TRef.get(worldStateRef)

            // 複数サービスの協調
            const updatedChunks = yield* STM.fromEffect(
              chunkService.updateChunks(currentState.chunks, delta)
            )
            const updatedBiomes = yield* STM.fromEffect(
              biomeService.updateBiomes(currentState.biomes, delta)
            )
            const updatedPhysics = yield* STM.fromEffect(
              physicsService.simulate(currentState.physics, delta)
            )

            const newState = {
              ...currentState,
              chunks: updatedChunks,
              biomes: updatedBiomes,
              physics: updatedPhysics
            }

            yield* TRef.set(worldStateRef, newState)

            // イベント発行
            yield* STM.fromEffect(
              eventQueue.publish({ type: 'WorldUpdated', state: newState })
            )

            return newState
          })
        )
      })
    })
  })
)
```

### 7.3 CQRS実装（inventory BC）

inventory BCでは完全なCQRS実装を採用：

#### Commands（状態変更）

```typescript
// src/domain/inventory/types/commands.ts
export const AddItemCommand = Schema.Struct({
  _tag: Schema.Literal('AddItem'),
  inventoryId: InventoryId,
  itemStack: ItemStack
})

export const RemoveItemCommand = Schema.Struct({
  _tag: Schema.Literal('RemoveItem'),
  inventoryId: InventoryId,
  slotPosition: SlotPosition
})

export type InventoryCommand =
  | Schema.Schema.Type<typeof AddItemCommand>
  | Schema.Schema.Type<typeof RemoveItemCommand>
```

#### Queries（参照）

```typescript
// src/domain/inventory/types/queries.ts
export const GetInventoryQuery = Schema.Struct({
  _tag: Schema.Literal('GetInventory'),
  inventoryId: InventoryId
})

export const ListItemsQuery = Schema.Struct({
  _tag: Schema.Literal('ListItems'),
  inventoryId: InventoryId,
  filters: Schema.optional(ItemFilters)
})

export type InventoryQuery =
  | Schema.Schema.Type<typeof GetInventoryQuery>
  | Schema.Schema.Type<typeof ListItemsQuery>
```

#### Application Service統合

```typescript
// src/application/inventory/api-service.ts
export const InventoryAPIServiceLive = Layer.effect(
  InventoryAPIService,
  Effect.gen(function* () {
    const commandHandler = yield* InventoryCommandHandler
    const queryHandler = yield* InventoryQueryHandler

    return InventoryAPIService.of({
      executeCommand: (cmd) => Match.value(cmd).pipe(
        Match.tag('AddItem', (c) => commandHandler.handleAddItem(c)),
        Match.tag('RemoveItem', (c) => commandHandler.handleRemoveItem(c)),
        Match.exhaustive
      ),

      executeQuery: (query) => Match.value(query).pipe(
        Match.tag('GetInventory', (q) => queryHandler.handleGetInventory(q)),
        Match.tag('ListItems', (q) => queryHandler.handleListItems(q)),
        Match.exhaustive
      )
    })
  })
)
```

## 8. Infrastructure層設計

### 8.1 技術実装ラッパー

Infrastructure層は技術的詳細を隠蔽し、Domain/Applicationから利用可能なサービスを提供：

**責務**:

- 外部ライブラリのラッピング（Three.js/Cannon.js）
- Repository実装（IndexedDB/LocalStorage）
- ECS（Entity Component System）実装
- オーディオシステム

### 8.2 Three.jsラッパー

```typescript
// src/infrastructure/three/renderer/webgl_renderer.ts
import * as THREE from 'three'
import { Effect, Layer, Context, Resource } from 'effect'

export interface WebGLRendererService {
  readonly render: (
    scene: THREE.Scene,
    camera: THREE.Camera
  ) => Effect.Effect<void, RendererError>

  readonly resize: (
    width: number,
    height: number
  ) => Effect.Effect<void, RendererError>
}

export const WebGLRendererService = Context.GenericTag<WebGLRendererService>(
  '@infrastructure/three/WebGLRendererService'
)

// Layer.scopedで外部リソース管理
export const WebGLRendererServiceLive = Layer.scoped(
  WebGLRendererService,
  Effect.gen(function* () {
    // acquireReleaseでリソース管理
    const rendererResource = yield* Resource.manual(
      Effect.acquireRelease(
        Effect.sync(() => new THREE.WebGLRenderer({
          antialias: true,
          alpha: true
        })),
        (renderer) => Effect.sync(() => {
          renderer.dispose()
          renderer.forceContextLoss()
        })
      )
    )

    return WebGLRendererService.of({
      render: (scene, camera) => Effect.gen(function* () {
        const renderer = yield* Resource.get(rendererResource)
        yield* Effect.sync(() => renderer.render(scene, camera))
      }),

      resize: (width, height) => Effect.gen(function* () {
        const renderer = yield* Resource.get(rendererResource)
        yield* Effect.sync(() => renderer.setSize(width, height))
      })
    })
  })
)
```

### 8.3 Cannon.jsラッパー

```typescript
// src/infrastructure/cannon/service.ts
import * as CANNON from 'cannon-es'
import { Effect, Layer, Context, Resource } from 'effect'

export interface PhysicsWorldService {
  readonly step: (
    deltaTime: number
  ) => Effect.Effect<void, PhysicsError>

  readonly addBody: (
    body: CANNON.Body
  ) => Effect.Effect<void, PhysicsError>
}

export const PhysicsWorldService = Context.GenericTag<PhysicsWorldService>(
  '@infrastructure/cannon/PhysicsWorldService'
)

export const PhysicsWorldServiceLive = Layer.scoped(
  PhysicsWorldService,
  Effect.gen(function* () {
    const worldResource = yield* Resource.manual(
      Effect.acquireRelease(
        Effect.sync(() => new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })),
        (world) => Effect.sync(() => {
          world.bodies = []
          world.constraints = []
        })
      )
    )

    return PhysicsWorldService.of({
      step: (deltaTime) => Effect.gen(function* () {
        const world = yield* Resource.get(worldResource)
        yield* Effect.sync(() => world.step(1 / 60, deltaTime, 3))
      }),

      addBody: (body) => Effect.gen(function* () {
        const world = yield* Resource.get(worldResource)
        yield* Effect.sync(() => world.addBody(body))
      })
    })
  })
)
```

### 8.4 ECS実装

```typescript
// src/infrastructure/ecs/world.ts
import { Effect, Layer, Context, Ref } from 'effect'

export interface ECSWorld {
  readonly createEntity: () => Effect.Effect<EntityId, ECSError>
  readonly addComponent: <T>(
    entityId: EntityId,
    component: Component<T>
  ) => Effect.Effect<void, ECSError>
  readonly query: <T>(
    componentTypes: ReadonlyArray<ComponentType>
  ) => Effect.Effect<ReadonlyArray<Entity<T>>, ECSError>
}

export const ECSWorld = Context.GenericTag<ECSWorld>(
  '@infrastructure/ecs/ECSWorld'
)

export const ECSWorldLive = Layer.effect(
  ECSWorld,
  Effect.gen(function* () {
    const entitiesRef = yield* Ref.make(new Map<EntityId, Entity>())
    const componentsRef = yield* Ref.make(new Map<EntityId, Map<ComponentType, Component>>())

    return ECSWorld.of({
      createEntity: () => Effect.gen(function* () {
        const id = yield* generateEntityId()
        const entity = { id, components: new Map() }
        yield* Ref.update(entitiesRef, (map) => new Map(map).set(id, entity))
        return id
      }),

      addComponent: (entityId, component) => Effect.gen(function* () {
        yield* Ref.update(componentsRef, (map) => {
          const entityComponents = map.get(entityId) ?? new Map()
          entityComponents.set(component.type, component)
          return new Map(map).set(entityId, entityComponents)
        })
      }),

      query: (componentTypes) => Effect.gen(function* () {
        const entities = yield* Ref.get(entitiesRef)
        const components = yield* Ref.get(componentsRef)

        return Array.from(entities.values()).filter((entity) => {
          const entityComponents = components.get(entity.id)
          return componentTypes.every((type) => entityComponents?.has(type))
        })
      })
    })
  })
)
```

## 9. Layer統合（bootstrap/）

### 9.1 MainLayer構成

```typescript
// src/bootstrap/infrastructure.ts
import { Layer } from 'effect'

// Domain Services
import { CameraServiceLive } from '@/domain/camera/service'
import { InventoryServiceLive } from '@/domain/inventory/inventory-service-live'
import { ChunkServiceLive } from '@/domain/chunk/service'

// Domain Repositories
import { CameraRepositoryLive } from '@/domain/camera/repository/camera_state/live'
import { InventoryRepositoryPersistent } from '@/domain/inventory/repository/inventory_repository/persistent'
import { ChunkRepositoryLive } from '@/domain/chunk/repository/chunk_repository/indexeddb_implementation'

// Application Services
import { WorldStateOrchestratorLive } from '@/application/world/world_state_stm'
import { GameLoopLive } from '@/application/game_loop'

// Infrastructure Services
import { WebGLRendererServiceLive } from '@/infrastructure/three/renderer/webgl_renderer'
import { PhysicsWorldServiceLive } from '@/infrastructure/cannon/service'
import { ECSWorldLive } from '@/infrastructure/ecs/world'
import { AudioServiceLive } from '@/infrastructure/audio/audio-service-live'

// MainLayer統合
export const MainLayer = Layer.mergeAll(
  // Infrastructure Layer
  WebGLRendererServiceLive,
  PhysicsWorldServiceLive,
  ECSWorldLive,
  AudioServiceLive,

  // Domain Repositories
  CameraRepositoryLive,
  InventoryRepositoryPersistent,
  ChunkRepositoryLive,

  // Domain Services
  CameraServiceLive,
  InventoryServiceLive,
  ChunkServiceLive,

  // Application Services
  WorldStateOrchestratorLive,
  GameLoopLive
)
```

### 9.2 Layer統合順序

Layer統合時は**依存関係の順序**を考慮：

```
依存順序（下から上へ）:
1. Infrastructure Services（Three.js/Cannon.js/ECS/Audio）
2. Domain Repositories（永続化層）
3. Domain Services（ビジネスロジック）
4. Application Services（システム統合）
```

**重要**: Layer.mergeAllは依存関係を自動解決するため、順序を気にする必要はない。
Effect-TSが依存グラフを解析し、正しい順序で初期化する。

### 9.3 main.tsでの使用方法

```typescript
// src/main.ts
import { Effect } from 'effect'
import { MainLayer } from '@/bootstrap/infrastructure'

const program = Effect.gen(function* () {
  // サービス取得
  const gameLoop = yield* GameLoop
  const camera = yield* CameraService
  const inventory = yield* InventoryService

  // ゲームループ開始
  yield* gameLoop.start()

  // メインループ
  yield* Effect.forever(
    Effect.gen(function* () {
      const delta = yield* Clock.currentTimeMillis
      yield* camera.update(delta)
      yield* inventory.update(delta)
    })
  )
})

// Layer提供してプログラム実行
Effect.runPromise(program.pipe(Effect.provide(MainLayer)))
```

## 10. Presentation層設計

### 10.1 現在の実装範囲

現在のプロジェクトではPresentationは限定的：

**実装済み**:

- ✅ インベントリUI（React）
- ✅ インベントリパネル/アイテムスロット
- ✅ リアクティブ状態管理

**未実装**:

- ⚠️ HUD（体力バー/満腹度バー/経験値バー）
- ⚠️ メニューシステム
- ⚠️ 設定画面

### 10.2 React統合

```typescript
// src/presentation/inventory/ui/components/InventoryPanel.tsx
import { Effect } from 'effect'
import { useEffect, useState } from 'react'
import { InventoryService } from '@/domain/inventory/inventory-service'

export const InventoryPanel = () => {
  const [inventory, setInventory] = useState<Inventory | null>(null)

  useEffect(() => {
    const program = Effect.gen(function* () {
      const service = yield* InventoryService
      const inv = yield* service.getInventory(playerId)
      return inv
    })

    Effect.runPromise(program.pipe(Effect.provide(MainLayer)))
      .then(setInventory)
      .catch(console.error)
  }, [])

  return (
    <div className="inventory-panel">
      {inventory?.slots.map((slot, index) => (
        <ItemSlot key={index} slot={slot} />
      ))}
    </div>
  )
}
```

### 10.3 State管理

```typescript
// src/presentation/inventory/state/reactive-system.ts
import { Effect, Stream, Ref } from 'effect'

export const createReactiveInventory = () =>
  Effect.gen(function* () {
    const inventoryRef = yield* Ref.make<Inventory>(initialInventory)
    const inventoryService = yield* InventoryService

    // ストリームでリアクティブ更新
    const inventoryStream = Stream.repeatEffect(
      Ref.get(inventoryRef)
    )

    const updateInventory = (command: InventoryCommand) =>
      Effect.gen(function* () {
        const result = yield* inventoryService.executeCommand(command)
        yield* Ref.set(inventoryRef, result)
      })

    return {
      inventory$: inventoryStream,
      updateInventory
    }
  })
```

## 11. 既知の技術的負債

### 11.1 Domain層の技術依存

#### 問題: camera BCのThree.js依存

**現状**:

- `src/domain/camera/first_person.ts` - Three.js Camera直接使用
- `src/domain/camera/third_person.ts` - Three.js Camera直接使用
- `src/domain/camera/aggregate/camera/camera.ts` - Three.js Vector3使用

**影響**:

- Domain層がInfrastructure層の技術に依存
- テスト困難（Three.jsモック必要）
- ブラウザ環境依存

**対応計画**:

```typescript
// ❌ 現状（Domain層にThree.js依存）
import * as THREE from 'three'

export const createFirstPersonCamera = (): THREE.PerspectiveCamera => {
  return new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
}

// ✅ リファクタリング後（Domain層は抽象化）
export interface CameraProjection {
  readonly fov: number
  readonly aspect: number
  readonly near: number
  readonly far: number
}

export const createCameraProjection = (
  config: CameraConfig
): Effect.Effect<CameraProjection, CameraError> =>
  Effect.gen(function* () {
    return {
      fov: 75,
      aspect: config.width / config.height,
      near: 0.1,
      far: 1000
    }
  })

// Infrastructure層でThree.js変換
export const toCameraProjection = (
  projection: CameraProjection
): THREE.PerspectiveCamera => {
  return new THREE.PerspectiveCamera(
    projection.fov,
    projection.aspect,
    projection.near,
    projection.far
  )
}
```

**優先度**: Priority 1（次期リファクタリング対象）

### 11.2 CQRS拡張計画

**現状**: inventory BCのみCQRS完全実装

**計画**: 他のBCへのCQRS拡張

- [ ] camera BC - Commands/Queries分離
- [ ] chunk BC - Commands/Queries分離
- [ ] world_generation BC - Commands/Queries分離

**メリット**:

- 読み取り/書き込みパフォーマンス最適化
- イベントソーシング統合準備
- マイクロサービス化の基盤

### 11.3 Presentation層拡張計画

**優先度**: Priority 3

**計画**:

- [ ] HUD実装（体力バー/満腹度バー/経験値バー）
- [ ] メニューシステム（メインメニュー/ポーズメニュー/設定）
- [ ] クラフティングUI
- [ ] チャットシステム

## 12. 実装ガイドライン

### 12.1 新規Bounded Context作成手順

#### Step 1: ディレクトリ構造作成

```bash
mkdir -p src/domain/<bc-name>/{aggregate,value_object,domain_service,repository,factory,types}
```

#### Step 2: 型定義（types/core.ts）

```typescript
// src/domain/<bc-name>/types/core.ts
import { Schema } from '@effect/schema'

// Brand型で識別子定義
export const XxxId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand('XxxId')
)
export type XxxId = Schema.Schema.Type<typeof XxxId>

// Aggregateの型定義
export const Xxx = Schema.Struct({
  id: XxxId,
  name: Schema.String,
  createdAt: Schema.Number
})
export type Xxx = Schema.Schema.Type<typeof Xxx>
```

#### Step 3: Repository Interface作成

```typescript
// src/domain/<bc-name>/repository/<xxx>_repository/interface.ts
export interface XxxRepository {
  readonly save: (entity: Xxx) => Effect.Effect<void, RepositoryError>
  readonly findById: (id: XxxId) => Effect.Effect<Option.Option<Xxx>, RepositoryError>
}

export const XxxRepository = Context.GenericTag<XxxRepository>(
  '@domain/<bc-name>/XxxRepository'
)
```

#### Step 4: Repository Memory実装

```typescript
// src/domain/<bc-name>/repository/<xxx>_repository/memory.ts
export const XxxRepositoryMemory = Layer.effect(
  XxxRepository,
  Effect.gen(function* () {
    const storage = yield* Ref.make(new Map<XxxId, Xxx>())
    return XxxRepository.of({
      save: (entity) => Ref.update(storage, (map) => new Map(map).set(entity.id, entity)),
      findById: (id) => Ref.get(storage).pipe(Effect.map((map) => Option.fromNullable(map.get(id))))
    })
  })
)
```

#### Step 5: Domain Service作成

```typescript
// src/domain/<bc-name>/service.ts
export interface XxxService {
  readonly createXxx: (name: string) => Effect.Effect<Xxx, XxxError>
}

export const XxxService = Context.GenericTag<XxxService>(
  '@domain/<bc-name>/XxxService'
)

export const XxxServiceLive = Layer.effect(
  XxxService,
  Effect.gen(function* () {
    const repository = yield* XxxRepository

    return XxxService.of({
      createXxx: (name) => Effect.gen(function* () {
        const id = yield* generateXxxId()
        const xxx = { id, name, createdAt: Date.now() }
        yield* repository.save(xxx)
        return xxx
      })
    })
  })
)
```

#### Step 6: MainLayerへ追加

```typescript
// src/bootstrap/infrastructure.ts
import { XxxServiceLive } from '@/domain/<bc-name>/service'
import { XxxRepositoryMemory } from '@/domain/<bc-name>/repository/<xxx>_repository/memory'

export const MainLayer = Layer.mergeAll(
  // ... 既存Layer
  XxxRepositoryMemory,
  XxxServiceLive
)
```

### 12.2 Repository実装手順

#### Step 1: interface.ts作成

標準的なCRUD操作を定義：

```typescript
export interface XxxRepository {
  readonly save: (entity: Xxx) => Effect.Effect<void, RepositoryError>
  readonly findById: (id: XxxId) => Effect.Effect<Option.Option<Xxx>, RepositoryError>
  readonly findAll: () => Effect.Effect<ReadonlyArray<Xxx>, RepositoryError>
  readonly delete: (id: XxxId) => Effect.Effect<void, RepositoryError>
}

export const XxxRepository = Context.GenericTag<XxxRepository>(
  '@domain/<bc-name>/XxxRepository'
)
```

#### Step 2: memory.ts作成（テスト用）

Ref.makeでメモリストレージ実装：

```typescript
export const XxxRepositoryMemory = Layer.effect(
  XxxRepository,
  Effect.gen(function* () {
    const storage = yield* Ref.make(new Map<XxxId, Xxx>())

    return XxxRepository.of({
      save: (entity) =>
        Ref.update(storage, (map) => new Map(map).set(entity.id, entity)),

      findById: (id) =>
        Ref.get(storage).pipe(
          Effect.map((map) => Option.fromNullable(map.get(id)))
        ),

      findAll: () =>
        Ref.get(storage).pipe(
          Effect.map((map) => Array.from(map.values()))
        ),

      delete: (id) =>
        Ref.update(storage, (map) => {
          const newMap = new Map(map)
          newMap.delete(id)
          return newMap
        })
    })
  })
)
```

#### Step 3: persistent.ts作成（本番用）

IndexedDBで永続化実装：

```typescript
export const XxxRepositoryPersistent = Layer.effect(
  XxxRepository,
  Effect.gen(function* () {
    const db = yield* IndexedDBService

    return XxxRepository.of({
      save: (entity) => Effect.gen(function* () {
        const encoded = yield* Schema.encode(XxxSchema)(entity)
        yield* db.put('xxxs', encoded, entity.id)
      }),

      findById: (id) => Effect.gen(function* () {
        const raw = yield* db.get('xxxs', id)
        return yield* Option.match(raw, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (data) =>
            Schema.decodeUnknown(XxxSchema)(data).pipe(
              Effect.map(Option.some)
            )
        })
      }),

      findAll: () => Effect.gen(function* () {
        const rawArray = yield* db.getAll('xxxs')
        return yield* Effect.all(
          rawArray.map((raw) => Schema.decodeUnknown(XxxSchema)(raw))
        )
      }),

      delete: (id) => db.delete('xxxs', id)
    })
  })
)
```

### 12.3 Service/Layer/Live実装手順

#### Step 1: Service Interface定義

```typescript
export interface XxxService {
  readonly operation1: (param: T1) => Effect.Effect<R1, E1>
  readonly operation2: (param: T2) => Effect.Effect<R2, E2>
}

export const XxxService = Context.GenericTag<XxxService>(
  '@domain/<bc-name>/XxxService'
)
```

#### Step 2: Live実装

```typescript
export const XxxServiceLive = Layer.effect(
  XxxService,
  Effect.gen(function* () {
    // 依存サービス取得
    const repository = yield* XxxRepository
    const validator = yield* XxxValidator

    // サービス実装
    return XxxService.of({
      operation1: (param) => Effect.gen(function* () {
        const validated = yield* validator.validate(param)
        const result = yield* repository.save(validated)
        return result
      }),

      operation2: (param) => Effect.gen(function* () {
        // 実装
      })
    })
  })
)
```

#### Step 3: MainLayerへ統合

```typescript
export const MainLayer = Layer.mergeAll(
  // 依存Layerを先に配置（順序は自動解決されるが、可読性のため）
  XxxRepositoryMemory,
  XxxValidatorLive,

  // ServiceLayer
  XxxServiceLive
)
```

### 12.4 テスト実装パターン

#### Pattern 1: Repository単体テスト

```typescript
import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { XxxRepositoryMemory } from './memory'

describe('XxxRepository', () => {
  it('should save and retrieve entity', () =>
    Effect.gen(function* () {
      const repo = yield* XxxRepository

      const entity = { id: 'test-id', name: 'Test' }
      yield* repo.save(entity)

      const retrieved = yield* repo.findById('test-id')
      expect(Option.isSome(retrieved)).toBe(true)
      expect(Option.getOrNull(retrieved)).toEqual(entity)
    }).pipe(
      Effect.provide(XxxRepositoryMemory),
      Effect.runPromise
    ))
})
```

#### Pattern 2: Service単体テスト

```typescript
describe('XxxService', () => {
  it('should create new entity', () =>
    Effect.gen(function* () {
      const service = yield* XxxService

      const created = yield* service.createXxx('Test Name')

      expect(created.name).toBe('Test Name')
      expect(created.id).toBeDefined()
    }).pipe(
      Effect.provide(Layer.mergeAll(
        XxxRepositoryMemory,
        XxxServiceLive
      )),
      Effect.runPromise
    ))
})
```

#### Pattern 3: TestClock使用例

```typescript
import { TestClock, TestContext } from 'effect'

describe('Time-dependent operations', () => {
  it('should timeout after 1 minute', () =>
    Effect.gen(function* () {
      const service = yield* XxxService

      const fiber = yield* service.longOperation().pipe(
        Effect.timeoutTo({
          duration: Duration.minutes(1),
          onSuccess: Option.some,
          onTimeout: () => Option.none()
        }),
        Effect.fork
      )

      // 時間を進める
      yield* TestClock.adjust(Duration.minutes(1))

      const result = yield* Fiber.join(fiber)
      expect(Option.isNone(result)).toBe(true)
    }).pipe(
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    ))
})
```

## 13. リファクタリング計画

### 13.1 Priority 1: Camera BCのThree.js依存除去

**目標**: Domain層からThree.js依存を完全除去

**対象ファイル**:

- `src/domain/camera/first_person.ts`
- `src/domain/camera/third_person.ts`
- `src/domain/camera/aggregate/camera/camera.ts`

**実装計画**:

```typescript
// Phase 1: Domain層にプラットフォーム非依存の型定義
export const CameraProjection = Schema.Struct({
  fov: Schema.Number,
  aspect: Schema.Number,
  near: Schema.Number,
  far: Schema.Number
})

export const CameraTransform = Schema.Struct({
  position: Vector3,
  rotation: Quaternion
})

// Phase 2: Infrastructure層でThree.js変換
export const toThreeCamera = (
  projection: CameraProjection,
  transform: CameraTransform
): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(
    projection.fov,
    projection.aspect,
    projection.near,
    projection.far
  )
  camera.position.copy(transform.position)
  camera.quaternion.copy(transform.rotation)
  return camera
}
```

**期限**: Q2 2025

### 13.2 Priority 2: CQRS拡張

**目標**: inventory BC以外の主要BCへCQRS適用

**対象BC**:

- camera BC
- chunk BC
- world_generation BC

**実装計画**:

```typescript
// Phase 1: Commands/Queries型定義
export const CameraCommands = Schema.Union(
  UpdatePositionCommand,
  UpdateRotationCommand,
  SwitchModeCommand
)

export const CameraQueries = Schema.Union(
  GetCameraQuery,
  GetCameraStateQuery
)

// Phase 2: CommandHandler/QueryHandler実装
export const CameraCommandHandler = ...
export const CameraQueryHandler = ...

// Phase 3: Application層統合
export const CameraAPIService = ...
```

**期限**: Q3 2025

### 13.3 Priority 3: Presentation層拡張

**目標**: HUD/メニューシステム実装

**実装範囲**:

- [ ] HUDコンポーネント（体力/満腹度/経験値）
- [ ] メニューシステム（メインメニュー/ポーズメニュー）
- [ ] 設定画面
- [ ] クラフティングUI

**期限**: Q4 2025

## 参考リンク

### プロジェクト公式ドキュメント

- [プロジェクトインデックス](docs/INDEX.md) - エントリーポイント
- [ディレクトリ構造](docs/reference/architecture/src-directory-structure.md) - 詳細構造
- [開発規約](docs/how-to/development/development-conventions.md) - コーディング規約

### Effect-TS関連

- [Effect-TSガイドライン](docs/how-to/development/effect-ts-guidelines.md) - 実装ガイドライン
- [Effect-TSパターン](docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md) - パターン集
- [Effect-TS完全準拠](docs/reference/effect-ts-compliance.md) - 禁止/推奨パターン
- [Effect-TS移行ガイド](docs/tutorials/effect-ts-migration-guide.md) - 移行手順

### アーキテクチャ

- [アーキテクチャ概要](docs/explanations/architecture/README.md) - 設計思想
- [サービスパターン](docs/explanations/design-patterns/service-patterns.md) - 実装パターン
- [型安全パターン](docs/tutorials/design-patterns/type-safety-patterns.md) - 型安全設計

### トラブルシューティング

- [よくあるエラー](docs/how-to/troubleshooting/common-errors.md) - エラー対応
- [Effect-TSトラブルシューティング](docs/how-to/troubleshooting/effect-ts-troubleshooting.md) - Effect-TS特有の問題

---

**最終更新**: 2025-10-11
**バージョン**: 2.0.0（完全書き換え版）
**ステータス**: プロジェクト実装に完全準拠
