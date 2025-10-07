# Effect-TSリファクタリング調査統合レポート

**調査日**: 2025-10-07
**調査範囲**: 全24ドメイン（876ファイル、約182,000行）
**調査方法**: 3グループ並列調査（グループA/B/C）

---

## 📊 統合調査結果サマリー

### 全体統計

| 指標                       | グループA | グループB | グループC | **合計**  |
| -------------------------- | --------- | --------- | --------- | --------- |
| **ファイル数**             | 575       | 109       | 53        | **737**   |
| **`as`型アサーション**     | 2,847     | 17        | 112       | **2,976** |
| **`any`使用**              | 385       | 1         | 2         | **388**   |
| **`unknown`使用**          | 382       | 13        | 14        | **409**   |
| **`!` non-null assertion** | 33        | 0         | 0         | **33**    |
| **型アサーション総数**     | 3,647     | 31        | 128       | **3,806** |

### 型安全性スコア（10点満点）

| グループ      | 平均スコア | 評価                        |
| ------------- | ---------- | --------------------------- |
| **グループA** | 4.2/10     | ⚠️ 改善必要（大規模・複雑） |
| **グループB** | 8.7/10     | ✅ 良好（一部改善）         |
| **グループC** | 7.8/10     | ✅ 良好（shared要改善）     |

---

## 🎯 最終リファクタリング優先順位

### Tier 1: 緊急対応必須（P0）

#### 1. **src/domain/world** - 最優先

- **型アサーション**: 1,127箇所の`as`、246箇所の`any`（全体の40%）
- **影響度**: 10/10（他ドメインへの参照元、プロジェクト中核）
- **複雑度**: 9/10（座標変換、ノイズ生成、バイオーム分類）
- **リスク**: 10/10（座標系混同バグ頻発、パフォーマンス重要）
- **工数見積**: 40-50時間
- **推奨アクション**:
  1. 座標系Brand型導入（`WorldCoordinate`/`ChunkCoordinate`/`BlockCoordinate`分離）
  2. `any`型の段階的削除（procedural_generation層から着手）
  3. Repository層Schema検証強化

#### 2. **src/domain/shared** - 基盤最優先

- **型アサーション**: 76箇所の`as`（Brand型定数初期化に集中）
- **影響度**: 10/10（全8ドメイン中5ドメインが依存）
- **複雑度**: 6/10（Brand型定数の安全な初期化パターン確立）
- **リスク**: 8/10（変更が全ドメインに波及）
- **工数見積**: 15-20時間
- **推奨アクション**:
  1. Brand型定数の安全な初期化パターン確立（`Schema.make()`活用）
  2. 算術演算結果の型安全化（`(a + b) as Meters` → Schema検証）
  3. 他ドメインへの影響分析と段階的移行

---

### Tier 2: 高優先対応（P1）

#### 3. **src/domain/inventory**

- **型アサーション**: 724箇所の`as`、73箇所の`any`、18箇所の`!`
- **影響度**: 7/10（独立性高いが重要機能）
- **複雑度**: 9/10（スタック操作・トランザクション複雑）
- **リスク**: 8/10（アイテム消失バグリスク）
- **工数見積**: 30-40時間
- **推奨アクション**:
  1. `!` non-null assertionの削除（slot配列nullチェック追加）
  2. ItemStack操作でのBrand型徹底
  3. TransactionManager型安全性向上（`Map<string, any>`削除）

#### 4. **src/domain/camera**

- **型アサーション**: 632箇所の`as`、21箇所の`any`、9箇所の`!`
- **影響度**: 6/10（UI層との境界）
- **複雤度**: 7/10（Repository層に`as any`集中）
- **リスク**: 5/10（ビジュアルバグは致命的でない）
- **工数見積**: 20-30時間
- **推奨アクション**:
  1. Repository層の`Map<string, any>`をジェネリクス化
  2. THREE.js型とのインターフェース明確化

---

### Tier 3: 中優先対応（P2）

#### 5. **src/domain/chunk**

- **型アサーション**: 364箇所の`as`、7箇所の`any`、6箇所の`!`
- **影響度**: 8/10（worldから頻繁参照）
- **複雑度**: 7/10（State管理複雑）
- **工数見積**: 15-20時間

#### 6. **src/domain/equipment**

- **型アサーション**: 8箇所の`as`（グループB最多）
- **影響度**: 3/10（独立ドメイン）
- **複雑度**: 9/10（Weight計算ロジック複雑）
- **工数見積**: 3時間

#### 7. **src/domain/physics**

- **型アサーション**: 35箇所の`as`、8箇所の`any`
- **影響度**: 6/10（ゲームプレイ重要）
- **複雑度**: 5/10（外部ライブラリ依存）
- **工数見積**: 10-15時間

---

### Tier 4: 低優先対応（P3）

#### 8-11. **agriculture**, **view_distance**, **game_loop**, **chunk_manager**

- **工数見積**: 各2-5時間
- **特徴**: 既にBrand型/Schema定義が充実、段階的改善

---

### Tier 5: リファクタリング不要（維持）

#### 12-24. **crafting**, **combat**, **materials**, **player**, **entities**, **block**, **furniture**, **scene**, **input**, **performance**, **chunk_loader**, **chunk_system**, **interaction**

- **評価**: 型安全性が既に高水準、現状維持で問題なし
- **特筆**: `crafting`は型アサーションゼロの模範実装

---

## 🔍 重要な発見事項

### 1. 座標系型アサーションの集中（world）

**問題箇所**: `world/types/core/coordinate_types.ts`

```typescript
// 現状（危険）
x: x as WorldCoordinate
z: z as ChunkCoordinate
y: y as BlockCoordinate
```

**影響**: 座標変換バグ頻発、実行時エラーの温床

**解決策**:

```typescript
// Brand型による静的型チェック
export const WorldCoordinate = Schema.Number.pipe(Schema.brand('WorldCoordinate'))
export const makeWorldCoordinate = Schema.make(WorldCoordinateSchema)
```

---

### 2. Repository層の`any`使用パターン（camera, inventory）

**問題箇所**: Repository層で`Map<string, any>`パターンが頻出

```typescript
// 現状（型安全性欠如）
const transactionStates = new Map<string, any>()
const lockRegistry = new Map<string, any>()
```

**解決策**:

```typescript
// ジェネリクス化
const transactionStates = new Map<TransactionId, TransactionState>()
const lockRegistry = new Map<LockId, LockState>()
```

---

### 3. Brand型の部分的実装

**問題**: Brand型は定義済みだが、使用箇所で`as`による強制キャストが残存

```typescript
// 現状（型検証スキップ）
return `player_${uuidv4()}` as PlayerId

// 推奨（Schema検証）
return Schema.make(PlayerIdSchema)(`player_${uuidv4()}`)
```

---

### 4. `unknown`の適切な使用（グループC）

**評価**: 14箇所全てが適切な外部入力受け取り（Schema検証前）

```typescript
// Good: Schema検証前の型
const parseInput = (input: unknown) => Schema.decodeUnknown(InputSchema)(input)
```

**リファクタリング不要**

---

### 5. `crafting`ドメインの模範実装（グループB）

**特徴**: 型アサーションゼロ、完全なBrand型・Schema活用

**他ドメインの参考例**:

- `RecipeId`, `IngredientQuantity`等のBrand型徹底
- Schema検証の網羅的実装
- `Match.type`によるパターンマッチング

---

## 📈 段階的リファクタリング戦略

### Phase 1: 基盤強化（1-2週間）

**目標**: `shared`と`world`の型安全化

#### Week 1: src/domain/shared

1. Brand型定数初期化パターン確立
2. 算術演算結果の型安全化
3. 依存ドメイン影響分析

#### Week 2: src/domain/world

1. 座標系Brand型導入
2. `any`型削除（procedural_generation層）
3. Repository層Schema検証

**成果物**:

- 1,203箇所の`as`削減
- 246箇所の`any`削除
- 全ドメインの基盤型安全化

---

### Phase 2: 高リスクドメイン（2-3週間）

**目標**: `inventory`と`camera`の型安全化

#### Week 3-4: src/domain/inventory

1. `!` non-null assertion削除（18箇所）
2. ItemStack操作Brand型徹底
3. TransactionManager型パラメータ化

#### Week 5: src/domain/camera

1. Repository層ジェネリクス化
2. THREE.js型インターフェース改善

**成果物**:

- 1,356箇所の`as`削減
- 94箇所の`any`削除
- 27箇所の`!`削除

---

### Phase 3: 残ドメイン段階的改善（2-3週間）

**目標**: 中優先ドメインの型安全化

- `chunk`, `equipment`, `physics`
- `agriculture`, `view_distance`, `game_loop`

**成果物**:

- 残り417箇所の`as`削減
- 残り48箇所の`any`削除

---

## 🧪 検証指標

### 型安全性メトリクス

| 指標                   | 現状   | Phase 1目標  | Phase 2目標 | 最終目標  |
| ---------------------- | ------ | ------------ | ----------- | --------- |
| `as`型アサーション     | 2,976  | 1,773 (-40%) | 417 (-85%)  | 0 (-100%) |
| `any`使用              | 388    | 142 (-63%)   | 48 (-88%)   | 0 (-100%) |
| `!` non-null assertion | 33     | 33 (維持)    | 6 (-82%)    | 0 (-100%) |
| **型安全性スコア**     | 4.8/10 | **7.2/10**   | **9.1/10**  | **10/10** |

### テストカバレッジ維持

- 各Phase後に全テスト実行
- カバレッジ80%+維持
- 新規Brand型にプロパティベーステスト追加

---

## ⚠️ リスク管理

### 高リスク箇所

1. **world座標変換** - 座標系混同バグ頻発箇所
   - **対策**: 段階的移行、型テスト追加

2. **inventory操作** - アイテム消失リスク
   - **対策**: トランザクションテスト強化

3. **shared基盤** - 全ドメインへの波及
   - **対策**: 後方互換性維持、段階的ロールアウト

### リスク軽減策

1. **Feature Flag**: 新旧実装の切り替え可能化
2. **段階的移行**: 1ドメインずつ、1PRあたり20-30ファイル
3. **自動テスト**: Brand型生成関数のプロパティベーステスト
4. **パフォーマンス計測**: Schema検証のオーバーヘッド測定

---

## 📝 次のアクション

### 即座に実行可能（今日-明日）

1. ✅ **調査レポート保存完了** - `REFACTORING_SURVEY_REPORT.md`
2. ⏭️ **Phase 1詳細計画作成** - `shared`リファクタリングタスク分解
3. ⏭️ **Issue作成**:
   - `[P0] world: 座標系Brand型導入`
   - `[P0] shared: Brand型定数初期化パターン確立`

### 今週中に実施

1. **プロトタイプ検証**:
   - `shared`のBrand型定数初期化パターン検証
   - Schema検証パフォーマンス測定
2. **依存関係分析**:
   - `shared`変更の影響範囲マッピング
3. **テスト戦略策定**:
   - Brand型プロパティベーステスト設計

---

## 📚 参考資料

### Effect-TSベストプラクティス

- [Effect-TS Schema Guide](https://effect.website/docs/schema/introduction)
- [Brand Types Documentation](https://effect.website/docs/schema/brands)
- [既存実装例: crafting domain](src/domain/crafting)

### プロジェクト内リソース

- [EXECUTE.md](./EXECUTE.md) - 元の要件定義
- [docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md](docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
- [docs/how-to/development/development-conventions.md](docs/how-to/development/development-conventions.md)

---

## 🎓 教訓

### 成功パターン

1. **craftingドメイン**: 型アサーションゼロの完全実装
   - Brand型徹底、Schema検証網羅
   - 他ドメインのリファクタリング模範

2. **グループC全体**: `unknown`の適切な使用
   - 外部入力受け取りでの型安全設計

### 改善パターン

1. **worldドメイン**: 座標系Brand型分離の重要性
   - プリミティブ型混同防止の典型例

2. **sharedドメイン**: 基盤型の安全な初期化パターン
   - `as`型アサーション削減の最大レバレッジポイント

---

## 📊 詳細定量分析結果

### クラス使用状況

- **`class`総数**: 約30箇所
- **Effect-TS準拠クラス** (問題なし): 約25箇所
  - `Schema.TaggedError` - エラー定義
  - `Data.Class` - Value Object
- **リファクタリング対象**: 約5箇所
  - レガシービルダーパターン（deprecated）

### 制御構文使用状況

- **`for`ループ総数**: 約10箇所
- **ホットパス該当**: なし（ドキュメント例とサービス層のみ）
- **リファクタリング方針**: `ReadonlyArray.forEach`または`Effect.forEach`で置き換え可能

### 非同期処理使用状況

- **`Promise`使用**: 約30箇所
  - IndexedDB操作 - 約10箇所
  - テクスチャローダー - 約5箇所
  - ファイルI/O - 約5箇所
  - リポジトリインターフェース - 約5箇所（型定義のみ）
- **`async`関数**: 約15箇所
- **`await`使用**: 約20箇所
- **Effect-TSラップ済み**: 大部分が`Effect.tryPromise`で適切にラップ済み

### 日時処理使用状況

- **`new Date()`使用**: 約150箇所
- **Effect-TS準拠パターン使用率**: 約95%（ほぼ移行済み）
- **パターン**:

  ```typescript
  // Pattern 1: Clock.currentTimeMillis経由（Effect-TS準拠）- 95%
  const now = yield * Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))

  // Pattern 2: 直接生成（リファクタリング対象）- 5%
  const now = new Date()
  ```

- **ホットパス該当**: なし

### ホットパス詳細分析

#### ゲームループ関連

- **該当ファイル**: `src/application/index.ts`, `src/domain/game_loop/`
- **評価**: クリーン（型アサーション/any/Promise使用なし）

#### レンダリング関連

- **該当ファイル**: `src/domain/chunk/application_service/chunk_data_provider.ts`
- **問題**: `any`使用3箇所（blockId, metadata, lightLevel仮実装）
- **優先度**: P0（実データ実装必要）

#### 物理演算関連

- **該当ファイル**: `src/infrastructure/cannon/three-integration.ts`
- **問題**: `as unknown as THREE.*`パターン4箇所
- **優先度**: P2（型定義の構造的差異によるもの）

#### カメラ更新

- **該当ファイル**: `src/domain/camera/repository/view_mode_preferences/live.ts`
- **問題**: `statisticsCache: HashMap.HashMap<string, any>`
- **優先度**: P1（統計キャッシュの型定義明確化）

### World Domain 詳細分析（最優先対象）

- **any使用**: 約150箇所（ヘルパー関数の仮実装）
  - `procedural_generation/structure_spawner.ts` - 約80箇所
  - `procedural_generation/cave_carver.ts` - 約40箇所
  - `procedural_generation/ore_placer.ts` - 約30箇所
- **特徴**: 全て具体的な型定義と実装が必要な仮実装

### Repository層パターン分析

- **`Map<string, any>`パターン**: 約20箇所
  - `camera` - 約8箇所
  - `inventory` - 約12箇所
- **推奨リファクタリング**: ジェネリクス型パラメータ化

---

## 🎯 更新された優先順位マトリクス

| Domain       | any | as   | !   | for | Promise | class | 総合スコア | 優先度 |
| ------------ | --- | ---- | --- | --- | ------- | ----- | ---------- | ------ |
| world        | 246 | 1127 | 0   | 0   | 0       | 0     | 1373       | **P0** |
| shared       | 2   | 76   | 0   | 0   | 0       | 0     | 78         | **P0** |
| inventory    | 73  | 724  | 18  | 3   | 5       | 5     | 828        | **P1** |
| camera       | 21  | 632  | 9   | 0   | 0       | 0     | 662        | **P1** |
| chunk        | 7   | 364  | 6   | 0   | 10      | 0     | 387        | **P2** |
| physics      | 8   | 35   | 0   | 0   | 2       | 0     | 45         | **P2** |
| equipment    | 0   | 8    | 0   | 0   | 0       | 0     | 8          | **P2** |
| 他17ドメイン | 31  | 10   | 0   | 7   | 13      | 25    | 86         | **P3** |

---

**調査完了日**: 2025-10-07
**詳細分析追加日**: 2025-10-07
**次回更新**: Phase 1完了時（予定: 2週間後）
