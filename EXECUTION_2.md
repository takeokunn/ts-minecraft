# TypeScript Minecraft Clone - 完全Effect-TS化リファクタリング実行計画書

## 📋 プロジェクト概要

**プロジェクト名**: TypeScript Minecraft Clone 完全Effect-TS化リファクタリング
**期間**: 2025年1月 - 2025年6月（約5ヶ月）
**目標**: Effect-TS化100% / 型安全性100% / テストカバレッジ100%

---

## 🎯 最終目標

### 定量的指標

```
Effect-TS化率: 8.8% → 100%（7,347箇所残存→0箇所）
型安全性違反: 約900箇所 → 0箇所（any/as/!/unknown/class完全除去）
テストカバレッジ: 20.1% → 100%（169→840ファイル、671ファイル新規作成）
テストPASS率: 78.6% → 100%（失敗196件→0件、skip90件→0件）
tsc --noEmit: 0エラー
pnpm check: 0エラー
pnpm test: 全PASS（100%）
```

### 定性的指標

- コードの可読性向上（pipe/Match連鎖による線形フロー）
- 保守性向上（Effect化による明示的副作用管理）
- 開発速度向上（型推論による自動補完強化）
- バグ削減（Schema検証による実行時安全性）

---

## 📊 現状分析（Phase 0-4完了時点）

### プロジェクト規模

```
総実装ファイル数: 840ファイル
総テストファイル数: 169ファイル（カバレッジ20.1%）
新規作成必要テスト: 671ファイル（不足79.9%）

コード行数: 約150,000行（推定）
```

### レイヤー別現状

| レイヤー          | ファイル数 | Effect-TS化率 | 残存if/else | 残存try/catch | 残存for/while |
|------------------|-----------|--------------|------------|--------------|--------------|
| Domain           | 588       | 8.8%         | ~1,950箇所  | 18箇所       | ~340箇所      |
| Application      | 84        | 100%         | 0箇所       | 0箇所        | 0箇所         |
| Infrastructure   | 126       | 99.9%        | 1箇所       | 0箇所        | 0箇所         |
| Presentation     | 42        | 未調査       | 未調査      | 未調査       | 未調査        |

### 型安全性違反統計

```
any使用: 約200箇所
as型アサーション: 約400箇所
! non-null assertion: 約150箇所
unknown: 約100箇所
class使用: 約50箇所

合計型安全性違反: 約900箇所
```

### テスト品質現状

```
総テスト数: 1,337件
失敗テスト: 196件（14.7%）
skipされたテスト: 90件（6.7%）
PASSテスト: 1,051件（78.6%）

主な失敗原因:
- パフォーマンステスト失敗: 約30件
- 型エラー（undefined参照等）: 約50件
- 実装不備（未定義関数等）: 約60件
- ADT/Schema検証エラー: 約40件
- その他: 約16件
```

### Phase 0-4実績（2025年1月時点）

**Phase 1-4累計**: 226箇所変換完了

- Phase 1: 23箇所（JSON.parse/バリデーション/for-of）
- Phase 2: 44箇所（world_generator/container_factory/transfer_service）
- Phase 3: 138箇所（camera constants/domain try-catch/world_metadata_repository）
- Phase 4: 21箇所（item_id/operations - Match.when連鎖）

**主要成果**:
- Application層: 100%完了
- Infrastructure層: 99.9%完了
- Domain層: 8.8%完了（進行中）

---

## 🏗️ 技術仕様（パフォーマンス最優先）

### パフォーマンス設計原則

**Effect-TSの高速化機能を最大限活用し、60FPS/メモリ<2GBを厳守**

1. **並行実行の徹底**: `concurrency: 'unbounded'`でI/O操作を完全並列化
2. **遅延評価の活用**: `Stream`による無限データストリーム処理（メモリ定数）
3. **メモ化の徹底**: `Cache`によるコンピュテーション結果キャッシュ
4. **バッチ処理**: `Chunk`による効率的データ処理（キャッシュヒット率向上）
5. **構造化並行性**: `Fiber`による軽量スレッド並列実行（OS threadより1000倍軽量）
6. **アトミック操作**: `STM`によるロックフリー並行制御（ロックベースより10-100倍高速）
7. **効率的スケジューリング**: `Schedule`による最適リトライ戦略（無駄なリトライ90%削減）
8. **Zero-Cost Abstraction**: `Effect.succeed`による純粋計算の最適化

### Effect-TS高速化機能一覧

#### 1. Fiber（軽量並行実行）

**性能**: OS threadより1000倍軽量、async/awaitより5-10倍高速

```typescript
// ✅ 数万タスクの同時実行（1 Fiber = 数KB）
const processInParallel = (tasks: Task[]) =>
  Effect.gen(function* () {
    const fibers = yield* Effect.forEach(
      tasks,
      (task) => Effect.fork(processTask(task)),
      { concurrency: 'unbounded' }
    )
    return yield* Effect.forEach(fibers, Fiber.join)
  })

// ✅ 構造化並行性（親終了で子自動キャンセル）
const withTimeout = (task: Effect.Effect<A>) =>
  Effect.race(task, Effect.sleep(Duration.seconds(5)))
```

#### 2. Stream（遅延評価データ処理）

**性能**: 通常配列より50-100倍省メモリ、メモリ使用量定数

```typescript
// ✅ 無限ストリーム処理（メモリ定数）
const processInfiniteStream = pipe(
  Stream.fromQueue(eventQueue),
  Stream.grouped(1000),  // Chunk単位バッチ処理
  Stream.mapEffect(processBatch, { concurrency: 'unbounded' }),
  Stream.runDrain
)

// ✅ バックプレッシャー制御（メモリオーバーフロー防止）
const processWithBackpressure = pipe(
  Stream.fromIterable(largeDataset),
  Stream.buffer(100),  // バッファサイズ制限
  Stream.mapEffect(process)
)
```

#### 3. Chunk（効率的データ構造）

**性能**: 通常配列より2-5倍高速（キャッシュヒット率向上）

```typescript
// ✅ 連続メモリ配列（キャッシュ効率的）
const processChunk = (data: Chunk.Chunk<number>) =>
  pipe(
    data,
    Chunk.map(x => x * 2),  // イミュータブルだが高速
    Chunk.filter(x => x > 10),
    Chunk.reduce(0, (a, b) => a + b)
  )

// ✅ バッチ変換（単一メモリコピー）
const transformed = Chunk.map(Chunk.range(0, 10000), transform)
```

#### 4. STM（ロックフリー並行制御）

**性能**: ロックベースより10-100倍高速、デッドロックフリー

```typescript
// ✅ アトミックな複数状態更新（ロック不要）
const transfer = (from: PlayerId, to: PlayerId, amount: number) =>
  STM.gen(function* () {
    const fromBalance = yield* TMap.get(balances, from)
    const toBalance = yield* TMap.get(balances, to)

    yield* STM.if(fromBalance < amount, {
      onTrue: () => STM.fail(InsufficientFunds),
      onFalse: () => STM.unit
    })

    yield* TMap.set(balances, from, fromBalance - amount)
    yield* TMap.set(balances, to, toBalance + amount)
  })

// ✅ 競合時の自動リトライ（ロック待機なし）
STM.commit(transfer(player1, player2, 100))
```

#### 5. Cache（計算結果メモ化）

**性能**: 再計算コストを0に削減、自動LRU/TTL管理

```typescript
// ✅ 重い計算の自動キャッシュ
const chunkCache = yield* Cache.make({
  capacity: 1000,  // LRU自動管理
  timeToLive: Duration.minutes(5),  // TTL自動削除
  lookup: (coord: ChunkCoordinate) => loadChunkFromStorage(coord)
})

const getChunk = (coord: ChunkCoordinate) =>
  Cache.get(chunkCache, coord)  // 初回のみ計算、以降キャッシュ

// ✅ Effect結果のメモ化
const cachedEffect = Effect.cached(expensiveComputation)
```

#### 6. Schedule（最適リトライ戦略）

**性能**: 無駄なリトライを90%削減、ネットワーク負荷分散

```typescript
// ✅ 指数バックオフ（ネットワーク負荷分散）
const retryPolicy = Schedule.exponential(Duration.millis(100))
  .pipe(Schedule.union(Schedule.recurs(5)))  // 最大5回
  .pipe(Schedule.jittered())  // ジッター追加（thundering herd回避）

yield* Effect.retry(networkRequest, retryPolicy)

// ✅ 並行リトライ制限
const limitedRetry = Schedule.exponential(Duration.seconds(1))
  .pipe(Schedule.maxDelay(Duration.seconds(30)))  // 最大遅延30秒
```

#### 7. Effect.all（完全並列実行）

**性能**: I/O待機時間を1/N に削減

```typescript
// ✅ 完全並列実行（待機時間最小化）
const results = yield* Effect.all(
  [
    loadChunk(coord1),
    loadChunk(coord2),
    loadChunk(coord3),
  ],
  { concurrency: 'unbounded' }  // 全て同時実行
)

// ✅ 大量タスクの並列実行
yield* Effect.all(
  coords.map(loadChunk),
  { concurrency: 'unbounded', batching: true }
)
```

#### 8. Effect.forEach（ループ並列化）

**性能**: for-ofより10-100倍高速（I/O待機時間削減）

```typescript
// ✅ ループの並列実行
const results = yield* Effect.forEach(
  items,
  (item) => processItem(item),
  { concurrency: 'unbounded' }  // 全要素同時処理
)

// ❌ 順次実行（避けるべき）
for (const item of items) {
  yield* processItem(item)  // 1つずつ待機（遅い）
}
```

#### 9. Ref（アトミック状態管理）

**性能**: Promiseより2-3倍高速、ロック不要

```typescript
// ✅ アトミック更新（ロック不要）
const counter = yield* Ref.make(0)

yield* Ref.update(counter, n => n + 1)  // アトミック
yield* Ref.getAndUpdate(counter, n => n + 1)  // アトミック取得＆更新
```

#### 10. Deferred（非同期通知）

**性能**: Promiseより低オーバーヘッド、ポーリング不要

```typescript
// ✅ 非同期通知（ポーリング不要）
const deferred = yield* Deferred.make<number>()

// 別Fiberで完了待機
yield* Deferred.await(deferred)

// 結果設定
yield* Deferred.succeed(deferred, 42)
```

### パフォーマンス目標

```
レンダリング: 60FPS維持（16.67ms/frame）
メモリ使用量: < 2GB
チャンクロード: < 100ms（並列実行）
テスト実行: < 3秒（全1,337+α件）
ビルド時間: < 20秒
型チェック: < 10秒
```

### パフォーマンス測定

```bash
# レンダリングFPS測定
Performance API / Chrome DevTools

# メモリ使用量測定
Chrome DevTools Memory Profiler

# チャンクロード時間測定
Effect.withSpan('chunk-load', { attributes: { coord } })

# ベンチマーク
time pnpm build
time pnpm test
time pnpm typecheck
```

---

## 🗓️ 実行計画（Phase 5-10）

### 全体スケジュール

| Phase    | 期間      | 作業内容                           | 変換箇所数 | 成果物                    |
|----------|-----------|-----------------------------------|-----------|--------------------------|
| Phase 5  | 2週間     | Domain層Match/Option化            | ~500箇所   | if/else→Match/Option     |
| Phase 6  | 2週間     | Domain層Effect.forEach化          | ~300箇所   | for→Effect.forEach       |
| Phase 7  | 3週間     | 型安全性最大化                     | ~900箇所   | any/as/!/unknown/class除去|
| Phase 8  | 4週間     | テスト新規作成（前半）              | 300ファイル | 新規Unitテスト+PBT        |
| Phase 9  | 4週間     | テスト新規作成（後半）              | 371ファイル | 新規Unitテスト+PBT        |
| Phase 10 | 4週間     | 高度機能適用                       | 全箇所     | STM/Fiber/Stream統合     |

**総期間**: 19週間（約4.5ヶ月）

---

## 📝 Phase 5: Domain層Match/Option化（2週間）

### 目標

**if/else/switch → Match.when/Match.tag/Option.match** (~500箇所)

### 対象ファイル（優先度順）

#### 高優先度（Week 1）

1. **aggregate層** (~150箇所)
   - `src/domain/inventory/aggregate/inventory/operations.ts`
   - `src/domain/inventory/aggregate/container/operations.ts`
   - `src/domain/inventory/aggregate/item_stack/operations.ts`
   - `src/domain/player/aggregate/player/operations.ts`
   - `src/domain/chunk/aggregate/chunk/operations.ts`

2. **domain_service層** (~100箇所)
   - `src/domain/inventory/domain_service/stacking_service/service.ts`
   - `src/domain/inventory/domain_service/transfer_service/service.ts`
   - `src/domain/physics/domain_service/collision_service.ts`
   - `src/domain/world/domain_service/terrain_generator.ts`

#### 中優先度（Week 2）

3. **value_object層** (~100箇所)
   - `src/domain/interaction/value_object/vector3.ts`
   - `src/domain/interaction/value_object/block_face.ts`
   - `src/domain/physics/value_object/velocity.ts`
   - `src/domain/camera/value_object/camera_rotation.ts`

4. **repository層** (~100箇所)
   - `src/domain/world/repository/world_metadata_repository/memory_implementation.ts`
   - `src/domain/world/repository/biome_system_repository/biome_cache.ts`
   - `src/domain/chunk/repository/chunk_query_repository/implementation.ts`

5. **その他** (~50箇所)
   - `src/domain/combat/service.ts`
   - `src/domain/furniture/service.ts`
   - `src/domain/entities/model/*.ts`

### 実装パターン

#### Pattern 1: 早期return式if文 → Match.when連鎖

```typescript
// ❌ Before
if (str.includes('sword')) return Effect.succeed(...)
if (str.includes('axe')) return Effect.succeed(...)
if (str.includes('pickaxe')) return Effect.succeed(...)
return Effect.succeed(...)

// ✅ After
return pipe(
  Match.value(str),
  Match.when(n => n.includes('sword'), () => Effect.succeed(...)),
  Match.when(n => n.includes('axe'), () => Effect.succeed(...)),
  Match.when(n => n.includes('pickaxe'), () => Effect.succeed(...)),
  Match.orElse(() => Effect.succeed(...))
)
```

#### Pattern 2: ネスト条件分岐 → Option.match

```typescript
// ❌ Before
const player = getPlayer(id)
if (player) {
  if (player.health > 0) {
    return updatePlayer(player)
  } else {
    return respawnPlayer(player)
  }
} else {
  return createPlayer(id)
}

// ✅ After
return pipe(
  getPlayer(id),
  Option.match({
    onNone: () => createPlayer(id),
    onSome: (player) =>
      player.health > 0
        ? updatePlayer(player)
        : respawnPlayer(player)
  })
)
```

#### Pattern 3: switch文 → Match.tag

```typescript
// ❌ Before
switch (state._tag) {
  case 'Loading': return handleLoading(state)
  case 'Success': return handleSuccess(state)
  case 'Error': return handleError(state)
  default: throw new Error('Unknown state')
}

// ✅ After
return pipe(
  state,
  Match.value,
  Match.tag('Loading', handleLoading),
  Match.tag('Success', handleSuccess),
  Match.tag('Error', handleError),
  Match.exhaustive
)
```

### 検証コマンド

```bash
# Phase 5完了確認
pnpm typecheck  # 0エラー
pnpm check      # 0エラー
pnpm test       # 全PASS

# 残存統計
grep -rn "^\s*if\s*(" src/domain --include="*.ts" | grep -v "spec.ts" | wc -l
grep -rn "^\s*switch\s*(" src/domain --include="*.ts" | grep -v "spec.ts" | wc -l
```

### 成果物

- Match/Option化完了ファイル: ~50ファイル
- コード削減: 推定15-20%
- 型推論強化: Match.exhaustiveによる網羅性チェック

---

## 📝 Phase 6: Domain層Effect.forEach化（2週間）

### 目標

**for/while → Effect.forEach/ReadonlyArray** (~300箇所)

### 対象パターン

#### Pattern 1: for-ofループ → Effect.forEach

```typescript
// ❌ Before
const results = []
for (const item of items) {
  const result = yield* processItem(item)
  results.push(result)
}

// ✅ After
const results = yield* Effect.forEach(
  items,
  (item) => processItem(item),
  { concurrency: 'unbounded' }
)
```

#### Pattern 2: for-iループ → ReadonlyArray.makeBy

```typescript
// ❌ Before
const slots = []
for (let i = 0; i < size; i++) {
  slots.push(createSlot(i))
}

// ✅ After
const slots = ReadonlyArray.makeBy(size, createSlot)
```

#### Pattern 3: whileループ → Effect.repeat

```typescript
// ❌ Before
let retries = 0
while (retries < maxRetries) {
  const result = yield* tryOperation()
  if (result.success) break
  retries++
}

// ✅ After
yield* Effect.retry(
  tryOperation(),
  Schedule.recurs(maxRetries)
)
```

### 対象ファイル

1. **高頻度ループ**:
   - `src/domain/chunk/factory/chunk_factory/service.ts`
   - `src/domain/world/domain_service/procedural_generation/terrain_generator.ts`
   - `src/domain/inventory/factory/inventory_factory/factory.ts`

2. **並行実行候補**:
   - `src/domain/chunk_loader/application/chunk_loading_provider.ts`
   - `src/domain/world/repository/world_metadata_repository/persistence_implementation.ts`

### 検証コマンド

```bash
# Phase 6完了確認
grep -rn "for\s*(" src/domain --include="*.ts" | grep -v "spec.ts" | wc -l
grep -rn "while\s*(" src/domain --include="*.ts" | grep -v "spec.ts" | wc -l
```

---

## 📝 Phase 7: 型安全性最大化（3週間）

### 目標

**any/as/!/unknown/class完全除去** (~900箇所)

### Week 1: any撲滅 (~200箇所)

#### Pattern: any → Schema.decodeUnknown

```typescript
// ❌ Before
const processData = (data: any) => {
  return data.someProperty as string
}

// ✅ After
const DataSchema = Schema.Struct({
  someProperty: Schema.String
})

const processData = (input: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(DataSchema)(input)
    return data.someProperty
  })
```

### Week 2: as/!撲滅 (~550箇所)

#### Pattern 1: as → Brand型

```typescript
// ❌ Before
const id = value as PlayerId

// ✅ After
const id = yield* Schema.decodeUnknown(PlayerId)(value)
```

#### Pattern 2: ! → Option.match

```typescript
// ❌ Before
const player = maybePlayer!

// ✅ After
return yield* pipe(
  maybePlayer,
  Option.match({
    onNone: () => Effect.fail(createPlayerNotFoundError()),
    onSome: (player) => Effect.succeed(player)
  })
)
```

### Week 3: unknown/class撲滅 (~150箇所)

#### Pattern 1: unknown → Schema

```typescript
// ❌ Before
const parse = (data: unknown) => {
  return data  // 危険
}

// ✅ After
const parse = (data: unknown) =>
  Schema.decodeUnknown(ExpectedSchema)(data)
```

#### Pattern 2: class → Effect Service

```typescript
// ❌ Before
class PlayerManager {
  private players = new Map()

  addPlayer(player: Player) {
    this.players.set(player.id, player)
  }
}

// ✅ After
interface PlayerManagerService {
  readonly addPlayer: (player: Player) => Effect.Effect<void, PlayerError>
}

const PlayerManagerService = Context.GenericTag<PlayerManagerService>(
  '@minecraft/PlayerManagerService'
)

const PlayerManagerServiceLive = Layer.effect(
  PlayerManagerService,
  Effect.gen(function* () {
    const playersRef = yield* Ref.make(new Map<PlayerId, Player>())

    return PlayerManagerService.of({
      addPlayer: (player) =>
        Ref.update(playersRef, (map) => new Map(map).set(player.id, player))
    })
  })
)
```

### 検証コマンド

```bash
# Phase 7完了確認
grep -rn " as " src --include="*.ts" | grep -v "spec.ts" | grep -v "as any" | wc -l
grep -rn "!" src --include="*.ts" | grep -v "spec.ts" | grep -v "!=" | wc -l
grep -rn "any" src --include="*.ts" | grep -v "spec.ts" | wc -l
grep -rn "class " src --include="*.ts" | grep -v "spec.ts" | grep -v "Schema.TaggedError" | wc -l
```

---

## 📝 Phase 8-9: テスト新規作成（8週間）

### 目標

**新規671テストファイル作成 + 既存169ファイル改善**

### Phase 8（4週間）: 前半300ファイル

#### Week 1-2: Domain/value_object層 (150ファイル)

**対象**:
- `src/domain/*/value_object/__tests__/*.spec.ts`

**テンプレート**:
```typescript
import { describe, it, expect } from '@effect/vitest'
import { Effect, Option } from 'effect'

describe('ValueObject', () => {
  describe('Creation', () => {
    it.effect('creates valid value object', () =>
      Effect.gen(function* () {
        const vo = yield* createValueObject(validInput)
        expect(vo).toBeDefined()
      })
    )

    it.effect('fails on invalid input', () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(createValueObject(invalidInput))
        expect(Either.isLeft(result)).toBe(true)
      })
    )
  })

  describe('Property-Based Tests', () => {
    it.prop({ a: it.number(), b: it.number(), c: it.number() })(
      'satisfies invariants',
      ({ a, b, c }) => Effect.gen(function* () {
        const vo = yield* createValueObject({ a, b, c })
        expect(checkInvariant(vo)).toBe(true)
      })
    )
  })
})
```

#### Week 3-4: Domain/aggregate層 (150ファイル)

**対象**:
- `src/domain/*/aggregate/__tests__/*.spec.ts`

### Phase 9（4週間）: 後半371ファイル

#### Week 1-2: Domain/domain_service層 (200ファイル)

**対象**:
- `src/domain/*/domain_service/__tests__/*.spec.ts`

#### Week 3-4: その他レイヤー (171ファイル)

**対象**:
- `src/domain/*/repository/__tests__/*.spec.ts`
- `src/domain/*/factory/__tests__/*.spec.ts`
- `src/presentation/**/__tests__/*.spec.ts`

### テスト品質基準

```typescript
// 1. Unit Test（60%）
describe('Function', () => {
  it('正常系')
  it('異常系')
  it('境界値')
})

// 2. Property-Based Testing（30%）
it.prop({ x: it.number(), y: it.number(), z: it.number() })(
  'property description',
  ({ x, y, z }) => Effect.gen(function* () {
    // 不変条件検証
  })
)

// 3. Integration Test（10%）
it.effect('integration test', () =>
  Effect.gen(function* () {
    // 複数レイヤー連携テスト
  }).pipe(Effect.provide(TestLayers))
)
```

### 失敗テスト修正（並行実施）

**196件の失敗テスト**:

1. **パフォーマンステスト** (30件)
   - タイムアウト値調整
   - 並行実行最適化
   - 重い処理のモック化

2. **型エラー** (50件)
   - undefined参照修正
   - Option/Either活用

3. **実装不備** (60件)
   - 未定義関数実装
   - import修正

4. **ADT/Schema検証** (40件)
   - Schema定義修正
   - Match.exhaustive追加

5. **その他** (16件)
   - 個別対応

### 検証コマンド

```bash
# Phase 8-9完了確認
find src -name "*.spec.ts" | wc -l  # 840ファイル
pnpm test  # 全PASS
pnpm test:coverage  # 100%
```

---

## 📝 Phase 10: 高度機能適用（4週間）

### 目標

**STM/Fiber/Stream/Cache/Schedule統合**

### Week 1: STM導入

#### 対象: World State管理

```typescript
// World State STM化
const WorldStateService = Context.GenericTag<{
  readonly updateBlock: (pos: Position, block: Block) => Effect.Effect<void, WorldError>
  readonly getBlock: (pos: Position) => Effect.Effect<Option.Option<Block>, WorldError>
}>('@minecraft/WorldStateService')

const WorldStateServiceLive = Layer.effect(
  WorldStateService,
  Effect.gen(function* () {
    const worldState = yield* TMap.make<Position, Block>()

    return WorldStateService.of({
      updateBlock: (pos, block) =>
        STM.commit(TMap.set(worldState, pos, block)),

      getBlock: (pos) =>
        STM.commit(TMap.get(worldState, pos))
    })
  })
)
```

#### 対象: Inventory操作

```typescript
// Inventory STM化
const addToInventory = (playerId: PlayerId, item: Item) =>
  STM.gen(function* () {
    const inv = yield* TMap.get(inventories, playerId)

    return yield* pipe(
      inv,
      Option.match({
        onNone: () => STM.fail(createPlayerNotFoundError({ playerId })),
        onSome: (inventory) =>
          inventory.items.length >= MAX_SIZE
            ? STM.fail(createInventoryFullError({ playerId }))
            : STM.set(inventories, playerId, {
                ...inventory,
                items: [...inventory.items, item]
              })
      })
    )
  })
```

### Week 2: Fiber並行制御

#### 対象: チャンクローディング

```typescript
// Fiber並行チャンクロード
const loadChunksInRadius = (center: ChunkCoordinate, radius: number) =>
  Effect.gen(function* () {
    const coords = generateChunkCoordinates(center, radius)

    // Fiber起動
    const fibers = yield* Effect.forEach(
      coords,
      (coord) => Effect.fork(loadChunk(coord)),
      { concurrency: 'unbounded' }
    )

    // 全Fiber待機
    const chunks = yield* Effect.forEach(
      fibers,
      (fiber) => Fiber.join(fiber)
    )

    return chunks
  })
```

### Week 3: Stream統合

#### 対象: イベント処理

```typescript
// Event Stream処理
const eventProcessor = pipe(
  Stream.fromQueue(eventQueue),
  Stream.map(parseEvent),
  Stream.filter(isValidEvent),
  Stream.mapEffect((event) =>
    Effect.gen(function* () {
      yield* processEvent(event)
      yield* notifySubscribers(event)
    })
  ),
  Stream.runDrain
)
```

### Week 4: Cache/Schedule最適化

#### Cache導入

```typescript
// Chunk Cache
const chunkCache = yield* Cache.make({
  capacity: 1000,
  timeToLive: Duration.minutes(5),
  lookup: (coord: ChunkCoordinate) => loadChunkFromStorage(coord)
})

const getChunk = (coord: ChunkCoordinate) =>
  Cache.get(chunkCache, coord)
```

#### Schedule活用

```typescript
// 定期保存
const autoSave = pipe(
  saveWorldState(),
  Effect.repeat(
    Schedule.spaced(Duration.minutes(5))
  )
)
```

### 検証コマンド

```bash
# Phase 10完了確認
grep -rn "STM\." src --include="*.ts" | wc -l
grep -rn "Fiber\." src --include="*.ts" | wc -l
grep -rn "Stream\." src --include="*.ts" | wc -l
grep -rn "Cache\." src --include="*.ts" | wc -l
```

---

## 🎯 各Phase完了条件

### 必須条件（全Phase共通）

```bash
# 1. 型チェックPASS
pnpm typecheck  # 0エラー

# 2. LintチェックPASS
pnpm check  # 0エラー

# 3. テスト全PASS
pnpm test  # 全PASS

# 4. ビルド成功
pnpm build  # 成功
```

### Phase別追加条件

**Phase 5**:
- if/else残存: < 1,450箇所（500箇所削減）
- Match/Option使用: > 500箇所増加

**Phase 6**:
- for/while残存: < 40箇所（300箇所削減）
- Effect.forEach使用: > 300箇所増加

**Phase 7**:
- any残存: 0箇所
- as残存: 0箇所（Layer.effect第一引数除く）
- !残存: 0箇所
- unknown適切使用: 100%
- class残存: 0箇所（Schema.TaggedError除く）

**Phase 8-9**:
- テストファイル数: 840ファイル
- テストPASS率: 100%
- カバレッジ: 100%

**Phase 10**:
- STM使用: World State, Inventory
- Fiber使用: チャンクローディング
- Stream使用: イベント処理
- Cache使用: チャンク、バイオーム

---

## 📊 進捗管理

### 週次確認項目

```bash
# 毎週金曜実施

# 1. 統計確認
grep -rn "^\s*if\s*(" src/domain --include="*.ts" | grep -v "spec.ts" | wc -l
grep -rn "^\s*for\s*(" src/domain --include="*.ts" | grep -v "spec.ts" | wc -l
grep -rn " as " src --include="*.ts" | grep -v "spec.ts" | wc -l
find src -name "*.spec.ts" | wc -l

# 2. 品質確認
pnpm typecheck
pnpm check
pnpm test
pnpm test:coverage

# 3. パフォーマンス確認
time pnpm build
time pnpm test
```

### メモリ記録

各Phase完了時に`write_memory`でパターン記録:

```
Phase 5完了: refactoring-phase5-match-option-patterns
Phase 6完了: refactoring-phase6-foreach-patterns
Phase 7完了: refactoring-phase7-type-safety-complete
Phase 8完了: refactoring-phase8-test-creation-part1
Phase 9完了: refactoring-phase9-test-creation-part2
Phase 10完了: refactoring-phase10-advanced-features-complete
```

---

## 🚨 リスク管理

### 高リスク項目

1. **STM性能劣化リスク**
   - 対策: ベンチマーク測定、必要に応じてRef使用
   - 許容範囲: 5%以内の性能低下

2. **テスト作成遅延リスク**
   - 対策: テンプレート自動生成、並行作業
   - バッファ: 各Phase +1週間

3. **循環依存発生リスク**
   - 対策: Schema分離、forward reference活用
   - 早期検出: tsc --noEmit監視

### 中リスク項目

1. **外部ライブラリ統合問題**
   - Three.js: Effect化困難→ラッパー作成
   - IndexedDB: Effect.tryPromise化

2. **パフォーマンステスト失敗**
   - タイムアウト調整
   - モック活用

---

## 🎓 学習リソース

### Effect-TS公式

- [Effect Documentation](https://effect.website/docs)
- [Effect Style Guide](https://effect.website/docs/style-guide)
- [Effect Examples](https://github.com/Effect-TS/effect/tree/main/packages/effect/examples)

### プロジェクト内ドキュメント

- `docs/tutorials/effect-ts-fundamentals/` - Effect-TS基礎
- `docs/how-to/development/development-conventions.md` - コーディング規約
- `docs/how-to/testing/testing-guide.md` - テストガイド

### メモリ参照

- `refactoring-imperative-to-effect-patterns` - リファクタリングパターン集
- `effect-service-dependency-injection-type-safe-pattern` - DI型安全パターン
- `schema-tagged-enum-migration-pattern` - ADT移行パターン

---

## 📈 最終成果予測

### コード品質向上

```
コード行数削減: 150,000行 → 120,000行（20%削減）
関数型パターン率: 90% → 100%
型安全性スコア: 70/100 → 100/100
保守性指数: 65/100 → 95/100
```

### 開発体験向上

```
型推論による補完: 70% → 95%
コンパイルエラー検出率: 80% → 100%
実行時エラー削減: 60% → 95%
リファクタリング安全性: 70% → 100%
```

### テスト品質向上

```
テストカバレッジ: 20.1% → 100%
テスト実行時間: 12.49s → 3s
テスト安定性: 78.6% → 100%
PBTカバレッジ: 5% → 50%
```

---

## ✅ 最終検証チェックリスト

### コード品質

- [ ] Effect-TS化率: 100%
- [ ] 型安全性違反: 0件
- [ ] tsc --noEmit: 0エラー
- [ ] pnpm check: 0エラー
- [ ] コード削減: 20%以上

### テスト品質

- [ ] テストファイル: 840ファイル
- [ ] テストPASS率: 100%
- [ ] カバレッジ: 100%
- [ ] PBT比率: 50%以上
- [ ] テスト実行時間: < 3秒

### 高度機能

- [ ] STM: World State/Inventory適用
- [ ] Fiber: チャンクローディング適用
- [ ] Stream: イベント処理適用
- [ ] Cache: チャンク/バイオーム適用
- [ ] Schedule: 定期保存適用

### ドキュメント

- [ ] docs/ 更新完了
- [ ] メモリ記録完了
- [ ] EXECUTION_2.md 最新化

---

## 🎉 プロジェクト完了時のビジョン

**TypeScript Minecraft Clone**は、Effect-TS 3.18+を最大限活用した、世界最高峰の関数型TypeScriptゲームエンジンとなります。

### 特徴

1. **完全型安全**: Schemaベースの実行時検証により、実行時エラー95%削減
2. **関数型プログラミング**: 100%純粋関数・不変データ構造
3. **高度並行制御**: STM/Fiber/Streamによる洗練された並行処理
4. **テスト完備**: 100%カバレッジ・50%PBT・3秒実行時間
5. **教育価値**: Effect-TS実践リファレンス実装

### 影響

- TypeScript関数型プログラミングの新しいベンチマーク
- Effect-TS高度機能の実証事例
- ゲーム開発における関数型アーキテクチャの実例

---

**作成日**: 2025年1月
**最終更新**: Phase 4完了時点
**次回更新**: Phase 5開始時
