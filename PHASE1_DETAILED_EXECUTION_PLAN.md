# Phase 1: 基盤型安全化 - 詳細実行計画書

**作成日**: 2025-10-07
**対象期間**: 2-3週間
**実現可能性**: 85%

## 📊 調査結果サマリー

### 現状の型安全性スコア

| 指標                              | 現在値        | Phase 1目標 | 改善率 |
| --------------------------------- | ------------- | ----------- | ------ |
| 総合型安全性スコア                | 4.8/10        | 7.2/10      | +50%   |
| `as`型アサーション                | 2,976箇所     | 1,773箇所   | -40%   |
| `any`使用                         | 388箇所       | 142箇所     | -63%   |
| `application_service`レイヤー違反 | 9コンテキスト | 0           | -100%  |

### 重要な発見事項

1. **src/domain/shared/の現状**: 既に`Schema.make`パターンを採用済み
   - `Meters`, `MetersPerSecond`, `Milliseconds`, `Timestamp`は既にBest Practiceを実装
   - as型アサーションは**ゼロ**（想定より優秀）
   - EFFECT_TS_PHASED_REFACTORING_PLAN.mdの76箇所の見積もりは過大評価

2. **src/domain/world/coordinatesの現状**:
   - 既に多層Brand型を実装済み (`WorldX`, `WorldY`, `WorldZ`, `ChunkX`, `ChunkZ`, `BlockX`, `BlockY`, `BlockZ`)
   - `makeUnsafe*`関数で`as`型アサーションを使用（26箇所）
   - `coordinate_transforms.ts`は`Schema.decodeSync`を使用（型安全）

3. **application_service/の現状**:
   - 9つの境界づけられたコンテキストに存在
   - 合計73ファイルが移動対象
   - 既存`src/application/`は小規模（inventory/のみ存在）

## 🎯 Phase 1の3つの柱

### 1. src/domain/shared/ - Brand型基盤整備（2-4時間）

**結論**: ほぼ完了済み。追加作業はドキュメント化とテスト強化のみ。

#### タスク詳細

| タスクID | タスク名                                    | 工数 | 優先度 | 依存関係 |
| -------- | ------------------------------------------- | ---- | ------ | -------- |
| P1-S1    | `makeUnsafe`パターンのドキュメント化        | 1h   | P2     | なし     |
| P1-S2    | Brand型算術演算のプロパティベーステスト追加 | 2h   | P1     | なし     |
| P1-S3    | 単位変換関数のテストカバレッジ向上          | 1h   | P2     | なし     |

**成果物**:

- `docs/tutorials/brand-type-arithmetic.md` - Brand型算術演算パターン
- `src/domain/shared/value_object/units/**/*.property.test.ts` - プロパティベーステスト

**検証方法**:

```bash
pnpm test src/domain/shared/value_object/units --coverage
pnpm test:property # プロパティベーステスト実行
```

---

### 2. src/domain/world/ - 座標系Brand型改善（8-12時間）

**現状**: 既に多層Brand型を実装済み。`makeUnsafe`関数の`as`型アサーションをSchema.makeに置き換える。

#### タスク詳細

| タスクID | タスク名                                       | 工数 | 優先度 | 依存関係 |
| -------- | ---------------------------------------------- | ---- | ------ | -------- |
| P1-W1    | `makeUnsafe*`関数を`Schema.make`パターンに移行 | 4h   | P0     | なし     |
| P1-W2    | 座標変換関数の型安全性検証強化                 | 3h   | P1     | P1-W1    |
| P1-W3    | プロパティベーステスト追加（可逆性検証）       | 3h   | P1     | P1-W1    |
| P1-W4    | パフォーマンステスト（座標変換オーバーヘッド） | 2h   | P1     | P1-W1    |

**詳細**: `makeUnsafe*`関数の移行

**Before**:

```typescript
// src/domain/world/value_object/coordinates/block_coordinate.ts
export const makeUnsafeBlockX = (value: number): BlockX => value as BlockX
export const makeUnsafeBlockY = (value: number): BlockY => value as BlockY
export const makeUnsafeBlockZ = (value: number): BlockZ => value as BlockZ
```

**After**:

```typescript
export const makeUnsafeBlockX = (value: number): BlockX => Schema.make(BlockXSchema)(value)
export const makeUnsafeBlockY = (value: number): BlockY => Schema.make(BlockYSchema)(value)
export const makeUnsafeBlockZ = (value: number): BlockZ => Schema.make(BlockZSchema)(value)
```

**影響範囲**:

- `block_coordinate.ts`: 5関数 (makeUnsafeBlockX/Y/Z, makeUnsafeBlockCoordinate, makeUnsafeBlockCoordinate2D)
- `chunk_coordinate.ts`: 5関数 (makeUnsafeChunkX/Z, makeUnsafeChunkCoordinate, makeUnsafeLocalX/Z, makeUnsafeLocalCoordinate)
- `world_coordinate.ts`: 5関数 (makeUnsafeWorldX/Y/Z, makeUnsafeWorldCoordinate, makeUnsafeWorldCoordinate2D)
- `chunk_coordinate_operations.ts`: 1関数 (makeUnsafe) + 依存する20+箇所

**リスク**: `Schema.make`のパフォーマンスオーバーヘッド
**対策**: ホットパスでのパフォーマンステスト実施、必要に応じて`unsafeMake`を検討

**成果物**:

- `src/domain/world/value_object/coordinates/*.ts` - Schema.make移行完了
- `src/domain/world/value_object/coordinates/**/*.property.test.ts` - 座標変換可逆性テスト
- `docs/tutorials/effect-ts-patterns/coordinate-brand-types.md` - 座標系Brand型パターン

**検証方法**:

```bash
# 型チェック
pnpm typecheck

# 座標変換可逆性テスト
pnpm test src/domain/world/value_object/coordinates --coverage

# パフォーマンステスト（60FPS維持確認）
pnpm test:performance --filter="coordinate-transforms"
```

---

### 3. DDD構造修正 - application_service移動（12-18時間）

**現状**: 9つの境界づけられたコンテキストに73ファイルが`domain/*/application_service/`に存在

#### タスク詳細

| タスクID | タスク名                                                      | 工数 | 優先度 | 依存関係    |
| -------- | ------------------------------------------------------------- | ---- | ------ | ----------- |
| P1-D1    | `src/application/`配下にコンテキストディレクトリ作成          | 1h   | P0     | なし        |
| P1-D2    | chunk/camera/chunk_manager移動（軽量3コンテキスト）           | 2h   | P0     | P1-D1       |
| P1-D3    | inventory/physics/crafting/equipment移動（中量4コンテキスト） | 4h   | P0     | P1-D1       |
| P1-D4    | world/interaction移動（重量2コンテキスト、23+2ファイル）      | 6h   | P0     | P1-D1       |
| P1-D5    | import文の一括更新とLayer定義修正                             | 3h   | P0     | P1-D2,D3,D4 |
| P1-D6    | 循環参照チェックと解消                                        | 2h   | P1     | P1-D5       |

**対象コンテキストとファイル数**:

| コンテキスト  | ファイル数 | 複雑度 | 移動優先度 |
| ------------- | ---------- | ------ | ---------- |
| chunk         | 1          | 低     | 1          |
| camera        | 推定1-2    | 低     | 1          |
| chunk_manager | 推定1-2    | 低     | 1          |
| inventory     | 推定5-8    | 中     | 2          |
| physics       | 推定3-5    | 中     | 2          |
| crafting      | 推定3-5    | 中     | 2          |
| equipment     | 推定2-3    | 中     | 2          |
| world         | 23         | 高     | 3          |
| interaction   | 2          | 中     | 3          |

**移動作業の詳細手順**:

```bash
# 1. ディレクトリ作成
mkdir -p src/application/{chunk,camera,chunk_manager,inventory,physics,crafting,equipment,world,interaction}

# 2. git mvで履歴保持しながらファイル移動
git mv src/domain/chunk/application_service/* src/application/chunk/
git mv src/domain/camera/application_service/* src/application/camera/
# ... (以下同様)

# 3. import文の一括更新（正規表現置換）
# Before: from '@domain/chunk/application_service/...'
# After:  from '@application/chunk/...'

find src -name "*.ts" -exec sed -i '' \
  's|@domain/\(.*\)/application_service|@application/\1|g' {} +

# 4. 循環参照チェック
pnpm madge --circular src/

# 5. 型チェック
pnpm typecheck

# 6. テスト実行
pnpm test
```

**Layer定義の修正例**:

**Before** (レイヤー混在):

```typescript
// src/domain/inventory/layers.ts
export const InventoryDomainLive = Layer.mergeAll(
  ItemRegistryLive, // Domain Service
  ValidationServiceLive, // Domain Service
  InventoryManagerLive, // Application Service ❌
  TransactionManagerLive // Application Service ❌
)
```

**After** (レイヤー分離):

```typescript
// src/domain/inventory/layers.ts
export const InventoryDomainLive = Layer.mergeAll(ItemRegistryLive, ValidationServiceLive)

// src/application/inventory/layers.ts
export const InventoryApplicationLive = Layer.mergeAll(InventoryManagerLive, TransactionManagerLive).pipe(
  Layer.provide(InventoryDomainLive) // ドメイン層への依存
)
```

**成果物**:

- `src/application/{9コンテキスト}/` - Application Service層新設
- `src/domain/{9コンテキスト}/layers.ts` - Layer定義修正
- `docs/how-to/development/layer-architecture.md` - Layerアーキテクチャドキュメント

**検証方法**:

```bash
# 循環依存検出
pnpm madge --circular src/

# 型チェック
pnpm typecheck

# 全テスト
pnpm test

# ビルド
pnpm build
```

---

## 📋 実装可能なGitHub Issue一覧

### Epic Issue

```markdown
# [P0] Phase 1: 基盤型安全化

## 目標

- 型安全性スコア: 4.8/10 → 7.2/10
- `as`型アサーション削減: 2,976 → 1,773 (-40%)
- `any`使用削減: 388 → 142 (-63%)
- DDD構造修正: application_service移動完了

## 工数見積もり

- 楽観: 22h (2.75日)
- 現実: 30h (3.75日)
- 悲観: 40h (5日)

## サブタスク

- [ ] #xxx: src/domain/shared/ Brand型基盤整備
- [ ] #xxx: src/domain/world/ 座標系Brand型改善
- [ ] #xxx: DDD構造修正 - application_service移動

## 成功基準

- [ ] pnpm typecheck 成功
- [ ] pnpm test 全テスト通過
- [ ] pnpm build 成功
- [ ] madge --circular 循環依存ゼロ
- [ ] パフォーマンステスト 60FPS維持
```

### Sub-Issue 1: Brand型基盤整備

````markdown
# [P1-S] src/domain/shared/ Brand型基盤整備

## 背景

src/domain/shared/value_object/units/は既に`Schema.make`パターンを採用済み。
追加作業はドキュメント化とテスト強化のみ。

## タスク

- [ ] P1-S1: `makeUnsafe`パターンのドキュメント化 (1h)
- [ ] P1-S2: Brand型算術演算のプロパティベーステスト追加 (2h)
- [ ] P1-S3: 単位変換関数のテストカバレッジ向上 (1h)

## 成果物

- `docs/tutorials/brand-type-arithmetic.md`
- `src/domain/shared/value_object/units/**/*.property.test.ts`

## 検証コマンド

```bash
pnpm test src/domain/shared/value_object/units --coverage
pnpm test:property
```
````

## 工数見積もり

- 楽観: 2h
- 現実: 4h
- 悲観: 6h

````

### Sub-Issue 2: 座標系Brand型改善

```markdown
# [P1-W] src/domain/world/ 座標系Brand型改善

## 背景
既に多層Brand型を実装済み。`makeUnsafe*`関数（26箇所）の`as`型アサーションを`Schema.make`に置き換える。

## タスク
- [ ] P1-W1: `makeUnsafe*`関数を`Schema.make`パターンに移行 (4h)
  - `block_coordinate.ts`: 5関数
  - `chunk_coordinate.ts`: 5関数
  - `world_coordinate.ts`: 5関数
  - `chunk_coordinate_operations.ts`: 1関数 + 依存箇所
- [ ] P1-W2: 座標変換関数の型安全性検証強化 (3h)
- [ ] P1-W3: プロパティベーステスト追加（可逆性検証） (3h)
- [ ] P1-W4: パフォーマンステスト（座標変換オーバーヘッド） (2h)

## 実装例
**Before**:
```typescript
export const makeUnsafeBlockX = (value: number): BlockX => value as BlockX
````

**After**:

```typescript
export const makeUnsafeBlockX = (value: number): BlockX => Schema.make(BlockXSchema)(value)
```

## 成果物

- `src/domain/world/value_object/coordinates/*.ts` - Schema.make移行完了
- `src/domain/world/value_object/coordinates/**/*.property.test.ts`
- `docs/tutorials/effect-ts-patterns/coordinate-brand-types.md`

## 検証コマンド

```bash
pnpm typecheck
pnpm test src/domain/world/value_object/coordinates --coverage
pnpm test:performance --filter="coordinate-transforms"
```

## リスク

- Schema.makeのパフォーマンスオーバーヘッド（対策: パフォーマンステスト実施）

## 工数見積もり

- 楽観: 8h
- 現実: 12h
- 悲観: 16h

````

### Sub-Issue 3: DDD構造修正

```markdown
# [P1-D] DDD構造修正 - application_service移動

## 背景
9つの境界づけられたコンテキストの73ファイルが`domain/*/application_service/`に存在。
DDDレイヤー分離原則に違反しているため、`src/application/`へ移動。

## 対象コンテキスト（優先度順）
1. **軽量** (優先度1): chunk (1), camera (1-2), chunk_manager (1-2)
2. **中量** (優先度2): inventory (5-8), physics (3-5), crafting (3-5), equipment (2-3)
3. **重量** (優先度3): world (23), interaction (2)

## タスク
- [ ] P1-D1: `src/application/`配下にコンテキストディレクトリ作成 (1h)
- [ ] P1-D2: chunk/camera/chunk_manager移動（軽量3コンテキスト） (2h)
- [ ] P1-D3: inventory/physics/crafting/equipment移動（中量4コンテキスト） (4h)
- [ ] P1-D4: world/interaction移動（重量2コンテキスト） (6h)
- [ ] P1-D5: import文の一括更新とLayer定義修正 (3h)
- [ ] P1-D6: 循環参照チェックと解消 (2h)

## 実装手順
```bash
# 1. ディレクトリ作成
mkdir -p src/application/{chunk,camera,chunk_manager,inventory,physics,crafting,equipment,world,interaction}

# 2. git mvで履歴保持
git mv src/domain/chunk/application_service/* src/application/chunk/

# 3. import文の一括更新
find src -name "*.ts" -exec sed -i '' \
  's|@domain/\(.*\)/application_service|@application/\1|g' {} +

# 4. 循環参照チェック
pnpm madge --circular src/
````

## Layer定義修正例

**Before**:

```typescript
// src/domain/inventory/layers.ts
export const InventoryDomainLive = Layer.mergeAll(
  ItemRegistryLive,
  InventoryManagerLive // Application Service ❌
)
```

**After**:

```typescript
// src/domain/inventory/layers.ts
export const InventoryDomainLive = Layer.mergeAll(ItemRegistryLive)

// src/application/inventory/layers.ts
export const InventoryApplicationLive = Layer.mergeAll(InventoryManagerLive).pipe(Layer.provide(InventoryDomainLive))
```

## 成果物

- `src/application/{9コンテキスト}/`
- `docs/how-to/development/layer-architecture.md`

## 検証コマンド

```bash
pnpm madge --circular src/
pnpm typecheck
pnpm test
pnpm build
```

## 工数見積もり

- 楽観: 12h
- 現実: 18h
- 悲観: 24h

````

---

## 📊 タスク依存関係図（Mermaid）

```mermaid
graph TD
    Start[Phase 1開始]

    Start --> S1[P1-S1: makeUnsafeドキュメント化]
    Start --> S2[P1-S2: プロパティベーステスト追加]
    Start --> S3[P1-S3: テストカバレッジ向上]

    Start --> W1[P1-W1: makeUnsafe関数移行]
    W1 --> W2[P1-W2: 型安全性検証強化]
    W1 --> W3[P1-W3: プロパティベーステスト]
    W1 --> W4[P1-W4: パフォーマンステスト]

    Start --> D1[P1-D1: ディレクトリ作成]
    D1 --> D2[P1-D2: 軽量コンテキスト移動]
    D1 --> D3[P1-D3: 中量コンテキスト移動]
    D1 --> D4[P1-D4: 重量コンテキスト移動]
    D2 --> D5[P1-D5: import更新とLayer修正]
    D3 --> D5
    D4 --> D5
    D5 --> D6[P1-D6: 循環参照チェック]

    S1 --> Verify[検証フェーズ]
    S2 --> Verify
    S3 --> Verify
    W2 --> Verify
    W3 --> Verify
    W4 --> Verify
    D6 --> Verify

    Verify --> TypeCheck[pnpm typecheck]
    Verify --> Test[pnpm test]
    Verify --> Build[pnpm build]
    Verify --> Madge[madge --circular]
    Verify --> Perf[パフォーマンステスト]

    TypeCheck --> End[Phase 1完了]
    Test --> End
    Build --> End
    Madge --> End
    Perf --> End
````

**並列実施可能なタスク**:

- P1-S1, S2, S3 (shared/)
- P1-W1 (world/)
- P1-D1 (DDD構造)

**逐次実施が必要なタスク**:

- P1-W1 → W2, W3, W4
- P1-D1 → D2, D3, D4 → D5 → D6

---

## 📈 工数見積もり（時間単位）

| カテゴリ    | タスク                      | 楽観    | 現実    | 悲観    |
| ----------- | --------------------------- | ------- | ------- | ------- |
| **shared/** | P1-S1: ドキュメント化       | 0.5h    | 1h      | 1.5h    |
|             | P1-S2: プロパティテスト     | 1.5h    | 2h      | 3h      |
|             | P1-S3: カバレッジ向上       | 0.5h    | 1h      | 1.5h    |
| **world/**  | P1-W1: makeUnsafe移行       | 3h      | 4h      | 6h      |
|             | P1-W2: 型安全性検証         | 2h      | 3h      | 4h      |
|             | P1-W3: プロパティテスト     | 2h      | 3h      | 4h      |
|             | P1-W4: パフォーマンステスト | 1h      | 2h      | 2h      |
| **DDD構造** | P1-D1: ディレクトリ作成     | 0.5h    | 1h      | 1h      |
|             | P1-D2: 軽量移動             | 1h      | 2h      | 3h      |
|             | P1-D3: 中量移動             | 3h      | 4h      | 6h      |
|             | P1-D4: 重量移動             | 4h      | 6h      | 8h      |
|             | P1-D5: import更新           | 2h      | 3h      | 4h      |
|             | P1-D6: 循環参照             | 1h      | 2h      | 3h      |
| **検証**    | 統合検証                    | 1h      | 1h      | 2h      |
| **合計**    |                             | **22h** | **30h** | **40h** |

**日数換算**（1日=8時間稼働）:

- **楽観**: 2.75日
- **現実**: 3.75日
- **悲観**: 5日

---

## ⚠️ リスク項目と対策

| リスク項目                                | 発生確率 | 影響度 | 対策                                                   |
| ----------------------------------------- | -------- | ------ | ------------------------------------------------------ |
| Schema.makeのパフォーマンスオーバーヘッド | 30%      | 中     | パフォーマンステスト実施、必要に応じてunsafeMakeを検討 |
| application_service移動時のimport更新漏れ | 40%      | 中     | 自動化ツール（sed正規表現）活用、型チェックで検出      |
| 循環参照発生                              | 25%      | 高     | madgeによる自動検出、依存方向の明確化                  |
| Layer定義の修正漏れ                       | 35%      | 中     | テスト実行で検出、段階的移行                           |
| 既存テストの破壊                          | 20%      | 高     | 各タスク完了時にテスト実行、Feature Flag活用           |

**総合リスクレベル**: 🟡 中（対策により管理可能）

---

## ✅ 完了基準（Definition of Done）

### Phase 1全体の完了基準

- [ ] **型チェック**: `pnpm typecheck` が成功
- [ ] **テスト**: `pnpm test` が全て通過
- [ ] **ビルド**: `pnpm build` が成功
- [ ] **循環依存**: `pnpm madge --circular src/` がゼロ
- [ ] **パフォーマンス**: ゲームループ60FPS維持（パフォーマンステスト）
- [ ] **カバレッジ**: テストカバレッジ80%+維持
- [ ] **ドキュメント**: 3つのドキュメントが作成完了
  - `docs/tutorials/brand-type-arithmetic.md`
  - `docs/tutorials/effect-ts-patterns/coordinate-brand-types.md`
  - `docs/how-to/development/layer-architecture.md`

### 各サブタスクの完了基準

**P1-S (shared/)**:

- [ ] プロパティベーステスト追加完了
- [ ] テストカバレッジ85%+
- [ ] ドキュメント作成完了

**P1-W (world/)**:

- [ ] `makeUnsafe*`関数から`as`型アサーション削除（26箇所）
- [ ] 座標変換可逆性テスト追加
- [ ] パフォーマンステストでオーバーヘッド<5%を確認

**P1-D (DDD構造)**:

- [ ] 9コンテキストの73ファイル移動完了
- [ ] import文の更新完了（推定187箇所）
- [ ] Layer定義の修正完了
- [ ] 循環依存ゼロ

---

## 📚 参考資料

### プロジェクト内リソース

- [EFFECT_TS_PHASED_REFACTORING_PLAN.md](./EFFECT_TS_PHASED_REFACTORING_PLAN.md) - Phase 1-4全体計画
- [DDD Architecture Analysis](./memories/ddd-architecture-analysis-2025.md) - DDD構造調査結果
- [docs/INDEX.md](./docs/INDEX.md) - プロジェクト全体ドキュメント
- [docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md](./docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md) - Effect-TSパターン集
- [docs/how-to/development/development-conventions.md](./docs/how-to/development/development-conventions.md) - 開発規約

### Effect-TS公式リソース

- [Effect-TS Schema Guide](https://effect.website/docs/schema/introduction)
- [Brand Types Documentation](https://effect.website/docs/schema/brands)
- [Layer Pattern](https://effect.website/docs/context-management/layers)

---

## 🚀 次のアクション（今週中）

### 1. Issue作成（GitHub Projects活用）

```bash
# Epic Issue作成
gh issue create --title "[P0] Phase 1: 基盤型安全化" \
  --body-file .github/ISSUE_TEMPLATE/phase1-epic.md \
  --label "refactoring,phase-1,P0"

# Sub-Issue作成
gh issue create --title "[P1-S] src/domain/shared/ Brand型基盤整備" \
  --body-file .github/ISSUE_TEMPLATE/phase1-shared.md \
  --label "refactoring,phase-1,domain-shared,P1"

gh issue create --title "[P1-W] src/domain/world/ 座標系Brand型改善" \
  --body-file .github/ISSUE_TEMPLATE/phase1-world.md \
  --label "refactoring,phase-1,domain-world,P0"

gh issue create --title "[P1-D] DDD構造修正 - application_service移動" \
  --body-file .github/ISSUE_TEMPLATE/phase1-ddd.md \
  --label "refactoring,phase-1,architecture,P0"
```

### 2. ベースライン測定

```bash
# 現状のパフォーマンス測定
pnpm test:performance --filter="baseline"

# 型アサーション箇所の最終確認
grep -r "as " src/domain/world/value_object/coordinates --include="*.ts" | \
  grep -v "as const" | wc -l
# 期待結果: 26箇所

# application_serviceファイル数確認
find src/domain -name "*.ts" -path "*/application_service/*" | wc -l
# 期待結果: 73ファイル
```

### 3. プロトタイプ検証（小規模実装）

**検証項目**:

- [ ] `makeUnsafe`を`Schema.make`に変換したパフォーマンス測定
- [ ] application_service移動の1コンテキスト試行（chunk/）
- [ ] プロパティベーステストのサンプル作成

**検証コード例**:

```typescript
// src/domain/world/value_object/coordinates/__tests__/prototype.property.test.ts
import { describe, it, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'

describe('座標変換可逆性テスト', () => {
  test.prop([fc.integer({ min: -30000000, max: 30000000 })])('座標変換の可逆性', (worldX) => {
    const world = makeWorldCoordinate(worldX, 0, 0)
    const chunk = worldToChunk(world)
    const backToWorld = chunkToWorld(chunk)

    expect(Math.floor(backToWorld.x)).toBe(Math.floor(world.x))
  })
})
```

---

## 📝 まとめ

### Phase 1の実現可能性: **85%** ✅

**高い実現可能性の根拠**:

1. **src/domain/shared/は既に完了済み**: 追加作業はドキュメント化とテスト強化のみ（2-4h）
2. **src/domain/world/は基盤が整備済み**: `makeUnsafe*`の移行のみ（8-12h）
3. **DDD構造修正は機械的作業**: git mv + sed置換で自動化可能（12-18h）
4. **総工数は現実的**: 30時間（3.75日）は2-3週間の範囲内で十分達成可能
5. **リスクは管理可能**: 全てのリスクに具体的な対策を用意

### 推奨実施順序

1. **Week 1**: P1-D (DDD構造修正) - 最も影響範囲が大きいため最初に実施
2. **Week 2**: P1-W (world/座標系) - パフォーマンステスト含む
3. **Week 2-3**: P1-S (shared/ドキュメント化) - 並行実施可能

### 成功のカギ

- ✅ 段階的な検証（各タスク完了時にテスト実行）
- ✅ 自動化ツールの活用（sed, madge, pnpm scripts）
- ✅ パフォーマンス継続監視（60FPS維持）
- ✅ ドキュメント化の徹底（次フェーズへの知見共有）

**Phase 1完了後、Phase 2（高リスクドメイン型安全化）への移行準備が整います。**

---

**計画書バージョン**: v1.0
**次回更新**: Phase 1完了時（予定: 2-3週間後）
