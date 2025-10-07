# 型アサーション削除分析レポート

**分析日**: 2025-10-07  
**プロジェクト**: TypeScript Minecraft Clone  
**分析対象**: 全`as`型アサーション箇所

---

## 📊 統計サマリー

### 総合統計

- **総 'as' 出現数**: 2,320箇所
- **対象ファイル数**: 454ファイル（923 TypeScriptファイル中）
- **削除対象**: 1,032箇所（44.5%）
- **削除不要**: 1,288箇所（55.5%）

### カテゴリ別内訳

| カテゴリ            | 箇所数 | 割合  | 削除要否         |
| ------------------- | ------ | ----- | ---------------- |
| `as const`          | 904    | 39.0% | **削除不要**     |
| `import type alias` | 430    | 18.5% | **削除不要**     |
| Brand型変換         | 789    | 34.0% | **削除対象**     |
| `as any`            | 37     | 1.6%  | **HIGH優先度**   |
| `as unknown`        | 11     | 0.5%  | **MEDIUM優先度** |

---

## 🎯 レイヤー別分析

### Domain層（最多：1,814箇所）

| ドメイン      | 削除対象 | ファイル数 | 優先度 |
| ------------- | -------- | ---------- | ------ |
| **world**     | 269      | 47         | HIGH   |
| **camera**    | 274      | 41         | HIGH   |
| **inventory** | 149      | 35         | MEDIUM |
| **chunk**     | 43       | 20         | MEDIUM |
| **physics**   | 23       | 6          | LOW    |
| **equipment** | 8        | 1          | LOW    |
| **crafting**  | 1        | 1          | LOW    |
| **shared**    | 40       | -          | -      |

### Application層（383箇所）

- 削除対象: 160箇所（29ファイル）
- 主な対象: `camera_mode_manager`, `chunk_data_provider`, `world_generation_orchestrator`

### Infrastructure層（49ファイル）

- 削除対象: 50箇所（17ファイル）
- THREE.js/CANNON.js境界の型変換が中心

---

## 📋 パターン別分類と解決策

### Pattern 1: Brand型数値変換（Schema.make()で解決）

**対象**: 約100箇所  
**優先度**: **MEDIUM**  
**代表例**: `src/domain/inventory/value_object/stack_size/operations.ts`

**Before（危険）:**

```typescript
const currentSize = current as number
const additionSize = addition as number
const maxSizeValue = maxSize as number
```

**After（安全）:**

```typescript
// Brand型のまま演算可能な関数を追加
export const addStackSizes = (a: StackSize, b: StackSize): Effect.Effect<StackSize, StackSizeError> =>
  Schema.make(StackSizeSchema)((a as number) + (b as number))

// または内部でSchema.make()使用
const result = yield * Schema.make(StackSizeSchema)((current as number) + (addition as number))
```

**影響範囲**:

- `src/domain/inventory/value_object/stack_size/operations.ts`: 21箇所
- `src/domain/inventory/value_object/slot_position/operations.ts`: 13箇所

---

### Pattern 2: Brand型プリミティブ変換（makeUnsafe()で解決）

**対象**: 約300箇所  
**優先度**: **HIGH**  
**代表例**: `src/domain/world/value_object/noise_configuration/`

**Before:**

```typescript
frequency: preset.frequency as Frequency,
amplitude: preset.amplitude as Amplitude,
scale: 1.0 as Scale,
octaves: preset.octaves as Octaves,
```

**After:**

```typescript
// operations.tsにmakeUnsafe関数を追加
export const makeUnsafeFrequency = (value: number): Frequency =>
  unsafeCoerce<number, Frequency>(value)

// 使用側
frequency: makeUnsafeFrequency(preset.frequency),
amplitude: makeUnsafeAmplitude(preset.amplitude),
scale: makeUnsafeScale(1.0),
octaves: makeUnsafeOctaves(preset.octaves),
```

**影響範囲**:

- `src/domain/world/value_object/noise_configuration/`: 47箇所
- `src/domain/world/value_object/biome_properties/`: 44箇所

**参考実装**: `src/domain/world/value_object/coordinates/world_coordinate.ts`（既存のmakeUnsafeパターン）

---

### Pattern 3: 外部ライブラリ型変換（Adapter Schemaで解決）

**対象**: 約50箇所  
**優先度**: **LOW**（Infrastructure層のため）  
**代表例**: `src/infrastructure/cannon/three-integration.ts`

**Before:**

```typescript
mesh.position.copy(body.position as unknown as THREE.Vector3)
mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion)
```

**After:**

```typescript
// Adapter Schema定義
const Vec3ToVector3 = Schema.transform(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  Schema.instanceOf(THREE.Vector3),
  {
    decode: ({ x, y, z }) => new THREE.Vector3(x, y, z),
    encode: (v) => ({ x: v.x, y: v.y, z: v.z }),
  }
)

// 使用側
const vector3 = yield * Schema.decode(Vec3ToVector3)(body.position)
mesh.position.copy(vector3)
```

**影響範囲**:

- `src/infrastructure/cannon/three-integration.ts`: 4箇所
- `src/infrastructure/three/core/`: 約20箇所

---

### Pattern 4: Repository型エイリアス削除

**対象**: 約100箇所  
**優先度**: **LOW**（可読性向上のみ）  
**代表例**: `src/domain/camera/repository/index.ts`

**Before:**

```typescript
import { PlayerId as CameraStatePlayerId } from './camera_state'
import { PlayerId as SettingsPlayerId } from './settings_storage'
```

**After:**

```typescript
// Shared Kernel統一により不要
import { PlayerId } from '@domain/shared/entities/player_id'
```

**影響範囲**:

- `src/domain/camera/repository/index.ts`: 36箇所

---

### Pattern 5: as any/unknown削除（型推論強化）

**対象**: 48箇所  
**優先度**: **HIGH**（型安全性リスク最大）

#### 5-1. `as any`（37箇所）

**代表例1**: `src/application/chunk/application_service/chunk_data_provider.ts`

```typescript
// Before
blockId: 1 as any, // Stone block
metadata: 0 as any,
lightLevel: 15 as any,

// After
blockId: BlockIdOperations.makeUnsafe(1),
metadata: MetadataOperations.makeUnsafe(0),
lightLevel: LightLevelOperations.makeUnsafe(15),
```

**代表例2**: `src/application/camera/application_service/camera_mode_manager/live.ts`

```typescript
// Before
distance: 8.0 as any, // CameraDistance Brand型は別途対応

// After
import { CameraDistanceSchema } from '@domain/camera/value_object/camera_distance'
distance: Schema.make(CameraDistanceSchema)(8.0),
```

#### 5-2. `as unknown`（11箇所）

**代表例**: `src/domain/physics/service/world_collision.ts`

```typescript
// Before
blockType: 'stone' as unknown as BlockTypeId,

// After
import { BlockTypeIdOperations } from '@domain/shared/entities/block_type_id'
blockType: yield* BlockTypeIdOperations.make('stone'),
```

---

## 🚀 PR分割案（20-30ファイル単位）

### Phase 1: HIGH優先度（型安全性リスク最大）

#### PR #1: as any/unknown削除

- **対象**: 15-20ファイル
- **削除見込み**: 48箇所
- **影響範囲**: application層・domain層混在
- **ファイル例**:
  - `src/application/chunk/application_service/chunk_data_provider.ts`
  - `src/application/camera/application_service/camera_mode_manager/live.ts`
  - `src/domain/physics/service/world_collision.ts`
  - `src/domain/world/repository/generation_session_repository/persistence_implementation.ts`

**実装手順**:

1. 各`as any`箇所に対応するBrand型操作関数を確認
2. 未実装の場合は`makeUnsafe()`関数を追加
3. Schema.make()またはmakeUnsafe()に置換
4. `pnpm typecheck && pnpm test`

---

### Phase 2: Inventory Domain

#### PR #2: Inventory型アサーション削減

- **対象**: 35ファイル
- **削除見込み**: 149箇所
- **ドメイン**: inventory全体
- **Top 5ファイル**:
  1. `value_object/stack_size/operations.ts`: 21箇所
  2. `repository/inventory_repository/interface.ts`: 14箇所
  3. `value_object/slot_position/operations.ts`: 13箇所
  4. `repository/container_repository/interface.ts`: 9箇所
  5. `factory/item_factory/factory.ts`: 9箇所

**実装手順**:

1. StackSize/SlotPositionにBrand型演算関数を追加
2. Repository interfaceの型定義を厳格化
3. Factory層の型アサーションをSchema.make()に置換

---

### Phase 3-4: Camera Domain（2分割）

#### PR #3: Camera Domain (Part 1)

- **対象**: 20ファイル
- **削除見込み**: 137箇所
- **Top 10ファイル**:
  1. `repository/index.ts`: 36箇所（Type Alias削除）
  2. `repository/animation_history/live.ts`: 19箇所
  3. `first_person.ts`: 18箇所
  4. `repository/view_mode_preferences/live.ts`: 15箇所

#### PR #4: Camera Domain (Part 2)

- **対象**: 21ファイル
- **削除見込み**: 137箇所
- **残りのファイル群**

**実装手順**:

1. `repository/index.ts`の重複Type Aliasを削除（Shared Kernel統一）
2. Value Object層にmakeUnsafe()関数追加
3. Repository層・Aggregate層の型推論強化

---

### Phase 5-6: World Domain（2分割）

#### PR #5: World Domain (Part 1)

- **対象**: 24ファイル
- **削除見込み**: 135箇所
- **Top 5ファイル**:
  1. `value_object/noise_configuration/index.ts`: 47箇所
  2. `value_object/biome_properties/index.ts`: 44箇所
  3. `aggregate/index.ts`: 24箇所
  4. `domain_service/biome_classification/biome_mapper.ts`: 21箇所

#### PR #6: World Domain (Part 2)

- **対象**: 23ファイル
- **削除見込み**: 134箇所
- **残りのファイル群**

**実装手順**:

1. Noise Configuration全Brand型に`makeUnsafe()`追加
2. Biome Properties同様に処理
3. Repository層のpersistence実装を型安全化

---

### Phase 7: Chunk/Physics/その他

#### PR #7: Chunk Domain型アサーション削減

- **対象**: 20ファイル
- **削除見込み**: 43箇所

#### PR #8: Physics/Equipment/その他

- **対象**: 約15ファイル
- **削除見込み**: 約40箇所

#### PR #9: Application層・Infrastructure層

- **対象**: 約30ファイル
- **削除見込み**: 約210箇所

---

## 🎯 優先実装ターゲット

### Tier 1: 即時実施（HIGH Priority）

**削除見込み**: 48箇所

| ファイル                                                             | 箇所数 | 理由                 |
| -------------------------------------------------------------------- | ------ | -------------------- |
| `application/camera/application_service/camera_mode_manager/live.ts` | 9      | `as any`多用         |
| `application/chunk/application_service/chunk_data_provider.ts`       | 4      | `as any`多用         |
| `domain/physics/service/world_collision.ts`                          | 8      | `as unknown`多用     |
| 他15ファイル                                                         | 27     | `as any/unknown`含む |

**実装期間**: 1-2日  
**リスク**: 低（既存Brand型操作関数活用）

---

### Tier 2: 短期実施（MEDIUM Priority）

**削除見込み**: 418箇所（Inventory + Camera Part 1）

| ドメイン          | 削除見込み | ファイル数 | 理由                 |
| ----------------- | ---------- | ---------- | -------------------- |
| **Inventory**     | 149        | 35         | Pattern 1適用が明確  |
| **Camera Part 1** | 137        | 20         | Type Alias削除が中心 |
| **Camera Part 2** | 137        | 21         | Value Object層が中心 |

**実装期間**: 1週間  
**リスク**: 低（既存パターン踏襲）

---

### Tier 3: 中期実施（MEDIUM-LOW Priority）

**削除見込み**: 269箇所（World Domain全体）

| 分割             | 削除見込み | ファイル数 | 理由                  |
| ---------------- | ---------- | ---------- | --------------------- |
| **World Part 1** | 135        | 24         | Noise/Biome設定が中心 |
| **World Part 2** | 134        | 23         | Repository層が中心    |

**実装期間**: 1週間  
**リスク**: 中（多数のBrand型makeUnsafe追加が必要）

---

### Tier 4: 長期実施（LOW Priority）

**削除見込み**: 約250箇所（Chunk/Physics/Application/Infrastructure）

**実装期間**: 1-2週間  
**リスク**: 中-高（Infrastructure層は外部ライブラリ境界処理）

---

## 📈 期待効果

### 型安全性向上

- **`as any`削除**: 実行時エラーリスク37箇所削減
- **`as unknown`削除**: 型チェック回避11箇所削減
- **Brand型強化**: 型変換の明示化789箇所

### 保守性向上

- **型推論強化**: IDEの型補完精度向上
- **明示的な型変換**: `makeUnsafe()`関数により変換箇所が検索可能
- **将来のバリデーション追加**: `makeUnsafe()`から`make()`への移行が容易

### パフォーマンス

- **変更なし**: `makeUnsafe()`は`unsafeCoerce()`ベースのため実行時オーバーヘッドなし

---

## 🔧 実装ガイドライン

### 1. Brand型演算関数追加パターン

```typescript
// src/domain/xxx/value_object/yyy/operations.ts

import { unsafeCoerce } from 'effect/Function'
import type { YyyBrand } from './schema'

// 安全な構築（バリデーション付き）
export const make = (value: number): Effect.Effect<YyyBrand, YyyError> => Schema.decode(YyyBrandSchema)(value)

// 高速構築（バリデーションなし）
export const makeUnsafe = (value: number): YyyBrand => unsafeCoerce<number, YyyBrand>(value)

// 演算関数
export const add = (a: YyyBrand, b: YyyBrand): YyyBrand => makeUnsafe((a as number) + (b as number))
```

### 2. 型推論強化パターン

```typescript
// Before
const result = someValue as SomeBrand

// After
import { SomeBrandOperations } from '@domain/xxx/value_object/some_brand'
const result = yield * SomeBrandOperations.make(someValue)
// または
const result = SomeBrandOperations.makeUnsafe(someValue)
```

### 3. Shared Kernel統一パターン

```typescript
// Before
import { PlayerId as RepositoryPlayerId } from './types'

// After
import { PlayerId } from '@domain/shared/entities/player_id'
```

---

## 🚨 注意事項

### 実装時の制約

1. **`makeUnsafe()`は最終手段**: パフォーマンスクリティカルな箇所のみ使用
2. **Schema.make()優先**: 通常はバリデーション付き構築を推奨
3. **テスト必須**: 各PR作成時に`pnpm typecheck && pnpm test && pnpm build`実行
4. **段階的移行**: 一度に大量のファイルを変更しない（20-30ファイル単位厳守）

### 既知のリスク

1. **Infrastructure層**: THREE.js/CANNON.js境界の型変換は慎重に
2. **Repository層**: 永続化処理での型変換は実行時エラーに注意
3. **Application層**: 複数ドメインの境界処理は型定義の整合性確認

---

## 📚 参考資料

### 既存実装パターン

- **Phase 1完了記録**: `shared-kernel-id-pattern` memory
- **Brand型makeUnsafe**: `src/domain/world/value_object/coordinates/world_coordinate.ts`
- **Schema.make()活用**: `src/domain/shared/value_object/units/meters/operations.ts`

### Effect-TS公式ドキュメント

- Schema: https://effect.website/docs/schema/introduction
- Brand: https://effect.website/docs/guides/branded-types

---

## 🎉 期待される最終成果

- **削除型アサーション**: 1,032箇所 → 0箇所
- **型安全性スコア**: 向上（静的解析ツールで測定可能）
- **保守性**: 型変換箇所の完全な可視化と検索可能性
- **実装期間**: 3-4週間（9 PRs）

---

## 📁 付録A: 削除対象Top 50ファイル詳細リスト

| #   | 削除箇所 | ファイルパス                                                                                        | ドメイン  | パターン               |
| --- | -------- | --------------------------------------------------------------------------------------------------- | --------- | ---------------------- |
| 1   | 47       | `src/domain/world/value_object/noise_configuration/index.ts`                                        | world     | Pattern 2              |
| 2   | 44       | `src/domain/world/value_object/biome_properties/index.ts`                                           | world     | Pattern 2              |
| 3   | 36       | `src/domain/camera/repository/index.ts`                                                             | camera    | Pattern 4              |
| 4   | 32       | `src/application/camera/application_service/scene_camera/live.ts`                                   | camera    | Pattern 1+2            |
| 5   | 24       | `src/domain/world/aggregate/index.ts`                                                               | world     | Pattern 2              |
| 6   | 23       | `src/application/camera/application_service/player_camera/live.ts`                                  | camera    | Pattern 1+2            |
| 7   | 21       | `src/domain/world/domain_service/biome_classification/biome_mapper.ts`                              | world     | Pattern 2              |
| 8   | 21       | `src/domain/inventory/value_object/stack_size/operations.ts`                                        | inventory | Pattern 1              |
| 9   | 19       | `src/domain/camera/repository/animation_history/live.ts`                                            | camera    | Pattern 1+4            |
| 10  | 18       | `src/domain/camera/first_person.ts`                                                                 | camera    | Pattern 1+3            |
| 11  | 15       | `src/domain/camera/repository/view_mode_preferences/live.ts`                                        | camera    | Pattern 1+4            |
| 12  | 14       | `src/domain/inventory/repository/inventory_repository/interface.ts`                                 | inventory | Pattern 1              |
| 13  | 13       | `src/domain/inventory/value_object/slot_position/operations.ts`                                     | inventory | Pattern 1              |
| 14  | 13       | `src/domain/camera/repository/view_mode_preferences/types.ts`                                       | camera    | Pattern 4              |
| 15  | 13       | `src/domain/camera/domain_service/settings_validator/live.ts`                                       | camera    | Pattern 1              |
| 16  | 12       | `src/domain/camera/value_object/animation_state/operations.ts`                                      | camera    | Pattern 1              |
| 17  | 12       | `src/domain/camera/repository/settings_storage/types.ts`                                            | camera    | Pattern 4              |
| 18  | 11       | `src/infrastructure/three/core/matrix4.ts`                                                          | infra     | Pattern 3              |
| 19  | 10       | `src/domain/world/value_object/generation_parameters/index.ts`                                      | world     | Pattern 2              |
| 20  | 10       | `src/domain/world/repository/generation_session_repository/persistence_implementation.ts`           | world     | Pattern 5              |
| 21  | 10       | `src/domain/camera/domain_service/view_mode_manager/live.ts`                                        | camera    | Pattern 1              |
| 22  | 10       | `src/domain/camera/domain_service/animation_engine/live.ts`                                         | camera    | Pattern 1              |
| 23  | 9        | `src/domain/inventory/repository/inventory_repository/__tests__/storage_schema.spec.ts`             | inventory | Pattern 1              |
| 24  | 9        | `src/domain/inventory/repository/container_repository/interface.ts`                                 | inventory | Pattern 1              |
| 25  | 9        | `src/domain/inventory/factory/item_factory/factory.ts`                                              | inventory | Pattern 1              |
| 26  | 9        | `src/domain/camera/aggregate/player_camera/player_camera.ts`                                        | camera    | Pattern 1              |
| 27  | 9        | `src/application/world/application_service/world_generation_orchestrator/orchestrator.ts`           | world     | Pattern 2+5            |
| 28  | 9        | `src/application/camera/application_service/camera_mode_manager/live.ts`                            | camera    | Pattern 5 (as any)     |
| 29  | 8        | `src/domain/world/repository/world_generator_repository/memory_implementation.ts`                   | world     | Pattern 2              |
| 30  | 8        | `src/domain/physics/service/world_collision.ts`                                                     | physics   | Pattern 5 (as unknown) |
| 31  | 8        | `src/domain/equipment/aggregate/equipment_set.ts`                                                   | equipment | Pattern 1              |
| 32  | 8        | `src/domain/camera/aggregate/scene_camera/factory.ts`                                               | camera    | Pattern 1              |
| 33  | 8        | `src/domain/camera/aggregate/camera/camera.ts`                                                      | camera    | Pattern 1              |
| 34  | 8        | `src/application/world/application_service/world_generation_orchestrator/error_recovery.ts`         | world     | Pattern 2+5            |
| 35  | 7        | `src/domain/world/repository/world_generator_repository/persistence_implementation.ts`              | world     | Pattern 2              |
| 36  | 7        | `src/domain/inventory/repository/item_definition_repository/interface.ts`                           | inventory | Pattern 1              |
| 37  | 7        | `src/domain/camera/index.ts`                                                                        | camera    | Pattern 4              |
| 38  | 6        | `src/infrastructure/scene/service-live.ts`                                                          | infra     | Pattern 3              |
| 39  | 6        | `src/domain/world/value_object/coordinates/chunk_coordinate.ts`                                     | world     | Pattern 2              |
| 40  | 6        | `src/domain/world/types/core/biome_types.ts`                                                        | world     | Pattern 2              |
| 41  | 6        | `src/domain/world/repository/world_metadata_repository/memory_implementation.ts`                    | world     | Pattern 2              |
| 42  | 6        | `src/domain/physics/system/collision_detection.ts`                                                  | physics   | Pattern 1              |
| 43  | 6        | `src/domain/inventory/value_object/item_id/operations.ts`                                           | inventory | Pattern 1              |
| 44  | 6        | `src/domain/inventory/inventory-service-live.ts`                                                    | inventory | Pattern 1              |
| 45  | 6        | `src/domain/inventory/factory/inventory_factory/factory.ts`                                         | inventory | Pattern 1              |
| 46  | 6        | `src/domain/chunk/aggregate/chunk/composite_operations.ts`                                          | chunk     | Pattern 1              |
| 47  | 6        | `src/domain/camera/third_person.ts`                                                                 | camera    | Pattern 1+3            |
| 48  | 6        | `src/application/world/application_service/world_generation_orchestrator/dependency_coordinator.ts` | world     | Pattern 2              |
| 49  | 6        | `src/application/world/application_service/progressive_loading/priority_calculator.ts`              | world     | Pattern 2              |
| 50  | 6        | `src/application/world/application_service/progressive_loading/memory_monitor.ts`                   | world     | Pattern 2              |

**合計（Top 50）**: 597箇所（全削除対象1,032箇所の57.8%）

---

## 📁 付録B: ドメイン別ファイルリスト

### World Domain (269箇所, 47ファイル)

```
47 src/domain/world/value_object/noise_configuration/index.ts
44 src/domain/world/value_object/biome_properties/index.ts
24 src/domain/world/aggregate/index.ts
21 src/domain/world/domain_service/biome_classification/biome_mapper.ts
10 src/domain/world/value_object/generation_parameters/index.ts
10 src/domain/world/repository/generation_session_repository/persistence_implementation.ts
...
```

### Camera Domain (274箇所, 41ファイル)

```
36 src/domain/camera/repository/index.ts
19 src/domain/camera/repository/animation_history/live.ts
18 src/domain/camera/first_person.ts
15 src/domain/camera/repository/view_mode_preferences/live.ts
13 src/domain/camera/repository/view_mode_preferences/types.ts
...
```

### Inventory Domain (149箇所, 35ファイル)

```
21 src/domain/inventory/value_object/stack_size/operations.ts
14 src/domain/inventory/repository/inventory_repository/interface.ts
13 src/domain/inventory/value_object/slot_position/operations.ts
9 src/domain/inventory/repository/container_repository/interface.ts
9 src/domain/inventory/factory/item_factory/factory.ts
...
```

---

## 📁 付録C: パターン別実装優先度マトリクス

| パターン                            | 削除見込み | 実装難易度 | 優先度   | 推奨Phase           |
| ----------------------------------- | ---------- | ---------- | -------- | ------------------- |
| **Pattern 5 (as any/unknown)**      | 48         | 低         | **HIGH** | Phase 1 (PR #1)     |
| **Pattern 1 (Brand型数値)**         | ~100       | 低         | MEDIUM   | Phase 2 (PR #2)     |
| **Pattern 2 (Brand型プリミティブ)** | ~300       | 中         | HIGH     | Phase 3-6 (PR #3-6) |
| **Pattern 4 (Type Alias)**          | ~100       | 低         | LOW      | Phase 3 (PR #3)     |
| **Pattern 3 (外部ライブラリ)**      | ~50        | 高         | LOW      | Phase 7+ (PR #9)    |

**実装難易度の基準**:

- **低**: 既存パターン適用のみ（1-2日/PR）
- **中**: 新規operations.ts作成が必要（3-5日/PR）
- **高**: Adapter Schema設計が必要（1週間/PR）

---

## 🎓 付録D: 学習リソース

### Effect-TS Schema

- **公式ガイド**: https://effect.website/docs/schema/introduction
- **Brand型**: https://effect.website/docs/guides/branded-types
- **Transform**: https://effect.website/docs/schema/transformations

### プロジェクト内参考実装

1. **Brand型makeUnsafe**: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/value_object/coordinates/world_coordinate.ts`
2. **Schema.make()活用**: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/shared/value_object/units/meters/operations.ts`
3. **Shared Kernel統一**: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/shared/entities/`

### メモリ参照

- `shared-kernel-id-pattern`: ID型統合パターン
- `phase1-refactoring-patterns`: Brand型安全構築パターン

---

**レポート作成完了**  
**次のアクション**: PR #1（as any/unknown削除）の実装開始を推奨
