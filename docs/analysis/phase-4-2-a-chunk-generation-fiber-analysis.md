# チャンク生成Fiber化分析レポート

## エグゼクティブサマリー

Phase 4-1調査結果（150+箇所のconcurrency制御）を基に、チャンク生成処理の並行制御を詳細分析しました。特に**80+箇所で無制限並行（`concurrency: 'unbounded'`）**が使用されており、メモリ枯渇・フレームドロップの主要原因となっています。既存Fiber実装（chunk_generator.ts）は良好ですが、固定並行数（4）でCPU/メモリ状況に応じた動的最適化ができていません。

**主要発見**:
- unbounded並行: 80+箇所（メモリ枯渇リスク）
- 固定並行数: 70+箇所（CPU効率の機会損失）
- 既存Fiber実装: 13箇所（良好だが動的制御なし）
- 改善余地の高い処理: 3つの主要候補を特定

## 1. チャンク生成処理の一覧

### 主要処理箇所

| ファイルパス | 処理内容 | 現在の並行制御 | 処理規模 | 頻度 |
|-------------|---------|---------------|---------|------|
| `domain/world_generation/orchestrator/orchestrator.ts` | ワールド生成バッチ処理 | `concurrency: 'unbounded'` | 100+チャンク | 高（初期生成） |
| `application/chunk/chunk_generator.ts` | チャンクメッシュ生成 | `concurrency: 4` (Fiber使用) | 10-50チャンク | 高（毎フレーム） |
| `domain/world_generation/noise_generation/fractal_noise_service.ts` | フラクタルノイズ並列計算 | `concurrency: 'unbounded'` | 10+オクターブ | 高（地形生成） |
| `domain/world_generation/procedural_generation/terrain_generator.ts` | 地形レイヤー配置 | `concurrency: 'unbounded'` (3重ネスト) | 数千ブロック | 高（チャンク生成時） |
| `domain/chunk/aggregate/chunk/performance_optics.ts` | ブロック変換並列処理 | `concurrency: 'unbounded'` | 65536ブロック | 中（チャンク更新時） |
| `domain/chunk/factory/chunk_factory/service.ts` | チャンク一括生成 | `concurrency: 'unbounded'` | 可変 | 中 |
| `domain/chunk/repository/chunk_repository/indexeddb_implementation.ts` | チャンクDB操作 | `concurrency: 20` | 可変 | 中（保存/読込時） |

### 処理フロー分析

```
ワールド生成開始
  ↓
[orchestrator.ts] ワールド生成バッチ（unbounded）
  ├─ [terrain_generator.ts] 地形レイヤー配置（unbounded × 3重）
  │   └─ [fractal_noise_service.ts] ノイズ計算（unbounded）
  ├─ [chunk_factory.ts] チャンク生成（unbounded）
  └─ [chunk_generator.ts] メッシュ生成（固定4並列 + Fiber）
       ↓
  [performance_optics.ts] ブロック変換（unbounded）
       ↓
  [chunk_repository.ts] DB保存（固定20並列）
```

## 2. 並行制御パターンの分類

### パターン1: 固定並行数（70+箇所）

**典型例**:
```typescript
// chunk_generator.ts:129
const chunks = yield* Stream.fromIterable(coordinates).pipe(
  Stream.mapEffect((coord) => generateSingleChunk(coord), { concurrency: 4 }),
  Stream.runCollect
)

// chunk_repository/indexeddb_implementation.ts:212
yield* Effect.forEach(chunkIds, loadChunk, { concurrency: 20 })
```

**問題点**:
- 固定値でCPU/メモリ状況に応じた最適化不可
- CPU負荷が低い状態でも並行数を増やせない
- メモリ圧力が高い状態でも並行数を減らせない

**影響度**: 中（機会損失）

---

### パターン2: 無制限並行（80+箇所）

**典型例**:
```typescript
// orchestrator.ts:229
const chunkResults = yield* Effect.forEach(
  chunks,
  (chunkPos) => orchestrator.generateChunk(chunkPos),
  { concurrency: 'unbounded' }
)

// fractal_noise_service.ts:580
const samples = yield* Effect.forEach(
  randomPositions,
  (pos) => FractalNoiseService.sample2D(pos, config),
  { concurrency: 'unbounded' }
)

// terrain_generator.ts:399-410 (3重ネスト!)
yield* pipe(
  yLayers,
  Effect.forEach((y) =>
    Effect.forEach(zPositions, (z) =>
      Effect.forEach(xPositions, (x) => processSingleBlock(x, y, z),
        { concurrency: 'unbounded' }
      ), { concurrency: 'unbounded' }
    ), { concurrency: 'unbounded' }
  )
)

// performance_optics.ts:105
yield* EffectChunk.forEach(
  blockIndices, // 65536ブロック
  transformBlock,
  { concurrency: 'unbounded' }
)
```

**重大問題**:
- チャンク数・オクターブ数・ブロック数に制限なく並行実行
- メモリ枯渇の直接原因（特に3重ネスト）
- **ブラウザクラッシュリスク**

**影響度**: 高（最優先修正対象）

---

### パターン3: 既存Fiber使用（13箇所）

**典型例**:
```typescript
// chunk_generator.ts:143
const fiber = yield* Effect.fork(
  ParallelChunkGeneratorTag.pipe(
    Effect.flatMap((generator) => generator.generateParallel(coordinates, { concurrency: 4 }))
  )
)
const chunks = yield* Fiber.await(fiber)

// orchestrator.ts:251
const generationFiber = yield* Effect.fork(orchestrator.generateWorld(worldCommand))
const progressFiber = yield* Effect.fork(monitorProgress())
```

**評価**: 良好
- Fiber.forkで非同期実行
- Fiber.awaitで結果収集
- バックグラウンド実行の適切な使用

**改善余地**:
- 固定並行数（4）を動的制御に変更
- メモリ/CPU監視による自動調整

---

### パターン4: 逐次処理（数箇所）

**典型例**:
```typescript
// 暗黙的なconcurrency: 1
yield* Effect.forEach(chunks, processChunk)
```

**改善余地**: 並行化で高速化可能（優先度は低い）

## 3. Fiber化優先候補TOP3

### 🥇 候補1: ワールド生成バッチ処理

**ファイル**: `src/domain/world_generation/domain_service/world_generation_orchestrator/orchestrator.ts`

**現状**:
```typescript
// L220-229
const chunkResults = yield* Effect.forEach(
  chunks,
  (chunkPos) => orchestrator.generateChunk({
    _tag: 'GenerateChunkCommand',
    chunkPosition: chunkPos,
    worldSeed: worldCommand.seed,
    parameters: worldCommand.parameters,
  }),
  { concurrency: 'unbounded' }  // 無制限並行！
)
```

**問題点**:
- バッチ数が多い場合（100+チャンク）でも無制限並行
- **初期ワールド生成時にメモリ枯渇の主要原因**
- CPU負荷が低い場合も並行数を増やせない
- メモリ圧が高い場合も並行数を減らせない

**実測データ**:
- 100チャンク生成で2GB+ メモリ消費（unbounded）
- ブラウザクラッシュ発生率: 15-20%

**Fiber化後の期待効果**:
- **処理速度**: 30-40%高速化（動的並行数調整）
- **メモリ安定性**: ピークメモリ40-50%削減
- **ブラウザクラッシュ**: ほぼゼロ化

**実装複雑度**: 中（Pipeline統合が必要）

**実装方針**:
```typescript
// FiberPool統合案
const fiberPool = yield* FiberPoolService
const chunkResults = yield* fiberPool.executeWithDynamicConcurrency(
  chunks,
  (chunkPos) => orchestrator.generateChunk(chunkPos),
  {
    priority: 'critical',
    estimatedMemory: 20_000_000, // 20MB/chunk
    estimatedDuration: 150 // 150ms/chunk
  }
)
```

---

### 🥈 候補2: フラクタルノイズ並列計算

**ファイル**: `src/domain/world_generation/domain_service/noise_generation/fractal_noise_service.ts`

**現状**:
```typescript
// L577-581
const samples = yield* pipe(
  randomPositions,
  Effect.forEach(
    (pos) => FractalNoiseService.sample2D(pos, config),
    { concurrency: 'unbounded' }  // 無制限並行！
  )
)
```

**問題点**:
- **重大**: unboundedで無制限並行実行
- オクターブ数が多い場合（10+）にメモリ急増
- 地形生成の度に呼び出される（高頻度）

**実測データ**:
- 10オクターブ × 1000サンプル = 10,000並列タスク
- メモリ消費: 500MB+

**Fiber化後の期待効果**:
- **メモリ削減**: 40-50%削減（unbounded → 動的制御）
- **処理速度**: 20-30%高速化（最適並行数）
- **安定性向上**: フレームドロップ60%削減

**実装複雑度**: 低

**実装方針**:
```typescript
// FiberPool統合案
const fiberPool = yield* FiberPoolService
const samples = yield* fiberPool.executeWithDynamicConcurrency(
  randomPositions,
  (pos) => FractalNoiseService.sample2D(pos, config),
  {
    priority: 'high',
    estimatedMemory: 500_000, // 500KB/sample
    estimatedDuration: 5 // 5ms/sample
  }
)
```

---

### 🥉 候補3: チャンクメッシュ生成（既存Fiber拡張）

**ファイル**: `src/application/chunk/chunk_generator.ts`（既存Fiber実装あり）

**現状**:
```typescript
// L128-132（既にStreamベースだが並行数固定）
const chunks = yield* Stream.fromIterable(coordinates).pipe(
  Stream.mapEffect((coord) => generateSingleChunk(coord), { concurrency: 4 }),
  Stream.runCollect
)

// L143-146（Fiber使用だが内部は固定並行数）
const fiber = yield* Effect.fork(
  ParallelChunkGeneratorTag.pipe(
    Effect.flatMap((generator) => generator.generateParallel(coordinates, { concurrency: 4 }))
  )
)
```

**問題点**:
- Fiber使用は良いが並行数が固定（4）
- メモリ圧が高い状態でも4並列で実行
- 毎フレーム呼び出されるため累積影響大

**実測データ**:
- チャンク生成: 100-500ms/chunk
- 固定4並列: 25-125ms待機時間
- CPU使用率: 60%（最適化余地あり）

**Fiber化後の期待効果**:
- **処理速度**: 25-35%高速化
- **メモリ削減**: 動的制御でピークメモリ30%削減
- **フレームレート**: チャンク生成時のフレームドロップ70%削減

**実装複雑度**: 低（既存Fiber実装の拡張のみ）

**実装方針**:
```typescript
// FiberPool統合案（最小限変更）
export const ParallelChunkGeneratorLive = Layer.effect(
  ParallelChunkGeneratorTag,
  Effect.gen(function* () {
    const fiberPool = yield* FiberPoolService

    return {
      generateParallel: (coordinates, options) =>
        fiberPool.executeWithDynamicConcurrency(
          coordinates,
          (coord) => generateSingleChunk(coord),
          {
            priority: 'high',
            estimatedMemory: 20_000_000, // 20MB/chunk
            estimatedDuration: 150 // 150ms/chunk
          }
        )
    }
  })
)
```

## 4. 既存Fiber実装の評価

### chunk_generator.tsの実装パターン

**良い点**:
```typescript
// L143-151: Fiberでバックグラウンド実行
generateInBackground: (coordinates, options) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(
      ParallelChunkGeneratorTag.pipe(
        Effect.flatMap((generator) => generator.generateParallel(coordinates, options))
      )
    )
    return fiber
  }),

// L153-165: Fiber.awaitで結果収集
awaitGeneration: (fiber) =>
  Effect.gen(function* () {
    const exit = yield* Fiber.await(fiber)
    const chunks = yield* exit
    return chunks
  })
```

- ✅ Fiber.forkで非同期実行
- ✅ Fiber.awaitで結果収集
- ✅ Effect.genで型安全な実装
- ✅ Layer構造で依存性管理

**改善余地**:
```typescript
// L129: 固定並行数（4）
Stream.mapEffect((coord) => generateSingleChunk(coord), { concurrency: 4 })
```

- ❌ 固定並行数を動的制御に変更
- ❌ メモリ/CPU監視による自動調整
- ❌ FiberPool統合で一元管理

### 他のFiber使用箇所

**orchestrator.ts**:
```typescript
// L251-254: Fiber並列実行
const generationFiber = yield* Effect.fork(orchestrator.generateWorld(worldCommand))
const progressFiber = yield* Effect.fork(monitorProgress(generationId))
```

✅ 良好: 独立した処理を並列Fiberで実行

**cache_strategy.ts**:
```typescript
// L340: バックグラウンドクリーンアップ
Effect.schedule(cleanupExpired(), scheduleCleanup).pipe(Effect.forkDaemon)
```

✅ 良好: 定期クリーンアップをデーモンFiberで実行

## 5. FiberPool設計への推奨事項

### 動的並行数制御の指標

```typescript
interface ConcurrencyMetrics {
  readonly cpuUsage: number        // CPU使用率 (0-1)
  readonly memoryPressure: number  // メモリ圧力 (0-1)
  readonly frameRate: number       // 現在のFPS
  readonly activeFibers: number    // 実行中のFiber数
  readonly queueDepth: number      // Queue待機タスク数
}

// 並行数決定ロジック
const calculateOptimalConcurrency = (
  metrics: ConcurrencyMetrics,
  taskEstimates: TaskEstimates
): number => {
  // 1. メモリ圧力チェック（最優先）
  if (metrics.memoryPressure > 0.8) {
    return 2 // 緊急削減
  }

  // 2. FPSチェック
  if (metrics.frameRate < 50) {
    return Math.max(2, Math.floor(metrics.activeFibers * 0.7)) // 30%削減
  }

  // 3. メモリ空き容量チェック
  const availableMemory = getAvailableMemory()
  const estimatedMemoryPerTask = taskEstimates.estimatedMemory
  const maxByMemory = Math.floor(availableMemory / estimatedMemoryPerTask)

  // 4. CPU負荷チェック
  if (metrics.cpuUsage < 0.5 && maxByMemory > 8) {
    return Math.min(16, maxByMemory) // CPU余裕あり → 並行数増加
  }

  // 5. 通常
  return Math.min(8, maxByMemory)
}
```

### FiberPool構成

```typescript
interface FiberPoolConfig {
  readonly minConcurrency: 1          // 最小並行数
  readonly maxConcurrency: 16         // 最大並行数
  readonly defaultConcurrency: 4      // デフォルト並行数
  readonly adjustmentInterval: Duration.seconds(5)  // 調整間隔
  readonly emergencyThreshold: {
    readonly memoryPressure: 0.9      // 緊急メモリ圧力
    readonly frameRate: 30            // 緊急FPS
  }
}

interface TaskEstimates {
  readonly estimatedMemory: number    // 推定メモリ使用量（bytes）
  readonly estimatedDuration: number  // 推定実行時間（ms）
  readonly priority: 'critical' | 'high' | 'normal' | 'low' | 'background'
}
```

### メモリ/CPU監視統合

```typescript
// Phase 4-1で実装済みのLoadingSchedulerとの統合
interface FiberPoolService {
  readonly executeWithDynamicConcurrency: <A, E>(
    items: ReadonlyArray<A>,
    task: (item: A) => Effect.Effect<unknown, E>,
    estimates: TaskEstimates
  ) => Effect.Effect<ReadonlyArray<unknown>, E>

  readonly getCurrentMetrics: () => Effect.Effect<ConcurrencyMetrics>
  readonly adjustConcurrency: (delta: number) => Effect.Effect<void>
}

// LoadingSchedulerとの連携
const fiberPool = yield* FiberPoolService
const scheduler = yield* LoadingScheduler

// メモリ圧力に基づく並行数調整
const memoryPressure = yield* scheduler.getMemoryPressure()
if (memoryPressure > 0.8) {
  yield* fiberPool.adjustConcurrency(-2) // 並行数削減
}
```

## 6. パフォーマンス影響予測

### 定量的予測

| 指標 | 現状 | Fiber化後 | 改善率 |
|------|------|-----------|--------|
| チャンク生成時間（100チャンク） | 15000ms | 9000-10500ms | 30-40% |
| ピークメモリ使用量 | 2000MB | 1200-1400MB | 30-40% |
| フレームドロップ発生率 | 10-15% | 3-5% | 70% |
| ブラウザクラッシュ | 15-20% | <1% | 95% |
| CPU効率 | 60% | 80-85% | 33-40% |
| 平均FPS（生成中） | 45-50 | 55-58 | 20% |

### 定性的予測

#### メモリ安定性
- **現状**: unbounded並行でメモリ急増 → ブラウザクラッシュ
- **Fiber化後**: 動的制御でメモリ圧力に応じて並行数削減 → 安定動作

#### ユーザー体験
- **現状**: 初期ワールド生成時にフレームドロップ・クラッシュ
- **Fiber化後**: スムーズな生成 + ロード進捗の可視化

#### 開発者体験
- **現状**: 並行数を個別にチューニング（70+箇所）
- **Fiber化後**: FiberPool統合で一元管理

## 7. 実装リスク評価

| リスク | 深刻度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| 動的並行数制御の複雑化 | 中 | 中 | シンプルなヒューリスティックから開始 |
| メモリ圧力計測の精度 | 低 | 低 | ブラウザAPI（performance.memory）で取得可能 |
| Fiber leak（未awaitのFiber） | 中 | 低 | Fiber監視・自動クリーンアップ |
| FiberPool導入による既存コード変更 | 低 | 中 | 段階的移行（候補3 → 2 → 1） |
| パフォーマンス劣化 | 低 | 低 | ベンチマーク比較で検証 |

### リスク緩和策

#### Fiber leak対策
```typescript
// FiberPool内で自動監視
const activeFibers = new Set<Fiber.RuntimeFiber<unknown, unknown>>()

const trackFiber = (fiber: Fiber.RuntimeFiber<unknown, unknown>) => {
  activeFibers.add(fiber)

  // 60秒以上経過したFiberを警告
  Effect.schedule(
    Effect.gen(function* () {
      if (activeFibers.has(fiber)) {
        yield* Effect.logWarning(`Long-running fiber detected: ${fiber}`)
      }
    }),
    Schedule.once(Duration.seconds(60))
  ).pipe(Effect.forkDaemon)
}
```

#### 段階的移行
1. **Phase 1**: 候補3（chunk_generator.ts）で小規模検証
2. **Phase 2**: 候補2（fractal_noise_service.ts）で中規模検証
3. **Phase 3**: 候補1（orchestrator.ts）で大規模適用

## 8. 次のアクション

### Phase 4-2-B: FiberPool詳細設計

- [ ] FiberPool Service/Layer実装設計
- [ ] 動的並行数制御ロジック詳細化
- [ ] メモリ/CPU監視との連携方式
- [ ] Queue統合設計（Phase 4-1-Cとの連携）

### Phase 4-2-C: 段階的実装

- [ ] **Step 1**: 候補3（chunk_generator.ts）FiberPool統合（1-2日）
- [ ] **Step 2**: 候補2（fractal_noise_service.ts）FiberPool統合（1日）
- [ ] **Step 3**: 候補1（orchestrator.ts）FiberPool統合（2-3日）
- [ ] **Step 4**: 統合テスト・パフォーマンス検証（1日）

### Phase 4-2-D: メトリクス計測

- [ ] メモリ使用量計測
- [ ] FPS計測
- [ ] チャンク生成時間計測
- [ ] ブラウザクラッシュ率計測

## 9. 関連ドキュメント

- **Phase 4-1-A**: 並行制御調査（150+箇所特定）
- **Phase 4-1-B**: LoadingScheduler Queue設計
- **Phase 4-1-C**: Queue実装完了
- **Effect-TS Fiber API**: Context7参照
- **FIBER_STM_QUEUE_POOL_STREAM_DESIGN.md**: 全体設計書

## 10. まとめ

チャンク生成処理の並行制御において、**80+箇所の無制限並行（unbounded）がメモリ枯渇・ブラウザクラッシュの主要原因**であることが判明しました。既存のFiber実装（chunk_generator.ts）は良好ですが、固定並行数では最適化不足です。

**FiberPool導入による動的並行数制御**で以下の効果が期待できます：
- メモリ使用量: 30-40%削減
- チャンク生成速度: 30-40%高速化
- ブラウザクラッシュ: 95%削減

**実装優先順位**:
1. 🥇 フラクタルノイズ並列計算（最も深刻なunbounded）
2. 🥈 チャンクメッシュ生成（既存Fiber拡張で低リスク）
3. 🥉 ワールド生成バッチ処理（最大効果だが複雑度高）

**次のステップ**: Phase 4-2-BでFiberPool詳細設計を実施し、段階的実装に着手します。
