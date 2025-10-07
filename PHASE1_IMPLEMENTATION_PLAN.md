# Phase 1型安全化 実装計画書

> **作成日**: 2025-10-07
> **対象期間**: Week 1-6（6週間）
> **目標**: 型アサーション684箇所削減（33.9%改善）、60FPS維持

---

## 📊 Executive Summary

### 現状分析結果

| 項目                    | 現状          | Phase 1目標   | 削減率     |
| ----------------------- | ------------- | ------------- | ---------- |
| `as`型アサーション      | 1,370箇所     | 約900箇所     | -34%       |
| `any`型使用             | 199箇所       | 約100箇所     | -50%       |
| `unknown`型（問題あり） | 263箇所       | 約150箇所     | -43%       |
| Non-null assertion `!`  | 66箇所        | 約20箇所      | -70%       |
| **合計**                | **2,018箇所** | **1,334箇所** | **-33.9%** |

### 戦略的優先順位

1. **Week 1-2**: Quick Wins（84箇所削減）- 高効果×低工数
2. **Week 3-4**: High Impact（150箇所削減）- 重要機能の型安全化
3. **Week 5-6**: Foundation（450箇所削減）- 全体基盤整備

### 成功の鍵

- ✅ **既存パターン活用**: units/coordinates配下の完成品を流用
- ✅ **パフォーマンス保護**: ゲームループ・レンダリングは触らない
- ✅ **段階的実装**: 20-30ファイル/PRに分割（3-4PR/week）

---

## 🎯 Phase 1の方針

### Phase 1で「やること」

1. **Enum-like型アサーション削除**（45箇所）
2. **timestamp型統一**（19箇所）
3. **Non-null assertion削除**（Container/Repository層）
4. **プロシージャル生成の型定義**（Structure/Ore/Cave）
5. **THREE.js境界の型安全化**（Camera domain）

### Phase 1で「やらないこと」

1. ❌ **ゲームループリファクタリング** → Phase 3以降に延期
2. ❌ **レンダリングパイプライン変更** → 60FPS最優先
3. ❌ **TypedArray型変更** → メモリ効率保護
4. ❌ **既存最適化コード破壊** → Cache/Pool系は保護
5. ❌ **class→Schema.Struct変換** → Phase 2以降

### パフォーマンス保護戦略

```typescript
// ✅ OK: 初期化処理（1回のみ）
const config = Schema.decodeSync(ConfigSchema)(rawConfig)

// ⚠️ ベンチマーク必須: 中頻度（10-60回/秒）
const duration = Schema.make(MillisecondsSchema)(delta)

// ❌ NG: 高頻度（100+回/秒）
// makeUnsafeを使用するか、Phase 2以降に延期
const coord = makeUnsafeBlockCoordinate(x, y, z)
```

---

## 📅 週次実装計画

### Week 1: Enum-like型アサーション削減（2日間）

**目標**: 45箇所削減、3.3%改善

#### Task 1.1: ItemCategory/Quality/Rarity型定義

**対象ファイル**:

- `src/domain/inventory/factory/item_factory/builders.ts` (32箇所)
- `src/domain/inventory/domain_service/item_registry/definitions.ts` (13箇所)

**実装手順**:

1. Schema.Literal定義追加（`src/domain/inventory/types/item_enums.ts`）

```typescript
// 新規ファイル: src/domain/inventory/types/item_enums.ts
import { Schema } from '@effect/schema'

// ItemCategory（8種類）
export const ItemCategorySchema = Schema.Literal(
  'tool',
  'weapon',
  'armor',
  'food',
  'block',
  'resource',
  'consumable',
  'redstone'
)
export type ItemCategory = Schema.Schema.Type<typeof ItemCategorySchema>

// ItemQuality（5種類）
export const ItemQualitySchema = Schema.Literal('common', 'uncommon', 'rare', 'epic', 'legendary')
export type ItemQuality = Schema.Schema.Type<typeof ItemQualitySchema>

// ItemRarity（4種類）
export const ItemRaritySchema = Schema.Literal('common', 'rare', 'epic', 'legendary')
export type ItemRarity = Schema.Schema.Type<typeof ItemRaritySchema>
```

2. Builder設定Schema定義（`src/domain/inventory/factory/item_factory/builder_config_schema.ts`）

```typescript
import { Schema } from '@effect/schema'
import { ItemCategorySchema, ItemQualitySchema } from '../../types/item_enums'

export const ItemBuilderConfigSchema = Schema.Struct({
  category: ItemCategorySchema,
  quality: ItemQualitySchema,
  stackable: Schema.Boolean,
  maxStackSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  enchantable: Schema.Boolean,
})
export type ItemBuilderConfig = Schema.Schema.Type<typeof ItemBuilderConfigSchema>
```

3. builders.ts修正（型アサーション削除）

```typescript
// ❌ Before
Match.when('tool', () => ({
  category: 'tool' as ItemCategory, // 型アサーション
  stackable: false,
  // ...
}))

// ✅ After
Match.when('tool', () =>
  ItemBuilderConfigSchema.make({
    category: 'tool', // 型推論が効く
    stackable: false,
    maxStackSize: 1,
    enchantable: true,
  })
)
```

4. 型チェック・テスト実行

```bash
pnpm typecheck
pnpm test src/domain/inventory/factory/item_factory/builders.test.ts
```

**PR分割**:

- PR#1: Schema定義追加（item_enums.ts, builder_config_schema.ts）
- PR#2: builders.ts修正（32箇所削除）
- PR#3: definitions.ts修正（13箇所削除）

**期待成果**:

- 削減: 45箇所（3.3%）
- 波及効果: 他のEnum-like型に適用可能なパターン確立
- 工数: 12時間（1.5日）

---

### Week 2: Timestamp型統一（1.5日間）

**目標**: 19箇所削減、1.4%改善

#### Task 1.2: Timestamp Brand型統一

**対象ファイル**:

- `src/domain/inventory/aggregate/container/operations.ts` (8箇所)
- `src/domain/inventory/aggregate/inventory/operations.ts` (11箇所)

**実装手順**:

1. 既存Timestamp型確認

```typescript
// 既に完成品が存在: src/domain/shared/value_object/units/timestamp/schema.ts
export const TimestampSchema = Schema.Number.pipe(Schema.nonNegative(), Schema.brand('Timestamp'))
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

// 構築ヘルパー
export const makeTimestampFromMillis = (millis: number): Timestamp => Schema.make(TimestampSchema)(millis)
```

2. Container/Inventory operations修正

```typescript
// ❌ Before
const timestamp = yield * Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
// ...
timestamp: timestamp as any // 型アサーション

// ✅ After
import { makeTimestampFromMillis } from '@domain/shared/value_object/units/timestamp'

const timestamp = yield * Effect.map(Clock.currentTimeMillis, makeTimestampFromMillis)
// ...
timestamp: timestamp // 型推論が効く
```

3. 重複定義削除

```typescript
// 削除対象: src/domain/inventory/types/core.ts
// ❌ Before: 重複定義
export type InventoryTimestamp = number

// ✅ After: 削除（shared/units/timestampを使用）
```

**PR分割**:

- PR#4: Container operations修正（8箇所）
- PR#5: Inventory operations修正（11箇所）

**期待成果**:

- 削減: 19箇所（1.4%）
- 統一: Timestamp型をプロジェクト全体で統一
- 工数: 8時間（1日）

---

### Week 2-3: Non-null Assertion削減（1.5日間）

**目標**: 20箇所削減（Container操作）、30%改善

#### Task 1.3: Container操作のOption型化

**対象ファイル**:

- `src/domain/inventory/aggregate/container/operations.ts` (20箇所)

**実装手順**:

1. 既存エラー型確認

```typescript
// 既存: src/domain/inventory/types/errors.ts
export class ContainerError extends Data.TaggedClass('ContainerError')<{
  // ...
}> {
  static slotNotFound(containerId: ContainerId, slotIndex: number): ContainerError {
    // ...
  }
}
```

2. getSlotヘルパー関数追加

```typescript
// 新規: src/domain/inventory/aggregate/container/helpers.ts
import { pipe, Effect, Option } from 'effect'
import { ContainerError } from '../../types/errors'

export const getSlot = (
  aggregate: ContainerAggregate,
  slotIndex: ContainerSlotIndex
): Effect.Effect<ContainerSlot, ContainerError> =>
  pipe(
    Option.fromNullable(aggregate.slots.get(slotIndex)),
    Effect.filterOrFail(Option.isSome, () => ContainerError.slotNotFound(aggregate.id, slotIndex)),
    Effect.map(Option.getOrThrow)
  )
```

3. operations.ts修正

```typescript
// ❌ Before
const slot = aggregate.slots.get(slotIndex)! // Non-null assertion

// ✅ After
const slot = yield * getSlot(aggregate, slotIndex)
```

**PR分割**:

- PR#6: helpers.ts追加（getSlot関数）
- PR#7: operations.ts修正（20箇所削除）

**期待成果**:

- 削減: 20箇所（Non-null assertion全体の30%）
- 安全性: 実行時エラー防止
- 工数: 10時間（1.25日）

**Week 1-2合計**: 84箇所削減、4.2%改善、30時間（3.75日）

---

### Week 3: Structure Spawner型定義（2.5日間）

**目標**: 84箇所any削減、42%改善

#### Task 2.1: プロシージャル生成Blueprint型定義

**対象ファイル**:

- `src/domain/world/domain_service/procedural_generation/structure_spawner.ts` (84箇所any)

**実装手順**:

1. Blueprint Schema定義拡張

```typescript
// 拡張: src/domain/world/types/blueprint_types.ts
import { Schema } from '@effect/schema'
import { BlockTypeSchema } from '../block/types'
import { WorldCoordinate3DSchema } from '../value_object/coordinates'

export const StructureDimensionsSchema = Schema.Struct({
  width: Schema.Number.pipe(Schema.int(), Schema.positive()),
  height: Schema.Number.pipe(Schema.int(), Schema.positive()),
  depth: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type StructureDimensions = Schema.Schema.Type<typeof StructureDimensionsSchema>

export const StructureComponentSchema = Schema.Struct({
  position: WorldCoordinate3DSchema,
  blockType: BlockTypeSchema,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type StructureComponent = Schema.Schema.Type<typeof StructureComponentSchema>

export const StructureBlueprintSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('StructureBlueprintId')),
  structureType: Schema.Literal('tree', 'house', 'cave_entrance', 'ruin'),
  dimensions: StructureDimensionsSchema,
  components: Schema.Array(StructureComponentSchema),
  spawnConditions: Schema.optional(
    Schema.Struct({
      minHeight: Schema.Number,
      maxHeight: Schema.Number,
      biomes: Schema.Array(Schema.String),
    })
  ),
})
export type StructureBlueprint = Schema.Schema.Type<typeof StructureBlueprintSchema>
```

2. structure_spawner.ts修正

```typescript
// ❌ Before
const generateStructure = (config: any): any => {
  const dimensions = config.dimensions as any
  // ... 84箇所のany使用
}

// ✅ After
import { StructureBlueprint } from '../../types/blueprint_types'
import { Structure } from '../../aggregate/structure'

const generateStructure = (blueprint: StructureBlueprint): Effect.Effect<Structure, GenerationError> =>
  Effect.gen(function* () {
    const { dimensions, components, structureType } = blueprint

    // 型推論が効く
    const width = dimensions.width
    const blocks = yield* Effect.forEach(components, (component) => placeBlock(component.position, component.blockType))

    return StructureSchema.make({
      id: yield* generateStructureId(),
      type: structureType,
      blocks,
    })
  })
```

3. 呼び出し元の修正

```typescript
// ❌ Before
const structure = generateStructure({ dimensions: { width: 10, ... } })

// ✅ After
const blueprint = StructureBlueprintSchema.make({
  id: 'oak_tree_large',
  structureType: 'tree',
  dimensions: { width: 5, height: 10, depth: 5 },
  components: [...],
})
const structure = yield* generateStructure(blueprint)
```

**PR分割**:

- PR#8: Blueprint Schema定義（blueprint_types.ts）
- PR#9: structure_spawner.ts修正（84箇所削除）
- PR#10: 呼び出し元修正（ore_placer.ts, cave_carver.ts等）

**期待成果**:

- 削減: 84箇所（any型全体の42%）
- 設計改善: プロシージャル生成の明確化
- 工数: 18時間（2.25日）

---

### Week 4: Transaction Manager型安全化（2日間）

**目標**: 38箇所any削減、19%改善

#### Task 2.2: Transaction Record型定義

**対象ファイル**:

- `src/domain/inventory/application_service/transaction_manager/workflows.ts` (38箇所)

**実装手順**:

1. Transaction Schema定義

```typescript
// 新規: src/domain/inventory/types/transaction_types.ts
import { Schema } from '@effect/schema'
import { TimestampSchema } from '@domain/shared/value_object/units/timestamp'

export const TransactionStatusSchema = Schema.Literal('pending', 'committed', 'rollback')
export type TransactionStatus = Schema.Schema.Type<typeof TransactionStatusSchema>

export const TransactionOperationSchema = Schema.Struct({
  operationType: Schema.Literal('add', 'remove', 'transfer'),
  containerId: ContainerIdSchema,
  slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 53)),
  itemStack: Schema.optional(ItemStackSchema),
})
export type TransactionOperation = Schema.Schema.Type<typeof TransactionOperationSchema>

export const TransactionRecordSchema = Schema.Struct({
  transactionId: Schema.String.pipe(Schema.brand('TransactionId')),
  status: TransactionStatusSchema,
  operations: Schema.Array(TransactionOperationSchema),
  timestamp: TimestampSchema,
  rollbackOperations: Schema.optional(Schema.Array(TransactionOperationSchema)),
})
export type TransactionRecord = Schema.Schema.Type<typeof TransactionRecordSchema>
```

2. workflows.ts修正

```typescript
// ❌ Before
const transactions: Map<string, any> = new Map()

const createTransaction = (ops: any[]): any => {
  const record = {
    id: generateId(),
    operations: ops,
    status: 'pending' as any,
  }
  // ...
}

// ✅ After
const transactions: Map<string, TransactionRecord> = new Map()

const createTransaction = (operations: TransactionOperation[]): Effect.Effect<TransactionRecord, TransactionError> =>
  Effect.gen(function* () {
    const transactionId = yield* generateTransactionId()
    const timestamp = yield* Effect.map(Clock.currentTimeMillis, makeTimestampFromMillis)

    const record = TransactionRecordSchema.make({
      transactionId,
      status: 'pending',
      operations,
      timestamp,
    })

    transactions.set(transactionId, record)
    return record
  })
```

**PR分割**:

- PR#11: Transaction Schema定義（transaction_types.ts）
- PR#12: workflows.ts修正（38箇所削除）

**期待成果**:

- 削減: 38箇所（any型全体の19%）
- 型安全性: トランザクション管理の完全型付け
- 工数: 14時間（1.75日）

---

### Week 4-5: Camera Repository型変換（1.5日間）

**目標**: 28箇所as削減、2%改善

#### Task 2.3: Camera Repository型安全化

**対象ファイル**:

- `src/domain/camera/repository/index.ts` (28箇所)

**実装手順**:

1. THREE.js Schema定義

```typescript
// 新規: src/infrastructure/three/schemas/camera_schemas.ts
import { Schema } from '@effect/schema'
import * as THREE from 'three'

export const PerspectiveCameraSchema = Schema.instanceOf(THREE.PerspectiveCamera)
export const Vector3Schema = Schema.instanceOf(THREE.Vector3)
export const QuaternionSchema = Schema.instanceOf(THREE.Quaternion)
```

2. Repository型ガード関数

```typescript
// 修正: src/domain/camera/repository/index.ts
import { PerspectiveCameraSchema } from '@infrastructure/three/schemas/camera_schemas'

// ❌ Before
const getCamera = (id: CameraId): Camera => {
  const raw = storage.get(id)
  return raw as Camera // 型アサーション
}

// ✅ After
const getCamera = (id: CameraId): Effect.Effect<Camera, CameraError> =>
  Effect.gen(function* () {
    const raw = storage.get(id)
    if (!raw) {
      return yield* Effect.fail(CameraError.notFound(id))
    }

    // Runtime検証
    const validated = yield* Schema.decodeUnknown(CameraSchema)(raw)
    return validated
  })
```

**PR分割**:

- PR#13: THREE.js Schema定義（camera_schemas.ts）
- PR#14: Repository修正（28箇所削除）

**期待成果**:

- 削減: 28箇所（2%）
- 安全性: THREE.js境界での検証強化
- 工数: 10時間（1.25日）

**Week 3-4合計**: 150箇所削減、7.4%改善、42時間（5.25日）

---

### Week 5-6: THREE.js型アサーション統一（3日間）

**目標**: 150箇所as削減、11%改善

#### Task 3.1: Camera Domain THREE.js型安全化

**対象ファイル**:

- `src/domain/camera/first_person.ts` (20箇所)
- `src/domain/camera/application_service/scene_camera/live.ts` (32箇所)
- `src/domain/camera/application_service/player_camera/live.ts` (23箇所)
- 他75箇所

**実装手順**:

1. THREE.js Adapter層追加

```typescript
// 新規: src/domain/camera/infrastructure/three_adapter.ts
import { Effect, pipe } from 'effect'
import * as THREE from 'three'
import { PerspectiveCameraSchema, Vector3Schema } from '@infrastructure/three/schemas'

export const validateCamera = (obj: unknown): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  pipe(
    Schema.decodeUnknown(PerspectiveCameraSchema)(obj),
    Effect.mapError(() => CameraError.invalidCameraInstance())
  )

export const validateVector3 = (obj: unknown): Effect.Effect<THREE.Vector3, CameraError> =>
  pipe(
    Schema.decodeUnknown(Vector3Schema)(obj),
    Effect.mapError(() => CameraError.invalidVector3())
  )

// パフォーマンス重視箇所用（初期化時のみ検証）
export const makeUnsafeCamera = (camera: THREE.PerspectiveCamera): THREE.PerspectiveCamera => camera // 型アサーションなし、型推論のみ
```

2. Camera Service修正（段階的）

```typescript
// ❌ Before (first_person.ts)
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
const position = new THREE.Vector3(x, y, z) as THREE.Vector3 // 型アサーション

// ✅ After
const camera =
  yield *
  Effect.succeed(new THREE.PerspectiveCamera(fov, aspect, near, far)).pipe(
    Effect.flatMap(validateCamera) // 初期化時のみ検証
  )
const position = new THREE.Vector3(x, y, z) // 型推論が効く
```

**PR分割**:

- PR#15: THREE.js Adapter層（three_adapter.ts）
- PR#16: first_person.ts修正（20箇所）
- PR#17: scene_camera/live.ts修正（32箇所）
- PR#18: player_camera/live.ts修正（23箇所）
- PR#19: 残り75箇所修正

**期待成果**:

- 削減: 150箇所（11%）
- アーキテクチャ: THREE.js境界の明確化
- 工数: 22時間（2.75日）

---

### Week 6: Builder/Factory型変換統一（3日間）

**目標**: 300箇所as削減、22%改善

#### Task 3.2: Builder/Factory型安全化

**対象ファイル**:

- `src/domain/inventory/factory/*/builders.ts` (約150箇所)
- `src/domain/world/factory/*` (約150箇所)

**実装手順**:

1. Builder基盤Schema定義

```typescript
// 新規: src/domain/shared/factory/builder_base.ts
import { Schema } from '@effect/schema'

export const BuilderConfigSchema = <T extends Schema.Struct.Fields>(fields: T) =>
  Schema.Struct({
    ...fields,
    _builderType: Schema.Literal('config'),
  })

export const createBuilder = <T extends Schema.Schema<any>>(schema: T) => ({
  make: (config: Schema.Schema.Type<typeof schema>) => Schema.make(schema)(config),
  makeUnsafe: (config: unknown) => config as Schema.Schema.Type<typeof schema>,
})
```

2. Inventory Factory修正

```typescript
// 修正: src/domain/inventory/factory/item_factory/builders.ts
import { BuilderConfigSchema, createBuilder } from '@domain/shared/factory/builder_base'

const ItemBuilderConfigSchema = BuilderConfigSchema({
  category: ItemCategorySchema,
  stackable: Schema.Boolean,
  // ...
})

const itemBuilder = createBuilder(ItemBuilderConfigSchema)

// ❌ Before
const config = {
  category: 'tool' as ItemCategory,
  stackable: false,
} as ItemBuilderConfig

// ✅ After
const config = itemBuilder.make({
  category: 'tool', // 型推論
  stackable: false,
})
```

3. World Factory修正

```typescript
// 修正: src/domain/world/factory/noise_configuration_builder.ts
const NoiseConfigBuilderSchema = BuilderConfigSchema({
  seed: Schema.Number.pipe(Schema.int()),
  octaves: Schema.Number.pipe(Schema.int(), Schema.positive()),
  // ...
})

const noiseBuilder = createBuilder(NoiseConfigBuilderSchema)

// ❌ Before
return {
  seed: seed,
  octaves: octaves,
} as NoiseConfiguration

// ✅ After
return noiseBuilder.make({
  seed,
  octaves,
})
```

**PR分割**:

- PR#20: Builder基盤（builder_base.ts）
- PR#21-24: Inventory Factory修正（150箇所、4PR）
- PR#25-28: World Factory修正（150箇所、4PR）

**期待成果**:

- 削減: 300箇所（22%）
- 統一: Builder/Factoryパターンの標準化
- 工数: 30時間（3.75日）

**Week 5-6合計**: 450箇所削減、33%改善、52時間（6.5日）

---

## 🧪 テスト戦略

### 単体テスト（各週実施）

```bash
# Schema定義テスト
pnpm test src/domain/inventory/types/item_enums.test.ts

# 型推論テスト（TypeScriptコンパイラ）
pnpm typecheck

# Runtime検証テスト
pnpm test src/domain/inventory/aggregate/container/operations.test.ts
```

### 統合テスト（Week 2, 4, 6実施）

```bash
# E2E動作確認
pnpm test:integration

# カバレッジ維持確認（80%+）
pnpm test:coverage
```

### パフォーマンステスト（Week 6実施）

```bash
# ベンチマーク比較（Phase 1前後）
pnpm benchmark:gameloop
pnpm benchmark:rendering
pnpm benchmark:chunk

# 許容範囲: 5%以内の劣化
# 5%超過時は該当修正をrevert
```

---

## 📊 進捗管理

### 週次チェックリスト

#### Week 1

- [ ] Task 1.1完了（Enum-like削除、45箇所）
- [ ] PR#1-3マージ
- [ ] typecheck成功
- [ ] テストカバレッジ80%+維持

#### Week 2

- [ ] Task 1.2完了（Timestamp統一、19箇所）
- [ ] Task 1.3完了（Non-null削除、20箇所）
- [ ] PR#4-7マージ
- [ ] 統合テスト成功
- [ ] Week 1-2累計: 84箇所削減確認

#### Week 3-4

- [ ] Task 2.1完了（Structure Spawner、84箇所）
- [ ] Task 2.2完了（Transaction Manager、38箇所）
- [ ] Task 2.3完了（Camera Repository、28箇所）
- [ ] PR#8-14マージ
- [ ] 統合テスト成功
- [ ] Week 3-4累計: 150箇所削減確認

#### Week 5-6

- [ ] Task 3.1完了（THREE.js統一、150箇所）
- [ ] Task 3.2完了（Builder/Factory、300箇所）
- [ ] PR#15-28マージ
- [ ] パフォーマンステスト（5%以内）
- [ ] 統合テスト成功
- [ ] Phase 1累計: 684箇所削減確認

---

## ⚠️ リスク管理

### 高リスク項目と対応

#### Risk 1: パフォーマンス劣化（発生確率: 30%）

**検出方法**:

```bash
pnpm benchmark:gameloop  # FPS計測
pnpm benchmark:chunk     # getBlockAt性能
```

**対応方針**:

- 5%以上劣化 → 該当PR即時revert
- 3-5%劣化 → makeUnsafe適用検討
- 3%以下 → 許容範囲

#### Risk 2: テストカバレッジ低下（発生確率: 40%）

**検出方法**:

```bash
pnpm test:coverage  # 80%+維持必須
```

**対応方針**:

- 79%以下 → 追加テスト作成
- 75%以下 → PR差し戻し

#### Risk 3: 既存機能のデグレード（発生確率: 20%）

**検出方法**:

```bash
pnpm test:integration  # E2Eテスト
```

**対応方針**:

- 失敗 → 該当PR即時revert
- 原因調査後に再実装

---

## 🎓 実装パターン集

### パターン1: Enum-like型定義

```typescript
// ✅ 推奨: Schema.Literal
export const StatusSchema = Schema.Literal('pending', 'success', 'error')
type Status = Schema.Schema.Type<typeof StatusSchema>

const status: Status = StatusSchema.make('pending') // 型推論
```

### パターン2: Brand型統一

```typescript
// ✅ 推奨: 既存Brand型活用
import { Timestamp, makeTimestampFromMillis } from '@domain/shared/value_object/units/timestamp'

const now = yield * Effect.map(Clock.currentTimeMillis, makeTimestampFromMillis)
```

### パターン3: Option型でNon-null回避

```typescript
// ✅ 推奨: Effect.filterOrFail
const getValue = (key: K): Effect.Effect<V, NotFoundError> =>
  pipe(
    Option.fromNullable(map.get(key)),
    Effect.filterOrFail(Option.isSome, () => NotFoundError.create(key)),
    Effect.map(Option.getOrThrow)
  )
```

### パターン4: Schema.Struct構築

```typescript
// ✅ 推奨: Schema.make()
const config = ConfigSchema.make({
  fps: 60,
  resolution: { width: 1920, height: 1080 },
})
```

### パターン5: THREE.js境界検証

```typescript
// ✅ 推奨: 初期化時のみ検証
const camera =
  yield *
  Effect.succeed(new THREE.PerspectiveCamera(fov, aspect, near, far)).pipe(
    Effect.flatMap(validateCamera) // 初回のみ
  )

// 更新時は検証なし（パフォーマンス優先）
camera.position.set(x, y, z)
```

---

## 📈 成功指標（Phase 1完了時）

### 定量指標

| 指標               | 現状      | Phase 1目標 | 達成条件          |
| ------------------ | --------- | ----------- | ----------------- |
| 型アサーション削減 | 2,018箇所 | 1,334箇所   | -684箇所（33.9%） |
| テストカバレッジ   | 80%       | 80%+        | 維持              |
| フレームレート     | 60FPS     | 60FPS       | 劣化<5%           |
| メモリ使用量       | <2GB      | <2GB        | 増加<10%          |
| ビルド時間         | X秒       | X秒         | 増加<20%          |

### 定性指標

- ✅ Enum-like型パターン確立
- ✅ Timestamp型統一完了
- ✅ Container/Repository層型安全化
- ✅ プロシージャル生成Blueprint明確化
- ✅ THREE.js境界Adapter確立

---

## 🚀 Phase 2以降への引き継ぎ

### Phase 2対象（残存1,334箇所）

1. **inventory domain全体**（約600箇所as残存）
   - ItemStack操作の型安全化
   - Crafting/Recipe系の型定義

2. **camera domain**（約400箇所as残存）
   - 更新ループの型安全化（慎重に）
   - Input処理の型定義

3. **chunk domain**（約300箇所as残存）
   - State管理の型安全化
   - Mesh生成の型定義

### Phase 1で確立したパターンの展開

- ✅ Schema.Literalパターン → 他のEnum-like型へ
- ✅ Schema.makeパターン → 全Builder/Factoryへ
- ✅ Option型パターン → 全Repository層へ
- ✅ makeUnsafeパターン → 高頻度パスへ（慎重に）

---

## 📚 参考資料

### プロジェクト内

- `docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md` - Effect-TS基本パターン
- `PHASE1_DETAILED_ANALYSIS.md` - 詳細分析レポート
- `CRITICAL_PATH_ANALYSIS_REPORT.md` - パフォーマンス保護ガイド
- `FR-1_DETAILED_ANALYSIS.md` - 型安全化要件詳細

### 外部

- [Effect-TS公式ドキュメント](https://effect.website/docs/introduction) - Schema/Brand型リファレンス
- [@effect/schema Guide](https://effect.website/docs/schema/introduction) - Schema定義ベストプラクティス

---

## ✅ Phase 1完了基準

以下の全条件を満たした時点でPhase 1完了とする:

1. ✅ **684箇所削減達成**（33.9%改善）
2. ✅ **全PR（#1-28）マージ完了**
3. ✅ **typecheck成功**（型エラー0件）
4. ✅ **テストカバレッジ80%+維持**
5. ✅ **統合テスト成功**（デグレード0件）
6. ✅ **パフォーマンステスト成功**（劣化<5%）
7. ✅ **ドキュメント更新完了**（実装パターン記録）

---

**計画書作成**: 2025-10-07
**次アクション**: Week 1 Task 1.1実装開始 → `/issue:create` でIssue自動生成
