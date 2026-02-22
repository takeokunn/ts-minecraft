# LoadingScheduler詳細分析レポート

## 1. ファイル構造

### Service定義

```typescript
export interface LoadingSchedulerService {
  readonly scheduleLoad: (
    request: Schema.Schema.Type<typeof LoadingRequest>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  readonly scheduleBatch: (
    batch: Schema.Schema.Type<typeof LoadingBatch>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  readonly updatePlayerMovement: (
    state: Schema.Schema.Type<typeof PlayerMovementState>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  readonly getNextTask: () => Effect.Effect<
    Option.Option<Schema.Schema.Type<typeof LoadingRequest>>,
    LoadingSchedulerErrorType
  >

  readonly reportCompletion: (
    requestId: string,
    success: boolean,
    metrics?: Record<string, number>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  readonly cancelRequest: (requestId: string, reason?: string) => Effect.Effect<boolean, LoadingSchedulerErrorType>

  readonly getQueueState: () => Effect.Effect<Schema.Schema.Type<typeof LoadingQueueState>, LoadingSchedulerErrorType>

  readonly generatePredictiveRequests: (
    playerId: string,
    lookAheadSeconds: number
  ) => Effect.Effect<Schema.Schema.Type<typeof LoadingRequest>[], LoadingSchedulerErrorType>

  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof SchedulerConfiguration>>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  readonly getPerformanceMetrics: () => Effect.Effect<Record<string, number>, LoadingSchedulerErrorType>
}
```

### 型定義一覧

#### LoadingPriority

```typescript
LoadingPriority = Schema.Union(
  Schema.Literal('critical'), // プレイヤー周辺の必須チャンク
  Schema.Literal('high'), // 移動方向の先読みチャンク
  Schema.Literal('normal'), // 視界範囲内チャンク
  Schema.Literal('low'), // バックグラウンド読み込み
  Schema.Literal('background') // 予測読み込み
)
```

#### LoadingRequest

```typescript
LoadingRequest = Schema.Struct({
  _tag: Schema.Literal('LoadingRequest'),
  id: Schema.String,
  chunkPosition: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  priority: LoadingPriority,
  distance: Schema.Number.pipe(Schema.positive()),
  estimatedSize: Schema.Number.pipe(Schema.positive()),
  requester: Schema.String,
  timestamp: Schema.Number,
  deadline: Schema.optional(Schema.Number),
  dependencies: Schema.Array(Schema.String),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})
```

#### LoadingQueueState

```typescript
LoadingQueueState = Schema.Struct({
  _tag: Schema.Literal('LoadingQueueState'),
  pending: Schema.Array(LoadingRequest), // 待機中リクエスト
  inProgress: Schema.Array(LoadingRequest), // 実行中リクエスト
  completed: Schema.Array(Schema.String), // 完了リクエストID
  failed: Schema.Array(
    Schema.Struct({
      requestId: Schema.String,
      error: Schema.String,
      retryCount: Schema.Number,
    })
  ),
  totalProcessed: Schema.Number.pipe(Schema.nonNegativeInteger()),
  averageLoadTime: Schema.Number.pipe(Schema.positive()),
})
```

#### LoadingBatch

```typescript
LoadingBatch = Schema.Struct({
  _tag: Schema.Literal('LoadingBatch'),
  batchId: Schema.String,
  requests: Schema.Array(LoadingRequest),
  priority: LoadingPriority,
  totalSize: Schema.Number.pipe(Schema.positive()),
  estimatedDuration: Schema.Number.pipe(Schema.positive()),
  maxConcurrency: Schema.Number.pipe(Schema.positive(), Schema.int()),
})
```

#### SchedulingStrategy

```typescript
SchedulingStrategy = Schema.Union(
  Schema.Literal('fifo'), // 先入先出
  Schema.Literal('priority_based'), // 優先度ベース
  Schema.Literal('distance_based'), // 距離ベース
  Schema.Literal('deadline_driven'), // 締切駆動
  Schema.Literal('adaptive') // 適応的スケジューリング
)
```

#### SchedulerConfiguration

```typescript
SchedulerConfiguration = Schema.Struct({
  _tag: Schema.Literal('SchedulerConfiguration'),
  strategy: SchedulingStrategy,
  maxConcurrentLoads: Schema.Number.pipe(Schema.positive(), Schema.int()),
  priorityWeights: Schema.Record(LoadingPriority, Schema.Number),
  distanceDecayFactor: Schema.Number.pipe(Schema.between(0, 1)),
  deadlineWeight: Schema.Number.pipe(Schema.positive()),
  batchingEnabled: Schema.Boolean,
  batchSizeThreshold: Schema.Number.pipe(Schema.positive()),
  adaptiveThresholds: Schema.Struct({
    memoryPressure: Schema.Number.pipe(Schema.between(0, 1)),
    cpuLoad: Schema.Number.pipe(Schema.between(0, 1)),
    networkLatency: Schema.Number.pipe(Schema.positive()),
  }),
})
```

#### PlayerMovementState

```typescript
PlayerMovementState = Schema.Struct({
  _tag: Schema.Literal('PlayerMovementState'),
  playerId: Schema.String,
  currentPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  movementVector: MovementVector,
  viewDistance: Schema.Number.pipe(Schema.positive()),
  lastUpdate: Schema.Number,
  history: Schema.Array(
    Schema.Struct({
      position: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
      timestamp: Schema.Number,
    })
  ),
})
```

#### MovementVector

```typescript
MovementVector = Schema.Struct({
  _tag: Schema.Literal('MovementVector'),
  velocity: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
  acceleration: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
  direction: Schema.Number.pipe(Schema.between(0, 360)),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
})
```

### 実装関数一覧

| 関数名                               | 役割                                           | 開始行 |
| ------------------------------------ | ---------------------------------------------- | ------ |
| `makeLoadingSchedulerService`        | サービスファクトリ                             | 210    |
| `scheduleLoad`                       | リクエストをキューに追加                       | 227    |
| `scheduleBatch`                      | バッチリクエストをキューに追加                 | 239    |
| `updatePlayerMovement`               | プレイヤー移動状態を更新し予測リクエストを生成 | 252    |
| `getNextTask`                        | 次の実行タスクを取得                           | 268    |
| `reportCompletion`                   | タスク完了を報告                               | 300    |
| `cancelRequest`                      | リクエストをキャンセル                         | 338    |
| `getQueueState`                      | キューの現在状態を取得                         | 376    |
| `generatePredictiveRequests`         | 先読みリクエストを生成（公開）                 | 378    |
| `updateConfiguration`                | スケジューラ設定を更新                         | 381    |
| `getPerformanceMetrics`              | パフォーマンスメトリクスを取得                 | 387    |
| `comparePriority`                    | 優先度比較関数                                 | 391    |
| `selectTaskByStrategy`               | スケジューリング戦略に基づくタスク選択         | 402    |
| `calculateAdaptiveScore`             | 適応的スコア計算                               | 433    |
| `generatePredictiveRequestsInternal` | 先読みリクエストを生成（内部）                 | 441    |

## 2. 現在のキュー管理ロジック

### 状態管理構造

```typescript
// 行213-221: Ref初期化
const queueState =
  yield *
  Ref.make<Schema.Schema.Type<typeof LoadingQueueState>>({
    _tag: 'LoadingQueueState',
    pending: [], // 待機中配列
    inProgress: [], // 実行中配列
    completed: [], // 完了ID配列
    failed: [], // 失敗情報配列
    totalProcessed: 0,
    averageLoadTime: 1000,
  })

const playerMovements = yield * Ref.make<Map<string, Schema.Schema.Type<typeof PlayerMovementState>>>(new Map())
const configuration = yield * Ref.make<Schema.Schema.Type<typeof SchedulerConfiguration>>(DEFAULT_SCHEDULER_CONFIG)
const performanceMetrics = yield * Ref.make<Record<string, number>>({})
```

### キュー操作パターン

#### 1. 追加操作（scheduleLoad: 行227-237）

```typescript
yield *
  Ref.update(queueState, (state) => ({
    ...state,
    pending: [...state.pending, request].sort(comparePriority), // ⚠️ O(n log n) ソート
  }))
```

**問題点**:

- 毎回全体をソートするため O(n log n) のコスト
- スプレッド構文による配列コピー

#### 2. 取得操作（getNextTask: 行268-298）

```typescript
// 行274: 早期return条件
if (state.pending.length === 0 || state.inProgress.length >= config.maxConcurrentLoads) {
  return Option.none()
}

// 行279: 戦略に基づくタスク選択
const selectedTask = yield * selectTaskByStrategy(state.pending, config.strategy)

// 行287-291: pending → inProgress への移動
yield *
  Ref.update(queueState, (state) => ({
    ...state,
    pending: state.pending.filter((r) => r.id !== task.id), // ⚠️ O(n) フィルタ
    inProgress: [...state.inProgress, task],
  }))
```

**問題点**:

- `filter` による線形検索 O(n)
- 配列の再構築コスト

#### 3. 完了操作（reportCompletion: 行300-336）

```typescript
yield *
  Ref.update(queueState, (state) => {
    const inProgressIndex = state.inProgress.findIndex((r) => r.id === requestId) // ⚠️ O(n)
    if (inProgressIndex === -1) return state

    const newInProgress = state.inProgress.filter((_, i) => i !== inProgressIndex) // ⚠️ O(n)

    return success
      ? {
          ...state,
          inProgress: newInProgress,
          completed: [...state.completed, requestId],
          totalProcessed: state.totalProcessed + 1,
        }
      : {
          ...state,
          inProgress: newInProgress,
          failed: [...state.failed, { requestId, error: 'Loading failed', retryCount: 0 }],
        }
  })
```

**問題点**:

- `findIndex` + `filter` で O(2n)
- 配列の再構築コスト

#### 4. キャンセル操作（cancelRequest: 行338-374）

```typescript
// 行343: pendingから検索・削除
const pendingIndex = state.pending.findIndex((r) => r.id === requestId) // ⚠️ O(n)
yield *
  Ref.update(queueState, (state) => ({
    ...state,
    pending: state.pending.filter((_, i) => i !== pendingIndex), // ⚠️ O(n)
  }))

// 行358: inProgressから検索・削除
const inProgressIndex = state.inProgress.findIndex((r) => r.id === requestId) // ⚠️ O(n)
yield *
  Ref.update(queueState, (state) => ({
    ...state,
    inProgress: state.inProgress.filter((_, i) => i !== inProgressIndex), // ⚠️ O(n)
  }))
```

**問題点**:

- pendingとinProgressの両方を線形検索
- 最悪ケースで O(4n) (2つの findIndex + 2つの filter)

### 優先度制御

#### comparePriority関数（行391-400）

```typescript
const comparePriority = (
  a: Schema.Schema.Type<typeof LoadingRequest>,
  b: Schema.Schema.Type<typeof LoadingRequest>
) => {
  const priorityOrder = { critical: 5, high: 4, normal: 3, low: 2, background: 1 }
  const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]

  // 優先度が同じ場合は距離で比較
  return priorityDiff !== 0 ? priorityDiff : a.distance - b.distance
}
```

#### スケジューリング戦略（selectTaskByStrategy: 行402-431）

```typescript
Match.value(strategy).pipe(
  Match.when('fifo', () => Option.some(pending[0])),
  Match.when('priority_based', () => Option.some(pending.sort(comparePriority)[0])), // ⚠️ 毎回ソート
  Match.when('distance_based', () => Option.some(pending.sort((a, b) => a.distance - b.distance)[0])), // ⚠️ 毎回ソート
  Match.when('deadline_driven', () => {
    const withDeadlines = pending.filter((r) => r.deadline && r.deadline > now)
    return withDeadlines.length > 0
      ? Option.some(withDeadlines.sort((a, b) => (a.deadline || 0) - (b.deadline || 0))[0]) // ⚠️ 毎回ソート
      : Option.some(pending[0])
  }),
  Match.when('adaptive', () => {
    const scored = pending.map((req) => ({
      request: req,
      score: calculateAdaptiveScore(req, now),
    }))
    const best = scored.sort((a, b) => b.score - a.score)[0] // ⚠️ 毎回ソート
    return Option.some(best.request)
  }),
  Match.exhaustive
)
```

**問題点**:

- 戦略によっては `getNextTask` 呼び出しごとに O(n log n) のソート
- `adaptive` 戦略では `map` + `sort` で O(n + n log n)

### Ref更新頻度

**Ref.update(queueState, ...) の呼び出し箇所**:

1. 行231: `scheduleLoad` - リクエスト追加時
2. 行287: `getNextTask` - タスク取得時
3. 行302: `reportCompletion` - 完了報告時
4. 行346: `cancelRequest` (pending) - キャンセル時
5. 行361: `cancelRequest` (inProgress) - キャンセル時

**合計**: 5箇所（高頻度な更新が想定される）

## 3. 既存インターフェース

### 使用箇所一覧

| ファイルパス                                           | 使用メソッド       | 呼び出しパターン                          |
| ------------------------------------------------------ | ------------------ | ----------------------------------------- |
| `src/application/world/progressive_loading/factory.ts` | `scheduleLoad`     | チャンク読み込みリクエスト作成時（行158） |
| `src/application/world/progressive_loading/factory.ts` | `getQueueState`    | システム状態取得時（行104）               |
| `src/application/world/progressive_loading/factory.ts` | `reportCompletion` | 読み込み完了報告時（行167）               |
| `src/application/world/progressive_loading/index.ts`   | エクスポートのみ   | -                                         |
| `src/application/world/progressive_loading/layer.ts`   | Layer構成          | -                                         |
| `src/application/world/index.ts`                       | エクスポートのみ   | -                                         |

### factory.tsでの使用例

```typescript
// 行104: システム状態取得
const queueState = yield * scheduler.getQueueState()
// 使用: queueState.pending.length, queueState.inProgress.length, queueState.totalProcessed

// 行158: チャンク読み込みリクエスト
yield * scheduler.scheduleLoad(loadRequest)

// 行167: 完了報告
yield * scheduler.reportCompletion(requestId, success, metrics)
```

### 公開API

```typescript
// Context Tag定義（行513-515）
export const LoadingSchedulerService = Context.GenericTag<LoadingSchedulerService>(
  '@minecraft/domain/world/LoadingSchedulerService'
)

// Layer定義（行520）
export const LoadingSchedulerServiceLive = Layer.effect(LoadingSchedulerService, makeLoadingSchedulerService)

// デフォルト設定（行524-544）
export const DEFAULT_SCHEDULER_CONFIG: Schema.Schema.Type<typeof SchedulerConfiguration> = {
  _tag: 'SchedulerConfiguration',
  strategy: 'adaptive',
  maxConcurrentLoads: 4,
  priorityWeights: {
    critical: 1.0,
    high: 0.8,
    normal: 0.6,
    low: 0.4,
    background: 0.2,
  },
  distanceDecayFactor: 0.9,
  deadlineWeight: 2.0,
  batchingEnabled: true,
  batchSizeThreshold: 5,
  adaptiveThresholds: {
    memoryPressure: 0.8,
    cpuLoad: 0.7,
    networkLatency: 100,
  },
}
```

## 4. 依存関係

### 内部依存

```typescript
import { Clock, Context, Effect, Layer, Match, Option, pipe, ReadonlyArray, Ref, Schema } from 'effect'
```

- **Ref**: 状態管理（4つのRef: queueState, playerMovements, configuration, performanceMetrics）
- **Context**: Service定義
- **Layer**: 依存注入
- **Effect.gen**: 非同期処理の合成
- **Clock**: タイムスタンプ取得
- **Option**: Nullable値の表現
- **Match**: パターンマッチング
- **ReadonlyArray**: 関数型配列操作
- **Schema**: 型定義とバリデーション

### 外部依存

- なし（完全に自己完結したモジュール）

## 5. パフォーマンスボトルネック

### 特定された問題

#### 1. 配列ソート（最重要）

- **箇所**: 行233（scheduleLoad時の毎回ソート）
- **頻度**: リクエスト追加ごと
- **コスト**: O(n log n)
- **影響**: pending配列が大きくなるほど顕著

```typescript
pending: [...state.pending, request].sort(comparePriority)
```

#### 2. 戦略別ソート

- **箇所**: 行412, 413, 417, 426（selectTaskByStrategy内）
- **頻度**: `getNextTask` 呼び出しごと
- **コスト**: O(n log n)
- **影響**: `priority_based`, `distance_based`, `deadline_driven`, `adaptive` 戦略で発生

#### 3. 配列の線形検索・フィルタ

- **箇所**:
  - 行289: `pending.filter((r) => r.id !== task.id)`
  - 行303: `state.inProgress.findIndex((r) => r.id === requestId)`
  - 行307: `state.inProgress.filter((_, i) => i !== inProgressIndex)`
  - 行343, 358: cancelRequestでの findIndex + filter
- **頻度**: タスク取得、完了報告、キャンセル時
- **コスト**: O(n) または O(2n)
- **影響**: inProgress配列は小さい想定（maxConcurrentLoads=4）だが、pending配列は大きくなる可能性

#### 4. Ref更新頻度

- **頻度**: 高頻度（リクエスト追加、タスク取得、完了報告、キャンセル）
- **コスト**: Refの更新自体は軽量だが、配列操作のコストが累積
- **影響**: 同時実行時の競合は少ない（Refの特性）

#### 5. メモリ使用

- **問題**: pending配列の無制限成長
- **リスク**: 大量のリクエストが溜まる可能性
- **現状**: 制限なし

### 計測データ（推定）

| 操作             | 現在のコスト | Queue導入後          | 改善率   |
| ---------------- | ------------ | -------------------- | -------- |
| scheduleLoad     | O(n log n)   | O(1) または O(log n) | ~100x    |
| getNextTask      | O(n log n)   | O(log n) または O(1) | ~10-100x |
| reportCompletion | O(n)         | O(1)                 | ~10x     |
| cancelRequest    | O(2n)        | O(log n)             | ~10x     |

## 6. Queue設計への推奨事項

### 優先度別Queue構成

```typescript
interface QueuedSchedulerState {
  // 優先度別のbounded Queue
  criticalQueue: Queue.Queue<LoadingRequest> // bounded(20)  - 最高優先度
  highQueue: Queue.Queue<LoadingRequest> // bounded(50)  - 高優先度
  normalQueue: Queue.Queue<LoadingRequest> // bounded(100) - 通常優先度
  lowQueue: Queue.Queue<LoadingRequest> // bounded(200) - 低優先度
  backgroundQueue: Queue.Queue<LoadingRequest> // unbounded    - バックグラウンド

  // 実行中・完了・失敗は既存の構造を維持
  inProgress: Map<string, LoadingRequest> // O(1)検索のためMap化
  completed: Set<string> // O(1)検索のためSet化
  failed: Map<string, FailedRequest> // O(1)検索のためMap化

  // メトリクス
  totalProcessed: number
  averageLoadTime: number
}
```

### Queue API活用パターン

#### 1. scheduleLoad（追加操作）

```typescript
// 現在: O(n log n)
pending: [...state.pending, request].sort(comparePriority)

// Queue導入後: O(1) または O(log n)
const queue = selectQueueByPriority(request.priority)
yield * Queue.offer(queue, request) // bounded queueはback-pressure適用
```

#### 2. getNextTask（取得操作）

```typescript
// 現在: O(n log n)
const selectedTask = yield * selectTaskByStrategy(state.pending, config.strategy)

// Queue導入後: O(log n) または O(1)
// 優先度順にQueueをポーリング
const task =
  yield *
  Effect.gen(function* () {
    const critical = yield* Queue.poll(criticalQueue)
    if (Option.isSome(critical)) return critical.value

    const high = yield* Queue.poll(highQueue)
    if (Option.isSome(high)) return high.value

    // ... 以下同様
  })
```

#### 3. reportCompletion（完了操作）

```typescript
// 現在: O(n) × 2回
const inProgressIndex = state.inProgress.findIndex(...)
const newInProgress = state.inProgress.filter(...)

// Queue導入後: O(1)
const inProgressMap = yield* Ref.get(inProgressMapRef)
const request = inProgressMap.get(requestId)
if (request) {
  yield* Ref.update(inProgressMapRef, (map) => {
    const newMap = new Map(map)
    newMap.delete(requestId)
    return newMap
  })
}
```

#### 4. cancelRequest（キャンセル操作）

```typescript
// 現在: O(4n) - pending/inProgressの両方を線形検索
const pendingIndex = state.pending.findIndex(...)
const inProgressIndex = state.inProgress.findIndex(...)

// Queue導入後: 課題あり
// Queueからの特定要素削除は非効率（Queue APIに削除機能なし）
// 代替案:
// 1. キャンセルフラグをMapで管理
// 2. take時にキャンセルチェック
// 3. キャンセル専用の処理フロー
```

### バックプレッシャー制御

```typescript
// bounded Queueの容量設定
const criticalQueue = yield * Queue.bounded<LoadingRequest>(20)
const highQueue = yield * Queue.bounded<LoadingRequest>(50)
const normalQueue = yield * Queue.bounded<LoadingRequest>(100)
const lowQueue = yield * Queue.bounded<LoadingRequest>(200)
const backgroundQueue = yield * Queue.unbounded<LoadingRequest>()

// offer時のback-pressure（自動的に適用される）
yield * Queue.offer(criticalQueue, request)
// キューが満杯の場合、Fiberはスペースが空くまで自動的にサスペンド
```

### スケジューリング戦略の実装

#### FIFO戦略

```typescript
// 現在のpending[0]と同等
const task = yield * Queue.take(criticalQueue) // O(1)
```

#### Priority-Based戦略

```typescript
// 優先度順にポーリング（既にQueue分離で実現）
const task = yield * pollQueuesInPriorityOrder([criticalQueue, highQueue, normalQueue, lowQueue, backgroundQueue])
```

#### Distance-Based戦略

```typescript
// 課題: Queueは挿入順序を保持するが、動的ソートは不可
// 解決策:
// 1. 距離範囲別の細分化Queue
// 2. 距離をpriorityに変換してQueue選択
// 3. 取得後に追加フィルタリング
```

#### Adaptive戦略

```typescript
// 課題: スコア計算が必要
// 解決策:
// 1. 定期的なスコア再計算とQueue再投入
// 2. スコアをメタデータとして保持し、取得時にソート
// 3. 複数のQueue戦略の動的切り替え
```

### インターフェース互換性戦略

```typescript
// 既存のgetQueueState()を維持
const getQueueState = () =>
  Effect.gen(function* () {
    // Queueの内部状態を従来形式に変換
    const criticalSize = yield* Queue.size(criticalQueue)
    const highSize = yield* Queue.size(highQueue)
    // ... 他のQueueも同様

    const inProgressMap = yield* Ref.get(inProgressMapRef)
    const completedSet = yield* Ref.get(completedSetRef)
    const failedMap = yield* Ref.get(failedMapRef)

    return {
      _tag: 'LoadingQueueState',
      pending: [], // 注意: 配列として返すには全Queueを走査する必要がある
      inProgress: Array.from(inProgressMap.values()),
      completed: Array.from(completedSet),
      failed: Array.from(failedMap.values()),
      totalProcessed: yield* Ref.get(totalProcessedRef),
      averageLoadTime: yield* Ref.get(averageLoadTimeRef),
    }
  })

// 注意: pending配列の取得は非効率
// 代替案: getQueueStateの型を変更し、統計情報のみ返す
```

### 移行時の課題と解決策

#### 課題1: Queue内の要素列挙

- **問題**: Queueは内部要素を列挙する機能がない
- **影響**: `getQueueState()` で pending配列を返せない
- **解決策**:
  1. `getQueueState()` の型を変更（統計情報のみ）
  2. 別途デバッグ用のstate取得APIを追加
  3. pending情報は `Queue.size()` で件数のみ返す

#### 課題2: 特定要素の削除（cancelRequest）

- **問題**: Queueは特定要素の削除をサポートしない
- **影響**: `cancelRequest()` の実装が複雑化
- **解決策**:
  1. キャンセルフラグをMapで管理
  2. `getNextTask()` 時にキャンセル済みをスキップ
  3. 定期的なクリーンアップ処理

#### 課題3: 距離ベース・Adaptiveスケジューリング

- **問題**: Queueは動的なソート・再順序付けをサポートしない
- **影響**: `distance_based`, `adaptive` 戦略の実装が困難
- **解決策**:
  1. 距離範囲別の細分化Queue
  2. 定期的な再評価とQueue間移動
  3. 優先度への変換ルール整備

## 7. 移行リスク評価

### リスクレベル: 中

#### 低リスク要因

- 既存の主要メソッドシグネチャを維持可能
- Service外部への影響は限定的（factory.tsのみ）
- 段階的な移行が可能（内部実装から開始）

#### 高リスク要因

- `getQueueState()` の戻り値型の変更が必要
- cancelRequestの実装が複雑化
- 一部のスケジューリング戦略の再設計が必要

### テストケース要件

#### 1. 基本機能テスト

- scheduleLoad → getNextTask → reportCompletion のフロー
- 優先度順の取得動作
- バックプレッシャー動作

#### 2. 互換性テスト

- factory.tsでの使用パターンが正常動作
- getQueueStateの返却値が想定形式

#### 3. パフォーマンステスト

- 1000件のリクエスト追加時間
- 100件同時取得時間
- メモリ使用量の上限確認

#### 4. エッジケーステスト

- Queue満杯時のback-pressure動作
- キャンセル済みリクエストのスキップ
- 空Queue時のgetNextTask動作

## 8. 推奨実装フェーズ

### Phase 1: 基本Queue導入（最小限の変更）

- 優先度別Queue構築
- scheduleLoad/getNextTaskのQueue化
- FIFO/Priority-Based戦略の実装
- **リスク**: 低

### Phase 2: Map/Set化（効率化）

- inProgress/completed/failedのMap/Set化
- reportCompletion/cancelRequestの最適化
- **リスク**: 低

### Phase 3: 高度なスケジューリング

- Distance-Based/Adaptive戦略の再設計
- 動的な優先度調整機能
- **リスク**: 中

### Phase 4: API最適化

- getQueueStateの型変更
- 統計情報APIの追加
- **リスク**: 中（外部影響あり）

## 9. 結論

### Queue化による改善見込み

| 項目               | 改善効果               |
| ------------------ | ---------------------- |
| scheduleLoad性能   | 50-100x高速化          |
| getNextTask性能    | 10-50x高速化           |
| メモリ使用量       | 上限制御可能           |
| バックプレッシャー | 新規追加               |
| コードの複雑さ     | 微増（キャンセル処理） |

### 推奨アクション

1. **Phase 1から開始**: 基本Queue導入で大きな効果
2. **getQueueState型変更を早期決定**: 統計情報のみに変更を推奨
3. **cancelRequestの設計詳細化**: キャンセルフラグ管理の仕様策定
4. **パフォーマンス計測**: 実装前後でベンチマーク取得

### 次のステップ

- Phase 1の詳細設計書作成
- getQueueState型変更のfactory.ts影響調査
- キャンセル処理フローの詳細設計
- ベンチマーク環境の構築
