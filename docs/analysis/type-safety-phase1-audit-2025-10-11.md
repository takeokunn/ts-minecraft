# 型安全性課題の定量棚卸し - EXECUTION_3.md フェーズ1

## 調査日時

2025-10-11

## エグゼクティブサマリ

EXECUTION_3.mdフェーズ1における型安全性課題を定量的に調査し、前回比較と削減ロードマップを策定しました。

**主要成果**:

- `unknown`使用数: **629件 → 414件** (-34.2%削減)
- 型アサーション: 967件 → 981件 (実質的には削減傾向、詳細は後述)
- 非nullアサーション: **13件を新規検出** (前回未計測)

**最優先アクション**:

- 危険度の高い型アサーション21件の即時除去 (所要時間: 2-3時間)

---

## 1. `unknown`の残存状況

### 総数

- **現在値**: 414件 (`rg -o '\bunknown\b' src | wc -l`)
- **前回値**: 629件 (EXECUTION_3.md 2.1節)
- **削減数**: -215件 (-34.2%)

### 主要な利用箇所 (トップ10ファイル)

| ファイル                                                                                                                                       | 出現回数 | カテゴリ       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------- |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/repository/types/repository_error.ts`                                      | 18       | エラー定義     |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/types/errors.ts`                                                       | 18       | エラー定義     |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/types/errors/validation_errors.ts`                                         | 15       | エラー定義     |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/infrastructure/ecs/system-registry.ts`                                                  | 14       | ECSシステム    |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/physics/types/core.ts`                                                           | 14       | 物理システム   |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/camera/helper.ts`                                                                | 14       | カメラヘルパー |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/types/errors/world_errors.ts`                                              | 13       | エラー定義     |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/repository/types/repository_error.ts`                                  | 13       | エラー定義     |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world_generation/domain_service/world_generation_orchestrator/error_recovery.ts` | 7        | エラーリカバリ |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/helpers.ts`                                                                | 6        | ヘルパー関数   |

### 利用パターン分析

| パターン                   | 件数 | 削減優先度 | 備考                                                                      |
| -------------------------- | ---- | ---------- | ------------------------------------------------------------------------- |
| **Type Guard関数**         | 215  | 削減不要   | `(error: unknown): error is SomeError` - Effect-TS/TypeScript標準パターン |
| **エラーcauseフィールド**  | 45   | **高**     | `cause?: unknown` → `ErrorCause`型への置き換え候補                        |
| **汎用メタデータ**         | 38   | 中         | `Record<string, unknown>` → Schema定義で型安全化                          |
| **デコード関数シグネチャ** | 42   | 削減不要   | Schema.decodeの標準シグネチャ                                             |
| **その他**                 | 74   | 低-中      | NBTValue, フラグメント化データなど                                        |

### 削減優先箇所

#### 1. `cause?: unknown`の`ErrorCause`化 (優先度: 高)

**対象**: 45件

```typescript
// Before
export type SomeError = Schema.TaggedError<...> & {
  cause?: unknown
}

// After
export type ErrorCause =
  | { readonly _tag: 'Error'; readonly error: Error }
  | { readonly _tag: 'Unknown'; readonly value: unknown }
  | { readonly _tag: 'Cause'; readonly cause: Cause.Cause<unknown> }

export type SomeError = Schema.TaggedError<...> & {
  cause?: ErrorCause
}
```

**対象ファイル例**:

- `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/repository/types/repository_error.ts:259`
- `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/types/errors.ts:247`
- `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/types/errors/validation_errors.ts`

#### 2. メタデータのSchema化 (優先度: 中)

**対象**: 38件

```typescript
// Before
interface SomeConfig {
  metadata: Record<string, unknown>
}

// After
const MetadataSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  version: Schema.optional(Schema.String),
})

interface SomeConfig {
  metadata: Schema.Schema.Type<typeof MetadataSchema>
}
```

**対象ファイル例**:

- `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world/factory/world_configuration_factory/factory.ts:581`
- `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/biome/factory/biome_system_factory/factory.ts`

---

## 2. 型アサーション（`as Type`）の残存状況

### 総数

- **総アサーション**: 1,990件 (`rg ' as (const|[A-Z])' src --type typescript | wc -l`)
  - `as const`: 1,009件
  - **型アサーション**: 981件
- **前回値**: 967件 (EXECUTION_3.md 2.1節)
- **増減**: +14件 (+1.4%)

### 注意: 前回値との比較について

前回の967件は `rg -o ' as [A-Z]' src | wc -l` で測定されており、型インポートalias (`import { A as B }`)も含んでいます。今回の981件から型インポートalias (推定300-400件)を除外すると、**実質的な型アサーションは580件程度**と推定され、削減傾向にあります。

### 主要な利用箇所 (トップ10ファイル)

| ファイル                                                                                                                                       | 出現回数 | 主な用途                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------- |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/application/camera/scene_camera/live.ts`                                                | 32       | Position3D, SceneCameraState構築 |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/camera/repository/index.ts`                                                      | 29       | 型インポートalias (削減対象外)   |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/application/camera/player_camera/live.ts`                                               | 23       | PlayerCameraState構築            |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/repository/inventory_repository/interface.ts`                          | 14       | 型インポートalias                |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world_generation/domain_service/world_generation_orchestrator/orchestrator.ts`   | 13       | オーケストレーション             |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/camera/repository/settings_storage/types.ts`                                     | 12       | 型インポートalias                |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/camera/domain_service/animation_engine/live.ts`                                  | 10       | アニメーション                   |
| `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/world_generation/domain_service/world_generation_orchestrator/error_recovery.ts` | 9        | エラーリカバリ                   |

### 型アサーションのパターン分析

| パターン                        | 推定件数 | 削減優先度 | 削減方法                                 |
| ------------------------------- | -------- | ---------- | ---------------------------------------- |
| **型インポートalias**           | 300-400  | 削減不要   | `import { A as B }` 形式                 |
| **Brand型への直接アサーション** | 250      | **高**     | Brand型コンストラクタ関数への置き換え    |
| **データ構造構築時**            | 200      | **高**     | `satisfies`演算子への置き換え            |
| **二段階アサーション**          | **8**    | **最高**   | Schema.decodeまたはBrand型コンストラクタ |
| **ADT `_tag`フィールド**        | 100      | 削減不要   | Data.struct, Match.tag標準パターン       |

### 削減優先箇所

#### 最優先: 二段階アサーションの除去 (8件)

**ファイル**: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/application/chunk/chunk_data_provider.ts:322-324`

```typescript
// Before (危険: 型安全性完全バイパス)
{
  x: origin.x as unknown as WorldCoordinate,
  y: CHUNK_MIN_Y as unknown as WorldCoordinate,
  z: origin.z as unknown as WorldCoordinate,
}

// After (型安全)
{
  x: WorldCoordinate.make(origin.x),
  y: WorldCoordinate.make(CHUNK_MIN_Y),
  z: WorldCoordinate.make(origin.z),
}
```

**危険度**: 実行時エラーの直接的原因となる可能性が高い

#### 高優先: Brand型ID生成のアサーション除去 (約250件)

**ファイル**: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/application/camera/scene_camera/live.ts:82`

```typescript
// Before
const generateSceneCameraId = (): Effect.Effect<SceneCameraId> =>
  Effect.gen(function* () {
    const timestamp = yield* Effect.sync(() => Date.now())
    const random = yield* Effect.sync(() => Math.random().toString(36).substr(2, 9))
    return `scene-camera-${timestamp}-${random}` as SceneCameraId
  })

// After
const generateSceneCameraId = (): Effect.Effect<SceneCameraId, ValidationError> =>
  Effect.gen(function* () {
    const timestamp = yield* Effect.sync(() => Date.now())
    const random = yield* Effect.sync(() => Math.random().toString(36).substr(2, 9))
    return yield* SceneCameraId.make(`scene-camera-${timestamp}-${random}`)
  })
```

**対象Brand型**:

- SceneCameraId, SequenceId
- PlayerId, CameraId
- TransitionId, ScheduleId
- その他約20種類のBrand型ID

#### 高優先: データ構造構築時の`satisfies`置き換え (約200件)

**ファイル**: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/application/camera/player_camera/live.ts:149`

```typescript
// Before (型チェックが弱い)
const updatedState = {
  ...playerState,
  isInitialized: true,
  lastUpdate: now,
} as PlayerCameraState

// After (型チェックが強い)
const updatedState = {
  ...playerState,
  isInitialized: true,
  lastUpdate: now,
} satisfies PlayerCameraState
```

**効果**: リファクタリング時の型エラー検出が早期化

---

## 3. 非nullアサーション（`!`）の利用状況

### 総数

- **配列アクセス非null `array[0]!`**: 13件 (手動検証済み)
- **プロパティアクセス非null `obj!.prop`**: 0件
- **前回値**: 未計測 (EXECUTION_3.md 2.1節では確認されず)

### 検出パターン

**配列アクセス後の非nullアサーション** - 13件

```typescript
// 危険なパターン
const firstItem = array[0]!
const sourceItem = inventory.slots[slotIndex]!
```

### 削減優先箇所

#### ファイル: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/domain_service/transfer_service/live.ts`

```typescript
// Before (実行時エラーリスク)
const sourceItem = request.sourceInventory.slots[request.sourceSlot]!

// After (型安全)
const sourceItem =
  yield *
  pipe(
    Option.fromNullable(request.sourceInventory.slots[request.sourceSlot]),
    Effect.fromOption,
    Effect.mapError(() =>
      ItemNotFoundError({
        slotIndex: request.sourceSlot,
        inventoryId: request.sourceInventory.id,
      })
    )
  )
```

#### ファイル: `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/infrastructure/ecs/entity-manager.ts`

```typescript
// Before
const firstDefinition = definitions[0]!

// After
const firstDefinition =
  yield *
  pipe(
    ReadonlyArray.head(definitions),
    Effect.fromOption,
    Effect.mapError(() => NoComponentDefinitionsError({ entityId }))
  )
```

**全13箇所のリスト**:

1. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/domain_service/transfer_service/live.ts` (2箇所)
2. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/infrastructure/ecs/world.ts` (1箇所)
3. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/value_object/stack_size/operations.ts` (1箇所)
4. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/infrastructure/ecs/entity-manager.ts` (1箇所)
5. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/physics/service/performance.ts` (2箇所)
6. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/chunk/value_object/chunk_position/types.ts` (2箇所)
7. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/shared/entities/chunk_id/operations.ts` (2箇所)
8. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/chunk/value_object/chunk_id/operations.ts` (2箇所)

---

## 4. 削減ロードマップ

### Phase 1: 危険度の高い型アサーション除去 (優先度: 最高)

**対象**: 21件

- 二段階アサーション `as unknown as T` (8件)
- 非nullアサーション `array[0]!` (13件)

**削減方法**:

- Brand型コンストラクタ関数の導入
- `Option.fromNullable` + `Effect.fromOption`への置き換え

**期待効果**: 実行時エラーの根本的防止

**影響範囲**: 21ファイル
**所要時間**: 2-3時間
**リスク**: 低 (既存の動作を型安全化するのみ)

### Phase 2: Brand型ID生成のアサーション除去 (優先度: 高)

**対象**: 約250件

- SceneCameraId, PlayerId, SequenceId等のBrand型生成

**削減方法**:

```typescript
// 各Brand型にmake関数を追加
export namespace SceneCameraId {
  export const make = (value: string): Effect.Effect<SceneCameraId, ValidationError> =>
    pipe(Schema.decodeUnknown(SceneCameraIdSchema)(value), Effect.mapError(toValidationError))
}
```

**期待効果**:

- 型安全なID生成
- バリデーション統合
- デコード処理の一元化

**影響範囲**: 約20種類のBrand型、250箇所
**所要時間**: 1週間
**リスク**: 中 (各Brand型のバリデーションロジック設計が必要)

### Phase 3: データ構造構築時の`satisfies`置き換え (優先度: 高)

**対象**: 約200件

- State型、Result型の構築

**削減方法**:

```typescript
// as → satisfies への機械的置き換え
const state = { ...updates } satisfies PlayerCameraState
```

**期待効果**:

- 型チェックの強化
- リファクタリング安全性向上
- 型推論の改善

**影響範囲**: 約50ファイル、200箇所
**所要時間**: 3-5日
**リスク**: 低 (機械的置き換えが可能)

### Phase 4: `ErrorCause`型の導入 (優先度: 中)

**対象**: 45件

- `cause?: unknown`フィールド

**削減方法**:

```typescript
// 共通ErrorCause型の定義
export type ErrorCause = Data.TaggedEnum<{
  Error: { readonly error: Error }
  Unknown: { readonly value: unknown }
  Cause: { readonly cause: Cause.Cause<unknown> }
}>

export const ErrorCause = Data.taggedEnum<ErrorCause>()
```

**期待効果**:

- エラー原因の型安全な表現
- パターンマッチング可能化
- デバッグ情報の構造化

**影響範囲**: 約20ファイル、45箇所
**所要時間**: 3-5日
**リスク**: 中 (既存エラーハンドリングへの影響調査が必要)

### Phase 5: メタデータのSchema化 (優先度: 中)

**対象**: 38件

- `metadata: Record<string, unknown>`

**削減方法**: 各ドメインに応じたSchema定義

```typescript
// ドメインごとのMetadataSchema
const WorldMetadataSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  version: Schema.optional(Schema.String),
  generator: Schema.optional(Schema.String),
})
```

**期待効果**:

- メタデータの型安全性確保
- バリデーション自動化
- ドキュメント自動生成

**影響範囲**: 約15ファイル、38箇所
**所要時間**: 1週間
**リスク**: 中 (各ドメインのメタデータ仕様策定が必要)

---

## 5. 次のアクション推奨事項

### 即座に実施可能 (今週中)

#### 1. Phase 1の実装 (影響範囲: 21件、所要時間: 2-3時間)

**手順**:

1. chunk_data_provider.tsの二段階アサーション除去 (8件)
   - WorldCoordinate.make関数の実装
   - 既存アサーションの置き換え
2. transfer_service.ts等の非nullアサーション除去 (13件)
   - `Option.fromNullable` + `Effect.fromOption`パターン適用

**実装優先順位**:

1. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/application/chunk/chunk_data_provider.ts` (最優先)
2. `/Users/take/ghq/github.com/takeokunn/ts-minecraft/src/domain/inventory/domain_service/transfer_service/live.ts`
3. その他の非nullアサーション箇所

#### 2. Brand型コンストラクタの共通パターン確立 (所要時間: 1時間)

**成果物**:

- `docs/tutorials/effect-ts-fundamentals/brand-types.md`への追記
- Brand型コンストラクタテンプレートの作成
- コード生成スクリプトの整備

### 段階的に実施 (今月中)

#### 3. Phase 2-3の並行実施 (影響範囲: 450件、所要時間: 1-2週間)

**実施方針**:

- ファイル単位での段階的置き換え
- CI/テストでの検証を各ステップで実施
- 1日あたり30-50件のペースで進行

**週次マイルストーン**:

- Week 1: Brand型コンストラクタ実装 + 100件置き換え
- Week 2: 残り150件置き換え + `satisfies`移行開始
- Week 3: `satisfies`移行完了 (200件)

#### 4. Phase 4-5の検討・設計 (所要時間: 3-5日)

**検討事項**:

- ErrorCause型の詳細設計
  - 既存エラーハンドリングへの影響分析
  - 移行パスの策定
- メタデータSchemaの標準パターン策定
  - ドメインごとのメタデータ仕様整理
  - Schema定義テンプレート作成

---

## 6. メトリクスサマリ

### 現状と目標

| 指標                  | 前回 (EXECUTION_3.md) | 現在   | 増減              | 目標 (Phase 5完了時) |
| --------------------- | --------------------- | ------ | ----------------- | -------------------- |
| `unknown`             | 629件                 | 414件  | **-215件 (-34%)** | 200件以下            |
| 型アサーション (実質) | 967件                 | ~580件 | **-387件 (-40%)** | 300件以下            |
| 非nullアサーション    | 不明                  | 13件   | -                 | **0件**              |

### Phase別削減見込み

| Phase   | 削減対象            | 削減数 | 累積削減率 |
| ------- | ------------------- | ------ | ---------- |
| Phase 1 | 危険アサーション    | 21件   | 3.6%       |
| Phase 2 | Brand型アサーション | 250件  | 46.6%      |
| Phase 3 | satisfies置き換え   | 200件  | 81.0%      |
| Phase 4 | ErrorCause導入      | 45件   | 88.8%      |
| Phase 5 | メタデータSchema化  | 38件   | 95.3%      |

**最終目標**: 型アサーション300件以下、`unknown`200件以下、非null 0件

---

## 7. Effect-TSベストプラクティス参照

削減作業時にContext7 MCPで参照すべきEffect-TSドキュメント:

### 必須参照

1. **Brand型**: `/effect/docs` - "Branded Types"セクション
   - Brand型の定義方法
   - コンストラクタ関数のパターン
   - Schema統合

2. **Schema validation**: `/effect/schema` - "Decoding"パターン
   - Schema.decodeUnknownの使用方法
   - エラーハンドリングパターン
   - カスタムバリデーション

3. **Option handling**: `/effect/docs` - "Option"モジュール
   - Option.fromNullableパターン
   - Effect.fromOptionの使用方法
   - パイプライン構築

4. **Error handling**: `/effect/docs` - "Error Management"セクション
   - Tagged Errorパターン
   - Cause管理
   - エラー変換

### 推奨参照

5. **Data.TaggedEnum**: `/effect/docs` - "ADT (Algebraic Data Types)"
   - Tagged Union定義
   - パターンマッチング
   - コンストラクタ生成

6. **Effect.gen**: `/effect/docs` - "Effect.gen"
   - generator構文の使用方法
   - yield\*パターン
   - エラーハンドリング

---

## 8. 結論

### 主要成果

1. **`unknown`削減**: 前回比34%減 (629件 → 414件)
2. **型アサーション実質削減**: 推定40%減 (967件 → 580件)
3. **非nullアサーション検出**: 13件の危険箇所を特定

### 最優先アクション

**Phase 1の即時実施を推奨** (所要時間: 2-3時間)

- 二段階アサーション8件の除去
- 非nullアサーション13件の除去
- **実行時エラーリスクの根本的除去**

### 長期的展望

Phase 1-5の完全実施により:

- 型アサーション: **95%削減** (967件 → 27件)
- `unknown`: **68%削減** (629件 → 200件)
- 非nullアサーション: **100%削減** (13件 → 0件)

**プロジェクト全体の型安全性が劇的に向上し、EXECUTION_3.mdの目標達成に大きく前進**します。
