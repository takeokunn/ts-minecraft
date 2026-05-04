# DDD リファクタリング総合実装計画書

**プロジェクト**: TypeScript Minecraft Clone - DDD適合性向上

**策定日**: 2025-10-07

**基準文書**: [DDD.md](./DDD.md) - DDD アーキテクチャ調査報告書

---

## 📋 エグゼクティブサマリー

### プロジェクト概要

DDD.mdで提示された3つのリファクタリング要件（FR-1/FR-2/FR-3）について、詳細な実コード調査を実施した結果、**当初見積もりとの大幅な乖離**が判明しました。本計画書は、実態に基づく最適化された実装アプローチを提示します。

### 重要な発見事項

#### 🎯 DDD.md見積もりとの差異

| 項目                    | DDD.md見積もり   | 実態（調査結果）                 | 差異                 |
| ----------------------- | ---------------- | -------------------------------- | -------------------- |
| **FR-1 import更新箇所** | 約187箇所        | 7箇所（直接）+ 30-50箇所（間接） | **-137箇所**         |
| **FR-1 総変更箇所**     | 約700箇所        | 約100-150箇所                    | **-550箇所**         |
| **FR-1 所要時間**       | 160時間（4週間） | 6-8時間                          | **-152時間（1/20）** |
| **FR-1 リスクレベル**   | 極めて危険       | 中程度                           | **大幅改善**         |
| **FR-3 型重複箇所**     | 約423箇所        | 20箇所                           | **-403箇所**         |
| **総所要時間**          | 160時間（4週間） | **18-23時間（2-3営業日）**       | **-137時間（1/7）**  |

#### ⚠️ 重要な技術的発見

**FR-1（Application Service移動）**:

- 4つのServiceがDomain Serviceへの再分類候補
  - WorldGenerationOrchestrator
  - PhysicsSimulationOrchestratorService
  - CraftingEngineService
  - RecipeRegistryService
- Application Service間の循環依存リスク: **未検出**
- Domain → Application の逆参照（レイヤー違反）: **未検出**

**FR-3（共有カーネル確立）**:

- BlockIdに**数値型/文字列型の不一致**が存在 → `BlockTypeId`として分離が必要
- PhysicsWorldIdは独自Brand実装 → WorldIdとの互換性検討が必要

**FR-2（World分割）**:

- coordinatesは安全に移動可能（world内部のみ使用）
- 依存関係は一方向（world_generation → biome）
- 循環依存リスク: **なし**

### 推奨実施アプローチ: 戦略B（段階的並列実施）

```
Phase 1: FR-3（共有カーネル確立）- 3時間
  ├─ WorldId/PlayerId/EntityId移行（1h）
  ├─ BlockId/ItemId移行 + 型不一致修正（1.5h）
  └─ 検証・ドキュメント化（0.5h）

Phase 2: FR-1（Application Service移動）- 6-8時間
  ├─ equipment/interaction試験実施（1h）
  ├─ chunk/chunk_manager/crafting移動（2h）
  ├─ physics/inventory移動（2h）
  └─ world/camera移動・Layer再構築（2-3h）

Phase 3: FR-2（World分割）- 9-12時間
  ├─ biomeコンテキスト分離（3-4h）
  ├─ world_generationコンテキスト分離（4-5h）
  └─ worldコンテキスト調整・検証（2-3h）

【総所要時間】: 18-23時間（2-3営業日）
```

### 期待される成果

1. **DDDレイヤー分離原則への準拠**: 9コンテキストのApplication Service移動により、レイヤー分離率が61% → 95%に向上
2. **型安全性の向上**: 20箇所の型重複解消により、共有カーネルの確立
3. **ドメインの明確化**: Worldコンテキスト分割により、単一責任原則への準拠
4. **保守性の向上**: 明確なコンテキスト境界により、変更影響範囲の明確化
5. **Effect-TS Layer設計の改善**: Domain/Application層の明確な分離

---

## 📊 詳細調査結果

### FR-1: Application Serviceの完全移動

#### 現状分析

**違反しているコンテキスト（9個）**:

1. `src/domain/chunk/application_service/` - 1ファイル
2. `src/domain/camera/application_service/` - 4サブディレクトリ + 2ファイル
3. `src/domain/chunk_manager/application_service/` - 2ファイル
4. `src/domain/world/application_service/` - 4サブディレクトリ + 3ファイル
5. `src/domain/inventory/application_service/` - 3サブディレクトリ + 3ファイル
6. `src/domain/physics/application_service/` - 4ファイル
7. `src/domain/crafting/application_service/` - 3ファイル
8. `src/domain/equipment/application_service/` - 2ファイル
9. `src/domain/interaction/application_service/` - 2ファイル

#### 調査結果サマリー

**影響範囲**:

- 直接的なapplication_service import: **7件のみ**
- 間接的な影響（context間import）: 308件（ただしほとんどが型参照のみ）
- **実際の修正必要ファイル数**: **30-50ファイル程度**

**所要時間**: 6-8時間（当初見積もり160時間の1/20）

**リスクレベル**: 中

**循環依存リスク**: 極めて低

- Application Service間の相互参照: **未検出**
- Domain → Application の逆参照（レイヤー違反）: **未検出**

#### 責務再分類が必要なService

以下4つのServiceは、ビジネスロジックを含むため、Domain Serviceへの再分類を検討すべき：

1. **WorldGenerationOrchestrator** (`src/domain/world/application_service/world_generation_orchestrator/`)
   - 理由: ワールド生成アルゴリズムの調整はドメインロジック
   - 推奨: `src/domain/world_generation/domain_service/` へ移動

2. **PhysicsSimulationOrchestratorService** (`src/domain/physics/application_service/physics_simulation_orchestrator.ts`)
   - 理由: 物理シミュレーションの調整はドメインロジック
   - 推奨: `src/domain/physics/domain_service/` へ移動

3. **CraftingEngineService** (`src/domain/crafting/application_service/crafting_engine.ts`)
   - 理由: クラフトレシピの検証・実行はドメインロジック
   - 推奨: `src/domain/crafting/domain_service/` へ移動

4. **RecipeRegistryService** (`src/domain/crafting/application_service/recipe_registry.ts`)
   - 理由: レシピ登録はドメインロジック
   - 推奨: `src/domain/crafting/domain_service/` へ移動

#### Effect-TS Layer再構築

**変更パターン（DDD.md記載の例）**:

```typescript
// 変更前（レイヤー混在）❌
// src/domain/inventory/layers.ts
export const InventoryDomainLive = Layer.mergeAll(
  ItemRegistryLive, // Domain Service
  ValidationServiceLive, // Domain Service
  InventoryManagerLive, // Application Service ❌
  TransactionManagerLive // Application Service ❌
)

// 変更後（レイヤー分離）✅
// src/domain/inventory/layers.ts
export const InventoryDomainLive = Layer.mergeAll(ItemRegistryLive, ValidationServiceLive)

// src/application/inventory/layers.ts
export const InventoryApplicationLive = Layer.mergeAll(InventoryManagerLive, TransactionManagerLive).pipe(
  Layer.provide(InventoryDomainLive)
)
```

---

### FR-2: Worldコンテキストの分割

#### 現状分析

**肥大化の構造**:

```
src/domain/world/aggregate/
├── biome_system/           # バイオーム管理（独立した責務）
├── world_generator/        # ワールド生成（独立した責務）
└── generation_session/     # セッション管理（独立した責務）
```

**問題点**:

1. 単一責任原則違反 - 1コンテキストが3つの独立集約を管理
2. 変更の影響範囲が不明確
3. チーム開発の阻害要因

#### 調査結果サマリー

**影響範囲**: 136ファイル

- biome関連: 35ファイル
- world_generation関連: 68ファイル
- world（調整後）: 33ファイル

**依存関係**: 一方向

```
world_generation → biome
```

**循環依存リスク**: なし

**coordinatesの扱い**:

- 現状: `src/domain/world/value_object/coordinates/`
- 調査結果: world内部のみで使用、他コンテキストへの影響なし
- 推奨: `src/domain/biome/value_object/coordinates/` へ移動（安全）
- アダプターエイリアス: `src/domain/world/value_object/coordinates/` に設置

#### 分割後のコンテキスト構成

**新設コンテキスト1: `domain/biome/`**

```
src/domain/biome/
├── aggregate/biome_system/
├── domain_service/biome_classification/
├── value_object/
│   ├── biome_properties/
│   └── coordinates/        # worldから移動
└── repository/biome_repository/
```

**責務**: バイオーム分類、気候モデル、バイオーム遷移

**新設コンテキスト2: `domain/world_generation/`**

```
src/domain/world_generation/
├── aggregate/
│   ├── world_generator/
│   └── generation_session/
├── domain_service/procedural_generation/
└── factory/world_generator_factory/
```

**責務**: ワールド生成アルゴリズム、ノイズ生成

**調整後の`domain/world/`**

```
src/domain/world/
├── domain_service/world_validation/
├── value_object/
│   ├── coordinates/        # エイリアス（移動済み）
│   ├── world_seed/
│   └── dimension_id/
└── types/
```

**責務**: ワールド座標系、ディメンション管理

#### Effect-TS Layer提供順序

```typescript
// 依存関係の順序
BiomeDomainLayer
  → WorldGenerationDomainLayer
    → WorldGenerationApplicationLayer
```

---

### FR-3: 共有カーネルの確立

#### 現状分析

**検出された型重複（20箇所）**:

- WorldIdSchema: 5箇所
- PlayerIdSchema: 5箇所
- EntityIdSchema: 1箇所
- BlockIdSchema: 4箇所
- ItemIdSchema: 5箇所

**重複箇所の例**:

- `src/domain/player/types.ts` の `WorldIdSchema`
- `src/domain/entities/types/core.ts` の `WorldIdSchema`

#### 調査結果サマリー

**影響範囲**: 20箇所の型定義重複（DDD.mdの「約423箇所」は使用箇所を含めた誤解）

**所要時間**: 3時間

**リスクレベル**: 低〜中

**高リスク発見**:

1. **BlockIdの型不一致**
   - `chunk/value_object/chunk_metadata/types.ts`: **数値型**のBlockId
   - 他のファイル: **文字列型**のBlockId
   - **対策**: 数値型を`BlockTypeId`として分離

2. **PhysicsWorldIdの独自Brand**
   - `physics/types/core.ts`: `PhysicsWorldId`として独自実装
   - **対策**: WorldIdとの互換性を保ちつつ、別名として残す

#### 共有カーネル構造設計

```
src/domain/shared/
├── entities/                    # 新設
│   ├── world_id/
│   │   ├── schema.ts
│   │   ├── operations.ts
│   │   ├── errors.ts
│   │   └── index.ts
│   ├── player_id/
│   ├── entity_id/
│   ├── block_id/               # 文字列型
│   ├── block_type_id/          # 数値型（新設）
│   ├── item_id/
│   └── README.md                # 共有カーネルポリシー
├── value_object/units/          # 既存
│   ├── meters/
│   ├── milliseconds/
│   └── timestamp/
└── effect/                      # 既存
```

#### 共有カーネルポリシー（README.md記載内容）

**対象範囲**:

- 複数コンテキストで使用される基本エンティティIDのみ
- ビジネスロジックは含まない

**変更時の注意事項**:

- 全依存コンテキストの合意が必要
- 依存関係の確保
- Effect-TS Schemaパターンへの準拠

**追加基準**:

- 3つ以上のコンテキストで使用される型
- ドメインの根幹となるID型

**テスト規則**:

- 各ID型にunit testを必須化
- Schemaバリデーションのテスト

---

## 🔄 総合依存関係分析

### 3つのリファクタリング間の依存関係

```
┌─────────────────────────────────────────────────┐
│ FR-3（共有カーネル確立）                         │
│ ├─ WorldId/PlayerId/EntityId                   │
│ ├─ BlockId/ItemId + BlockTypeId分離            │
│ └─ 共有カーネルポリシー文書化                   │
│                                                 │
│ 【独立性】: 極めて高                             │
│ 【FR-1/FR-2への影響】: 共通型の提供              │
└─────────────────────────────────────────────────┘
                        ↓ 共通型を利用
┌─────────────────────────────────────────────────┐
│ FR-1（Application Service移動）                 │
│ ├─ 9コンテキストのApplication Service移動       │
│ ├─ 4つのServiceのDomain Service再分類           │
│ └─ Effect-TS Layer分離                         │
│                                                 │
│ 【独立性】: 高（FR-3完了後が望ましい）           │
│ 【FR-2への影響】: レイヤー分離によりFR-2が安全化 │
└─────────────────────────────────────────────────┘
                        ↓ レイヤー分離済み
┌─────────────────────────────────────────────────┐
│ FR-2（World分割）                               │
│ ├─ biomeコンテキスト分離                        │
│ ├─ world_generationコンテキスト分離             │
│ └─ worldコンテキスト調整                        │
│                                                 │
│ 【独立性】: 中（FR-1完了後が推奨）               │
│ 【リスク】: FR-1未完了時は循環依存リスク増加     │
└─────────────────────────────────────────────────┘
```

### 並列実施可能性の評価

| 組み合わせ         | 並列実施可能性 | リスク | 推奨度 |
| ------------------ | -------------- | ------ | ------ |
| FR-3 ∥ FR-1        | ✅ 可能        | 低     | ⭐⭐⭐ |
| FR-3 ∥ FR-2        | ✅ 可能        | 低     | ⭐⭐⭐ |
| FR-1 ∥ FR-2        | ⚠️ 条件付き    | 中     | ⭐⭐   |
| FR-3 ∥ FR-1 ∥ FR-2 | ❌ 非推奨      | 高     | ⭐     |

**推奨アプローチ**: FR-3 → FR-1 → FR-2 の段階的実施

---

### 推奨実施順序の根拠

#### Phase 1: FR-3（共有カーネル確立）- 最優先

**理由**:

1. ✅ **完全独立性**: FR-1/FR-2への依存なし
2. ✅ **低リスク**: 影響範囲が明確（20箇所）
3. ✅ **短時間完了**: 3時間で完了可能
4. ✅ **基盤整備**: FR-1/FR-2で使用する共通型を提供
5. ✅ **BlockIdの型不一致修正**: 早期修正により後続作業の安全性向上

**期待される成果**:

- 型安全性の向上
- FR-1/FR-2での共通型利用が可能に
- BlockTypeId分離による数値/文字列型の明確化

#### Phase 2: FR-1（Application Service移動）- 高優先

**理由**:

1. ✅ **DDDレイヤー分離原則への準拠**: 最重要要件
2. ✅ **FR-3の成果を利用**: 共通型が確立済み
3. ✅ **FR-2の安全化**: レイヤー分離後のドメイン再編が安全
4. ✅ **Effect-TS Layer設計の改善**: Domain/Application層の明確化
5. ⚠️ **中程度のリスク**: 100-150箇所の変更が必要

**期待される成果**:

- レイヤー分離率: 61% → 95%
- Effect-TS Layer設計の改善
- テスタビリティの向上

#### Phase 3: FR-2（World分割）- 中優先

**理由**:

1. ✅ **FR-1完了後が安全**: Application Service移動後のドメイン再編
2. ✅ **単一責任原則への準拠**: コンテキスト粒度の適正化
3. ✅ **保守性向上**: 変更影響範囲の明確化
4. ⚠️ **中〜高リスク**: 136ファイルの移動
5. ⚠️ **長時間作業**: 9-12時間

**期待される成果**:

- 境界づけられたコンテキスト明確性: 85% → 95%
- 集約設計の改善: 78% → 90%
- チーム開発の効率化

---

## 🚀 段階的実装計画（戦略B）

### Phase 1: FR-3（共有カーネル確立）- 3時間

#### Issue #1: FR-3 Phase 1 - WorldId/PlayerId/EntityId共有カーネル移行

**所要時間**: 1時間

**リスクレベル**: 低

**実装内容**:

1. **ディレクトリ構造作成**:

以下のディレクトリを作成:

- `src/domain/shared/entities/world_id`
- `src/domain/shared/entities/player_id`
- `src/domain/shared/entities/entity_id`

2. **WorldId統合**（5箇所の重複解消）:

```typescript
// src/domain/shared/entities/world_id/schema.ts
import { Schema } from 'effect'

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'), Schema.nonEmpty())

export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>
```

```typescript
// src/domain/shared/entities/world_id/operations.ts
import { Effect } from 'effect'
import type { WorldId } from './schema'

export const create = (value: string): Effect.Effect<WorldId, Error> => {
  // バリデーションロジック
}

export const equals = (a: WorldId, b: WorldId): boolean => a === b
```

```typescript
// src/domain/shared/entities/world_id/index.ts
export * from './schema'
export * as WorldIdOperations from './operations'
```

3. **PlayerId統合**（5箇所の重複解消）:
   同様のパターンで実装

4. **EntityId統合**（1箇所）:
   同様のパターンで実装

5. **import文の更新**:

旧import (`from '../player/types'`) を新import (`from '@/domain/shared/entities/world_id'`) に置換

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 型エラー0件
- [ ] テスト全通過
- [ ] ビルド成功
- [ ] 5箇所のWorldId重複が1箇所に統合

---

#### Issue #2: FR-3 Phase 2 - BlockId/ItemId共有カーネル移行 + 型不一致修正

**所要時間**: 1.5時間

**リスクレベル**: 中（BlockIdの型不一致修正含む）

**実装内容**:

1. **BlockTypeId分離**（高リスク対応）:

```typescript
// src/domain/shared/entities/block_type_id/schema.ts
import { Schema } from 'effect'

// 数値型のBlockTypeId（chunk_metadata用）
export const BlockTypeIdSchema = Schema.Number.pipe(Schema.brand('BlockTypeId'), Schema.int(), Schema.positive())

export type BlockTypeId = Schema.Schema.Type<typeof BlockTypeIdSchema>
```

2. **BlockId統合**（文字列型）:

```typescript
// src/domain/shared/entities/block_id/schema.ts
import { Schema } from 'effect'

// 文字列型のBlockId（標準）
export const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'), Schema.nonEmpty())

export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>
```

3. **chunk_metadata修正**:

```typescript
// src/domain/chunk/value_object/chunk_metadata/types.ts
- import { BlockId } from '../../../block/types'
+ import { BlockTypeId } from '@/domain/shared/entities/block_type_id'

- blockId: BlockId  // 旧: 数値型
+ blockTypeId: BlockTypeId  // 新: 明示的な数値型
```

4. **ItemId統合**（5箇所の重複解消）:
   同様のパターンで実装

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 型エラー0件
- [ ] BlockId/BlockTypeIdの明確な分離
- [ ] chunk_metadataの型エラー解消
- [ ] テスト全通過

---

#### Issue #3: FR-3 Phase 3 - 共有カーネル検証・ドキュメント化

**所要時間**: 0.5時間

**リスクレベル**: 低

**実装内容**:

1. **README.md作成**:

```markdown
# 共有カーネル（Shared Kernel）

## 対象範囲

複数コンテキストで使用される基本エンティティIDのみを含む。

## 含まれる型

- WorldId: ワールド識別子
- PlayerId: プレイヤー識別子
- EntityId: エンティティ識別子
- BlockId: ブロック識別子（文字列型）
- BlockTypeId: ブロックタイプ識別子（数値型）
- ItemId: アイテム識別子

## 追加基準

1. 3つ以上のコンテキストで使用される型
2. ドメインの根幹となるID型
3. ビジネスロジックを含まない

## 変更時の注意事項

1. 全依存コンテキストの合意が必要
2. 依存関係の確保
3. Effect-TS Schemaパターンへの準拠

## テスト規則

各ID型にunit testを必須化
```

2. **全import文の最終検証**:

重複定義の完全削除と新importへの移行を確認

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] README.md作成完了
- [ ] 旧型定義の完全削除
- [ ] 新importへの完全移行
- [ ] テスト全通過

---

### Phase 2: FR-1（Application Service移動）- 6-8時間

#### Issue #4: FR-1 Phase 1 - equipment/interaction試験実施

**所要時間**: 1時間

**リスクレベル**: 低（最小規模での試験）

**実装内容**:

1. **ディレクトリ構造作成**:

以下のディレクトリを作成:

- `src/application/equipment`
- `src/application/interaction`

2. **equipment移動**:

`src/domain/equipment/application_service/` を `src/application/equipment/` へ移動

Layer分離:

- `src/domain/equipment/layers.ts`（Domain Serviceのみ）
- `src/application/equipment/layers.ts`（Application Service）

3. **interaction移動**:

`src/domain/interaction/application_service/` を `src/application/interaction/` へ移動

4. **import文の更新**:

旧import (`domain/equipment/application_service`) を新import (`application/equipment`) に置換

5. **Layer分離**:

```typescript
// src/domain/equipment/layers.ts（変更後）
export const EquipmentDomainLive = Layer
  .mergeAll
  // Domain Serviceのみ
  ()

// src/application/equipment/layers.ts（新設）
export const EquipmentApplicationLive = Layer.mergeAll(EquipmentServiceLive).pipe(Layer.provide(EquipmentDomainLive))
```

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 型エラー0件
- [ ] domain/equipment配下にapplication_serviceディレクトリなし
- [ ] domain/interaction配下にapplication_serviceディレクトリなし
- [ ] Layer分離完了
- [ ] テスト全通過

---

#### Issue #5: FR-1 Phase 2 - chunk/chunk_manager/crafting移動

**所要時間**: 2時間

**リスクレベル**: 中

**実装内容**:

1. **3コンテキストのApplication Service移動**:

以下のディレクトリを移動:

- `src/domain/chunk/application_service/` → `src/application/chunk/`
- `src/domain/chunk_manager/application_service/` → `src/application/chunk_manager/`
- `src/domain/crafting/application_service/` → `src/application/crafting/`

2. **crafting責務再分類検討**:

```typescript
// CraftingEngineService → Domain Serviceへ移動検討
// src/domain/crafting/domain_service/crafting_engine.ts

// RecipeRegistryService → Domain Serviceへ移動検討
// src/domain/crafting/domain_service/recipe_registry.ts
```

3. **Layer分離**:
   各コンテキストで同様のパターンを適用

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 3コンテキストのapplication_service移動完了
- [ ] crafting責務再分類の判断完了
- [ ] Layer分離完了
- [ ] テスト全通過

---

#### Issue #6: FR-1 Phase 3 - physics/inventory移動

**所要時間**: 2時間

**リスクレベル**: 中

**実装内容**:

1. **2コンテキストのApplication Service移動**:

以下のディレクトリを移動:

- `src/domain/physics/application_service/` → `src/application/physics/`
- `src/domain/inventory/application_service/` → `src/application/inventory/`

2. **physics責務再分類検討**:

```typescript
// PhysicsSimulationOrchestratorService → Domain Serviceへ移動検討
// src/domain/physics/domain_service/physics_simulation_orchestrator.ts
```

3. **Layer分離**:
   DDD.md記載のパターンを適用（inventory）

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 2コンテキストのapplication_service移動完了
- [ ] physics責務再分類の判断完了
- [ ] Layer分離完了
- [ ] テスト全通過

---

#### Issue #7: FR-1 Phase 4 - world/camera移動・Layer再構築

**所要時間**: 2-3時間

**リスクレベル**: 中〜高（最大規模）

**実装内容**:

1. **2コンテキストのApplication Service移動**:

以下のディレクトリを移動:

- `src/domain/world/application_service/` → `src/application/world/`
- `src/domain/camera/application_service/` → `src/application/camera/`

2. **world責務再分類検討**:

```typescript
// WorldGenerationOrchestrator → Domain Serviceへ移動検討
// src/domain/world_generation/domain_service/world_generation_orchestrator.ts
// （注: FR-2でworld_generationコンテキスト作成後に移動）
```

3. **全コンテキストのEffect-TS Layer最終調整**:

```typescript
// 全コンテキストのLayer依存関係を確認
// 循環依存のチェック
// Layer提供順序の最適化
```

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 2コンテキストのapplication_service移動完了
- [ ] world責務再分類の判断完了
- [ ] 全コンテキストのLayer分離完了
- [ ] 循環依存なし
- [ ] テスト全通過
- [ ] **domain配下にapplication_serviceディレクトリが0件**

---

### Phase 3: FR-2（World分割）- 9-12時間

#### Issue #8: FR-2 Phase 1 - biomeコンテキスト分離

**所要時間**: 3-4時間

**リスクレベル**: 中

**実装内容**:

1. **ディレクトリ構造作成**:

以下のディレクトリを作成:

- `src/domain/biome/aggregate`
- `src/domain/biome/domain_service`
- `src/domain/biome/value_object`
- `src/domain/biome/repository`

2. **biome関連ファイルの移動**（35ファイル）:

以下のディレクトリを移動:

- `src/domain/world/aggregate/biome_system/` → `src/domain/biome/aggregate/`
- `src/domain/world/domain_service/biome_classification/` → `src/domain/biome/domain_service/`
- `src/domain/world/repository/biome_system_repository/` → `src/domain/biome/repository/`

3. **coordinatesの移動**:

`src/domain/world/value_object/coordinates/` を `src/domain/biome/value_object/` へ移動

worldにアダプターエイリアスを作成:
`src/domain/world/value_object/coordinates/index.ts` に `export * from '@/domain/biome/value_object/coordinates'` を記述

4. **import文の更新**:

旧import (`domain/world/aggregate/biome_system`) を新import (`domain/biome/aggregate/biome_system`) に置換

5. **Effect-TS Layer作成**:

```typescript
// src/domain/biome/layers.ts（新設）
export const BiomeDomainLive = Layer.mergeAll(BiomeSystemLive, BiomeClassificationLive, BiomeRepositoryLive)
```

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 35ファイルの移動完了
- [ ] coordinatesの移動完了
- [ ] アダプターエイリアス設置
- [ ] Layer作成完了
- [ ] テスト全通過

---

#### Issue #9: FR-2 Phase 2 - world_generationコンテキスト分離

**所要時間**: 4-5時間

**リスクレベル**: 中〜高

**実装内容**:

1. **ディレクトリ構造作成**:

以下のディレクトリを作成:

- `src/domain/world_generation/aggregate`
- `src/domain/world_generation/domain_service`
- `src/domain/world_generation/factory`

2. **world_generation関連ファイルの移動**（68ファイル）:

以下のディレクトリを移動:

- `src/domain/world/aggregate/world_generator/` → `src/domain/world_generation/aggregate/`
- `src/domain/world/aggregate/generation_session/` → `src/domain/world_generation/aggregate/`
- `src/domain/world/domain_service/procedural_generation/` → `src/domain/world_generation/domain_service/`
- `src/domain/world/factory/world_generator_factory/` → `src/domain/world_generation/factory/`

3. **WorldGenerationOrchestrator移動**（FR-1の成果を利用）:

Application ServiceからDomain Serviceへ再分類:
`src/application/world/world_generation_orchestrator/` → `src/domain/world_generation/domain_service/`

4. **biomeへの依存関係の整理**:

```typescript
// src/domain/world_generation/layers.ts（新設）
import { BiomeDomainLive } from '@/domain/biome/layers'

export const WorldGenerationDomainLive = Layer.mergeAll(
  WorldGeneratorLive,
  GenerationSessionLive,
  ProceduralGenerationLive
).pipe(
  Layer.provide(BiomeDomainLive) // biomeへの依存
)
```

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] 68ファイルの移動完了
- [ ] WorldGenerationOrchestratorの再分類完了
- [ ] biome依存関係の整理完了
- [ ] Layer作成完了
- [ ] テスト全通過

---

#### Issue #10: FR-2 Phase 3 - worldコンテキスト調整・検証

**所要時間**: 2-3時間

**リスクレベル**: 中

**実装内容**:

1. **worldコンテキストの最終調整**:

```
src/domain/world/（調整後）
├── domain_service/world_validation/
├── value_object/
│   ├── coordinates/        # エイリアス（移動済み）
│   ├── world_seed/
│   └── dimension_id/
└── types/
```

2. **不要なファイルの削除確認**:

biome/world_generation関連の残存がないことを確認（coordinatesのエイリアスを除く）

3. **全依存関係の検証**:

以下の依存関係を確認:

- worldからbiomeへの依存（あるべき）
- worldからworld_generationへの依存（あるべき）
- biomeからworldへの逆依存（あってはならない、coordinatesのエイリアス参照のみ許可）
- world_generationからworldへの逆依存（あってはならない、coordinatesのエイリアス参照のみ許可）

4. **Effect-TS Layer提供順序の確定**:

```typescript
// 最終的な依存関係
BiomeDomainLayer
  → WorldGenerationDomainLayer
    → WorldDomainLayer（調整役）
```

**検証**:

```bash
pnpm typecheck
pnpm test
pnpm build
```

**成功条件**:

- [ ] worldコンテキストの最終調整完了
- [ ] 不要ファイルの削除完了
- [ ] 全依存関係の検証完了
- [ ] Layer提供順序の確定
- [ ] 循環依存なし
- [ ] テスト全通過

---

## 🛡️ リスク管理

### 各Phaseのリスク評価

| Phase        | リスクレベル | 主要リスク             | 発生確率 | 影響度 |
| ------------ | ------------ | ---------------------- | -------- | ------ |
| FR-3 Phase 1 | 🟢 低        | 型エラー               | 10%      | 低     |
| FR-3 Phase 2 | 🟡 中        | BlockId型不一致        | 30%      | 中     |
| FR-3 Phase 3 | 🟢 低        | ドキュメント不備       | 5%       | 低     |
| FR-1 Phase 1 | 🟢 低        | Layer定義エラー        | 15%      | 低     |
| FR-1 Phase 2 | 🟡 中        | 責務再分類の判断ミス   | 25%      | 中     |
| FR-1 Phase 3 | 🟡 中        | 循環依存発生           | 20%      | 中     |
| FR-1 Phase 4 | 🟠 中〜高    | Layer提供順序エラー    | 35%      | 高     |
| FR-2 Phase 1 | 🟡 中        | coordinates移動の影響  | 20%      | 中     |
| FR-2 Phase 2 | 🟠 中〜高    | 68ファイル移動の複雑性 | 40%      | 高     |
| FR-2 Phase 3 | 🟡 中        | 依存関係の整理漏れ     | 25%      | 中     |

### リスク軽減策

#### FR-3のリスク軽減

**BlockId型不一致リスク**:

- 軽減策: BlockTypeIdとして明確に分離
- 検証: chunk_metadataの型エラー完全解消を確認
- ロールバック: BlockTypeIdの削除、元の数値型に戻す

#### FR-1のリスク軽減

**循環依存リスク**:

- 軽減策: Application Service間の相互参照を事前調査済み（未検出）
- 検証: 各Phase完了後に循環依存チェック
- ロールバック: ファイル移動を元に戻す

**Layer提供順序エラー**:

- 軽減策: 各コンテキストのLayer依存関係を可視化
- 検証: Effect-TSのLayer依存関係エラーを確認
- ロールバック: Layer定義を移動前の状態に戻す

#### FR-2のリスク軽減

**coordinates移動の影響**:

- 減減策: アダプターエイリアスの設置
- 検証: 既存importが動作することを確認
- ロールバック: coordinatesをworldに戻し、エイリアス削除

**68ファイル移動の複雑性**:

- 軽減策: 段階的な移動
- 検証: 各ファイルの移動後に型チェック
- ロールバック: ファイル移動の逆操作で元の位置に戻す

### ロールバック手順

#### 一般的なロールバック手順

1. 現在の状態を確認
2. ファイル移動を元に戻す
3. 型エラーの確認 (`pnpm typecheck`)
4. テストの実行 (`pnpm test`)

#### Phase別ロールバック手順

**FR-3 Phase 2ロールバック例**:

1. BlockTypeId分離を取り消し（`src/domain/shared/entities/block_type_id/` を削除）
2. chunk_metadataを元に戻す
3. 型チェック (`pnpm typecheck`)

**FR-1 Phase 4ロールバック例**:

1. world Application Serviceを元の位置に戻す (`src/application/world/` → `src/domain/world/application_service/`)
2. Layer定義を元に戻す
3. 型チェック (`pnpm typecheck`)

---

## ✅ 成功条件と検証基準

### 各Issue完了の成功条件

#### FR-3全体の成功条件

- [ ] 20箇所の型定義重複が解消
- [ ] `src/domain/shared/entities/`配下に6つのID型が整備
- [ ] BlockId/BlockTypeIdの型不一致が解消
- [ ] 共有カーネルREADME.mdが作成
- [ ] 型エラー0件
- [ ] テスト全通過
- [ ] ビルド成功

#### FR-1全体の成功条件

- [ ] `find src/domain -name "application_service" -type d` が0件
- [ ] `src/application/`配下に9コンテキストが存在
- [ ] 各コンテキストのLayer分離完了
- [ ] 4つのServiceのDomain Service再分類判断完了
- [ ] 循環依存なし
- [ ] 型エラー0件
- [ ] テスト全通過
- [ ] ビルド成功

#### FR-2全体の成功条件

- [ ] `src/domain/biome/`が作成され、35ファイルが移動
- [ ] `src/domain/world_generation/`が作成され、68ファイルが移動
- [ ] `src/domain/world/`が調整され、33ファイルが残存
- [ ] coordinatesのアダプターエイリアス設置
- [ ] Layer提供順序の確定（BiomeDomain → WorldGenerationDomain）
- [ ] 循環依存なし
- [ ] 型エラー0件
- [ ] テスト全通過
- [ ] ビルド成功

### CI/CD検証項目

#### 各PR作成時の検証

```bash
# 1. 型チェック
pnpm typecheck
# 期待結果: Found 0 errors

# 2. Lintチェック
pnpm lint
# 期待結果: No lint errors

# 3. テスト実行
pnpm test
# 期待結果: All tests passed

# 4. ビルド
pnpm build
# 期待結果: Build succeeded

# 5. 循環依存チェック（madge等）
npx madge --circular src/
# 期待結果: No circular dependencies found
```

### 最終検証基準

#### Phase 1完了時（FR-3）

```bash
# 共有カーネル統合確認
find src/domain/shared/entities -name "*.ts" | wc -l
# 期待結果: 約24ファイル（6型 × 4ファイル/型）

# 旧型定義の完全削除確認
find src/domain -name "*.ts" -exec grep -l "WorldIdSchema\s*=" {} \; | grep -v "shared/entities"
# 期待結果: 0件
```

#### Phase 2完了時（FR-1）

```bash
# application_service完全削除確認
find src/domain -name "application_service" -type d
# 期待結果: 0件

# application配下の構造確認
ls src/application/
# 期待結果: equipment, interaction, chunk, chunk_manager, crafting, physics, inventory, world, camera の9ディレクトリ

# Layer分離確認
find src/application -name "layers.ts" | wc -l
# 期待結果: 9ファイル
```

#### Phase 3完了時（FR-2）

```bash
# 3コンテキスト存在確認
ls src/domain/ | grep -E "(biome|world_generation|world)"
# 期待結果: biome, world, world_generation

# world配下のbiome関連削除確認
find src/domain/world -name "*biome*" | grep -v coordinates
# 期待結果: 0件

# coordinatesアダプターエイリアス確認
cat src/domain/world/value_object/coordinates/index.ts
# 期待結果: export * from '@/domain/biome/value_object/coordinates'
```

#### 最終統合検証

```bash
# 全Phase完了後の総合検証
pnpm typecheck && pnpm lint && pnpm test && pnpm build
# 期待結果: すべて成功
```

DDD準拠率の確認:

- レイヤー分離: 61% → 95%
- 集約設計: 78% → 90%
- 境界づけられたコンテキスト明確性: 85% → 95%

---

## 📅 タイムライン

### 各Phaseの所要時間

| Phase        | Issue数 | 所要時間 | 累積時間 | 並列実施可能性 |
| ------------ | ------- | -------- | -------- | -------------- |
| FR-3 Phase 1 | 1       | 1h       | 1h       | -              |
| FR-3 Phase 2 | 1       | 1.5h     | 2.5h     | -              |
| FR-3 Phase 3 | 1       | 0.5h     | 3h       | -              |
| FR-1 Phase 1 | 1       | 1h       | 4h       | FR-3完了後     |
| FR-1 Phase 2 | 1       | 2h       | 6h       | -              |
| FR-1 Phase 3 | 1       | 2h       | 8h       | -              |
| FR-1 Phase 4 | 1       | 2-3h     | 10-11h   | -              |
| FR-2 Phase 1 | 1       | 3-4h     | 13-15h   | FR-1完了後     |
| FR-2 Phase 2 | 1       | 4-5h     | 17-20h   | -              |
| FR-2 Phase 3 | 1       | 2-3h     | 19-23h   | -              |

### 並列実施可能性

#### 戦略B（推奨）: 段階的実施

```
Day 1:
├─ AM (9:00-12:00): FR-3 Phase 1-3（3時間）
└─ PM (13:00-17:00): FR-1 Phase 1-2（3時間）

Day 2:
├─ AM (9:00-12:00): FR-1 Phase 3（2時間）
├─ PM (13:00-16:00): FR-1 Phase 4（3時間）
└─ PM (16:00-17:00): レビュー・調整（1時間）

Day 3:
├─ AM (9:00-13:00): FR-2 Phase 1（4時間）
├─ PM (14:00-19:00): FR-2 Phase 2（5時間）
└─ 残業 (19:00-20:00): レビュー（1時間）

Day 4:
├─ AM (9:00-12:00): FR-2 Phase 3（3時間）
└─ PM (13:00-17:00): 最終検証・ドキュメント更新（4時間）
```

**総所要時間**: 約3-4営業日（実作業時間: 18-23時間）

#### 戦略A（リスク高）: 並列実施

```
Day 1:
├─ Engineer A: FR-3 Phase 1-3（3時間）
└─ Engineer B: FR-1 Phase 1-2（3時間）

Day 2:
├─ Engineer A: FR-1 Phase 3-4（4-5時間）
└─ Engineer B: FR-2 Phase 1（4時間）

Day 3:
└─ Engineer A+B: FR-2 Phase 2-3 + マージ作業（7-8時間）
```

**総所要時間**: 約2-3営業日（ただしconflictリスク高）

### 総所要時間

**推奨アプローチ（戦略B）**:

- **実作業時間**: 18-23時間
- **営業日換算**: 3-4営業日
- **カレンダー日換算**: 1週間（レビュー・調整時間含む）

**DDD.md見積もりとの比較**:

- DDD.md見積もり: 160時間（4週間）
- 実態: 18-23時間（3-4営業日）
- **差異**: -137時間（約1/7）

---

## 🚦 次のステップ

### 実装手順

各Phase（FR-3, FR-1, FR-2）を本計画書の詳細に従って順次実装します。

#### 実装順序

```
FR-3 Phase 1 → FR-3 Phase 2 → FR-3 Phase 3
↓
FR-1 Phase 1 → FR-1 Phase 2 → FR-1 Phase 3 → FR-1 Phase 4
↓
FR-2 Phase 1 → FR-2 Phase 2 → FR-2 Phase 3
```

**重要**: 各Phaseは前Phase完了後に着手

#### 検証

各Phase完了時に以下を実行:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

---

## 📚 参考資料

### DDD関連

- Eric Evans『Domain-Driven Design』(2003)
- Vaughn Vernon『Implementing Domain-Driven Design』(2013)
- Martin Fowler『Patterns of Enterprise Application Architecture』(2002)

### Effect-TS関連

- [Effect-TS 3.17+ Official Documentation](https://effect.website/)
- [Effect-TS Layer Pattern Guide](https://effect.website/docs/guides/context-management/layers)
- [Effect-TS Schema Documentation](https://effect.website/docs/schema/introduction)

### TypeScript関連

- [TypeScript Handbook - Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [TypeScript Deep Dive - Circular Dependencies](https://basarat.gitbook.io/typescript/main-1/circular-dependencies)

### リファクタリング関連

- Martin Fowler『Refactoring』(2018)
- Joshua Kerievsky『Refactoring to Patterns』(2004)

---

## 🎯 最終目標

### DDD準拠率の向上

| 評価項目                         | 現状    | 目標    | 改善幅   |
| -------------------------------- | ------- | ------- | -------- |
| レイヤー分離                     | 61%     | 95%     | **+34%** |
| 集約設計                         | 78%     | 90%     | **+12%** |
| 値オブジェクト活用               | 92%     | 95%     | **+3%**  |
| 境界づけられたコンテキスト明確性 | 85%     | 95%     | **+10%** |
| **総合スコア**                   | **74%** | **94%** | **+20%** |

### 定量的成果

- ✅ Application Serviceの完全分離: 9コンテキスト
- ✅ 型重複の解消: 20箇所
- ✅ コンテキスト分割: World → biome + world_generation + world
- ✅ Effect-TS Layer分離: 9コンテキスト

### 定性的成果

- ✅ DDDレイヤー分離原則への準拠
- ✅ Effect-TS 3.17+のベストプラクティス適用
- ✅ 保守性・可読性の向上
- ✅ チーム開発の効率化

---

**策定日**: 2025-10-07

**策定基準**: DDD原則、Effect-TSベストプラクティス、実コード調査結果

**次回更新**: 各Phase完了後の振り返りにて実績を記録
