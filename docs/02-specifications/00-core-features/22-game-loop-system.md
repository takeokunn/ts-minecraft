---
title: "22 Game Loop System"
description: "22 Game Loop Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# ゲームループシステム

## 概要

ゲームループは、ts-minecraftの中核となるシステムで、すべてのゲーム要素の更新とレンダリングを制御します。Effect-TSの並行処理機能を活用し、固定タイムステップと可変レンダリングを組み合わせた高性能なループ実装を提供します。

## アーキテクチャ

### 基本構造

```typescript
// ゲームループの基本インターフェース
interface GameLoopService {
  readonly start: Effect.Effect<void, GameLoopError>
  readonly stop: Effect.Effect<void, never>
  readonly pause: Effect.Effect<void, never>
  readonly resume: Effect.Effect<void, never>
  readonly getMetrics: Effect.Effect<GameLoopMetrics, never>
  readonly setTargetFPS: (fps: number) => Effect.Effect<void, never>
}

// ループメトリクス
const GameLoopMetrics = Schema.Struct({
  fps: Schema.Number,
  frameTime: Schema.Number,
  updateTime: Schema.Number,
  renderTime: Schema.Number,
  idleTime: Schema.Number,
  ticksPerSecond: Schema.Number,
  skippedFrames: Schema.Number,
  interpolationAlpha: Schema.Number
})
```

### ループタイプ

#### 1. 固定タイムステップループ（物理演算用）

```typescript
const FixedTimeStepLoop = Effect.gen(function* () {
  const TICK_RATE = 20 // Minecraft標準: 20 ticks/秒
  const TICK_DURATION = 1000 / TICK_RATE // 50ms
  const MAX_CATCH_UP_TICKS = 5 // 最大追いつきティック数

  let accumulator = 0
  let lastTime = yield* Effect.sync(() => performance.now())
  let currentTick = 0n

  const update = Effect.gen(function* () {
    const currentTime = yield* Effect.sync(() => performance.now())
    const deltaTime = Math.min(currentTime - lastTime, TICK_DURATION * MAX_CATCH_UP_TICKS)
    lastTime = currentTime

    accumulator += deltaTime

    let ticksProcessed = 0
    while (accumulator >= TICK_DURATION && ticksProcessed < MAX_CATCH_UP_TICKS) {
      // 固定タイムステップでの更新
      yield* processGameTick(currentTick, TICK_DURATION)

      accumulator -= TICK_DURATION
      currentTick++
      ticksProcessed++
    }

    // 補間用のアルファ値を計算
    const interpolationAlpha = accumulator / TICK_DURATION

    return { ticksProcessed, interpolationAlpha, currentTick }
  })

  return { update, getCurrentTick: () => currentTick }
})
```

#### 2. 可変タイムステップループ（レンダリング用）

```typescript
const VariableTimeStepLoop = Effect.gen(function* () {
  let lastFrameTime = yield* Effect.sync(() => performance.now())
  let frameCount = 0

  const targetFrameTime = yield* Ref.make(16.67) // 60 FPS default

  const render = (interpolationAlpha: number) =>
    Effect.gen(function* () {
      const currentTime = yield* Effect.sync(() => performance.now())
      const deltaTime = currentTime - lastFrameTime
      lastFrameTime = currentTime

      // レンダリング処理
      yield* renderFrame(interpolationAlpha, deltaTime)

      frameCount++

      // フレームレート制御
      const target = yield* Ref.get(targetFrameTime)
      if (deltaTime < target) {
        // VSync待機またはスリープ
        yield* Effect.sleep(Duration.millis(target - deltaTime))
      }

      return { frameTime: deltaTime, frameCount }
    })

  return { render, setTargetFPS: (fps: number) => Ref.set(targetFrameTime, 1000 / fps) }
})
```

## メインゲームループ実装

### 統合ループシステム

```typescript
const GameLoopServiceLive = Layer.effect(
  GameLoopService,
  Effect.gen(function* () {
    const running = yield* Ref.make(false)
    const paused = yield* Ref.make(false)
    const metrics = yield* Ref.make(initialMetrics)

    // サブシステムの初期化
    const fixedLoop = yield* FixedTimeStepLoop
    const variableLoop = yield* VariableTimeStepLoop
    const systems = yield* GameSystems

    // メインループ
    const mainLoop = Effect.gen(function* () {
      while (yield* Ref.get(running)) {
        if (yield* Ref.get(paused)) {
          yield* Effect.sleep(Duration.millis(100))
          continue
        }

        const loopStart = yield* Effect.sync(() => performance.now())

        // 固定タイムステップ更新（物理演算、ゲームロジック）
        const updateStart = yield* Effect.sync(() => performance.now())
        const { ticksProcessed, interpolationAlpha } = yield* fixedLoop.update()
        const updateEnd = yield* Effect.sync(() => performance.now())

        // 可変タイムステップレンダリング（補間付き）
        const renderStart = yield* Effect.sync(() => performance.now())
        const { frameTime } = yield* variableLoop.render(interpolationAlpha)
        const renderEnd = yield* Effect.sync(() => performance.now())

        // メトリクス更新
        const loopEnd = yield* Effect.sync(() => performance.now())
        yield* updateMetrics(metrics, {
          updateTime: updateEnd - updateStart,
          renderTime: renderEnd - renderStart,
          totalTime: loopEnd - loopStart,
          ticksProcessed,
          frameTime
        })

        // 次フレームまで待機
        yield* Effect.yieldNow()
      }
    })

    return {
      start: Effect.gen(function* () {
        yield* Ref.set(running, true)
        yield* Effect.fork(mainLoop)
        yield* Effect.logInfo("Game loop started")
      }),

      stop: Effect.gen(function* () {
        yield* Ref.set(running, false)
        yield* Effect.logInfo("Game loop stopped")
      }),

      pause: Ref.set(paused, true),
      resume: Ref.set(paused, false),
      getMetrics: Ref.get(metrics),
      setTargetFPS: variableLoop.setTargetFPS
    }
  })
)
```

## ゲームティック処理

### ティック処理パイプライン

```typescript
const processGameTick = (tickNumber: bigint, deltaTime: number) =>
  Effect.gen(function* () {
    const world = yield* WorldService
    const ecs = yield* ECSService
    const physics = yield* PhysicsService
    const entities = yield* EntityService

    // フェーズ1: 入力処理
    yield* processInputs()

    // フェーズ2: ゲームロジック更新
    yield* Effect.allPar([
      updatePlayerActions(tickNumber),
      updateEntityAI(tickNumber),
      updateRedstone(tickNumber)
    ])

    // フェーズ3: 物理シミュレーション
    yield* physics.simulate(deltaTime)

    // フェーズ4: ECSシステム更新
    yield* ecs.update(deltaTime)

    // フェーズ5: ワールド更新
    yield* Effect.allPar([
      world.updateChunks(tickNumber),
      world.updateLighting(),
      world.updateWeather(tickNumber)
    ])

    // フェーズ6: エンティティ後処理
    yield* entities.postUpdate()

    // フェーズ7: イベント処理
    yield* processGameEvents(tickNumber)

    // フェーズ8: ネットワーク同期（マルチプレイヤー）
    if (yield* isMultiplayer()) {
      yield* syncNetworkState(tickNumber)
    }
  })
```

### システム更新順序

```typescript
// 更新優先度と依存関係の定義
const SystemUpdateOrder = {
  // 優先度: 高 → 低
  priority: [
    'input',           // 入力は最初に処理
    'player',          // プレイヤーアクション
    'physics',         // 物理演算
    'collision',       // 衝突検出
    'movement',        // 移動処理
    'ai',             // AI更新
    'block-updates',   // ブロック更新
    'redstone',       // レッドストーン
    'fluids',         // 液体シミュレーション
    'lighting',       // ライティング
    'particles',      // パーティクル
    'sound',          // サウンド
    'network'         // ネットワーク同期
  ],

  // 並列実行可能なシステムグループ
  parallelGroups: [
    ['ai', 'particles', 'sound'],
    ['block-updates', 'fluids'],
    ['lighting', 'network']
  ]
}

// 依存関係を考慮した更新スケジューラ
const scheduleSystemUpdates = (systems: GameSystem[]) =>
  Effect.gen(function* () {
    const scheduler = yield* SystemScheduler

    // 依存関係グラフの構築
    const dependencyGraph = buildDependencyGraph(systems)

    // トポロジカルソート
    const sortedSystems = topologicalSort(dependencyGraph)

    // 並列実行可能なグループに分割
    const executionGroups = partitionIntoParallelGroups(sortedSystems)

    // 各グループを順次実行、グループ内は並列実行
    for (const group of executionGroups) {
      yield* Effect.allPar(group.map(system => system.update()))
    }
  })
```

## レンダリングフレーム処理

### 補間レンダリング

```typescript
const renderFrame = (interpolationAlpha: number, deltaTime: number) =>
  Effect.gen(function* () {
    const renderer = yield* RendererService
    const camera = yield* CameraService
    const ui = yield* UIService

    // ビューマトリクスの更新
    yield* camera.updateViewMatrix(interpolationAlpha)

    // フラスタムカリング
    const visibleEntities = yield* performFrustumCulling(camera.frustum)

    // オクルージョンカリング
    const renderableEntities = yield* performOcclusionCulling(visibleEntities)

    // 補間位置の計算
    const interpolatedEntities = yield* interpolateEntityPositions(
      renderableEntities,
      interpolationAlpha
    )

    // レンダリングパス
    yield* Effect.allSequential([
      renderer.shadowPass(interpolatedEntities),
      renderer.opaquePass(interpolatedEntities),
      renderer.transparentPass(interpolatedEntities),
      renderer.particlePass(interpolationAlpha),
      renderer.postProcessingPass(),
      ui.render()
    ])

    // フレームバッファのスワップ
    yield* renderer.present()
  })

// エンティティ位置の補間
const interpolateEntityPositions = (entities: Entity[], alpha: number) =>
  Effect.gen(function* () {
    return entities.map(entity => {
      const position = entity.components.position
      const velocity = entity.components.velocity

      if (!velocity) return entity

      // 線形補間による滑らかな動き
      const interpolatedPosition = {
        x: position.x + velocity.x * alpha,
        y: position.y + velocity.y * alpha,
        z: position.z + velocity.z * alpha
      }

      return {
        ...entity,
        renderPosition: interpolatedPosition
      }
    })
  })
```

## パフォーマンス最適化

### 適応型フレームレート

```typescript
const AdaptiveFrameRate = Effect.gen(function* () {
  const targetFPS = yield* Ref.make(60)
  const minFPS = 30
  const maxFPS = 144

  const frameTimeHistory = yield* Ref.make<number[]>([])
  const qualityLevel = yield* Ref.make<'low' | 'medium' | 'high'>('high')

  const adjustFrameRate = (currentFrameTime: number) =>
    Effect.gen(function* () {
      const history = yield* Ref.get(frameTimeHistory)
      const updatedHistory = [...history.slice(-19), currentFrameTime]
      yield* Ref.set(frameTimeHistory, updatedHistory)

      if (updatedHistory.length < 20) return

      const avgFrameTime = updatedHistory.reduce((a, b) => a + b, 0) / 20
      const currentTarget = yield* Ref.get(targetFPS)
      const targetFrameTime = 1000 / currentTarget

      // フレームレートが目標を大きく下回る場合
      if (avgFrameTime > targetFrameTime * 1.5) {
        // 品質を下げる
        const quality = yield* Ref.get(qualityLevel)
        if (quality === 'high') {
          yield* Ref.set(qualityLevel, 'medium')
          yield* Effect.logInfo("Reducing quality to medium")
        } else if (quality === 'medium') {
          yield* Ref.set(qualityLevel, 'low')
          yield* Effect.logInfo("Reducing quality to low")
        }

        // 目標FPSも下げる
        const newTarget = Math.max(minFPS, currentTarget - 10)
        yield* Ref.set(targetFPS, newTarget)
      }
      // フレームレートに余裕がある場合
      else if (avgFrameTime < targetFrameTime * 0.7) {
        const quality = yield* Ref.get(qualityLevel)
        if (quality === 'low') {
          yield* Ref.set(qualityLevel, 'medium')
        } else if (quality === 'medium' && currentTarget >= 60) {
          yield* Ref.set(qualityLevel, 'high')
        }

        // 可能なら目標FPSを上げる
        const newTarget = Math.min(maxFPS, currentTarget + 10)
        yield* Ref.set(targetFPS, newTarget)
      }
    })

  return { adjustFrameRate, getQualityLevel: Ref.get(qualityLevel) }
})
```

### フレームスキップ

```typescript
const FrameSkipController = Effect.gen(function* () {
  const maxSkippedFrames = 5
  let consecutiveSkips = 0

  const shouldSkipFrame = (frameTime: number, targetFrameTime: number) =>
    Effect.gen(function* () {
      // すでに連続でスキップしている場合は強制レンダリング
      if (consecutiveSkips >= maxSkippedFrames) {
        consecutiveSkips = 0
        return false
      }

      // フレーム時間が目標の2倍を超える場合はスキップ
      if (frameTime > targetFrameTime * 2) {
        consecutiveSkips++
        yield* Effect.logDebug(`Skipping frame (${consecutiveSkips}/${maxSkippedFrames})`)
        return true
      }

      consecutiveSkips = 0
      return false
    })

  return { shouldSkipFrame }
})
```

## デバッグとプロファイリング

### ループメトリクス収集

```typescript
const GameLoopProfiler = Effect.gen(function* () {
  const metrics = {
    frameTimeHistogram: new Float32Array(144), // 最大144FPS分
    updateTimeDistribution: new Map<string, number>(),
    renderTimeDistribution: new Map<string, number>(),
    tickTimeDistribution: new Map<string, number>()
  }

  const profileFrame = (phase: string, duration: number) =>
    Effect.gen(function* () {
      const distribution = phase.startsWith('update')
        ? metrics.updateTimeDistribution
        : phase.startsWith('render')
        ? metrics.renderTimeDistribution
        : metrics.tickTimeDistribution

      distribution.set(phase, (distribution.get(phase) || 0) + duration)
    })

  const generateReport = () =>
    Effect.gen(function* () {
      const report = {
        avgFrameTime: calculateAverage(metrics.frameTimeHistogram),
        p95FrameTime: calculatePercentile(metrics.frameTimeHistogram, 95),
        p99FrameTime: calculatePercentile(metrics.frameTimeHistogram, 99),
        slowestSystems: getSlowentSystems(metrics.updateTimeDistribution),
        renderBottlenecks: getBottlenecks(metrics.renderTimeDistribution)
      }

      yield* Effect.logInfo("Game Loop Performance Report", report)
      return report
    })

  return { profileFrame, generateReport }
})
```

### デバッグビジュアライゼーション

```typescript
const DebugOverlay = Effect.gen(function* () {
  const canvas = yield* createDebugCanvas()
  const ctx = canvas.getContext('2d')!

  const drawMetrics = (metrics: GameLoopMetrics) =>
    Effect.gen(function* () {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, 300, 200)

      ctx.fillStyle = '#00ff00'
      ctx.font = '14px monospace'

      const lines = [
        `FPS: ${metrics.fps.toFixed(1)}`,
        `Frame Time: ${metrics.frameTime.toFixed(2)}ms`,
        `Update Time: ${metrics.updateTime.toFixed(2)}ms`,
        `Render Time: ${metrics.renderTime.toFixed(2)}ms`,
        `TPS: ${metrics.ticksPerSecond.toFixed(1)}`,
        `Skipped Frames: ${metrics.skippedFrames}`,
        `Interpolation: ${(metrics.interpolationAlpha * 100).toFixed(1)}%`
      ]

      lines.forEach((line, i) => {
        ctx.fillText(line, 10, 20 + i * 20)
      })

      // フレームタイムグラフ
      drawFrameTimeGraph(ctx, metrics)
    })

  return { drawMetrics }
})
```

## マルチスレッド対応

### Worker統合

```typescript
const WorkerIntegratedLoop = Effect.gen(function* () {
  const physicsWorker = yield* createPhysicsWorker()
  const renderWorker = yield* createRenderWorker()
  const aiWorker = yield* createAIWorker()

  const parallelUpdate = (tickNumber: bigint) =>
    Effect.gen(function* () {
      // 各Workerに並列でタスクを送信
      const tasks = yield* Effect.allPar([
        physicsWorker.simulate(tickNumber),
        aiWorker.update(tickNumber),
        renderWorker.prepareMeshes(tickNumber)
      ])

      // 結果の同期
      yield* synchronizeWorkerResults(tasks)
    })

  return { parallelUpdate }
})
```

このゲームループシステムにより、ts-minecraftは安定した物理演算と滑らかなレンダリングを実現し、様々なハードウェア環境で最適なパフォーマンスを発揮します。