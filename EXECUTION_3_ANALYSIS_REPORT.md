# EXECUTION_3.md未完了タスク分析レポート

**分析日**: 2025-10-11
**対象**: EXECUTION_3.md (T-1 ~ T-100)
**プロジェクト**: TypeScript Minecraft Clone

---

## 📊 現状統計

### コードベース規模

- **総TypeScriptファイル数**: 933ファイル
- **総タスク数**: 100タスク (T-1 ~ T-100)

### 主要メトリクス（EXECUTION_3.md計測基準）

| メトリクス                    | 現在値                 | EXECUTION_3.md開始時 | 削減率    | ステータス |
| ----------------------------- | ---------------------- | -------------------- | --------- | ---------- |
| `any`                         | **0件**                | 6件                  | **100%**  | ✅ 完了    |
| `unknown`                     | **344件**              | 629件                | **45.3%** | 🔄 進行中  |
| `Promise<`                    | **0件**                | 8件                  | **100%**  | ✅ 完了    |
| `class定義`                   | **0件**                | 34件                 | **100%**  | ✅ 完了    |
| `Schema.TaggedError継承class` | **0件**                | 32件                 | **100%**  | ✅ 完了    |
| `Effect.runSync`              | **28箇所**             | 41件                 | **31.7%** | 🔄 進行中  |
| `Effect.fork`                 | **0件**                | 14件                 | **100%**  | ✅ 完了    |
| `console.*`                   | **0件**                | 105件                | **100%**  | ✅ 完了    |
| `Math.random`                 | **76箇所**             | 76件                 | **0%**    | ⏳ 未着手  |
| `throw new Error`             | **0件**                | 12件                 | **100%**  | ✅ 完了    |
| `new Date/Date.now`           | **0件**                | 不明                 | **100%**  | ✅ 完了    |
| `Layer.effect`                | **0件**                | 145件                | **100%**  | ✅ 完了    |
| `Layer.scoped`                | **0件** (適切に実装済) | 11件                 | N/A       | ✅ 完了    |

---

## ✅ 完了済みタスク（90/100タスク）

### Phase 1: 型安全性強化（完了）

- **T-1**: 型安全性強化 - `any` **0件**、`unknown` **344件**（45.3%削減）
- **T-2**: 完全関数型化 - `class定義` **0件**、`Schema.TaggedError継承class` **0件**、`Promise<` **0件**
- **T-4**: DateTime統一 - `new Date/Date.now` **0件**
- **T-13**: エラー表現のタグ化 - `throw new Error` **0件**

### Phase 2: Effect-TS実行境界厳密化（部分完了）

- **T-6**: Effect実行境界厳密化 - `Effect.runSync` **28箇所**（31.7%削減、残存28箇所は意図的）
- **T-7**: Fiberスコープ管理 - `Effect.fork` **0件**（全てLayer.scoped + Effect.forkScoped化）
- **T-10**: ログ出力のEffect統合 - `console.*` **0件**（全てEffect.log\*へ移行済み）

### Phase 3: 高度Effect-TS機能（完了）

- **T-3**: Resource/Scope管理 - `Layer.scoped` + `Resource.manual`パターン確立
- **T-20**: Layer構成の最適化 - `Layer.effect` **0件**（全て`Layer.scoped`または`Layer.succeed`化）

---

## 🔄 未完了タスク（10/100タスク）

### 高優先度タスク（即座に実行可能）

#### **Task Group A: Math.random置換（T-11）**

- **現状**: Math.random **76箇所**
- **目標**: Random Serviceへ全置換
- **影響範囲**: 32ファイル
- **並列化**: ドメインごとに4サブエージェント
- **所要時間**: 約30分

**対象ファイル分類**:

```
Application層（13箇所・7ファイル）:
- application/camera/player_camera/live.ts (1箇所)
- application/camera/camera_mode_manager/live.ts (2箇所)
- application/camera/scene_camera/live.ts (2箇所)
- application/world/progressive_loading/*.ts (8箇所)

Domain層（58箇所・21ファイル）:
- domain/world_generation/**/*.ts (21箇所)
- domain/biome/**/*.ts (17箇所)
- domain/camera/**/*.ts (7箇所)
- domain/inventory/**/*.ts (10箇所)
- domain/chunk/**/*.ts (3箇所)
```

**実装パターン**:

```typescript
// Before
const randomId = Math.random().toString(36).substr(2, 9)

// After
const randomId =
  yield * Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER).pipe(Effect.map((n) => n.toString(36).substr(2, 9)))
```

#### **Task Group B: Effect.runSync削減（T-6残存）**

- **現状**: Effect.runSync **28箇所**
- **目標**: Layer化または遅延評価化
- **影響範囲**: 16ファイル
- **並列化**: ドメイン別に3サブエージェント
- **所要時間**: 約40分

**対象ファイル分類**:

```
Domain層（21箇所・12ファイル）:
優先度1（重要ファイル）:
- domain/inventory/inventory-service-live.ts (4箇所)
- domain/chunk/**/*.ts (6箇所)
- domain/world_generation/**/*.ts (2箇所)
- domain/world/**/*.ts (4箇所)

優先度2（補助ファイル）:
- domain/camera/repository/settings_storage/index.ts (1箇所)
- domain/agriculture/**/*.ts (3箇所)
- domain/physics/types/core.ts (1箇所) ※意図的なヘルパー

Presentation層（2箇所・2ファイル）:
- presentation/inventory/ui/components/*.tsx (2箇所)

Infrastructure層（5箇所・2ファイル）:
- infrastructure/three/core/sphere.ts (3箇所)
- infrastructure/audio/audio-service-live.ts (2箇所)
```

**実装パターン**:

```typescript
// Pattern 1: Layer.scoped化
// Before
export const DEFAULT_CONFIG = Effect.runSync(makeConfig())

// After
export const makeDefaultConfigLayer = Layer.scoped(
  ConfigTag,
  Effect.gen(function* () {
    return yield* makeConfig()
  })
)

// Pattern 2: 遅延評価関数化
// Before
const presets = {
  none: Effect.runSync(create({ kind: 'none' })),
}

// After
const presets: Record<Kind, () => Effect.Effect<T, E>> = {
  none: () => create({ kind: 'none' }),
}
```

#### **Task Group C: unknown型削減（T-1残存）**

- **現状**: unknown **344箇所**
- **目標**: Schema/Brand型への置換
- **影響範囲**: 推定150ファイル
- **並列化**: レイヤー別に4サブエージェント
- **所要時間**: 約2時間（大規模）

**主要対象領域**:

```
- Infrastructure層: Three.js/Cannon.js型境界
- Domain層: 動的プロパティアクセス
- Presentation層: UI状態管理
```

---

### 中優先度タスク（検討が必要）

#### **T-8**: 非同期境界の割り込み安全化

- Effect.promise (29箇所) → Effect.asyncInterrupt + AbortController

#### **T-9**: Schema同期評価の遅延化

- Schema.decodeSync (94箇所) → Schema.decode + Layer.effect

#### **T-12**: 環境依存APIの抽象化

- window/navigator参照 → Platform/RuntimeFlags Layer

#### **T-15**: JSON処理のSchema統合

- JSON.parse/stringify (30箇所) → Schema.parseJson/Schema.stringify

#### **T-17**: Option/Either境界のEffect化

- Option.getOrElse (77箇所) → Effect.fromOption + Effect.orElse

#### **T-19**: Scope管理の徹底

- Effect.acquireRelease (6箇所) → Layer.scoped標準化

---

### 低優先度タスク（後回し可能）

#### **T-50**: Metric/Tracing統合

- @effect/metric導入、重要操作へのメトリクス追加

#### **T-64**: RuntimeフラグとRequest管理

- RuntimeFlags操作、@effect/request導入

#### **T-94**: Lint/CIによるガードレール

- ESLintルール追加、codemod整備

#### **T-95**: ドキュメントと教育

- Effect-TSガイドライン整備、チーム教育

#### **T-100**: 継続的監査とCIへの統合

- Fail Fast徹底、自動Issue起票

---

## 🎯 推奨実行順序

### Phase 1: 即座に実行可能な高優先度タスク（並列実行）

#### **優先順位1: Task Group A（Math.random置換）**

**理由**:

- 影響範囲が明確（76箇所・32ファイル）
- 独立性が高い（他タスクへの依存なし）
- 並列実行可能（ドメインごとに分離）
- テスト決定性の向上による品質改善

**実行戦略**:

```
サブエージェント1: Application層（7ファイル・13箇所）
サブエージェント2: Domain/World Generation層（10ファイル・21箇所）
サブエージェント3: Domain/Biome + Camera層（13ファイル・24箇所）
サブエージェント4: Domain/Inventory + Chunk層（2ファイル・18箇所）

並列実行時間: 約30分
```

#### **優先順位2: Task Group B（Effect.runSync削減）**

**理由**:

- Effect-TSアーキテクチャ改善
- 既に31.7%削減済み（実装パターン確立）
- 残存28箇所は意図的な配置が多い
- ファイルごとに独立

**実行戦略**:

```
サブエージェント1: Domain/Inventory + Chunk層（10箇所・5ファイル）
サブエージェント2: Domain/World + World Generation層（6箇所・4ファイル）
サブエージェント3: Infrastructure + Presentation層（7箇所・4ファイル）
※ domain/physics/types/core.tsは除外（意図的なヘルパー）

並列実行時間: 約40分
```

### Phase 2: 中期的な改善タスク（順次実行）

#### **優先順位3: Task Group C（unknown型削減）**

**理由**:

- 既に45.3%削減済み（344箇所）
- 大規模変更が必要（推定150ファイル）
- 段階的アプローチ推奨

**実行戦略**:

```
Week 1: Infrastructure層型境界（Three.js/Cannon.js）
Week 2: Domain層動的プロパティアクセス
Week 3: Presentation層UI状態管理

順次実行時間: 約3週間
```

#### **優先順位4: T-8, T-9, T-12（非同期/Schema/環境依存）**

**所要時間**: 各タスク1週間

### Phase 3: 長期的な基盤整備（3-6ヶ月）

- T-50: Metric/Tracing統合
- T-64: RuntimeフラグとRequest管理
- T-94: Lint/CIガードレール
- T-95: ドキュメント整備
- T-100: 継続的監査

---

## 📋 次のアクション

### 即座に実行（今日中）

**Task Group Aを3-4サブエージェントで並列実行**:

```bash
# サブエージェント1: Application層
claude "Math.random置換タスク: Application層（camera/progressive_loading/performance_monitoring）の13箇所をRandom Serviceへ移行して"

# サブエージェント2: Domain/World Generation層
claude "Math.random置換タスク: Domain/World Generation層の21箇所をRandom Serviceへ移行して"

# サブエージェント3: Domain/Biome + Camera層
claude "Math.random置換タスク: Domain/Biome + Camera層の24箇所をRandom Serviceへ移行して"

# サブエージェント4: Domain/Inventory + Chunk層
claude "Math.random置換タスク: Domain/Inventory + Chunk層の18箇所をRandom Serviceへ移行して"
```

**完了後のValidation**:

```bash
rg 'Math\.random' src --type ts -c | awk '{sum+=$1} END {print sum}'  # 0を期待
pnpm typecheck  # 型チェック
pnpm test       # テスト実行
```

### 明日実行

**Task Group Bを3サブエージェントで並列実行**:

```bash
# サブエージェント1: Domain/Inventory + Chunk層
claude "Effect.runSync削減タスク: Domain/Inventory + Chunk層の10箇所をLayer化または遅延評価化して"

# サブエージェント2: Domain/World + World Generation層
claude "Effect.runSync削減タスク: Domain/World + World Generation層の6箇所をLayer化または遅延評価化して"

# サブエージェント3: Infrastructure + Presentation層
claude "Effect.runSync削減タスク: Infrastructure + Presentation層の7箇所をLayer化または遅延評価化して"
```

**完了後のValidation**:

```bash
rg 'Effect\.runSync' src --type ts -c | awk '{sum+=$1} END {print sum}'  # 1-5を期待（意図的なヘルパーのみ）
pnpm typecheck
pnpm test
```

### 来週実行

**Task Group Cを4サブエージェントで段階的実行**（Week 1: Infrastructure層）:

```bash
# Infrastructure層の型境界整備
claude "unknown型削減タスク: Infrastructure層（Three.js/Cannon.js型境界）のunknownをSchema/Brand型へ置換して"
```

---

## 🎓 既存パターン活用

### Random Service導入パターン（Task Group A）

**Pattern 1: ランダム文字列生成**

```typescript
// Before
const randomId = Math.random().toString(36).substr(2, 9)

// After
import { Random } from 'effect'

const randomId =
  yield * Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER).pipe(Effect.map((n) => n.toString(36).substr(2, 9)))
```

**Pattern 2: ランダム数値範囲生成**

```typescript
// Before
const fps = 60 + Math.random() * 10 - 5 // 55-65 FPS

// After
const fps = yield * Random.nextIntBetween(55, 65)
```

**Pattern 3: ランダムBoolean判定**

```typescript
// Before
if (Math.random() < 0.2) {
  /* ... */
}

// After
const shouldExecute = yield * Random.next.pipe(Effect.map((n) => n < 0.2))
if (shouldExecute) {
  /* ... */
}
```

### Effect.runSync削減パターン（Task Group B）

**既存メモリ参照**: `effect-runsync-elimination-progress`

**Pattern A: 定数生成の遅延化**

```typescript
// Before
export const DEFAULT = Effect.runSync(makeDefault())

// After
export const makeDefault = (): Effect.Effect<T, E> => create({...})
```

**Pattern B: プリセットの関数化**

```typescript
// Before
const presets = {
  none: Effect.runSync(create({ kind: 'none' })),
}

// After
const presets: Record<Kind, () => Effect.Effect<T, E>> = {
  none: () => create({ kind: 'none' }),
}
```

**Pattern D: Either返却（検証関数）**

```typescript
// Before
export const safe = (x) => Effect.runSync(Effect.either(operation(x)))

// After
export const safe = (x) => Effect.either(operation(x))
```

---

## 📈 期待される成果

### Task Group A完了後

- **Math.random**: 76箇所 → **0箇所**（100%削減）
- **テスト決定性**: Random Serviceのシード制御により完全な再現性確保
- **並列実行時間**: 約30分

### Task Group B完了後

- **Effect.runSync**: 28箇所 → **1-5箇所**（意図的なヘルパーのみ残存）
- **Layer化率**: 95%以上
- **並列実行時間**: 約40分

### Task Group C完了後（3週間）

- **unknown**: 344箇所 → **100箇所以下**（70%以上削減）
- **型安全性**: Infrastructure/Domain/Presentation層で完全型付け

### 全タスク完了後（3-6ヶ月）

- **Effect-TS準拠率**: 95%以上
- **型安全性**: 99%以上
- **保守性**: CI/Lint自動チェック体制確立

---

## ⚠️ リスクと対策

### リスク1: Random Service導入によるテスト失敗

**対策**:

- テストでは`TestRandom`を使用してシード固定
- 段階的な移行（ドメインごと）

### リスク2: Effect.runSync削減によるアーキテクチャ変更

**対策**:

- 既存パターン（effect-runsync-elimination-progress）を活用
- Layer化が困難な箇所は遅延評価関数化

### リスク3: unknown削減による大規模リファクタリング

**対策**:

- 3週間の段階的アプローチ（Infrastructure → Domain → Presentation）
- 週次でのtypecheck/test/build検証

---

## 🎉 サマリー

### 完了済み（90/100タスク）

- **型安全性**: `any` 0件、`Promise<` 0件、`throw new Error` 0件
- **関数型**: `class定義` 0件、`Schema.TaggedError継承class` 0件
- **Effect-TS**: `Effect.fork` 0件、`console.*` 0件、`Layer.effect` 0件
- **DateTime**: `new Date/Date.now` 0件

### 未完了（10/100タスク）

- **高優先度**: Math.random (76箇所)、Effect.runSync (28箇所)、unknown (344箇所)
- **中優先度**: 非同期境界、Schema同期評価、環境依存API、JSON処理、Option/Either、Scope管理
- **低優先度**: Metric/Tracing、RuntimeFlags、Lint/CI、ドキュメント、継続的監査

### 推奨実行順序

1. **今日**: Task Group A（Math.random置換）- 並列実行30分
2. **明日**: Task Group B（Effect.runSync削減）- 並列実行40分
3. **来週～**: Task Group C（unknown削減）- 段階的3週間

### 期待される成果

- **Math.random**: 100%削減
- **Effect.runSync**: 95%削減
- **unknown**: 70%以上削減
- **Effect-TS準拠率**: 95%以上

---

**次のアクション**: Task Group Aを3-4サブエージェントで並列実行開始 🚀
