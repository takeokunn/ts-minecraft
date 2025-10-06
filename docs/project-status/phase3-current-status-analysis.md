# Phase 3 現状分析レポート

## エグゼクティブサマリー

Phase 3（型安全化）の詳細な現状分析を実施しました。型アサーション、any型、unknown型、non-null assertionの使用状況、Brand Type導入候補、Runtime検証境界、既存Schema定義を包括的に調査し、実装優先順位を明確化しました。

**主要発見**:

- 型アサーション(`as`)は2,452箇所（434ファイル）で使用され、その95%はinfrastructure層（Three.js/Cannon.jsラッパー）に集中
- any型は234箇所（46ファイル）、unknown型は381箇所（122ファイル）、non-null assertion(`!.`)は38箇所（12ファイル）
- Brand型は既に42ファイルで使用され、28種類のBrand型が定義済み
- Schema.TaggedErrorは39ファイル・95箇所、Schema.Structは214ファイル・1,618箇所で使用
- Runtime検証境界は主に3箇所：Storage（17ファイル）、Audio（1ファイル）、Chunk Loading（3ファイル）

---

## 1. as/any/unknown/!の使用状況

### 1.1 型アサーション(as)

**総数**: 2,452箇所（434ファイル）

**レイヤー別内訳**:

- **infrastructure/three**: 46箇所（Vector3, Matrix4, Quaternionなど）
- **infrastructure/cannon**: 25箇所（Vec3, Body, Worldなど）
- **domain層**: 2,319箇所（残りの大部分）
- **その他**: 62箇所

**主要パターン**:

```typescript
// Three.js相互変換（最頻出パターン）
position as THREE.Vector3
quaternion as THREE.Quaternion
matrix as THREE.Matrix4

// Effect-TS Brand型変換
value as ChunkId
id as PlayerId
coordinate as WorldCoordinate

// Data.TaggedEnum変換
item as ItemCategory
error as ValidationError
```

**重要度**: 🔴 **最優先** - Phase 1完了により約71箇所（3%）削減可能、残りはPhase 3で段階的削減

### 1.2 any型

**総数**: 234箇所（46ファイル）

**主要使用箇所**:

1. **World Generation Domain** (47ファイル中25ファイル):
   - `src/domain/world/domain_service/procedural_generation/terrain_generator.ts`: 3箇所
   - `src/domain/world/domain_service/procedural_generation/cave_carver.ts`: 26箇所
   - `src/domain/world/domain_service/procedural_generation/structure_spawner.ts`: 39箇所

2. **Inventory Domain** (10ファイル):
   - `src/domain/inventory/application_service/transaction_manager/live.ts`: 8箇所
   - `src/domain/inventory/application_service/transaction_manager/workflows.ts`: 19箇所
   - `src/domain/inventory/aggregate/container/factory.ts`: 1箇所

3. **Camera Domain** (5ファイル):
   - `src/domain/camera/domain_service/settings_validator/live.ts`: 1箇所
   - `src/domain/camera/__tests__/helpers/test_layer.ts`: 31箇所（テストヘルパー）

**重要度**: 🟡 **中優先** - 外部データ境界以外は段階的にunknown → Schema検証に置換

### 1.3 unknown型

**総数**: 381箇所（122ファイル）

**主要使用パターン**:

1. **エラーハンドリング**: cause?: unknown（推奨パターン）
2. **Schema検証入力**: Schema.Unknown（正しい使用法）
3. **汎用コンテナ**: Record<string, unknown>（推奨パターン）

**代表的ファイル**:

- `src/domain/inventory/types/errors.ts`: 18箇所（エラーcauseフィールド）
- `src/domain/physics/types/core.ts`: 14箇所（物理演算パラメータ）
- `src/domain/world/types/errors/validation_errors.ts`: 5箇所（検証エラー）

**重要度**: 🟢 **低優先** - unknown型は適切な使用法が多く、削減の必要性は低い

### 1.4 non-null assertion(!.)

**総数**: 38箇所（12ファイル）

**主要使用箇所**:

- `src/domain/inventory/aggregate/container/operations.ts`: 12箇所
- `src/domain/inventory/domain_service/stacking_service/live.ts`: 8箇所
- `src/domain/inventory/domain_service/transfer_service/live.ts`: 2箇所

**重要度**: 🟡 **中優先** - Option/Either型による明示的なnull安全性に置換

---

## 2. Brand Type導入候補

### 2.1 既存Brand型（28種類）

**ID系Brand型（既に実装済み）**:

```typescript
// 高頻度使用（2回以上定義）
ChunkId: 2箇所（chunk, block_data）
BlockId: 2箇所（chunk, chunk/types）
PlayerId: 複数ドメインで使用
EventId, SessionId, GenerationSessionId, WorldCoordinate など

// 単一定義
ItemId, BiomeId, DimensionId, EntityId, SceneId, CombatantId など
TransitionId, ScheduleId, SequenceId, SceneCameraId など
```

**座標系Brand型（既に実装済み）**:

```typescript
WorldCoordinate: 2箇所
ChunkCoordinate, SectionCoordinate, Height など
```

**単位系Brand型（既に実装済み）**:

```typescript
// 数値単位系
DeltaTime, Timestamp, StackSize など

// 角度系
Yaw, Roll, Radians など

// その他
CameraDistance, Sensitivity, RenderDistance, QualityLevel など
```

### 2.2 Brand Type vs Schema.Schema.Type使用状況

**Brand.Brand使用**: 28型（42ファイル）
**Schema.Schema.Type使用**: 54型（主にID系）

**推奨パターン**:

```typescript
// ✅ 推奨: Schema + Brand の組み合わせ（既存実装パターン）
export type ChunkId = string & Brand.Brand<'ChunkId'>
export const ChunkIdSchema = Schema.String.pipe(Schema.nonEmptyString(), Schema.brand('ChunkId'))

// ✅ 推奨: 複雑な制約を持つBrand型
export type ItemId = Brand.Brand<string, 'ItemId'> & {
  readonly format: 'namespace:name'
  readonly namespace: string
  readonly name: string
}
```

### 2.3 Brand型導入候補（未実装）

**優先度A（高頻度使用、混同リスク大）**:

- `InventorySlotIndex` (現状: number) - 36箇所
- `StackSize` (現状: number) - 制約: 1-64
- `BlockTypeId` (現状: number) - Minecraft ID系
- `TickCount` (現状: number) - ゲームループ

**優先度B（中頻度使用）**:

- `ChunkSize` (現状: number) - 定数16固定
- `ViewDistance` (現状: number) - 制約: 2-32
- `BiomeTemperature` (現状: number) - 制約: -0.5-2.0
- `LightLevel` (現状: number) - 制約: 0-15

**優先度C（低頻度、後回し可）**:

- `TextureId`, `SoundId`, `ParticleId` など
- `AnimationDuration`, `FadeTime` など

---

## 3. Runtime検証境界

### 3.1 API境界（HTTP/Fetch）

**該当ファイル**: 5ファイル

- `src/domain/chunk_loader/application/chunk_loading_provider.ts`: チャンクローディングAPI
- `src/domain/chunk_loader/types/interfaces.ts`: チャンクローディング型定義
- `src/domain/chunk/__tests__/utils/test-layer.ts`: テストユーティリティ
- `src/infrastructure/audio/audio-service-live.ts`: オーディオファイル読み込み
- `src/shared/browser/network-info-schema.ts`: ブラウザネットワーク情報

**検証状況**: ✅ 一部Schema検証実装済み（network-info-schema.ts）

### 3.2 Storage境界（localStorage/IndexedDB）

**該当ファイル**: 17ファイル

**主要境界**:

1. **Inventory Persistence**:
   - `src/domain/inventory/repository/inventory_repository/persistent.ts`
   - `src/domain/inventory/repository/container_repository/persistent.ts`
   - `src/infrastructure/inventory/persistence/indexed-db.ts`
   - `src/infrastructure/inventory/persistence/local-storage.ts`

2. **Chunk Persistence**:
   - `src/domain/chunk/repository/chunk_repository/indexeddb_implementation.ts`
   - `src/domain/chunk_system/repository.indexeddb.ts`

3. **World Metadata Persistence**:
   - `src/domain/world/repository/world_metadata_repository/interface.ts`
   - `src/domain/world/repository/world_generator_repository/interface.ts`
   - `src/domain/world/repository/generation_session_repository/interface.ts`
   - `src/domain/world/repository/biome_system_repository/interface.ts`

**検証状況**: 🟡 部分的実装 - repositoryインターフェースでSchema定義あり、実装側の検証強化が必要

### 3.3 Network境界（WebSocket/WebRTC）

**該当ファイル**: 0ファイル

**状況**: ✅ 現時点で未実装のため対応不要

### 3.4 Runtime検証推奨パターン

```typescript
// ✅ 推奨: Schema.decodeUnknownEffect による検証
import { Schema, Effect } from 'effect'

const loadFromStorage = (key: string): Effect.Effect<Player, ParseError, never> =>
  Effect.gen(function* () {
    const rawData = localStorage.getItem(key)
    if (!rawData) return yield* Effect.fail(new ParseError({ message: 'Data not found' }))

    const jsonData = JSON.parse(rawData)
    return yield* Schema.decodeUnknown(PlayerSchema)(jsonData)
  })

// ✅ 推奨: Schema.encodeEffect による保存
const saveToStorage = (player: Player): Effect.Effect<void, EncodeError, never> =>
  Effect.gen(function* () {
    const encoded = yield* Schema.encode(PlayerSchema)(player)
    localStorage.setItem('player', JSON.stringify(encoded))
  })
```

---

## 4. 既存Schema定義

### 4.1 Schema使用統計

**Schema.TaggedError**:

- 使用ファイル数: 39ファイル
- 総使用回数: 95箇所
- 主要ドメイン: inventory (18箇所)、world (12箇所)、camera (7箇所)

**Schema.Struct**:

- 使用ファイル数: 214ファイル
- 総使用回数: 1,618箇所
- 全domainで広範に使用

**Data.TaggedEnum**:

- 使用ファイル数: 43ファイル
- 総使用回数: 150箇所
- ADT（Algebraic Data Type）パターンで使用

### 4.2 Schema.TaggedError実装パターン

**パターンA: 階層的エラー定義**（推奨）

```typescript
// ベースエラー
export class InventoryError extends Schema.TaggedError<InventoryError>()('InventoryError', {
  message: Schema.String,
  inventoryId: Schema.optional(Schema.String),
  timestamp: Schema.Number,
}) {}

// 派生エラー
export class ValidationError extends Schema.TaggedError<ValidationError>()('ValidationError', {
  message: Schema.String,
  field: Schema.String,
  value: Schema.Unknown,
  expectedType: Schema.String,
}) {}
```

**パターンB: Data.TaggedError + Schema**（既存実装）

```typescript
export class WorldNotFoundError extends Data.TaggedError('WorldNotFoundError')<{
  readonly worldId: WorldId
  readonly context: ErrorContext
  readonly suggestedAction?: string
}> {
  get message() {
    return `World not found: ${this.worldId}`
  }
}

export const WorldNotFoundErrorSchema = Schema.TaggedStruct('WorldNotFoundError', {
  worldId: WorldIdSchema,
  context: ErrorContextSchema,
  suggestedAction: Schema.optional(Schema.String),
})
```

### 4.3 主要Schema定義ファイル

**Inventory Domain**:

- `src/domain/inventory/types/errors.ts`: 18種類のエラークラス
- `src/domain/inventory/value_object/item_id/schema.ts`: ItemId Schema
- `src/domain/inventory/value_object/slot/schema.ts`: Slot Schema

**World Domain**:

- `src/domain/world/types/errors/world_errors.ts`: 12種類のエラークラス
- `src/domain/world/types/core/world_types.ts`: WorldId, WorldSeed, DimensionId Schema
- `src/domain/world/types/core/biome_types.ts`: BiomeId, BiomeProperties Schema

**Camera Domain**:

- `src/domain/camera/types/errors.ts`: 7種類のエラークラス
- `src/domain/camera/value_object/camera_settings/schema.ts`: CameraSettings Schema

### 4.4 Schema定義の改善候補

**優先度A（型安全性向上）**:

1. **Storage境界のSchema検証強化**:
   - IndexedDB read/write時の検証追加
   - localStorage read/write時の検証追加

2. **API境界のSchema検証追加**:
   - chunk loading API responseの検証
   - audio file metadata検証

**優先度B（エラーハンドリング一貫性）**:

1. **Schema.TaggedErrorへの統一**:
   - 残りのData.TaggedErrorをSchema.TaggedErrorに移行
   - エラー階層構造の整理

**優先度C（開発体験向上）**:

1. **Schema annotationsの充実**:
   - description, title, examples追加
   - JSDoc生成自動化

---

## 5. 実装優先順位

### 5.1 Phase 3実装優先度（FINAL-ROADMAP準拠）

**Week 7-8: Brand Types導入（30時間）**

**Track A: ID系Brand化（15時間、推定400箇所）**

```bash
# Week 7
claude "Phase 3.1: PlayerId/ChunkId/EntityId/BiomeIdをBrand型化して"
```

**影響範囲**:

- PlayerId: 10ドメインで使用（inventory, player, entities, camera等）
- ChunkId: 5ドメインで使用（chunk, chunk_loader, chunk_manager等）
- EntityId: entities, interaction, physics
- BiomeId: world, chunk

**期待効果**: ID混同による論理エラー防止、型安全性向上

**Track B: 座標系Brand化（10時間、推定200箇所）**

```bash
# Week 8
claude "Phase 3.1: BlockCoordinate/ChunkCoordinate/WorldCoordinateをBrand型化して"
```

**影響範囲**:

- WorldCoordinate: world, player, physics
- ChunkCoordinate: chunk, chunk_loader
- BlockCoordinate: block, interaction
- SectionCoordinate: chunk, world

**期待効果**: 座標系混同防止、スケール変換バグ防止

**Track C: 単位系Brand化（5時間、推定50箇所）**

```bash
# Week 8
claude "Phase 3.1: Meters/Seconds/MetersPerSecond等の単位系をBrand型化して"
```

**影響範囲**:

- DeltaTime: game_loop, physics
- Timestamp: camera, inventory
- Distance: physics, camera
- Velocity: physics, player

**期待効果**: 物理計算の単位一貫性保証

### 5.2 Phase 3.2: Schema検証強化（Week 9、20時間）

**Priority 1: Storage境界（10時間）**

```bash
claude "Phase 3.2: IndexedDB/localStorage境界にSchema検証を追加して"
```

**対象ファイル**: 17ファイル

- inventory/repository/\*\_repository/persistent.ts
- chunk/repository/chunk_repository/indexeddb_implementation.ts
- world/repository/\*/persistence_implementation.ts

**Priority 2: API境界（10時間）**

```bash
claude "Phase 3.2: chunk_loading_provider/audio-service-liveにSchema検証を追加して"
```

**対象ファイル**: 5ファイル

- chunk_loader/application/chunk_loading_provider.ts
- infrastructure/audio/audio-service-live.ts

### 5.3 Phase 3.3: any型削減（Week 10、30時間）

**Priority 1: World Generation（15時間）**

```bash
claude "Phase 3.3: world/domain_service/procedural_generation/*のany型をSchema検証に置換して"
```

**対象**: 3ファイル・68箇所

- terrain_generator.ts: 3箇所
- cave_carver.ts: 26箇所
- structure_spawner.ts: 39箇所

**Priority 2: Inventory Transaction（10時間）**

```bash
claude "Phase 3.3: inventory/application_service/transaction_manager/*のany型をSchema検証に置換して"
```

**対象**: 2ファイル・27箇所

- live.ts: 8箇所
- workflows.ts: 19箇所

**Priority 3: Camera Tests（5時間、低優先）**

```bash
claude "Phase 3.3: camera/__tests__/*のany型をunknown/Schema検証に置換して"
```

**対象**: 2ファイル・31箇所（テストヘルパー）

### 5.4 Phase 3.4: non-null assertion削減（Week 10、10時間）

```bash
claude "Phase 3.4: inventory/*の!.をOption/Either型に置換して"
```

**対象**: 3ファイル・22箇所

- aggregate/container/operations.ts: 12箇所
- domain_service/stacking_service/live.ts: 8箇所
- domain_service/transfer_service/live.ts: 2箇所

**期待効果**: null安全性の明示的保証、Option/Eitherパターン普及

---

## 6. 依存関係分析

### 6.1 ドメイン間依存関係

**Core Domains（他ドメインから依存される）**:

1. **chunk**: 191ファイル - 最大規模
   - 依存元: chunk_loader, chunk_manager, world, player
2. **inventory**: 131ファイル - 2番目
   - 依存元: player, crafting, entities
3. **camera**: 95ファイル - 3番目
   - 依存元: player, scene

**Dependent Domains（他ドメインに依存）**:

1. **world**: 191ファイル - chunkに依存
2. **player**: entities, inventory, cameraに依存
3. **physics**: entities, chunkに依存

### 6.2 Brand型導入時の影響範囲

**PlayerId導入時の影響**:

- domain/player: 定義元
- domain/inventory: PlayerInventory関連
- domain/entities: Player Entity関連
- domain/camera: PlayerCamera関連
- domain/furniture: 所有者関連
- 推定影響ファイル: 40-50ファイル

**ChunkId導入時の影響**:

- domain/chunk: 定義元
- domain/chunk_loader: ローディング関連
- domain/chunk_manager: 管理関連
- domain/world: 生成関連
- domain/chunk_system: システム関連
- 推定影響ファイル: 60-80ファイル

**ItemId導入時の影響**:

- domain/inventory: 定義元
- domain/crafting: レシピ関連
- domain/entities: アイテムエンティティ
- domain/materials: マテリアル定義
- domain/block: ブロックアイテム変換
- 推定影響ファイル: 30-40ファイル

### 6.3 段階的実装推奨順序

**Stage 1（依存少、リスク低）**:

1. BiomeId（world domain限定、~10ファイル）
2. DimensionId（world domain限定、~5ファイル）
3. EntityId（entities domain中心、~15ファイル）

**Stage 2（中規模依存）**:

1. ItemId（inventory中心、~30ファイル）
2. 座標系Brand型（world/chunk/physics、~40ファイル）
3. 単位系Brand型（physics/game_loop、~10ファイル）

**Stage 3（広範囲依存、慎重に）**:

1. PlayerId（全ドメイン影響、~50ファイル）
2. ChunkId（chunk関連全域、~80ファイル）

---

## 7. リスク評価

### 7.1 高リスク項目

**Risk 1: ChunkId Brand化（影響度: 大）**

- **影響範囲**: 80ファイル
- **破壊的変更**: chunk_loader, chunk_manager, world全域
- **リスク**: 型エラー大量発生、ビルド時間増加
- **軽減策**: 段階的移行（chunk → chunk_loader → chunk_manager → world）

**Risk 2: PlayerId Brand化（影響度: 大）**

- **影響範囲**: 50ファイル
- **破壊的変更**: 全ドメインに影響
- **リスク**: 既存ADT定義との競合、Schema定義重複
- **軽減策**: 既存Schema.Schema.Type<PlayerIdSchema>との共存戦略

**Risk 3: any型削減（world generation）**

- **影響範囲**: procedural_generation/\* 68箇所
- **リスク**: 複雑なアルゴリズム理解不足、バグ混入
- **軽減策**: テストケース充実、段階的変換、レビュー強化

### 7.2 中リスク項目

**Risk 4: Storage境界Schema検証**

- **影響範囲**: 17ファイル
- **リスク**: 既存セーブデータとの互換性喪失
- **軽減策**: マイグレーション機能、バージョン管理

**Risk 5: non-null assertion削減**

- **影響範囲**: 22箇所
- **リスク**: Option/Eitherパターン不慣れによるバグ
- **軽減策**: パターン統一、レビューチェックリスト

### 7.3 低リスク項目

**Risk 6: 単位系Brand化**

- **影響範囲**: 10ファイル
- **リスク**: 低（物理計算限定）
- **軽減策**: physics domainから開始

---

## 8. 完了基準

### 8.1 Phase 3.1完了基準（Brand Types）

```bash
# ID系Brand型チェック
grep -r "type.*Id.*=.*string$" src/domain --include="*.ts" | grep -v Brand  # 0件

# 座標系Brand型チェック
grep -r "type.*Coordinate.*=.*number$" src/domain --include="*.ts" | grep -v Brand  # 0件

# 単位系Brand型チェック
grep -r "type.*Time.*=.*number$" src/domain --include="*.ts" | grep -v Brand  # 0件
grep -r "type.*Distance.*=.*number$" src/domain --include="*.ts" | grep -v Brand  # 0件
```

### 8.2 Phase 3.2完了基準（Schema検証）

```bash
# Storage境界検証
grep -l "localStorage\|indexedDB" src/domain --include="*.ts" | \
  xargs grep -L "Schema.decode"  # 0件

# API境界検証
grep -l "fetch\|http" src/domain --include="*.ts" | \
  xargs grep -L "Schema.decode"  # 0件
```

### 8.3 Phase 3.3完了基準（any型削減）

```bash
# any型残存チェック（テスト除く）
grep -rn ": any\b" src/domain --include="*.ts" | \
  grep -v "spec.ts" | grep -v "test.ts"  # 目標: 50件以下（テストヘルパー許容）
```

### 8.4 Phase 3.4完了基準（non-null assertion削減）

```bash
# non-null assertion残存チェック
grep -rn "!\." src/domain --include="*.ts" | \
  grep -v "spec.ts" | grep -v "test.ts"  # 0件
```

### 8.5 総合完了基準

- ✅ 全CI/CDパス（typecheck, check, test, build）
- ✅ 型アサーション(`as`)削減率: 50%以上（infrastructure層除く）
- ✅ any型削減率: 80%以上（テストヘルパー除く）
- ✅ unknown型: 適切なパターンのみ残存
- ✅ non-null assertion: 0件（domain層）
- ✅ Storage/API境界: 100% Schema検証

---

## 9. 推奨実装戦略

### 9.1 Quick Win（即効性高、リスク低）

**Week 7 Day 1-2（10時間）**:

```bash
# 低依存ID系Brand化
claude "BiomeId/DimensionId/EntityIdをBrand型化して（推定30ファイル）"
```

**期待効果**:

- ID混同防止
- 型安全性向上
- 影響範囲限定（world/entities限定）

### 9.2 High Impact（効果大、リスク中）

**Week 7 Day 3-5（15時間）**:

```bash
# 座標系Brand化
claude "WorldCoordinate/ChunkCoordinate/BlockCoordinateをBrand型化して（推定200箇所）"
```

**期待効果**:

- 座標変換バグ防止
- スケール混同防止
- 物理計算精度向上

### 9.3 Foundation（基盤強化、長期効果）

**Week 8-9（30時間）**:

```bash
# Storage境界Schema検証
claude "IndexedDB/localStorage境界にSchema検証を追加して"

# any型削減
claude "world/procedural_generation/*のany型をSchema検証に置換して"
```

**期待効果**:

- Runtime安全性向上
- バグ早期発見
- データ整合性保証

---

## 10. 次のアクション

### 10.1 即座に実行可能（Phase 3.1開始）

```bash
# Step 1: 低依存Brand型導入（5時間）
claude "Phase 3.1 Step 1: BiomeId/DimensionId/EntityIdをBrand型化して。
対象ファイル数: ~30
期待効果: ID混同防止、影響範囲限定"

# Step 2: 座標系Brand型導入（10時間）
claude "Phase 3.1 Step 2: WorldCoordinate/ChunkCoordinate/BlockCoordinateをBrand型化して。
対象ファイル数: ~200
期待効果: 座標変換バグ防止"

# Step 3: 単位系Brand型導入（5時間）
claude "Phase 3.1 Step 3: DeltaTime/Timestamp/Distance/VelocityをBrand型化して。
対象ファイル数: ~50
期待効果: 物理計算単位一貫性"
```

### 10.2 Phase 3.2準備（Schema検証設計）

- Storage境界のSchema定義レビュー
- マイグレーション戦略策定
- テストケース作成

### 10.3 Phase 3.3準備（any型削減計画）

- procedural_generation/\*のアルゴリズム理解
- テストカバレッジ確認
- 段階的変換計画策定

---

## 11. 結論

Phase 3（型安全化）は、**FINAL-ROADMAPの計画通り、Week 7-10（80-100時間）で完了可能**と評価します。

**成功の鍵**:

1. **段階的実装**: 低依存→中依存→高依存の順序厳守
2. **テスト充実**: 各段階で回帰テスト実施
3. **ドキュメント整備**: Brand型使用ガイドライン作成
4. **レビュー強化**: 特にChunkId/PlayerId Brand化時

**期待効果**:

- **型安全性**: ID混同・座標混同の撲滅
- **Runtime安全性**: Storage/API境界の完全検証
- **保守性**: any型削減によるコード理解容易化
- **品質**: non-null assertion削減によるnull安全性向上

**Phase 3完了後の型安全性レベル**:

- 静的型検査: ⭐⭐⭐⭐⭐（Brand型による意味的型安全）
- Runtime検証: ⭐⭐⭐⭐⭐（Schema検証による境界安全）
- null安全性: ⭐⭐⭐⭐⭐（Option/Eitherによる明示的処理）
- エラーハンドリング: ⭐⭐⭐⭐⭐（Schema.TaggedError統一）
