# LoadingScheduler Queue設計書

## 概要

Phase 4-1-Aの分析結果に基づき、LoadingSchedulerを配列ベースの実装からEffect-TS Queueベースの実装に移行する詳細設計を定義します。既存インターフェースとの互換性を維持しながら、パフォーマンス改善を実現します。

## 1. Queue構成

### 1-1. 状態設計

```typescript
interface QueuedSchedulerState {
  // === 優先度別Queue（5段階） ===
  criticalQueue: Queue.Queue<LoadingRequest> // bounded(20)  - プレイヤー周辺の即座ロード
  highQueue: Queue.Queue<LoadingRequest> // bounded(50)  - 視界内の優先ロード
  normalQueue: Queue.Queue<LoadingRequest> // bounded(100) - 通常ロード
  lowQueue: Queue.Queue<LoadingRequest> // bounded(200) - 予測ロード
  backgroundQueue: Queue.Queue<LoadingRequest> // unbounded    - バックグラウンド

  // === 実行状態管理（O(1)化） ===
  inProgress: Map<string, InProgressRequest> // 実行中リクエスト + 開始時刻
  completed: Set<string> // 完了リクエストID
  failed: Map<string, FailedRequest> // 失敗リクエスト + エラー情報

  // === キャンセル管理 ===
  cancelled: Set<string> // キャンセルフラグ（Queue内削除不可のため）

  // === 統計情報（getQueueState用） ===
  totalProcessed: number
  averageLoadTime: number

  // === プレイヤー移動状態 ===
  playerMovements: Map<string, PlayerMovementState>

  // === 設定 ===
  configuration: SchedulerConfiguration
  performanceMetrics: Record<string, number>
}

interface InProgressRequest {
  request: LoadingRequest
  startTime: number // Clock.currentTimeMillisで取得
}
```

### 1-2. Queueサイズ決定根拠

| Queue          | サイズ       | 根拠                                                                                     | バックプレッシャー戦略                       |
| -------------- | ------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| **critical**   | bounded(20)  | プレイヤー周辺16x16ブロック範囲、最大チャンク数は理論上256だが、実際の同時ロードは20以下 | 満杯時は即座にエラー返却、ゲームプレイに影響 |
| **high**       | bounded(50)  | 視界範囲内（render distance 8-12チャンク）の先読み、移動速度を考慮                       | 満杯時はnormalに降格                         |
| **normal**     | bounded(100) | 通常の視界外チャンク読み込み、プレイヤー移動に合わせた段階的ロード                       | 満杯時はlowに降格                            |
| **low**        | bounded(200) | 予測読み込み、プレイヤーが向かう可能性のある方向のチャンク                               | 満杯時はbackgroundに降格                     |
| **background** | unbounded    | バックグラウンドの最適化・プリロード、メモリ圧迫時に自動破棄                             | 制限なし、メモリ監視で制御                   |

**設計判断の根拠**:

- Minecraft標準のチャンクサイズは16x16ブロック
- 標準的なrender distanceは8-12チャンク（半径）
- 最大同時表示チャンク数: π × 12² ≈ 452チャンク
- 実際の同時ロード数はconfiguration.maxConcurrentLoads（デフォルト4）で制限

### 1-3. Queue vs 戦略別Queueの判断

**採用**: 優先度別Queueのみ（戦略別Queueは不採用）

**理由**:

1. **FIFO/Priority-Based**: 優先度Queueで自然に実現可能
2. **Distance-Based**: 優先度に距離を織り込む（critical/high/normalの区分で代替）
3. **Adaptive**: リクエスト生成時に動的に優先度を調整

**戦略とQueueの対応**:

```typescript
// scheduleLoad時に戦略に応じて優先度を決定
const determinePriority = (request: LoadingRequest, strategy: SchedulingStrategy): LoadingPriority => {
  switch (strategy) {
    case 'fifo':
    case 'priority_based':
      return request.priority // リクエストの優先度をそのまま使用

    case 'distance_based':
      // 距離に基づいて優先度を再計算
      if (request.distance < 32) return 'critical'
      if (request.distance < 64) return 'high'
      if (request.distance < 128) return 'normal'
      if (request.distance < 256) return 'low'
      return 'background'

    case 'adaptive':
      // メモリ圧力・CPU負荷に応じて動的調整
      const memoryPressure = getMemoryPressure()
      if (memoryPressure > 0.8) return downgrade(request.priority)
      if (memoryPressure < 0.4) return upgrade(request.priority)
      return request.priority
  }
}
```

## 2. インターフェース設計

### 2-1. 維持するAPI（既存シグネチャ100%互換）

```typescript
interface LoadingSchedulerService {
  // === 完全互換API ===
  readonly scheduleLoad: (request: LoadingRequest) => Effect.Effect<void, LoadingSchedulerError>
  readonly getNextTask: () => Effect.Effect<Option.Option<LoadingRequest>, LoadingSchedulerError>
  readonly reportCompletion: (
    requestId: string,
    success: boolean,
    metrics?: Record<string, number>
  ) => Effect.Effect<void, LoadingSchedulerError>
  readonly cancelRequest: (requestId: string, reason?: string) => Effect.Effect<boolean, LoadingSchedulerError>

  // === 変更が必要なAPI（後方互換性維持） ===
  readonly getQueueState: () => Effect.Effect<LoadingQueueState, LoadingSchedulerError>

  // === その他のAPI（影響なし） ===
  readonly scheduleBatch: (batch: LoadingBatch) => Effect.Effect<void, LoadingSchedulerError>
  readonly updatePlayerMovement: (state: PlayerMovementState) => Effect.Effect<void, LoadingSchedulerError>
  readonly generatePredictiveRequests: (
    playerId: string,
    lookAheadSeconds: number
  ) => Effect.Effect<LoadingRequest[], LoadingSchedulerError>
  readonly updateConfiguration: (config: Partial<SchedulerConfiguration>) => Effect.Effect<void, LoadingSchedulerError>
  readonly getPerformanceMetrics: () => Effect.Effect<Record<string, number>, LoadingSchedulerError>
}
```

### 2-2. getQueueState()の互換性確保

**問題**: Effect-TS Queueは内部要素を列挙できない（`Queue.takeAll()`は破壊的操作）

**採用案**: **案A - 統計情報のみ返却（非破壊的変更）**

```typescript
// 既存の型定義を維持
export const LoadingQueueState = Schema.Struct({
  _tag: Schema.Literal('LoadingQueueState'),
  pending: Schema.Array(LoadingRequest), // 空配列 [] を返す
  inProgress: Schema.Array(LoadingRequest), // Map → Array変換
  completed: Schema.Array(Schema.String), // Set → Array変換
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

// 実装
const getQueueState = () =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)

    return {
      _tag: 'LoadingQueueState' as const,
      pending: [], // Queue内部は参照不可のため空配列
      inProgress: Array.from(state.inProgress.values()).map((ip) => ip.request),
      completed: Array.from(state.completed),
      failed: Array.from(state.failed.entries()).map(([requestId, info]) => ({
        requestId,
        error: info.error,
        retryCount: info.retryCount,
      })),
      totalProcessed: state.totalProcessed,
      averageLoadTime: state.averageLoadTime,
    }
  })
```

**factory.ts影響調査結果**:

```typescript
// factory.ts内の使用箇所（110-113行目）
const queueState = yield* scheduler.getQueueState()
// ...
scheduler: {
  pendingRequests: queueState.pending.length,  // ⚠️ 常に0になる
  inProgressRequests: queueState.inProgress.length,  // ✅ 正常動作
  totalProcessed: queueState.totalProcessed,  // ✅ 正常動作
}
```

**対策**: `pendingRequests`の代替実装

```typescript
// 新規API追加（後方互換性維持）
interface LoadingSchedulerService {
  // 既存API...

  // 新規: Queue統計情報取得（pending数を含む）
  readonly getQueueStatistics: () => Effect.Effect<QueueStatistics, LoadingSchedulerError>
}

interface QueueStatistics {
  pendingCount: number        // 全Queueのsize合計
  inProgressCount: number
  completedCount: number
  failedCount: number
  priorityBreakdown: {
    critical: number
    high: number
    normal: number
    low: number
    background: number
  }
}

// 実装
const getQueueStatistics = () =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)

    // Queue.sizeはキャパシティではなく現在の要素数を返す
    const criticalSize = yield* Queue.size(state.criticalQueue)
    const highSize = yield* Queue.size(state.highQueue)
    const normalSize = yield* Queue.size(state.normalQueue)
    const lowSize = yield* Queue.size(state.lowQueue)
    const backgroundSize = yield* Queue.size(state.backgroundQueue)

    return {
      pendingCount: criticalSize + highSize + normalSize + lowSize + backgroundSize,
      inProgressCount: state.inProgress.size,
      completedCount: state.completed.size,
      failedCount: state.failed.size,
      priorityBreakdown: {
        critical: criticalSize,
        high: highSize,
        normal: normalSize,
        low: lowSize,
        background: backgroundSize,
      }
    }
  })

// factory.ts側の修正
const getSystemStatus = () =>
  Effect.gen(function* () {
    const queueStats = yield* scheduler.getQueueStatistics()  // 新API使用
    // ...
    scheduler: {
      pendingRequests: queueStats.pendingCount,  // ✅ 正確な値
      inProgressRequests: queueStats.inProgressCount,
      totalProcessed: queueState.totalProcessed,
    }
  })
```

**代替案B（不採用）**: `Queue.takeAll()` + 再offer

```typescript
// ❌ 不採用理由
// 1. 高コスト: O(n)の全要素取り出し + 再挿入
// 2. 並行アクセス時の競合リスク
// 3. Queue順序の保証が困難
const getPendingRequests = () =>
  Effect.gen(function* () {
    const items = yield* Queue.takeAll(queue)
    const result = Chunk.toReadonlyArray(items)

    // 全要素を再挿入（順序が崩れる可能性あり）
    for (const item of result) {
      yield* Queue.offer(queue, item)
    }

    return result
  })
```

### 2-3. cancelRequest()の設計

**問題**: Queue内の特定要素を削除できない（Queue APIに削除メソッドなし）

**解決策**: キャンセルフラグ管理 + getNextTask時のスキップ

```typescript
const cancelRequest = (requestId: string, reason?: string) =>
  Effect.gen(function* () {
    yield* Ref.update(schedulerState, (state) => ({
      ...state,
      cancelled: state.cancelled.add(requestId),
    }))

    // inProgressから削除
    const state = yield* Ref.get(schedulerState)
    const wasInProgress = state.inProgress.has(requestId)

    if (wasInProgress) {
      yield* Ref.update(schedulerState, (state) => {
        const newInProgress = new Map(state.inProgress)
        newInProgress.delete(requestId)
        return { ...state, inProgress: newInProgress }
      })
    }

    yield* Effect.logInfo(`リクエストキャンセル: ${requestId} ${reason ? `(理由: ${reason})` : ''}`)
    return true // pending内にあるかは不明だがキャンセルフラグは設定済み
  })

const getNextTask = () =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)
    const config = state.configuration

    // 早期return条件
    if (state.inProgress.size >= config.maxConcurrentLoads) {
      return Option.none()
    }

    // 優先度順にQueueをポーリング
    const queues = [state.criticalQueue, state.highQueue, state.normalQueue, state.lowQueue, state.backgroundQueue]

    for (const queue of queues) {
      // Queueが空でない場合のみtakeを試行
      const size = yield* Queue.size(queue)
      if (size === 0) continue

      // 非ブロッキングポーリング
      const taskOption = yield* Queue.poll(queue)

      if (Option.isSome(taskOption)) {
        const task = taskOption.value

        // キャンセルチェック
        if (state.cancelled.has(task.id)) {
          yield* Effect.logDebug(`キャンセル済みタスクをスキップ: ${task.id}`)
          // 再帰的に次を取得（最大10回まで）
          return yield* getNextTask()
        }

        // inProgressに追加
        yield* Ref.update(schedulerState, (state) => ({
          ...state,
          inProgress: state.inProgress.set(task.id, {
            request: task,
            startTime: Date.now(),
          }),
        }))

        return Option.some(task)
      }
    }

    return Option.none()
  })
```

**メモリリーク対策**: 定期的なcancelledセットのクリーンアップ

```typescript
// サービス初期化時にクリーンアップを定期実行
const startCancelledCleanup = () =>
  Effect.gen(function* () {
    yield* Effect.repeat(
      Effect.gen(function* () {
        const state = yield* Ref.get(schedulerState)

        // completedまたはfailedに含まれるIDはcancelledから削除
        const toRemove = new Set<string>()
        for (const id of state.cancelled) {
          if (state.completed.has(id) || state.failed.has(id)) {
            toRemove.add(id)
          }
        }

        if (toRemove.size > 0) {
          yield* Ref.update(schedulerState, (state) => ({
            ...state,
            cancelled: new Set([...state.cancelled].filter((id) => !toRemove.has(id))),
          }))
          yield* Effect.logDebug(`キャンセルフラグクリーンアップ: ${toRemove.size}件削除`)
        }
      }),
      Schedule.spaced(Duration.seconds(60)) // 60秒ごと
    )
  }).pipe(Effect.fork) // バックグラウンド実行
```

## 3. 戦略別実装方針

### Phase 1: FIFO/Priority-Based（優先実装）

**実装内容**:

```typescript
const scheduleLoad = (request: LoadingRequest) =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)
    const config = state.configuration

    // 戦略に応じた優先度決定
    const effectivePriority = config.strategy === 'priority_based' ? request.priority : request.priority // FIFOもpriority_basedと同じ扱い（Queueの挿入順が保証される）

    // 適切なQueueに投入
    const targetQueue = selectQueue(state, effectivePriority)

    // バックプレッシャー処理
    const offerResult = yield* Queue.offer(targetQueue, request).pipe(
      Effect.catchTag('QueueFullError', (error) =>
        Effect.gen(function* () {
          // 降格処理
          const downgradedPriority = downgradePriority(effectivePriority)
          if (downgradedPriority !== effectivePriority) {
            yield* Effect.logWarning(`Queue満杯により優先度降格: ${effectivePriority} → ${downgradedPriority}`)
            const fallbackQueue = selectQueue(state, downgradedPriority)
            return yield* Queue.offer(fallbackQueue, {
              ...request,
              priority: downgradedPriority,
            })
          }

          // 降格不可の場合はエラー
          return yield* Effect.fail(
            new LoadingSchedulerError({
              message: `Queue満杯でリクエストを受け付けられません: ${request.id}`,
              schedulerId: 'loading-scheduler',
              requestId: request.id,
            })
          )
        })
      )
    )

    yield* Effect.logDebug(`リクエストキューに追加: ${request.id} (優先度: ${effectivePriority})`)
  })

const selectQueue = (state: QueuedSchedulerState, priority: LoadingPriority): Queue.Queue<LoadingRequest> => {
  switch (priority) {
    case 'critical':
      return state.criticalQueue
    case 'high':
      return state.highQueue
    case 'normal':
      return state.normalQueue
    case 'low':
      return state.lowQueue
    case 'background':
      return state.backgroundQueue
  }
}

const downgradePriority = (priority: LoadingPriority): LoadingPriority => {
  switch (priority) {
    case 'critical':
      return 'high'
    case 'high':
      return 'normal'
    case 'normal':
      return 'low'
    case 'low':
      return 'background'
    case 'background':
      return 'background' // これ以上降格不可
  }
}
```

**期待効果**:

- scheduleLoad: **O(n log n) → O(1)** - ソート不要、Queue.offerのみ
- getNextTask: **O(n log n) → O(5)** - 最大5つのQueueをポーリング
- reportCompletion: **O(n) → O(1)** - Map.delete
- cancelRequest: **O(n) → O(1)** - Set.add

### Phase 2: Map/Set最適化（Phase 1と同時実装可能）

**実装内容**:

```typescript
// reportCompletionの最適化
const reportCompletion = (requestId: string, success: boolean, metrics?: Record<string, number>) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis

    yield* Ref.update(schedulerState, (state) => {
      // O(1)削除
      const inProgressData = state.inProgress.get(requestId)
      if (!inProgressData) return state

      const newInProgress = new Map(state.inProgress)
      newInProgress.delete(requestId)

      const loadTime = now - inProgressData.startTime
      const newAverageLoadTime = (state.averageLoadTime * state.totalProcessed + loadTime) / (state.totalProcessed + 1)

      if (success) {
        return {
          ...state,
          inProgress: newInProgress,
          completed: state.completed.add(requestId),
          totalProcessed: state.totalProcessed + 1,
          averageLoadTime: newAverageLoadTime,
        }
      } else {
        return {
          ...state,
          inProgress: newInProgress,
          failed: state.failed.set(requestId, {
            requestId,
            error: 'Loading failed',
            retryCount: 0,
            timestamp: now,
          }),
        }
      }
    })

    // パフォーマンスメトリクス更新
    yield* Effect.when(metrics !== undefined, () =>
      Ref.update(schedulerState, (state) => ({
        ...state,
        performanceMetrics: { ...state.performanceMetrics, ...metrics },
      }))
    )

    yield* Effect.logInfo(`読み込み完了報告: ${requestId} (成功: ${success}, 時間: ${now}ms)`)
  })
```

### Phase 3: Distance-Based/Adaptive（将来対応）

**Distance-Based実装案（案B採用）**: 距離範囲別の細分化Queue

```typescript
// リクエスト生成時に距離に基づいて優先度を決定
const scheduleLoadWithDistance = (request: LoadingRequest) =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)

    if (state.configuration.strategy === 'distance_based') {
      // 距離に基づく優先度の動的決定
      const distanceBasedPriority = calculateDistanceBasedPriority(request.distance)
      const adjustedRequest = { ...request, priority: distanceBasedPriority }
      return yield* scheduleLoad(adjustedRequest)
    }

    return yield* scheduleLoad(request)
  })

const calculateDistanceBasedPriority = (distance: number): LoadingPriority => {
  // Minecraft標準チャンクサイズ: 16ブロック
  const chunkDistance = distance / 16

  if (chunkDistance < 2) return 'critical' // 0-32ブロック
  if (chunkDistance < 4) return 'high' // 32-64ブロック
  if (chunkDistance < 8) return 'normal' // 64-128ブロック
  if (chunkDistance < 16) return 'low' // 128-256ブロック
  return 'background' // 256ブロック以上
}
```

**Adaptive実装案（案C採用）**: メモリ圧力に基づく動的調整

```typescript
const scheduleLoadWithAdaptation = (request: LoadingRequest) =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)

    if (state.configuration.strategy === 'adaptive') {
      // メモリ圧力・CPU負荷を取得（MemoryMonitorService連携）
      const memoryPressure = yield* getMemoryPressureLevel()

      // 負荷が高い場合は優先度を下げる
      const adaptedPriority = memoryPressure > 0.8 ? downgradePriority(request.priority) : request.priority

      const adjustedRequest = { ...request, priority: adaptedPriority }
      return yield* scheduleLoad(adjustedRequest)
    }

    return yield* scheduleLoad(request)
  })

// 5秒ごとに既存リクエストの優先度を再評価（オプション）
const startAdaptiveRebalancing = () =>
  Effect.gen(function* () {
    yield* Effect.repeat(
      Effect.gen(function* () {
        const state = yield* Ref.get(schedulerState)
        const memoryPressure = yield* getMemoryPressureLevel()

        // メモリ圧力が高い場合、lowとbackgroundのキューを空にする
        if (memoryPressure > 0.9) {
          yield* Queue.takeAll(state.lowQueue)
          yield* Queue.takeAll(state.backgroundQueue)
          yield* Effect.logWarning('メモリ圧力により低優先度キューをクリア')
        }
      }),
      Schedule.spaced(Duration.seconds(5))
    )
  }).pipe(Effect.fork)
```

**トレードオフ**:

- **Distance-Based**: 完全な距離順ソートは不可、範囲での近似
  - **利点**: シンプル、リクエスト時の計算のみ
  - **欠点**: プレイヤー移動時の動的再評価が困難
- **Adaptive**: 定期的な再評価が可能
  - **利点**: メモリ圧力に応じた柔軟な調整
  - **欠点**: 5秒ごとのポーリングによるオーバーヘッド（軽微）

## 4. キャンセル処理設計

### 実装方針

```typescript
// キャンセルフラグ管理
const cancelled = yield * Ref.make(new Set<string>())

// キャンセル時
const cancelRequest = (requestId: string, reason?: string) =>
  Effect.gen(function* () {
    yield* Ref.update(schedulerState, (state) => {
      const newCancelled = new Set(state.cancelled)
      newCancelled.add(requestId)

      // inProgressからも削除
      const newInProgress = new Map(state.inProgress)
      const wasInProgress = newInProgress.delete(requestId)

      return {
        ...state,
        cancelled: newCancelled,
        inProgress: newInProgress,
      }
    })

    yield* Effect.logInfo(`リクエストキャンセル: ${requestId} ${reason ? `(理由: ${reason})` : ''}`)
    return true
  })

// getNextTask時にスキップ
const getNextTaskWithCancellationCheck = () =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)

    // 再帰的にキャンセル済みタスクをスキップ（最大10回）
    const tryGetTask = (retryCount: number): Effect.Effect<Option.Option<LoadingRequest>, LoadingSchedulerError> =>
      Effect.gen(function* () {
        if (retryCount > 10) {
          yield* Effect.logWarning('getNextTask: 10回連続でキャンセル済みタスクを検出、中断')
          return Option.none()
        }

        // Queueから取得
        const taskOption = yield* pollFromQueues(state)

        if (Option.isNone(taskOption)) {
          return Option.none()
        }

        const task = taskOption.value

        // キャンセルチェック
        if (state.cancelled.has(task.id)) {
          yield* Effect.logDebug(`キャンセル済みタスクをスキップ: ${task.id}`)
          return yield* tryGetTask(retryCount + 1)
        }

        return Option.some(task)
      })

    return yield* tryGetTask(0)
  })
```

### メモリリーク対策

**問題**: キャンセルされた要素がQueue内に残り続ける

**対策1**: 定期的なクリーンアップ（60秒ごと）

```typescript
const startCancelledCleanup = () =>
  Effect.gen(function* () {
    yield* Effect.repeat(
      Effect.gen(function* () {
        const state = yield* Ref.get(schedulerState)

        // completedまたはfailedに含まれるIDはcancelledから削除
        const idsToRemove = [...state.cancelled].filter((id) => state.completed.has(id) || state.failed.has(id))

        if (idsToRemove.length > 0) {
          yield* Ref.update(schedulerState, (state) => ({
            ...state,
            cancelled: new Set([...state.cancelled].filter((id) => !idsToRemove.includes(id))),
          }))
          yield* Effect.logDebug(`キャンセルフラグクリーンアップ: ${idsToRemove.length}件削除`)
        }
      }),
      Schedule.spaced(Duration.seconds(60))
    )
  }).pipe(Effect.fork)
```

**対策2**: Queue内のキャンセル済み要素の推定とアラート

```typescript
const estimateCancelledInQueue = () =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)
    const stats = yield* getQueueStatistics()

    // 推定: cancelled数がpendingCountの50%を超えたら警告
    const cancelledRatio = state.cancelled.size / (stats.pendingCount || 1)

    if (cancelledRatio > 0.5) {
      yield* Effect.logWarning(`Queue内のキャンセル済み要素が多い可能性: ${state.cancelled.size}/${stats.pendingCount}`)
    }
  })
```

**対策3**: Queueの定期的な再構築（極端なケースのみ）

```typescript
// メモリ圧力が非常に高く、かつcancelledが大量にある場合のみ実施
const rebuildQueuesIfNeeded = () =>
  Effect.gen(function* () {
    const state = yield* Ref.get(schedulerState)
    const memoryPressure = yield* getMemoryPressureLevel()

    // 条件: メモリ圧力90%以上 かつ cancelledが200以上
    if (memoryPressure > 0.9 && state.cancelled.size > 200) {
      yield* Effect.logWarning('Queue再構築を開始（メモリ圧力とキャンセル数が閾値超過）')

      // 各Queueから全要素を取得してフィルタリング後に再投入
      for (const [priority, queue] of Object.entries({
        critical: state.criticalQueue,
        high: state.highQueue,
        normal: state.normalQueue,
        low: state.lowQueue,
        background: state.backgroundQueue,
      })) {
        const items = yield* Queue.takeAll(queue)
        const filtered = Chunk.filter(items, (req: LoadingRequest) => !state.cancelled.has(req.id))

        for (const item of filtered) {
          yield* Queue.offer(queue, item)
        }
      }

      // cancelledセットをクリア
      yield* Ref.update(schedulerState, (state) => ({
        ...state,
        cancelled: new Set<string>(),
      }))

      yield* Effect.logInfo('Queue再構築完了')
    }
  })
```

## 5. パフォーマンス最適化

### 5-1. バックプレッシャー制御

**戦略**:

1. **bounded Queueのサイズ根拠**（前述のテーブル参照）
2. **満杯時の降格処理**（scheduleLoad内で実装）
3. **メモリ圧力に応じた動的調整**

```typescript
// Queue満杯時の降格処理（再掲）
const offerWithBackpressure = (
  state: QueuedSchedulerState,
  request: LoadingRequest
): Effect.Effect<void, LoadingSchedulerError> =>
  Effect.gen(function* () {
    const targetQueue = selectQueue(state, request.priority)

    const result = yield* Queue.offer(targetQueue, request).pipe(
      Effect.catchTag('QueueFullError', (error) =>
        Effect.gen(function* () {
          const downgradedPriority = downgradePriority(request.priority)

          if (downgradedPriority === request.priority) {
            // background queueは無制限なのでここには到達しないはず
            return yield* Effect.fail(
              new LoadingSchedulerError({
                message: `全キューが満杯: ${request.id}`,
                schedulerId: 'loading-scheduler',
                requestId: request.id,
              })
            )
          }

          yield* Effect.logWarning(
            `Queue満杯により優先度降格: ${request.id} (${request.priority} → ${downgradedPriority})`
          )

          // 降格して再試行
          return yield* offerWithBackpressure(state, {
            ...request,
            priority: downgradedPriority,
          })
        })
      )
    )
  })
```

### 5-2. Stream統合（オプション・将来対応）

**利点**:

- 複数Queueの統合が簡潔
- 並列実行制御が容易
- バックプレッシャー制御が自動

**欠点**:

- 既存の`getNextTask()`パターンから乖離
- factory.tsの大幅な変更が必要

**実装例**（参考、Phase 1では不採用）:

```typescript
// 全Queueを統合したStream
const createLoadingStream = (state: QueuedSchedulerState) =>
  Stream.mergeAll(
    [
      Stream.fromQueue(state.criticalQueue, { maxChunkSize: 1 }),
      Stream.fromQueue(state.highQueue, { maxChunkSize: 1 }),
      Stream.fromQueue(state.normalQueue, { maxChunkSize: 1 }),
      Stream.fromQueue(state.lowQueue, { maxChunkSize: 1 }),
      Stream.fromQueue(state.backgroundQueue, { maxChunkSize: 1 }),
    ],
    { concurrency: 'unbounded' }
  )

// 並列ロード処理
const startLoadingWorkers = (state: QueuedSchedulerState) =>
  createLoadingStream(state).pipe(
    // キャンセルチェック
    Stream.filter((req: LoadingRequest) => !state.cancelled.has(req.id)),
    // 並列実行（maxConcurrentLoadsに制限）
    Stream.mapEffect((req: LoadingRequest) => executeLoadingTask(req), {
      concurrency: state.configuration.maxConcurrentLoads,
    }),
    Stream.runDrain
  )
```

**採用判断**: Phase 1では不採用、Phase 4以降で検討

## 6. エラーハンドリング

### エラー型定義

```typescript
// Queue満杯エラー
export const QueueFullErrorSchema = Schema.TaggedStruct('QueueFullError', {
  priority: LoadingPriority,
  queueSize: Schema.Number.pipe(Schema.int()),
  requestId: Schema.String,
})

export type QueueFullError = Schema.Schema.Type<typeof QueueFullErrorSchema>

// Queue操作エラー
export const QueueOperationErrorSchema = Schema.TaggedStruct('QueueOperationError', {
  operation: Schema.Union(Schema.Literal('offer'), Schema.Literal('take'), Schema.Literal('poll')),
  queueName: Schema.String,
  cause: Schema.Unknown,
})

export type QueueOperationError = Schema.Schema.Type<typeof QueueOperationErrorSchema>

// LoadingSchedulerError（既存）の拡張
export const LoadingSchedulerErrorSchema = Schema.TaggedStruct('LoadingSchedulerError', {
  message: Schema.String,
  schedulerId: Schema.String,
  requestId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export type LoadingSchedulerError = Schema.Schema.Type<typeof LoadingSchedulerErrorSchema>
```

### エラー処理フロー

```typescript
// scheduleLoad内のエラーハンドリング
const scheduleLoad = (request: LoadingRequest) =>
  Effect.gen(function* () {
    // ...
  }).pipe(
    Effect.catchTags({
      QueueFullError: (error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`Queue満杯エラー: ${error.priority} queue`)
          // 降格処理（既に実装済み）
        }),

      QueueOperationError: (error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`Queue操作エラー: ${error.operation} on ${error.queueName}`)
          return yield* Effect.fail(
            new LoadingSchedulerError({
              message: `Queue操作に失敗: ${error.operation}`,
              schedulerId: 'loading-scheduler',
              requestId: request.id,
              cause: error.cause,
            })
          )
        }),
    })
  )

// getNextTask内のエラーハンドリング
const getNextTask = () =>
  Effect.gen(function* () {
    // ...
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError('getNextTaskでエラー発生', error)
        return Option.none() // エラー時は空を返す
      })
    )
  )
```

## 7. 実装フェーズ計画

### Phase 1: 基本Queue導入（2-3日）

**タスク**:

- [ ] QueuedSchedulerState型定義
- [ ] 優先度別Queue初期化（5種類のbounded/unbounded Queue）
- [ ] scheduleLoad実装（優先度別振り分け + バックプレッシャー）
- [ ] getNextTask実装（優先度順ポーリング + キャンセルチェック）
- [ ] 単体テスト作成
  - scheduleLoad: 各優先度への振り分け確認
  - getNextTask: 優先度順の取得確認
  - バックプレッシャー: Queue満杯時の降格確認

**完了条件**:

- `pnpm typecheck` パス
- 単体テストパス
- FIFO/Priority-Based戦略が動作

### Phase 2: Map/Set最適化（1日）

**タスク**:

- [ ] inProgress/completed/failed最適化
  - Array → Map/Set変換
- [ ] reportCompletion実装（O(1)削除 + 平均時間計算）
- [ ] cancelRequest実装（キャンセルフラグ + inProgress削除）
- [ ] 単体テスト追加
  - reportCompletion: O(1)動作確認
  - cancelRequest: フラグ設定確認

**完了条件**:

- `pnpm typecheck` パス
- reportCompletion/cancelRequestのパフォーマンステスト

### Phase 3: 高度なスケジューリング（2-3日）

**タスク**:

- [ ] Distance-Based実装（距離範囲別優先度決定）
- [ ] Adaptive実装（メモリ圧力に基づく動的調整）
- [ ] 定期的なクリーンアップ処理
  - cancelledセットのクリーンアップ
  - 推定キャンセル率のモニタリング
- [ ] 統合テスト
  - Distance-Based戦略のテスト
  - Adaptive戦略のテスト

**完了条件**:

- 全戦略（FIFO/Priority/Distance/Adaptive）が動作
- メモリリークがないことを確認

### Phase 4: 統合テスト（1日）

**タスク**:

- [ ] factory.ts統合
  - getQueueStatistics API追加
  - getSystemStatus更新
- [ ] パフォーマンステスト
  - 1000件のリクエストを同時投入
  - getNextTaskのレスポンスタイム測定（目標: <1ms）
  - メモリ使用量モニタリング
- [ ] ストレステスト
  - Queue満杯時の動作確認
  - キャンセル処理の負荷テスト

**完了条件**:

- `pnpm build` パス
- パフォーマンス目標達成
- factory.tsとの統合確認

## 8. リスク評価

| リスク項目                        | 深刻度 | 発生確率 | 対策                                                                   |
| --------------------------------- | ------ | -------- | ---------------------------------------------------------------------- |
| **factory.ts破壊的変更**          | 中     | 低       | getQueueStatistics API追加で回避、既存APIは維持                        |
| **Distance戦略の劣化**            | 低     | 中       | Phase 3で距離範囲別の細分化Queueで近似、完全な距離順ソートは諦める     |
| **キャンセル処理のメモリリーク**  | 中     | 中       | 定期クリーンアップ + 推定モニタリング + 極端なケースのQueue再構築      |
| **Queue満杯時のユーザー体験低下** | 高     | 低       | バックプレッシャー制御で降格、critical queueは小さくして満杯を早期検知 |
| **Effect-TS Queue APIの理解不足** | 中     | 中       | Context7で最新仕様確認、公式ドキュメント参照                           |
| **並行アクセス時の競合**          | 中     | 低       | Effect-TS RefとQueueの原子性を活用、明示的なロック不要                 |

## 9. 次のアクション

### 実装開始前の確認事項

- [x] factory.ts影響調査（getQueueState型変更の影響）
  - **結果**: `pending.length`が常に0になる、`getQueueStatistics` API追加で対応
- [ ] Effect-TS Queue APIの詳細確認
  - `Queue.bounded` vs `Queue.unbounded`の挙動
  - `Queue.size()`の戻り値（現在の要素数 vs キャパシティ）
  - `Queue.offer()`のエラー型（QueueFullErrorの正確な型名）
  - `Queue.poll()`の戻り値型（Option<A>の確認）
- [ ] メモリ監視との連携方法確認
  - `MemoryMonitorService.getPressureLevel()`の戻り値型
  - メモリ圧力の閾値決定（0.8, 0.9の妥当性）
- [ ] テスト戦略の確認
  - 単体テストでのQueue動作の検証方法
  - パフォーマンステストの測定ツール

### Phase 4-1-C実装開始の承認依頼

この設計書の内容で実装を開始してよいか、以下の点について確認してください：

1. **インターフェース変更の承認**
   - `getQueueStatistics()` API追加
   - `getQueueState().pending`が空配列を返すことの許容

2. **Queueサイズの妥当性**
   - critical: 20, high: 50, normal: 100, low: 200, background: unbounded
   - ゲームプレイへの影響評価

3. **実装フェーズの優先順位**
   - Phase 1-2を先行実装し、Distance/Adaptiveは後回しでよいか

4. **パフォーマンス目標の確認**
   - getNextTask: <1ms
   - scheduleLoad: <1ms
   - 同時リクエスト数: 1000件

## 10. 参考資料

### Effect-TS公式ドキュメント

- Queue API: `/Effect-TS/effect` (Context7)
- Stream API: `/Effect-TS/effect` (Context7)
- Ref API: `/Effect-TS/effect` (Context7)

### プロジェクト内ドキュメント

- `docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md`: Effect-TSの基本パターン
- `src/application/world/progressive_loading/loading_scheduler.ts`: 既存実装

### 既存メモリ

- `phase3-data-taggederror-validation-errors`: Schema.TaggedStructパターン
- `effect-ts-refactoring-current-status`: リファクタリング現状
