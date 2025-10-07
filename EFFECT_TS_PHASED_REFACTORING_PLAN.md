# Effect-TS段階的リファクタリング実行計画書

## 📊 計画概要

### 背景

EXECUTE.mdで提示された「876ファイル・182,000行の一括全面改修」は、以下の理由から実現可能性が35%と判定されました：

- ❌ 全ファイル一括変更はレビュー不可能（30+ PRが必要）
- ❌ 既存テストの大量破壊（19テスト → 全て書き直し）
- ❌ Effect-TSオーバーヘッドが60FPS維持に影響する可能性
- ❌ 開発期間の長期化（3-6ヶ月）

### EXECUTE.mdとの差分

| 項目                   | EXECUTE.md要求   | 本計画書のアプローチ          | 理由                                      |
| ---------------------- | ---------------- | ----------------------------- | ----------------------------------------- |
| **実施方法**           | 一括全面改修     | 4段階の段階的リファクタリング | レビュー可能性・リスク分散                |
| **Data.Class扱い**     | 完全廃止         | 許容（一部`Schema.Struct`化） | Effect-TS公式パターン、既存実装優秀       |
| **制御構文**           | 全Effect-TS化    | ホットパス外のみ段階的移行    | パフォーマンス優先、60FPS維持             |
| **型安全性優先度**     | P0（最高優先）   | P0（最高優先） ✅             | 合意                                      |
| **高度Effect-TS機能**  | 最初から全面活用 | Phase 4で段階的導入           | パフォーマンス検証後に導入                |
| **`new Date()`統一**   | 全`DateTime`化   | `Clock.currentTimeMillis`維持 | 既に95%移行済み、残り5%も段階的対応       |
| **バレルエクスポート** | 全`index.ts`統一 | Phase 3で段階的整備           | 型安全化後に実施                          |
| **工数見積**           | 理論値のみ       | 楽観/現実/悲観の3値           | プロジェクト管理の透明性確保              |
| **DDD構造修正**        | 言及なし         | Phase 1で優先実施             | REFACTORING_SURVEY_REPORTの調査結果を反映 |

### 段階的アプローチの選択理由

1. **レビュー可能性の確保**
   - 1 Phase = 20-30ファイル/PR（現実的なレビュー規模）
   - 各Phase完了時に全テスト・ビルド検証
   - ロールバック可能な粒度

2. **パフォーマンスリスクの早期検出**
   - Phase 1で基盤型安全化 + パフォーマンス測定
   - 60FPS維持を確認後にPhase 2以降へ進行
   - ホットパス（ゲームループ、レンダリング）は慎重にアプローチ

3. **既存資産の保護**
   - `Data.Class`（Effect-TS公式パターン）は維持
   - 正常動作中のコードを段階的に改善
   - テストカバレッジ80%+を各Phase完了時に維持

4. **チーム学習曲線の考慮**
   - Phase 1-2: 基本的なBrand型・Schema（学習コスト低）
   - Phase 3-4: Fiber/STM等の高度機能（学習コスト高）
   - 段階的な知識習得

## 🎯 Phase 1: 基盤型安全化（2-3週間）

### 目標

**World DomainとShared Domainの型安全化により、プロジェクト全体の基盤を強化**

- 型安全性スコア: 4.8/10 → **7.2/10**
- `as`型アサーション: 2,976 → 1,773 (-40%)
- `any`使用: 388 → 142 (-63%)
- DDD構造修正: `application_service`レイヤー違反 9 → 0

### 対象範囲

#### 1. `src/domain/shared/` - Brand型基盤整備（15-20時間）

**現状問題**:

- 76箇所の`as`型アサーション（Brand型定数初期化に集中）
- 算術演算結果の型安全性欠如（`(a + b) as Meters`）

**リファクタリング内容**:

```typescript
// ❌ Before: 型アサーションによる強制変換
export const ZERO_METERS: Meters = 0 as Meters
export const addMeters = (a: Meters, b: Meters): Meters => (a + b) as Meters

// ✅ After: Schema.makeによる安全な初期化
import { Schema } from '@effect/schema'

export const MetersSchema = Schema.Number.pipe(Schema.brand('Meters'))
export const ZERO_METERS: Meters = Schema.make(MetersSchema)(0)

export const addMeters = (a: Meters, b: Meters): Effect.Effect<Meters, Schema.ParseError> =>
  Schema.make(MetersSchema)(a + b)
```

**詳細タスク**:

1. Brand型定数初期化パターン確立（`Meters`, `MetersPerSecond`, `Milliseconds`, `Timestamp`）
2. 算術演算ヘルパー関数の型安全化（`add`, `subtract`, `multiply`, `divide`）
3. 依存5ドメインへの影響分析（`world`, `chunk`, `player`, `camera`, `physics`）
4. 段階的移行戦略策定（Feature Flag活用）

**成果物**:

- `src/domain/shared/value_object/units/*/operations.ts` - 型安全な算術演算
- `src/domain/shared/value_object/units/*/constants.ts` - Schema.make初期化
- `docs/tutorials/brand-type-arithmetic.md` - パターンドキュメント

**検証方法**:

```bash
# 型チェック成功
pnpm typecheck

# 単体テスト追加
pnpm test src/domain/shared/value_object/units/**/*.test.ts

# パフォーマンス測定（ホットパスでの影響確認）
pnpm test:performance --filter="shared-units"
```

#### 2. `src/domain/world/` - 座標系Brand型導入（40-50時間）

**現状問題**:

- 1,127箇所の`as`型アサーション（座標変換で頻発）
- 246箇所の`any`使用（procedural_generation層に集中）
- 座標系混同バグ頻発（`WorldCoordinate` vs `ChunkCoordinate` vs `BlockCoordinate`）

**リファクタリング内容**:

```typescript
// ❌ Before: 型アサーションによる座標変換
export const worldToChunkCoordinate = (world: number): ChunkCoordinate => Math.floor(world / 16) as ChunkCoordinate

// ✅ After: 多層Brand型による型安全な変換
import { Schema } from '@effect/schema'

// 多層Brand型定義（既存パターンを踏襲）
export const WorldCoordinate = Schema.Number.pipe(Schema.int(), Schema.brand('WorldCoordinate'))
export const ChunkCoordinate = Schema.Number.pipe(Schema.int(), Schema.brand('ChunkCoordinate'))

// 型安全な座標変換（Schema検証付き）
export const worldToChunkCoordinate = (world: WorldCoordinate): Effect.Effect<ChunkCoordinate, Schema.ParseError> =>
  Schema.make(ChunkCoordinateSchema)(Math.floor(Schema.value(world) / 16))
```

**詳細タスク**:

1. **座標系Brand型導入**（10時間）
   - `WorldCoordinate`, `ChunkCoordinate`, `BlockCoordinate`の3層分離
   - 既存の`BlockCoordinate`実装（`src/domain/world/value_object/coordinates/block_coordinate.ts`）をベースに拡張
   - 座標変換関数の型安全化（`worldToChunk`, `chunkToBlock`, `blockToWorld`等）

2. **procedural_generation層の`any`削除**（20時間）
   - `structure_spawner.ts` - 80箇所（ツリー・村・ダンジョン生成ロジックの型定義）
   - `cave_carver.ts` - 40箇所（洞窟彫刻アルゴリズムの型定義）
   - `ore_placer.ts` - 30箇所（鉱石配置ロジックの型定義）
   - 各ヘルパー関数の具体的な型定義策定

3. **Repository層Schema検証**（10時間）
   - `BiomeSystemRepository` - `Map<string, any>`をジェネリクス化
   - `ChunkRepository` - `Map<ChunkId, Chunk>`型パラメータ化

**成果物**:

- `src/domain/world/value_object/coordinates/` - 多層Brand型座標系
- `src/domain/world/procedural_generation/*/types.ts` - 具体的な型定義
- `src/domain/world/repository/*/schema.ts` - Repository型安全化
- プロパティベーステスト追加（座標変換の可逆性検証）

**検証方法**:

```bash
# 型チェック成功
pnpm typecheck

# 座標変換プロパティベーステスト
pnpm test src/domain/world/value_object/coordinates/**/*.property.test.ts

# ワールド生成統合テスト
pnpm test:integration --filter="world-generation"

# パフォーマンステスト（ワールド生成60FPS維持確認）
pnpm test:performance --filter="world-generation"
```

#### 3. DDD構造修正 - `application_service`レイヤー違反修正（10-15時間）

**現状問題**（DDD.mdより）:

- 9コンテキストで`domain/{context}/application_service/`が存在
- DDDレイヤー分離原則違反
- Effect-TS Layer-based DIとの不整合

**リファクタリング内容**:

```bash
# Before（レイヤー混在）
src/domain/inventory/application_service/inventory_manager.ts

# After（レイヤー分離）
src/application/inventory/inventory_manager.ts
```

**詳細タスク**:

1. **`src/application/`配下にコンテキストディレクトリ作成**（2時間）
   - `application/chunk/`, `application/camera/`, `application/world/`等9ディレクトリ
   - バレルエクスポート`index.ts`設定

2. **`domain/{context}/application_service/`を`application/{context}/`へ移動**（3時間）
   - `git mv`でファイル履歴保持
   - import文の一括更新（約187箇所）

3. **Effect-TS Layer定義の修正**（5時間）

   ```typescript
   // ❌ Before（レイヤー混在）
   // src/domain/inventory/layers.ts
   export const InventoryDomainLive = Layer.mergeAll(
     ItemRegistryLive, // Domain Service
     ValidationServiceLive, // Domain Service
     InventoryManagerLive, // Application Service ❌
     TransactionManagerLive // Application Service ❌
   )

   // ✅ After（レイヤー分離）
   // src/domain/inventory/layers.ts
   export const InventoryDomainLive = Layer.mergeAll(ItemRegistryLive, ValidationServiceLive)

   // src/application/inventory/layers.ts
   export const InventoryApplicationLive = Layer.mergeAll(InventoryManagerLive, TransactionManagerLive).pipe(
     Layer.provide(InventoryDomainLive) // ドメイン層への依存
   )
   ```

4. **循環参照チェックと解消**（3時間）
   - `madge`による循環依存検出
   - 依存方向の修正（Application → Domain の単方向を保証）

**成果物**:

- `src/application/{9コンテキスト}/` - Application Service層新設
- `src/domain/{9コンテキスト}/layers.ts` - Layer定義修正
- `docs/how-to/development/layer-architecture.md` - Layerアーキテクチャドキュメント

**検証方法**:

```bash
# 循環依存検出
pnpm madge --circular src/

# 型チェック成功
pnpm typecheck

# 全テスト通過
pnpm test

# ビルド成功
pnpm build
```

### Phase 1 成果物・KPI

| 指標                       | Phase 1開始前 | Phase 1完了後 | 改善率   |
| -------------------------- | ------------- | ------------- | -------- |
| `as`型アサーション         | 2,976         | 1,773         | -40%     |
| `any`使用                  | 388           | 142           | -63%     |
| `application_service`混在  | 9             | 0             | -100%    |
| World Domain型安全性スコア | 4.2/10        | 7.2/10        | +71%     |
| **総合型安全性スコア**     | **4.8/10**    | **7.2/10**    | **+50%** |

### 検証方法

```bash
# 段階的検証（各タスク完了時）
pnpm typecheck && pnpm test && pnpm build

# パフォーマンステスト（Phase 1完了時）
pnpm test:performance --filter="phase1-baseline"

# 期待結果
# - ゲームループ60FPS維持
# - メモリ使用量<2GB
# - Schema検証オーバーヘッド<5%
```

### リスク評価

| リスク項目               | 発生確率 | 影響度 | 対策                                             |
| ------------------------ | -------- | ------ | ------------------------------------------------ |
| 座標系変換バグ           | 40%      | 高     | プロパティベーステスト（可逆性検証）             |
| Schema検証オーバーヘッド | 30%      | 中     | パフォーマンス測定、必要に応じて`unsafeMake`活用 |
| 循環参照発生             | 25%      | 高     | `madge`による自動検出、依存方向の明確化          |
| 依存ドメインへの影響     | 60%      | 中     | Feature Flag活用、段階的ロールアウト             |

## 🎯 Phase 2: 高リスクドメイン型安全化（2-3週間）

### 目標

**Inventory/Camera Domainの型安全化により、ユーザー体験に直結する部分の堅牢性を向上**

- 型安全性スコア: 7.2/10 → **9.1/10**
- `as`型アサーション: 1,773 → 417 (-85%総計)
- `any`使用: 142 → 48 (-88%総計)
- `!` non-null assertion: 33 → 6 (-82%)

### 対象範囲

#### 1. `src/domain/inventory/` - 型安全性とトランザクション堅牢化（30-40時間）

**現状問題**:

- 724箇所の`as`型アサーション
- 73箇所の`any`使用（`Map<string, any>`パターン）
- 18箇所の`!` non-null assertion（スロット配列アクセス）
- アイテム消失バグリスク

**リファクタリング内容**:

```typescript
// ❌ Before: null assertion + 型アサーション
export const getSlot = (inventory: Inventory, index: number): ItemStack => {
  return inventory.slots[index]! // ← 危険！
}

export const transactionStates = new Map<string, any>() // ← 型安全性欠如

// ✅ After: Option型 + ジェネリクス
import { Option, Schema } from 'effect'

export const getSlot = (inventory: Inventory, index: number): Effect.Effect<Option.Option<ItemStack>, InventoryError> =>
  Effect.gen(function* () {
    if (index < 0 || index >= inventory.slots.length) {
      return Option.none()
    }
    return Option.fromNullable(inventory.slots[index])
  })

// TransactionState型定義
export const TransactionStateSchema = Schema.Struct({
  transactionId: TransactionIdSchema,
  playerId: PlayerIdSchema,
  timestamp: TimestampSchema,
  operations: Schema.Array(InventoryOperationSchema),
  status: Schema.Union(Schema.Literal('pending'), Schema.Literal('committed'), Schema.Literal('rolled_back')),
})

export const transactionStates = new Map<TransactionId, TransactionState>()
```

**詳細タスク**:

1. **`!` non-null assertion削除**（10時間）
   - スロット配列アクセスを`Option`型で安全化
   - `Array.get`（Effect-TS提供）活用
   - 境界値チェックの明示的実装

2. **ItemStack操作でのBrand型徹底**（10時間）
   - `ItemId`, `ItemQuantity`, `SlotIndex`のBrand型導入
   - Stack操作（add, remove, split, merge）の型安全化

3. **TransactionManager型安全化**（10時間）
   - `Map<string, any>`をジェネリクス型に変換
   - TransactionState Schemaの完全定義
   - STM（Software Transactional Memory）導入検討

**成果物**:

- `src/domain/inventory/value_object/slot/` - Option型スロット管理
- `src/domain/inventory/aggregate/transaction_manager/schema.ts` - Transaction型定義
- `src/domain/inventory/repository/*/types.ts` - Repository型パラメータ化

**検証方法**:

```bash
# 型チェック成功
pnpm typecheck

# インベントリ操作単体テスト
pnpm test src/domain/inventory/**/*.test.ts

# トランザクション統合テスト
pnpm test:integration --filter="inventory-transactions"

# E2Eテスト（アイテム移動・スタック操作）
pnpm test:e2e --filter="inventory"
```

#### 2. `src/domain/camera/` - Repository層型安全化（20-30時間）

**現状問題**:

- 632箇所の`as`型アサーション（Repository層に集中）
- 21箇所の`any`使用（`Map<string, any>`, `statisticsCache: HashMap<string, any>`）
- 9箇所の`!` non-null assertion

**リファクタリング内容**:

```typescript
// ❌ Before: Map<string, any>パターン
export class ViewModePreferencesLive {
  private preferencesCache = new Map<string, any>()
  private statisticsCache: HashMap.HashMap<string, any>
}

// ✅ After: ジェネリクス型パラメータ
export const ViewModePreferencesLive = Layer.effect(
  ViewModePreferencesTag,
  Effect.gen(function* () {
    const preferencesCache = yield* Ref.make(new Map<PlayerId, ViewModePreference>())
    const statisticsCache = yield* Ref.make(HashMap.empty<PlayerId, CameraStatistics>())
    // ...
  })
)

// 型定義
export const CameraStatisticsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  averageFPS: Schema.Number.pipe(Schema.positive()),
  frameDrops: Schema.Number.pipe(Schema.nonNegativeInteger()),
  lastUpdateTime: TimestampSchema,
})
export type CameraStatistics = Schema.Schema.Type<typeof CameraStatisticsSchema>
```

**詳細タスク**:

1. **Repository層ジェネリクス化**（10時間）
   - `Map<string, any>`を`Map<PlayerId, T>`型に変換
   - `HashMap<string, any>`を`HashMap<PlayerId, CameraStatistics>`に変換

2. **THREE.js型インターフェース改善**（10時間）
   - THREE.js型との境界を明確化（Adapter層導入）
   - `as unknown as THREE.*`パターンをAdapter関数で集約

**成果物**:

- `src/domain/camera/repository/*/types.ts` - Repository型定義
- `src/domain/camera/adapter/three_adapter.ts` - THREE.js境界層
- `src/domain/camera/value_object/statistics/` - CameraStatistics型

**検証方法**:

```bash
# 型チェック成功
pnpm typecheck

# カメラ操作E2Eテスト
pnpm test:e2e --filter="camera"

# パフォーマンステスト（カメラ更新60FPS維持）
pnpm test:performance --filter="camera-update"
```

### Phase 2 成果物・KPI

| 指標                   | Phase 2開始前 | Phase 2完了後 | 改善率（総計） |
| ---------------------- | ------------- | ------------- | -------------- |
| `as`型アサーション     | 1,773         | 417           | -85%           |
| `any`使用              | 142           | 48            | -88%           |
| `!` non-null assertion | 33            | 6             | -82%           |
| **総合型安全性スコア** | **7.2/10**    | **9.1/10**    | **+89%**       |

### 検証方法

```bash
# E2Eテスト（ユーザー体験検証）
pnpm test:e2e --filter="inventory,camera"

# パフォーマンステスト（60FPS維持確認）
pnpm test:performance --filter="phase2-baseline"

# 期待結果
# - インベントリ操作が正確（アイテム消失なし）
# - カメラ操作がスムーズ（60FPS維持）
# - トランザクション整合性保証
```

### リスク評価

| リスク項目               | 発生確率 | 影響度 | 対策                                    |
| ------------------------ | -------- | ------ | --------------------------------------- |
| アイテム消失バグ         | 35%      | 極大   | トランザクションテスト強化、STM導入検討 |
| Option型導入の学習コスト | 50%      | 低     | ドキュメント整備、コードレビュー強化    |
| THREE.js型変換の複雑化   | 40%      | 中     | Adapter層で変換ロジック集約             |
| パフォーマンス劣化       | 20%      | 高     | パフォーマンス測定、必要に応じて最適化  |

## 🎯 Phase 3: 残ドメイン段階的改善（2-3週間）

### 目標

**中優先ドメインの型安全化と`new Date()`統一、DDD構造調整を完了**

- 型安全性スコア: 9.1/10 → **10/10**
- `as`/`any`/`unknown`/`!`: **完全撲滅**
- `new Date()`: 150箇所 → 0箇所（`DateTime` API統一）
- DDD構造調整: World/Biome分割、Player/Entities統合

### 対象範囲

#### 1. 中優先ドメインの型安全化（25-35時間）

**対象ドメイン**:

- `src/domain/chunk/` - 15-20時間
- `src/domain/equipment/` - 3時間
- `src/domain/physics/` - 10-15時間
- `src/domain/agriculture/` - 2-5時間
- `src/domain/view_distance/` - 2-5時間
- `src/domain/game_loop/` - 2-5時間

**共通リファクタリングパターン**:

1. **Repository層`Map<string, any>`削除**

   ```typescript
   // ❌ Before
   const chunkCache = new Map<string, any>()

   // ✅ After
   const chunkCache = new Map<ChunkId, Chunk>()
   ```

2. **State管理の型安全化**

   ```typescript
   // ❌ Before
   type ChunkState = 'loading' | 'loaded' | 'unloading' | string

   // ✅ After
   export const ChunkStateSchema = Schema.Union(
     Schema.Literal('loading'),
     Schema.Literal('loaded'),
     Schema.Literal('unloading'),
     Schema.Literal('error')
   )
   export type ChunkState = Schema.Schema.Type<typeof ChunkStateSchema>
   ```

3. **外部ライブラリ境界の型安全化**（physics特有）

   ```typescript
   // ❌ Before
   const body = world.addBody(bodyDef as any)

   // ✅ After（Adapter層）
   export const createPhysicsBody = (bodyDef: PhysicsBodyDefinition): Effect.Effect<PhysicsBody, PhysicsError> =>
     Effect.gen(function* () {
       const cannonBodyDef = toCannonBodyDef(bodyDef)
       const body = yield* Effect.try({
         try: () => world.addBody(cannonBodyDef),
         catch: (error) => new PhysicsError({ message: 'Failed to create body', cause: error }),
       })
       return fromCannonBody(body)
     })
   ```

**成果物**:

- 各ドメインの`repository/*/types.ts` - 型定義整備
- 各ドメインの`adapter/` - 外部ライブラリ境界層
- 各ドメインの`value_object/state/` - ADT State定義

#### 2. `new Date()` 統一（10-15時間）

**現状**:

- 150箇所の`new Date()`使用
- 既に95%は`Clock.currentTimeMillis`経由で適切
- 残り5%（約7-8箇所）の直接生成を修正

**リファクタリングパターン**:

```typescript
// ❌ Before: 直接生成
const now = new Date()
const timestamp = Date.now()

// ✅ After: Clock Service経由
import { Clock, Effect } from 'effect'

const now = yield * Clock.currentTimeMillis
const date = new Date(now) // Date型が必要な場合のみ

// ✅ Better: Brand型Timestampで統一
import { DomainClock } from '@/domain/shared/effect/clock'

const timestamp = yield * DomainClock.now()
// timestamp: EpochMillis (Brand型)
```

**詳細タスク**:

1. **残り7-8箇所の`new Date()`直接生成を検出・修正**（5時間）

   ```bash
   # 検出
   grep -r "new Date()" src/ --exclude-dir=node_modules

   # 修正（Clock Service経由に変換）
   ```

2. **`Date.now()`を`Clock.currentTimeMillis`に統一**（5時間）

3. **既存の`DomainClock`サービス活用を全ドメインに展開**（5時間）
   - 参考実装: `/src/domain/shared/effect/clock.ts`

**成果物**:

- `docs/how-to/development/datetime-conventions.md` - DateTime使用規約
- 全ドメインで`DomainClock`サービス活用

#### 3. DDD構造調整（15-20時間）

##### 3-1. World/Biome分割（10時間）

**背景**（DDD.mdより）:

- `domain/world/aggregate/`が3つの独立集約を管理（単一責任原則違反）
- biome_system/world_generator/generation_sessionは独立した責務

**リファクタリング内容**:

```bash
# Before（肥大化）
src/domain/world/aggregate/
├── biome_system/
├── world_generator/
└── generation_session/

# After（分割）
src/domain/biome/               # 新設
├── aggregate/biome_system/
├── domain_service/biome_classification/
└── repository/biome_repository/

src/domain/world_generation/    # 新設
├── aggregate/
│   ├── world_generator/
│   └── generation_session/
└── domain_service/procedural_generation/

src/domain/world/               # 調整
├── value_object/coordinates/   # 共通座標系
└── types/
```

**詳細タスク**:

1. **`domain/biome/`新設**（4時間）
   - `aggregate/biome_system/`移動
   - `domain_service/biome_classification/`移動
   - import文更新

2. **`domain/world_generation/`新設**（4時間）
   - `aggregate/world_generator/`移動
   - `domain_service/procedural_generation/`移動
   - import文更新

3. **`domain/world/`調整**（2時間）
   - 座標系・ディメンション管理のみ残す
   - Layer定義修正

##### 3-2. Player/Entities統合（5-10時間）

**背景**（DDD.mdより）:

- `domain/player/`と`domain/entities/`で型重複（`WorldId`, `PlayerId`等）
- 共有カーネル（Shared Kernel）の不在

**リファクタリング内容**:

```bash
# Before（重複）
src/domain/player/types.ts         # WorldIdSchema定義
src/domain/entities/types/core.ts  # WorldIdSchema定義（重複）

# After（共有カーネル）
src/domain/shared/entities/        # 新設
├── player_id.ts                   # PlayerIdの正式定義
├── world_id.ts                    # WorldIdの正式定義
├── entity_id.ts
├── block_id.ts
└── item_id.ts
```

**詳細タスク**:

1. **`domain/shared/entities/`新設**（2時間）
   - 共有エンティティID型定義

2. **型重複削除**（3時間）
   - `player/types.ts`から共通型を削除
   - `entities/types/core.ts`から共通型を削除
   - import文更新（約423箇所）

3. **共有カーネルポリシー策定**（2時間）
   - 変更時の合意プロセス
   - `docs/how-to/development/shared-kernel-policy.md`作成

### Phase 3 成果物・KPI

| 指標                          | Phase 3開始前 | Phase 3完了後 | 改善率（総計） |
| ----------------------------- | ------------- | ------------- | -------------- |
| `as`型アサーション            | 417           | 0             | -100%          |
| `any`使用                     | 48            | 0             | -100%          |
| `unknown`使用（不適切）       | 395           | 0             | -100%          |
| `!` non-null assertion        | 6             | 0             | -100%          |
| `new Date()`直接生成          | 7-8           | 0             | -100%          |
| DDD境界づけられたコンテキスト | 23            | 25            | +9%（分割）    |
| **総合型安全性スコア**        | **9.1/10**    | **10/10**     | **+108%**      |

### 検証方法

```bash
# 型アサーション完全削除確認
grep -r "as " src/ --exclude-dir=node_modules | grep -v "as const"
# 期待結果: 0件

# 全テスト通過
pnpm test

# E2Eテスト（全機能）
pnpm test:e2e

# パフォーマンステスト（60FPS維持確認）
pnpm test:performance --filter="phase3-baseline"

# カバレッジ80%+維持確認
pnpm test:coverage
```

### リスク評価

| リスク項目                   | 発生確率 | 影響度 | 対策                               |
| ---------------------------- | -------- | ------ | ---------------------------------- |
| World/Biome分割の影響範囲    | 50%      | 中     | 段階的移行、Feature Flag活用       |
| 共有カーネル変更の波及       | 40%      | 高     | 変更時の合意プロセス確立           |
| 型重複削除のimport更新漏れ   | 30%      | 中     | 自動化ツール活用（codemod）        |
| DateTime統一のパフォーマンス | 15%      | 低     | Clock Service軽量、既に95%移行済み |

## 🎯 Phase 4: 高度Effect-TS機能導入（2-3週間）

### 目標

**Fiber/STM/Queue/Streamの全面活用により、並行処理最適化とメモリ効率化を実現**

- チャンク生成並列化（Fiber活用）
- ワールド状態管理（STM導入）
- イベント駆動強化（Queue拡張）
- Resource Pool管理（チャンク/テクスチャプール）

### 対象範囲

#### 1. Fiber活用による並行処理最適化（15-20時間）

**参考実装**: `/src/presentation/inventory/state/reactive-system.ts`

- Fiber.fork/Fiber.await/Fiber.interrupt活用例
- Stream + Schedule統合パターン

**リファクタリング内容**:

```typescript
// ❌ Before: 逐次チャンク生成
for (const chunkId of chunkIds) {
  await generateChunk(chunkId)
}

// ✅ After: Fiber並列化（concurrency制御付き）
import { Effect, Fiber } from 'effect'

export const generateChunksInBackground = (
  chunkIds: ReadonlyArray<ChunkId>
): Effect.Effect<Fiber.RuntimeFiber<ReadonlyArray<Chunk>, ChunkGenerationError>> =>
  Effect.gen(function* () {
    // 並列度4でチャンク生成
    const fiber = yield* Effect.fork(
      Effect.forEach(chunkIds, generateChunk, {
        concurrency: 4,
      })
    )
    return fiber
  })

// Fiber待機と結果取得
const chunks = yield * Fiber.await(generationFiber)

// Fiberキャンセル（ユーザーが離れた場合）
yield * Fiber.interrupt(generationFiber)
```

**詳細タスク**:

1. **チャンク生成並列化**（8時間）
   - `domain/world_generation/`のワールド生成をFiber化
   - concurrency制御（CPU使用率考慮）
   - Fiber中断機能（視野距離外チャンクのキャンセル）

2. **バックグラウンドタスク管理**（7時間）
   - チャンク保存処理のバックグラウンド化
   - テクスチャ読み込みの非同期化

**成果物**:

- `src/domain/world_generation/service/parallel_generator.ts` - Fiber並列生成
- `src/infrastructure/background/fiber_task_manager.ts` - Fiberタスク管理

**検証方法**:

```bash
# 並列処理負荷テスト
pnpm test:load --filter="parallel-chunk-generation"

# パフォーマンス測定（生成速度向上確認）
pnpm test:performance --filter="chunk-generation-throughput"

# 期待結果
# - チャンク生成スループット: 10 chunks/sec → 30+ chunks/sec
# - CPU使用率: 適切な並列度制御
```

#### 2. STM（Software Transactional Memory）導入（10-15時間）

**参考実装**: `/src/domain/world/application_service/world_generation_orchestrator/generation_pipeline.ts`

- STM.ref/STM.commit活用例
- 並行安全な状態管理パターン

**リファクタリング内容**:

```typescript
// ❌ Before: Refのみでの状態管理（競合時の安全性不足）
import { Ref } from 'effect'

const loadedChunks = yield * Ref.make<Map<ChunkId, Chunk>>(new Map())

// ✅ After: STMによるトランザクショナルな状態管理
import { STM, TRef } from 'effect'

export const createWorldState = Effect.gen(function* () {
  const loadedChunks = yield* TRef.make<ReadonlyMap<ChunkId, Chunk>>(new Map())
  const activePlayers = yield* TRef.make<ReadonlySet<PlayerId>>(new Set())

  return { loadedChunks, activePlayers }
})

// トランザクショナルな更新（自動リトライ）
export const addPlayerToWorld = (state: WorldState, playerId: PlayerId): Effect.Effect<void, never> =>
  STM.commit(
    STM.gen(function* () {
      const current = yield* TRef.get(state.activePlayers)
      yield* TRef.set(state.activePlayers, new Set([...current, playerId]))
    })
  )
```

**詳細タスク**:

1. **ワールド状態管理STM化**（8時間）
   - `domain/world/`の共有状態をSTM化
   - チャンク読み込み/アンロード競合対策

2. **プレイヤー状態管理STM化**（7時間）
   - `domain/player/`の並行アクセス対策
   - トランザクション整合性保証

**成果物**:

- `src/domain/world/state/stm_world_state.ts` - STM状態管理
- `src/domain/player/state/stm_player_state.ts` - STMプレイヤー状態

**検証方法**:

```bash
# 並行アクセステスト（競合検出確認）
pnpm test:concurrent --filter="stm-world-state"

# 期待結果
# - 競合時の自動リトライ成功
# - データ整合性保証
```

#### 3. Queue活用によるイベント駆動アーキテクチャ強化（8-12時間）

**リファクタリング内容**:

```typescript
// ❌ Before: 直接関数呼び出し（疎結合性欠如）
onBlockPlaced(position, blockType)
onPlayerJoined(playerId)

// ✅ After: Queueベースのイベント駆動
import { Queue } from 'effect'

export const createGameEventQueue = Effect.gen(function* () {
  const queue = yield* Queue.bounded<GameEvent>(1000) // バックプレッシャー制御
  return queue
})

// イベント発行
yield *
  Queue.offer(eventQueue, {
    _tag: 'BlockPlaced',
    position,
    blockType,
    timestamp: yield * Clock.currentTimeMillis,
  })

// イベント処理（バックグラウンド）
yield * Queue.take(eventQueue).pipe(Effect.flatMap(handleEvent), Effect.forever, Effect.fork)
```

**詳細タスク**:

1. **ゲームイベントキュー導入**（6時間）
   - `Queue.bounded`によるバックプレッシャー制御
   - イベントハンドラ登録機構

2. **既存イベントシステム移行**（6時間）
   - ブロック配置/破壊イベント
   - プレイヤー参加/退出イベント

**成果物**:

- `src/domain/game_loop/event/queue_based_event_bus.ts` - Queueベースイベントバス
- `docs/tutorials/effect-ts-patterns/event-driven-queue.md` - Queueパターンドキュメント

#### 4. Resource Pool管理（8-12時間）

**リファクタリング内容**:

```typescript
// ❌ Before: 毎回新規生成（メモリ非効率）
const chunk = createChunk()

// ✅ After: Resource Poolによる再利用
import { Pool } from 'effect'

export const ChunkPoolLive = Layer.effect(
  ChunkPool,
  Effect.gen(function* () {
    const pool = yield* Pool.make({
      acquire: createChunk(),
      size: 100, // 最大100チャンクをプール
    })

    return ChunkPool.of({
      acquire: Pool.get(pool),
      release: (chunk) => Pool.invalidate(pool, chunk),
    })
  })
)
```

**詳細タスク**:

1. **チャンクプール導入**（6時間）
   - `Pool.make`による再利用機構
   - アンロード時のリリース処理

2. **テクスチャ/メッシュプール導入**（6時間）
   - THREE.jsオブジェクトの再利用
   - メモリ効率化

**成果物**:

- `src/infrastructure/pool/chunk_pool.ts` - チャンクプール
- `src/infrastructure/pool/texture_pool.ts` - テクスチャプール

**検証方法**:

```bash
# メモリプロファイリング
pnpm test:memory --filter="resource-pool"

# 期待結果
# - メモリ使用量: 2.5GB → <2GB
# - GC頻度削減
```

#### 5. Stream処理（5-8時間）

**リファクタリング内容**:

```typescript
// ❌ Before: 全チャンクデータを一度にメモリ読み込み
const allChunks = await loadAllChunks()
for (const chunk of allChunks) {
  await processChunk(chunk)
}

// ✅ After: Streamによるバッチ処理
import { Stream } from 'effect'

export const processChunkStream = (chunkIds: Stream.Stream<ChunkId>): Effect.Effect<void, ChunkError> =>
  pipe(
    chunkIds,
    Stream.mapEffect(loadChunk),
    Stream.grouped(10), // 10個ずつバッチ処理
    Stream.mapEffect(processBatch),
    Stream.runDrain
  )
```

**詳細タスク**:

1. **大量チャンクデータのストリーミング処理**（5時間）
   - `Stream.grouped`によるバッチ処理
   - メモリ効率化

**成果物**:

- `src/domain/chunk/stream/chunk_stream_processor.ts` - Streamチャンク処理

### Phase 4 成果物・KPI

| 指標                         | Phase 4開始前 | Phase 4完了後  | 改善率    |
| ---------------------------- | ------------- | -------------- | --------- |
| チャンク生成スループット     | 10 chunks/sec | 30+ chunks/sec | +200%     |
| メモリ使用量                 | 2.5GB         | <2GB           | -20%      |
| 並行処理安全性               | 中            | 高             | STM導入   |
| イベント駆動アーキテクチャ   | 部分的        | 完全           | Queue活用 |
| **総合パフォーマンススコア** | **7.5/10**    | **9.5/10**     | **+27%**  |

### 検証方法

```bash
# 並行処理負荷テスト
pnpm test:load --filter="fiber-stm-concurrent"

# メモリプロファイリング
pnpm test:memory --filter="resource-pool"

# パフォーマンス総合テスト
pnpm test:performance --filter="phase4-final"

# 期待結果
# - ゲームループ60FPS維持
# - メモリ使用量<2GB
# - 並行処理の競合エラーゼロ
# - イベント処理遅延<50ms
```

### リスク評価

| リスク項目                  | 発生確率 | 影響度 | 対策                                     |
| --------------------------- | -------- | ------ | ---------------------------------------- |
| Fiber並列度の不適切な設定   | 40%      | 中     | 段階的調整、CPU使用率監視                |
| STM導入の学習コスト         | 60%      | 中     | ドキュメント整備、サンプルコード提供     |
| Resource Poolのメモリリーク | 25%      | 高     | メモリプロファイリング、リリース処理確認 |
| Queue溢れによるイベント損失 | 20%      | 中     | バックプレッシャー制御、Queue容量調整    |

## 📅 全体スケジュール

### ガントチャート風の表

| Phase   | 週       | タスク内容                             | 成果物                                    | 検証                            |
| ------- | -------- | -------------------------------------- | ----------------------------------------- | ------------------------------- |
| Phase 1 | Week 1   | Brand型基盤整備（shared）              | 算術演算型安全化                          | typecheck, test, performance    |
| Phase 1 | Week 2   | 座標系Brand型導入（world）             | 多層座標系、procedural_generation型定義   | property test, integration test |
| Phase 1 | Week 2-3 | DDD構造修正（application_service移動） | Application層新設、Layer定義修正          | typecheck, build, madge         |
| Phase 2 | Week 4-5 | Inventory型安全化                      | Option型スロット、Transaction型定義       | e2e, integration test           |
| Phase 2 | Week 5-6 | Camera型安全化                         | Repository型パラメータ、THREE.js Adapter  | e2e, performance                |
| Phase 3 | Week 7   | 中優先ドメイン型安全化                 | Repository型定義、State ADT               | typecheck, test                 |
| Phase 3 | Week 7-8 | DateTime統一、DDD構造調整              | Biome/WorldGeneration分割、共有カーネル   | test, coverage                  |
| Phase 4 | Week 9   | Fiber並列化、STM導入                   | 並列チャンク生成、STM状態管理             | load test, concurrent test      |
| Phase 4 | Week 10  | Queue/Resource Pool/Stream             | イベントキュー、チャンク/テクスチャプール | memory profiling, performance   |

### 総期間

- **楽観的見積もり**: 8週間（各Phase最短）
- **現実的見積もり**: 10週間（上記ガントチャート）
- **悲観的見積もり**: 12-13週間（Phase毎に追加調整発生）

### マイルストーン

- ✅ **Milestone 1（Week 3完了時）**: 基盤型安全化完了、DDD構造修正完了
- ✅ **Milestone 2（Week 6完了時）**: 高リスクドメイン型安全化完了、型安全性スコア9.1/10達成
- ✅ **Milestone 3（Week 8完了時）**: 型安全性100%達成、DDD構造調整完了
- ✅ **Milestone 4（Week 10完了時）**: Effect-TS高度機能導入完了、パフォーマンス最適化

## ⚠️ リスク管理

### Phase 1のリスクと対策

| リスク項目               | 発生確率 | 影響度 | 対策                                             |
| ------------------------ | -------- | ------ | ------------------------------------------------ |
| 座標系変換バグ           | 40%      | 高     | プロパティベーステスト（可逆性検証）             |
| Schema検証オーバーヘッド | 30%      | 中     | パフォーマンス測定、必要に応じて`unsafeMake`活用 |
| 循環参照発生             | 25%      | 高     | `madge`による自動検出、依存方向の明確化          |
| 依存ドメインへの影響     | 60%      | 中     | Feature Flag活用、段階的ロールアウト             |

**総合リスクレベル**: 🟠 中（対策により管理可能）

### Phase 2のリスクと対策

| リスク項目               | 発生確率 | 影響度 | 対策                                    |
| ------------------------ | -------- | ------ | --------------------------------------- |
| アイテム消失バグ         | 35%      | 極大   | トランザクションテスト強化、STM導入検討 |
| Option型導入の学習コスト | 50%      | 低     | ドキュメント整備、コードレビュー強化    |
| THREE.js型変換の複雑化   | 40%      | 中     | Adapter層で変換ロジック集約             |
| パフォーマンス劣化       | 20%      | 高     | パフォーマンス測定、必要に応じて最適化  |

**総合リスクレベル**: 🟠 中（トランザクションテスト強化が鍵）

### Phase 3のリスクと対策

| リスク項目                   | 発生確率 | 影響度 | 対策                               |
| ---------------------------- | -------- | ------ | ---------------------------------- |
| World/Biome分割の影響範囲    | 50%      | 中     | 段階的移行、Feature Flag活用       |
| 共有カーネル変更の波及       | 40%      | 高     | 変更時の合意プロセス確立           |
| 型重複削除のimport更新漏れ   | 30%      | 中     | 自動化ツール活用（codemod）        |
| DateTime統一のパフォーマンス | 15%      | 低     | Clock Service軽量、既に95%移行済み |

**総合リスクレベル**: 🟢 低-中（大部分が既存パターンの適用）

### Phase 4のリスクと対策

| リスク項目                  | 発生確率 | 影響度 | 対策                                     |
| --------------------------- | -------- | ------ | ---------------------------------------- |
| Fiber並列度の不適切な設定   | 40%      | 中     | 段階的調整、CPU使用率監視                |
| STM導入の学習コスト         | 60%      | 中     | ドキュメント整備、サンプルコード提供     |
| Resource Poolのメモリリーク | 25%      | 高     | メモリプロファイリング、リリース処理確認 |
| Queue溢れによるイベント損失 | 20%      | 中     | バックプレッシャー制御、Queue容量調整    |

**総合リスクレベル**: 🟠 中-高（高度機能、事前プロトタイプ検証推奨）

### 全体リスク軽減戦略

1. **段階的移行によるリスク分散**
   - 1 Phase = 20-30ファイル/PR
   - 各Phase完了時に全テスト・ビルド検証
   - ロールバック可能な粒度

2. **パフォーマンス継続監視**
   - 各Phase完了時にパフォーマンステスト実行
   - 60FPS維持、メモリ<2GBを確認
   - 劣化検出時は即座に最適化

3. **Feature Flag活用**
   - 新旧実装の切り替え可能化
   - 本番環境での段階的ロールアウト
   - 問題発生時の即座ロールバック

4. **自動テスト強化**
   - Brand型生成関数のプロパティベーステスト
   - トランザクション整合性テスト
   - 並行処理競合テスト

5. **ドキュメント整備**
   - Effect-TSパターンドキュメント充実
   - 実装例・サンプルコード提供
   - トラブルシューティングガイド

## 📋 次のアクション

### Phase 1開始のための準備タスク（今週中）

#### 1. ツール・環境準備

```bash
# Serena MCP活用準備
# - find_symbol: Brand型定義箇所の検出
# - search_for_pattern: `as`型アサーション検出
# - replace_symbol_body: 関数全体の置換

# madge（循環依存検出）導入
pnpm add -D madge

# パフォーマンス測定ツール準備
pnpm add -D benchmark clinic
```

#### 2. ベースライン測定

```bash
# 現状のパフォーマンス測定
pnpm test:performance --filter="baseline"

# メモリ使用量測定
pnpm test:memory --filter="baseline"

# 型アサーション箇所検出
grep -r "as " src/ --exclude-dir=node_modules | wc -l
# 期待結果: 2,976箇所
```

#### 3. Issue作成（GitHub Projects活用）

**Phase 1 Epic**:

- [ ] `[P0] Phase 1: 基盤型安全化 - 全体管理Issue`

**Phase 1 Sub-Issues**:

- [ ] `[P0-1] shared: Brand型定数初期化パターン確立`
- [ ] `[P0-2] shared: 算術演算ヘルパー関数型安全化`
- [ ] `[P0-3] world: 座標系Brand型導入`
- [ ] `[P0-4] world: procedural_generation層any削除`
- [ ] `[P0-5] world: Repository層Schema検証`
- [ ] `[P0-6] DDD: application_service移動（9コンテキスト）`
- [ ] `[P0-7] DDD: Layer定義修正`

#### 4. プロトタイプ検証（小規模実装）

**検証項目**:

- [ ] Brand型定数初期化パターン（`Meters`で検証）
- [ ] 座標系Brand型変換（`WorldCoordinate` ↔ `ChunkCoordinate`）
- [ ] Schema検証パフォーマンス測定（ホットパスでの影響確認）

**検証コード例**:

```typescript
// src/domain/shared/value_object/units/meters/prototype.test.ts
import { Schema } from '@effect/schema'
import { describe, expect, it } from 'vitest'

describe('Brand型定数初期化パターン検証', () => {
  const MetersSchema = Schema.Number.pipe(Schema.brand('Meters'))
  const ZERO_METERS = Schema.make(MetersSchema)(0)

  it('Schema.make初期化が成功する', () => {
    expect(ZERO_METERS).toBe(0)
  })

  it('算術演算結果のSchema検証', () => {
    const a = Schema.make(MetersSchema)(10)
    const b = Schema.make(MetersSchema)(5)
    const sum = Schema.make(MetersSchema)(a + b)
    expect(sum).toBe(15)
  })
})
```

#### 5. ドキュメント準備

- [ ] `docs/tutorials/brand-type-arithmetic.md` - Brand型算術演算パターン
- [ ] `docs/how-to/development/layer-architecture.md` - Layerアーキテクチャガイド
- [ ] `docs/tutorials/effect-ts-patterns/coordinate-brand-types.md` - 座標系Brand型パターン

#### 6. チーム学習（Optional）

- [ ] Effect-TS Schema勉強会開催
- [ ] Brand型・ADTパターン共有会
- [ ] プロパティベーステスト導入セッション

### 即座に実行可能なコマンド

```bash
# 1. ベースライン測定
pnpm test:performance --filter="baseline"

# 2. 型アサーション箇所検出
grep -r "as " src/ --exclude-dir=node_modules > /tmp/type-assertions.txt
wc -l /tmp/type-assertions.txt

# 3. 循環依存検出
pnpm madge --circular src/

# 4. Issue作成（GitHub CLI活用）
gh issue create --title "[P0] Phase 1: 基盤型安全化" \
  --body-file .github/ISSUE_TEMPLATE/phase1-epic.md \
  --label "refactoring,phase-1,P0"
```

## 📚 参考資料

### Effect-TSベストプラクティス

- [Effect-TS Schema Guide](https://effect.website/docs/schema/introduction)
- [Brand Types Documentation](https://effect.website/docs/schema/brands)
- [Fiber Documentation](https://effect.website/docs/concurrency/fiber)
- [STM Documentation](https://effect.website/docs/concurrency/stm)
- [Queue Documentation](https://effect.website/docs/concurrency/queue)

### プロジェクト内優秀な実装例

1. **Service定義模範**: `/src/domain/shared/effect/clock.ts`
2. **Fiber + Stream + Schedule統合**: `/src/presentation/inventory/state/reactive-system.ts`
3. **STM並行制御**: `/src/domain/world/application_service/world_generation_orchestrator/generation_pipeline.ts`
4. **ADTパターン**: `/src/domain/camera/value_object/view_mode/schema.ts`
5. **多層Brand型**: `/src/domain/world/value_object/coordinates/block_coordinate.ts`

### プロジェクト内リソース

- [EXECUTE.md](./EXECUTE.md) - 元の要件定義
- [REFACTORING_SURVEY_REPORT.md](./REFACTORING_SURVEY_REPORT.md) - 詳細調査結果
- [DDD.md](./DDD.md) - DDD構造分析結果
- [docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md](docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
- [docs/how-to/development/development-conventions.md](docs/how-to/development/development-conventions.md)

## 🎓 教訓（EXECUTE.mdから学んだこと）

### 成功要因

1. **段階的アプローチの重要性**
   - 一括全面改修は実現可能性35%
   - 4段階の段階的リファクタリングで実現可能性85%に向上

2. **パフォーマンス優先の姿勢**
   - 各Phase完了時にパフォーマンス測定
   - 60FPS維持を最優先（ゲーム要件）

3. **既存資産の尊重**
   - `Data.Class`（Effect-TS公式パターン）は維持
   - 正常動作中のコードを段階的に改善

4. **リスク管理の徹底**
   - Feature Flag活用
   - ロールバック可能な粒度
   - 継続的なパフォーマンス監視

### 改善パターン

1. **Brand型基盤の重要性**
   - `shared`ドメインの型安全化が全体に波及
   - Phase 1での基盤整備が後続Phaseを加速

2. **座標系Brand型の典型例**
   - プリミティブ型混同防止の最大レバレッジポイント
   - ワールド生成バグの大部分が座標系混同

3. **DDD構造修正の優先順位**
   - `application_service`レイヤー違反修正は最優先
   - Effect-TS Layer設計の改善に直結

---

## 📝 最終判定

### 実現可能性評価

**本計画書の実現可能性**: **85/100** ✅

**根拠**:

- ✅ 段階的アプローチでレビュー可能性確保
- ✅ パフォーマンスリスクの早期検出
- ✅ 既存資産（`Data.Class`等）を保護
- ✅ 各Phase完了時に検証可能
- ✅ ロールバック可能な粒度

### EXECUTE.mdとの比較

| 項目               | EXECUTE.md要求 | 本計画書のアプローチ | 実現可能性 |
| ------------------ | -------------- | -------------------- | ---------- |
| 実施方法           | 一括全面改修   | 4段階段階的          | 35% → 85%  |
| 型安全性優先度     | P0             | P0                   | 100%       |
| パフォーマンス優先 | 言及あり       | 各Phase完了時測定    | 90%        |
| DDD構造修正        | 言及なし       | Phase 1で実施        | 95%        |
| 高度Effect-TS機能  | 最初から全面   | Phase 4で段階的      | 80%        |

### 推奨事項

1. ✅ **本計画書の採用を強く推奨**
   - EXECUTE.mdの目的（型安全性・Effect-TS活用）を達成
   - 現実的な実施計画（10週間）
   - リスク管理徹底

2. ✅ **Phase 1から段階的に開始**
   - 基盤型安全化（2-3週間）
   - パフォーマンス測定
   - Phase 2以降の継続判断

3. ✅ **継続的なパフォーマンス監視**
   - 60FPS維持を最優先
   - メモリ<2GB確保
   - 劣化検出時は即座最適化

### 次のアクション（優先順位順）

1. ✅ **本計画書の承認取得**（今日）
2. ✅ **Phase 1 Issue作成**（今日-明日）
3. ✅ **ベースライン測定**（明日）
4. ✅ **プロトタイプ検証**（今週中）
5. ✅ **Phase 1開始**（来週月曜）

---

**計画書作成日**: 2025-10-07
**計画書バージョン**: v1.0
**次回更新**: Phase 1完了時（予定: 2-3週間後）
