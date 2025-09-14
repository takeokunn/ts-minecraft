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
import { Schema, Effect, Context, Stream, Fiber, STM, Match, pipe } from "effect"

// ブランド型の定義
const DeltaTime = Schema.Number.pipe(
  Schema.brand("DeltaTime"),
  Schema.filter(n => n >= 0, { message: () => "DeltaTime must be non-negative" })
)
type DeltaTime = Schema.Schema.Type<typeof DeltaTime>

const TickRate = Schema.Number.pipe(
  Schema.brand("TickRate"),
  Schema.filter(n => n > 0 && n <= 1000, { message: () => "TickRate must be between 1-1000" })
)
type TickRate = Schema.Schema.Type<typeof TickRate>

const FrameRate = Schema.Number.pipe(
  Schema.brand("FrameRate"),
  Schema.filter(n => n > 0 && n <= 1000, { message: () => "FrameRate must be between 1-1000" })
)
type FrameRate = Schema.Schema.Type<typeof FrameRate>

// ゲーム状態の定義（Schema.TaggedUnion使用）
const GameState = Schema.TaggedUnion("_tag", {
  Initializing: Schema.Struct({
    _tag: Schema.Literal("Initializing"),
    progress: Schema.Number
  }),
  Running: Schema.Struct({
    _tag: Schema.Literal("Running"),
    tickNumber: Schema.BigInt,
    lastUpdateTime: DeltaTime
  }),
  Paused: Schema.Struct({
    _tag: Schema.Literal("Paused"),
    pausedAt: Schema.BigInt
  }),
  Stopped: Schema.Struct({
    _tag: Schema.Literal("Stopped"),
    reason: Schema.String
  })
})
type GameState = Schema.Schema.Type<typeof GameState>

// エラー定義
class GameLoopError extends Schema.TaggedError<GameLoopError>()("GameLoopError", {
  reason: Schema.String
}) {}

// メトリクス定義（ブランド型使用）
const GameLoopMetrics = Schema.Struct({
  fps: FrameRate,
  frameTime: DeltaTime,
  updateTime: DeltaTime,
  renderTime: DeltaTime,
  idleTime: DeltaTime,
  ticksPerSecond: TickRate,
  skippedFrames: Schema.Number,
  interpolationAlpha: Schema.Number.pipe(
    Schema.filter(n => n >= 0 && n <= 1, { message: () => "Interpolation alpha must be 0-1" })
  )
})
type GameLoopMetrics = Schema.Schema.Type<typeof GameLoopMetrics>

// サービスインターフェース
interface GameLoopService {
  readonly start: Effect.Effect<void, GameLoopError>
  readonly stop: Effect.Effect<void, never>
  readonly pause: Effect.Effect<void, never>
  readonly resume: Effect.Effect<void, never>
  readonly getState: Effect.Effect<GameState, never>
  readonly getMetrics: Effect.Effect<GameLoopMetrics, never>
  readonly setTargetFPS: (fps: FrameRate) => Effect.Effect<void, never>
}

const GameLoopService = Context.GenericTag<GameLoopService>("@minecraft/GameLoopService")
```

### ループタイプ

#### 1. 固定タイムステップループ（物理演算用）

```typescript
// ティック設定の定義
const TickConfig = Schema.Struct({
  tickRate: TickRate,
  maxCatchUpTicks: Schema.Number.pipe(
    Schema.filter(n => n > 0 && n <= 10, { message: () => "Max catch up ticks must be 1-10" })
  )
})
type TickConfig = Schema.Schema.Type<typeof TickConfig>

// 固定タイムステップループ（Streamベース）
const createFixedTimeStepLoop = (config: TickConfig) => Effect.gen(function* () {
  const tickDuration = Schema.decodeSync(DeltaTime)(1000 / config.tickRate)
  const stateRef = yield* STM.TRef.make({ accumulator: 0, lastTime: 0, currentTick: 0n })

  const tickStream = Stream.repeatEffectOption(
    STM.commit(
      STM.gen(function* () {
        const state = yield* STM.TRef.get(stateRef)
        const currentTime = performance.now()
        const deltaTime = Math.min(
          currentTime - state.lastTime,
          tickDuration * config.maxCatchUpTicks
        )

        const newAccumulator = state.accumulator + deltaTime

        return Match.value(newAccumulator >= tickDuration).pipe(
          Match.when(true, () =>
            Effect.gen(function* () {
              yield* STM.TRef.update(stateRef, s => ({
                ...s,
                accumulator: s.accumulator - tickDuration,
                currentTick: s.currentTick + 1n,
                lastTime: currentTime
              }))

              return {
                tickNumber: state.currentTick + 1n,
                deltaTime: Schema.decodeSync(DeltaTime)(tickDuration),
                interpolationAlpha: newAccumulator / tickDuration
              }
            })
          ),
          Match.orElse(() => Effect.none)
        )
      })
    )
  )

  return {
    tickStream,
    getCurrentTick: STM.TRef.get(stateRef).pipe(
      STM.map(s => s.currentTick),
      STM.commit
    )
  }
})
```

#### 2. 可変タイムステップループ（レンダリング用）

```typescript
// フレーム設定
const FrameConfig = Schema.Struct({
  targetFrameRate: FrameRate,
  enableVSync: Schema.Boolean,
  maxFrameSkip: Schema.Number.pipe(
    Schema.filter(n => n >= 0 && n <= 10, { message: () => "Frame skip must be 0-10" })
  )
})
type FrameConfig = Schema.Schema.Type<typeof FrameConfig>

// 可変タイムステップループ（Streamベース）
const createVariableTimeStepLoop = (config: FrameConfig) => Effect.gen(function* () {
  const frameState = yield* STM.TRef.make({
    lastFrameTime: 0,
    frameCount: 0,
    consecutiveSkips: 0
  })

  const targetFrameTime = yield* STM.TRef.make(Schema.decodeSync(DeltaTime)(1000 / config.targetFrameRate))

  const renderStream = Stream.repeatEffectOption(
    Effect.gen(function* () {
      const currentTime = performance.now()
      const state = yield* STM.TRef.get(frameState).pipe(STM.commit)
      const deltaTime = Schema.decodeSync(DeltaTime)(currentTime - state.lastFrameTime)
      const target = yield* STM.TRef.get(targetFrameTime).pipe(STM.commit)

      // フレームスキップ判定
      const shouldSkip = state.consecutiveSkips < config.maxFrameSkip &&
                        deltaTime > target * 2

      return Match.value(shouldSkip).pipe(
        Match.when(true, () =>
          STM.TRef.update(frameState, s => ({
            ...s,
            consecutiveSkips: s.consecutiveSkips + 1
          })).pipe(STM.commit, Effect.as(Effect.none))
        ),
        Match.orElse(() => Effect.gen(function* () {
          yield* STM.TRef.update(frameState, s => ({
            lastFrameTime: currentTime,
            frameCount: s.frameCount + 1,
            consecutiveSkips: 0
          })).pipe(STM.commit)

          // VSync制御
          if (config.enableVSync && deltaTime < target) {
            yield* Effect.sleep(`${target - deltaTime} millis`)
          }

          return {
            frameTime: deltaTime,
            frameCount: state.frameCount + 1,
            interpolationAlpha: 0 // 後で計算
          }
        }))
      )
    })
  )

  return {
    renderStream,
    setTargetFPS: (fps: FrameRate) =>
      STM.TRef.set(targetFrameTime, Schema.decodeSync(DeltaTime)(1000 / fps)).pipe(STM.commit)
  }
})
```

## メインゲームループ実装

### 統合ループシステム

```typescript
// メインゲームループサービス実装
const GameLoopServiceLive = Layer.effect(
  GameLoopService,
  Effect.gen(function* () {
    const gameState = yield* STM.TRef.make<GameState>({ _tag: "Stopped", reason: "Initial state" })
    const metrics = yield* STM.TRef.make<GameLoopMetrics>({
      fps: Schema.decodeSync(FrameRate)(0),
      frameTime: Schema.decodeSync(DeltaTime)(0),
      updateTime: Schema.decodeSync(DeltaTime)(0),
      renderTime: Schema.decodeSync(DeltaTime)(0),
      idleTime: Schema.decodeSync(DeltaTime)(0),
      ticksPerSecond: Schema.decodeSync(TickRate)(0),
      skippedFrames: 0,
      interpolationAlpha: 0
    })

    // サブシステムの初期化
    const tickConfig = { tickRate: Schema.decodeSync(TickRate)(20), maxCatchUpTicks: 5 }
    const frameConfig = {
      targetFrameRate: Schema.decodeSync(FrameRate)(60),
      enableVSync: true,
      maxFrameSkip: 3
    }

    const fixedLoop = yield* createFixedTimeStepLoop(tickConfig)
    const variableLoop = yield* createVariableTimeStepLoop(frameConfig)

    // メインループFiber
    const createMainLoopFiber = Effect.gen(function* () {
      const tickFiber = yield* Stream.mergeWithTag(
        {
          tick: fixedLoop.tickStream,
          render: variableLoop.renderStream
        },
        { concurrency: "unbounded" }
      ).pipe(
        Stream.tap(event =>
          Match.value(event).pipe(
            Match.tag("tick", ({ value }) => processGameTick(value)),
            Match.tag("render", ({ value }) => renderFrame(value)),
            Match.exhaustive
          )
        ),
        Stream.takeUntil(STM.TRef.get(gameState).pipe(
          STM.map(state => state._tag === "Stopped"),
          STM.commit
        )),
        Stream.runDrain,
        Effect.fork
      )

      return tickFiber
    })

    const processGameTick = (tickData: { tickNumber: bigint; deltaTime: DeltaTime; interpolationAlpha: number }) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // ゲームロジック処理
        yield* updateGameSystems(tickData.tickNumber, tickData.deltaTime)

        const endTime = performance.now()
        const updateTime = Schema.decodeSync(DeltaTime)(endTime - startTime)

        // メトリクス更新
        yield* STM.TRef.update(metrics, m => ({ ...m, updateTime })).pipe(STM.commit)
      })

    const renderFrame = (frameData: { frameTime: DeltaTime; frameCount: number; interpolationAlpha: number }) =>
      Effect.gen(function* () {
        const state = yield* STM.TRef.get(gameState).pipe(STM.commit)

        return Match.value(state).pipe(
          Match.tag("Running", () =>
            Effect.gen(function* () {
              const startTime = performance.now()
              yield* performRenderPass(frameData.interpolationAlpha)
              const endTime = performance.now()

              const renderTime = Schema.decodeSync(DeltaTime)(endTime - startTime)
              yield* STM.TRef.update(metrics, m => ({
                ...m,
                renderTime,
                fps: Schema.decodeSync(FrameRate)(1000 / frameData.frameTime)
              })).pipe(STM.commit)
            })
          ),
          Match.orElse(() => Effect.void)
        )
      })

    return {
      start: Effect.gen(function* () {
        yield* STM.TRef.set(gameState, {
          _tag: "Running",
          tickNumber: 0n,
          lastUpdateTime: Schema.decodeSync(DeltaTime)(performance.now())
        }).pipe(STM.commit)

        yield* createMainLoopFiber
        yield* Effect.logInfo("Game loop started")
      }),

      stop: Effect.gen(function* () {
        yield* STM.TRef.set(gameState, { _tag: "Stopped", reason: "User requested" }).pipe(STM.commit)
        yield* Effect.logInfo("Game loop stopped")
      }),

      pause: STM.TRef.update(gameState, state =>
        Match.value(state).pipe(
          Match.tag("Running", (running) => ({
            _tag: "Paused" as const,
            pausedAt: running.tickNumber
          })),
          Match.orElse(() => state)
        )
      ).pipe(STM.commit),

      resume: STM.TRef.update(gameState, state =>
        Match.value(state).pipe(
          Match.tag("Paused", () => ({
            _tag: "Running" as const,
            tickNumber: 0n,
            lastUpdateTime: Schema.decodeSync(DeltaTime)(performance.now())
          })),
          Match.orElse(() => state)
        )
      ).pipe(STM.commit),

      getState: STM.TRef.get(gameState).pipe(STM.commit),
      getMetrics: STM.TRef.get(metrics).pipe(STM.commit),
      setTargetFPS: variableLoop.setTargetFPS
    }
  })
)
```

## ゲームティック処理

### ティック処理パイプライン

```typescript
// ゲームティック処理フェーズ定義
const GameTickPhase = Schema.TaggedUnion("_tag", {
  Input: Schema.Struct({ _tag: Schema.Literal("Input"), priority: Schema.Literal(1) }),
  Logic: Schema.Struct({ _tag: Schema.Literal("Logic"), priority: Schema.Literal(2) }),
  Physics: Schema.Struct({ _tag: Schema.Literal("Physics"), priority: Schema.Literal(3) }),
  ECS: Schema.Struct({ _tag: Schema.Literal("ECS"), priority: Schema.Literal(4) }),
  World: Schema.Struct({ _tag: Schema.Literal("World"), priority: Schema.Literal(5) }),
  PostProcess: Schema.Struct({ _tag: Schema.Literal("PostProcess"), priority: Schema.Literal(6) }),
  Events: Schema.Struct({ _tag: Schema.Literal("Events"), priority: Schema.Literal(7) }),
  Network: Schema.Struct({ _tag: Schema.Literal("Network"), priority: Schema.Literal(8) })
})
type GameTickPhase = Schema.Schema.Type<typeof GameTickPhase>

// ゲームティックデータ
const GameTickData = Schema.Struct({
  tickNumber: Schema.BigInt,
  deltaTime: DeltaTime,
  phase: GameTickPhase
})
type GameTickData = Schema.Schema.Type<typeof GameTickData>

// メインティック処理
const updateGameSystems = (tickNumber: bigint, deltaTime: DeltaTime) =>
  Effect.gen(function* () {
    const phases = [
      { _tag: "Input" as const, priority: 1 },
      { _tag: "Logic" as const, priority: 2 },
      { _tag: "Physics" as const, priority: 3 },
      { _tag: "ECS" as const, priority: 4 },
      { _tag: "World" as const, priority: 5 },
      { _tag: "PostProcess" as const, priority: 6 },
      { _tag: "Events" as const, priority: 7 },
      { _tag: "Network" as const, priority: 8 }
    ]

    // フェーズごとのStream処理
    yield* Stream.fromIterable(phases).pipe(
      Stream.mapEffect(phase =>
        processTickPhase({ tickNumber, deltaTime, phase }),
        { concurrency: 1 } // 依存関係により順次処理
      ),
      Stream.runDrain
    )
  })

const processTickPhase = (tickData: GameTickData) =>
  Match.value(tickData.phase).pipe(
    Match.tag("Input", () => processInputPhase(tickData)),
    Match.tag("Logic", () => processLogicPhase(tickData)),
    Match.tag("Physics", () => processPhysicsPhase(tickData)),
    Match.tag("ECS", () => processECSPhase(tickData)),
    Match.tag("World", () => processWorldPhase(tickData)),
    Match.tag("PostProcess", () => processPostProcessPhase(tickData)),
    Match.tag("Events", () => processEventsPhase(tickData)),
    Match.tag("Network", () => processNetworkPhase(tickData)),
    Match.exhaustive
  )

// 各フェーズの実装
const processInputPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const inputService = yield* InputService
    yield* inputService.processInputs(tickData.tickNumber)
  })

const processLogicPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const playerService = yield* PlayerService
    const aiService = yield* AIService
    const redstoneService = yield* RedstoneService

    // 並列実行可能なシステム
    yield* Effect.allPar([
      playerService.updateActions(tickData.tickNumber),
      aiService.updateEntities(tickData.tickNumber),
      redstoneService.updateCircuits(tickData.tickNumber)
    ])
  })

const processPhysicsPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const physicsService = yield* PhysicsService
    yield* physicsService.simulate(tickData.deltaTime)
  })

const processECSPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const ecsService = yield* ECSService
    yield* ecsService.update(tickData.deltaTime)
  })

const processWorldPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const worldService = yield* WorldService

    yield* Effect.allPar([
      worldService.updateChunks(tickData.tickNumber),
      worldService.updateLighting(),
      worldService.updateWeather(tickData.tickNumber)
    ])
  })

const processPostProcessPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const entityService = yield* EntityService
    yield* entityService.postUpdate()
  })

const processEventsPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const eventService = yield* EventService
    yield* eventService.processGameEvents(tickData.tickNumber)
  })

const processNetworkPhase = (tickData: GameTickData) =>
  Effect.gen(function* () {
    const networkService = yield* NetworkService
    const isMultiplayer = yield* networkService.isMultiplayer()

    return Match.value(isMultiplayer).pipe(
      Match.when(true, () => networkService.syncState(tickData.tickNumber)),
      Match.orElse(() => Effect.void)
    )
  })
```

### システム更新順序

```typescript
// システム情報定義
const SystemInfo = Schema.Struct({
  name: Schema.String,
  priority: Schema.Number,
  dependencies: Schema.Array(Schema.String),
  canRunInParallel: Schema.Boolean,
  estimatedDuration: DeltaTime
})
type SystemInfo = Schema.Schema.Type<typeof SystemInfo>

// システム実行結果
const SystemExecutionResult = Schema.Struct({
  systemName: Schema.String,
  actualDuration: DeltaTime,
  success: Schema.Boolean,
  error: Schema.optionalWith(Schema.String, { default: () => undefined })
})
type SystemExecutionResult = Schema.Schema.Type<typeof SystemExecutionResult>

// システム更新スケジューラ
const createSystemScheduler = Effect.gen(function* () {
  const systemRegistry = new Map<string, SystemInfo>()

  // システム登録
  const registerSystems = () => {
    const systems: SystemInfo[] = [
      { name: "input", priority: 1, dependencies: [], canRunInParallel: false, estimatedDuration: Schema.decodeSync(DeltaTime)(2) },
      { name: "player", priority: 2, dependencies: ["input"], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(3) },
      { name: "ai", priority: 2, dependencies: ["input"], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(5) },
      { name: "physics", priority: 3, dependencies: ["player", "ai"], canRunInParallel: false, estimatedDuration: Schema.decodeSync(DeltaTime)(8) },
      { name: "collision", priority: 4, dependencies: ["physics"], canRunInParallel: false, estimatedDuration: Schema.decodeSync(DeltaTime)(4) },
      { name: "movement", priority: 5, dependencies: ["collision"], canRunInParallel: false, estimatedDuration: Schema.decodeSync(DeltaTime)(3) },
      { name: "redstone", priority: 6, dependencies: ["movement"], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(6) },
      { name: "fluids", priority: 6, dependencies: ["movement"], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(4) },
      { name: "lighting", priority: 7, dependencies: ["redstone", "fluids"], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(7) },
      { name: "particles", priority: 7, dependencies: [], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(2) },
      { name: "sound", priority: 8, dependencies: [], canRunInParallel: true, estimatedDuration: Schema.decodeSync(DeltaTime)(1) },
      { name: "network", priority: 9, dependencies: ["lighting", "sound"], canRunInParallel: false, estimatedDuration: Schema.decodeSync(DeltaTime)(5) }
    ]

    systems.forEach(system => systemRegistry.set(system.name, system))
  }

  registerSystems()

  const executeSystemsInOrder = (tickData: GameTickData) =>
    Effect.gen(function* () {
      // 優先度でグループ化
      const systemGroups = Array.from(systemRegistry.values())
        .reduce((acc, system) => {
          const priority = system.priority
          if (!acc[priority]) acc[priority] = []
          acc[priority].push(system)
          return acc
        }, {} as Record<number, SystemInfo[]>)

      const results: SystemExecutionResult[] = []

      // 各優先度グループを順次実行
      for (const priority of Object.keys(systemGroups).map(Number).sort()) {
        const group = systemGroups[priority]
        const parallelSystems = group.filter(s => s.canRunInParallel)
        const sequentialSystems = group.filter(s => !s.canRunInParallel)

        // 並列実行可能なシステム
        if (parallelSystems.length > 0) {
          const parallelResults = yield* Effect.allPar(
            parallelSystems.map(system => executeSystem(system, tickData))
          )
          results.push(...parallelResults)
        }

        // 順次実行システム
        for (const system of sequentialSystems) {
          const result = yield* executeSystem(system, tickData)
          results.push(result)
        }
      }

      return results
    })

  const executeSystem = (system: SystemInfo, tickData: GameTickData) =>
    Effect.gen(function* () {
      const startTime = performance.now()

      const result = yield* getSystemExecutor(system.name)(tickData).pipe(
        Effect.timeout(`${system.estimatedDuration * 2} millis`),
        Effect.either
      )

      const endTime = performance.now()
      const actualDuration = Schema.decodeSync(DeltaTime)(endTime - startTime)

      return Match.value(result).pipe(
        Match.tag("Right", () => ({
          systemName: system.name,
          actualDuration,
          success: true,
          error: undefined
        })),
        Match.tag("Left", (error) => ({
          systemName: system.name,
          actualDuration,
          success: false,
          error: String(error)
        })),
        Match.exhaustive
      )
    })

  return { executeSystemsInOrder }
})

// システム実行関数マッピング
const getSystemExecutor = (systemName: string) =>
  Match.value(systemName).pipe(
    Match.when("input", () => (tickData: GameTickData) => processInputPhase(tickData)),
    Match.when("player", () => (tickData: GameTickData) => processPlayerSystem(tickData)),
    Match.when("ai", () => (tickData: GameTickData) => processAISystem(tickData)),
    Match.when("physics", () => (tickData: GameTickData) => processPhysicsPhase(tickData)),
    Match.when("collision", () => (tickData: GameTickData) => processCollisionSystem(tickData)),
    Match.when("movement", () => (tickData: GameTickData) => processMovementSystem(tickData)),
    Match.when("redstone", () => (tickData: GameTickData) => processRedstoneSystem(tickData)),
    Match.when("fluids", () => (tickData: GameTickData) => processFluidsSystem(tickData)),
    Match.when("lighting", () => (tickData: GameTickData) => processLightingSystem(tickData)),
    Match.when("particles", () => (tickData: GameTickData) => processParticlesSystem(tickData)),
    Match.when("sound", () => (tickData: GameTickData) => processSoundSystem(tickData)),
    Match.when("network", () => (tickData: GameTickData) => processNetworkPhase(tickData)),
    Match.orElse(() => () => Effect.void)
  )
```

## レンダリングフレーム処理

### 補間レンダリング

```typescript
// レンダリングフェーズ定義
const RenderPhase = Schema.TaggedUnion("_tag", {
  ViewUpdate: Schema.Struct({ _tag: Schema.Literal("ViewUpdate"), priority: Schema.Literal(1) }),
  Culling: Schema.Struct({ _tag: Schema.Literal("Culling"), priority: Schema.Literal(2) }),
  Interpolation: Schema.Struct({ _tag: Schema.Literal("Interpolation"), priority: Schema.Literal(3) }),
  ShadowPass: Schema.Struct({ _tag: Schema.Literal("ShadowPass"), priority: Schema.Literal(4) }),
  OpaquePass: Schema.Struct({ _tag: Schema.Literal("OpaquePass"), priority: Schema.Literal(5) }),
  TransparentPass: Schema.Struct({ _tag: Schema.Literal("TransparentPass"), priority: Schema.Literal(6) }),
  ParticlePass: Schema.Struct({ _tag: Schema.Literal("ParticlePass"), priority: Schema.Literal(7) }),
  PostProcess: Schema.Struct({ _tag: Schema.Literal("PostProcess"), priority: Schema.Literal(8) }),
  UI: Schema.Struct({ _tag: Schema.Literal("UI"), priority: Schema.Literal(9) }),
  Present: Schema.Struct({ _tag: Schema.Literal("Present"), priority: Schema.Literal(10) })
})
type RenderPhase = Schema.Schema.Type<typeof RenderPhase>

// レンダリングフレームデータ
const RenderFrameData = Schema.Struct({
  interpolationAlpha: Schema.Number.pipe(
    Schema.filter(n => n >= 0 && n <= 1, { message: () => "Alpha must be 0-1" })
  ),
  frameTime: DeltaTime,
  visibleEntities: Schema.Array(Schema.Any), // Entityは具体的なSchemaで置き換え
  renderPhase: RenderPhase
})
type RenderFrameData = Schema.Schema.Type<typeof RenderFrameData>

// メインレンダリング処理
const performRenderPass = (interpolationAlpha: number) =>
  Effect.gen(function* () {
    const renderPhases = [
      { _tag: "ViewUpdate" as const, priority: 1 },
      { _tag: "Culling" as const, priority: 2 },
      { _tag: "Interpolation" as const, priority: 3 },
      { _tag: "ShadowPass" as const, priority: 4 },
      { _tag: "OpaquePass" as const, priority: 5 },
      { _tag: "TransparentPass" as const, priority: 6 },
      { _tag: "ParticlePass" as const, priority: 7 },
      { _tag: "PostProcess" as const, priority: 8 },
      { _tag: "UI" as const, priority: 9 },
      { _tag: "Present" as const, priority: 10 }
    ]

    let frameData: RenderFrameData = {
      interpolationAlpha,
      frameTime: Schema.decodeSync(DeltaTime)(0),
      visibleEntities: [],
      renderPhase: { _tag: "ViewUpdate", priority: 1 }
    }

    // フェーズごとの順次処理
    yield* Stream.fromIterable(renderPhases).pipe(
      Stream.mapEffect(phase => {
        frameData = { ...frameData, renderPhase: phase }
        return processRenderPhase(frameData)
      }, { concurrency: 1 }),
      Stream.runDrain
    )
  })

const processRenderPhase = (frameData: RenderFrameData) =>
  Match.value(frameData.renderPhase).pipe(
    Match.tag("ViewUpdate", () => updateViewMatrix(frameData)),
    Match.tag("Culling", () => performCulling(frameData)),
    Match.tag("Interpolation", () => interpolatePositions(frameData)),
    Match.tag("ShadowPass", () => renderShadows(frameData)),
    Match.tag("OpaquePass", () => renderOpaque(frameData)),
    Match.tag("TransparentPass", () => renderTransparent(frameData)),
    Match.tag("ParticlePass", () => renderParticles(frameData)),
    Match.tag("PostProcess", () => postProcess(frameData)),
    Match.tag("UI", () => renderUI(frameData)),
    Match.tag("Present", () => presentFrame(frameData)),
    Match.exhaustive
  )

// 各フェーズの実装
const updateViewMatrix = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const cameraService = yield* CameraService
    yield* cameraService.updateViewMatrix(frameData.interpolationAlpha)
    return frameData
  })

const performCulling = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const renderingService = yield* RenderingService
    const cameraService = yield* CameraService

    // フラスタムカリング -> オクルージョンカリングのパイプライン
    const frustum = yield* cameraService.getFrustum()
    const visibleEntities = yield* renderingService.performFrustumCulling(frustum).pipe(
      Effect.flatMap(visible => renderingService.performOcclusionCulling(visible))
    )

    return { ...frameData, visibleEntities }
  })

const interpolatePositions = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    // 並列でエンティティ位置を補間
    const interpolatedEntities = yield* Stream.fromIterable(frameData.visibleEntities).pipe(
      Stream.mapEffect(entity =>
        interpolateEntityPosition(entity, frameData.interpolationAlpha),
        { concurrency: 4 }
      ),
      Stream.runCollect
    )

    return { ...frameData, visibleEntities: interpolatedEntities }
  })

const interpolateEntityPosition = (entity: any, alpha: number) =>
  Effect.gen(function* () {
    const position = entity.components?.position
    const velocity = entity.components?.velocity

    return Match.value(velocity).pipe(
      Match.when(
        (v) => v !== undefined && v !== null,
        (v) => ({
          ...entity,
          renderPosition: {
            x: position.x + v.x * alpha,
            y: position.y + v.y * alpha,
            z: position.z + v.z * alpha
          }
        })
      ),
      Match.orElse(() => entity)
    )
  })

const renderShadows = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const rendererService = yield* RendererService
    yield* rendererService.shadowPass(frameData.visibleEntities)
    return frameData
  })

const renderOpaque = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const rendererService = yield* RendererService
    yield* rendererService.opaquePass(frameData.visibleEntities)
    return frameData
  })

const renderTransparent = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const rendererService = yield* RendererService
    yield* rendererService.transparentPass(frameData.visibleEntities)
    return frameData
  })

const renderParticles = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const rendererService = yield* RendererService
    yield* rendererService.particlePass(frameData.interpolationAlpha)
    return frameData
  })

const postProcess = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const rendererService = yield* RendererService
    yield* rendererService.postProcessingPass()
    return frameData
  })

const renderUI = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const uiService = yield* UIService
    yield* uiService.render()
    return frameData
  })

const presentFrame = (frameData: RenderFrameData) =>
  Effect.gen(function* () {
    const rendererService = yield* RendererService
    yield* rendererService.present()
    return frameData
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
// パフォーマンスプロファイルデータ
const ProfileData = Schema.Struct({
  phase: Schema.String,
  duration: DeltaTime,
  timestamp: Schema.Number,
  metadata: Schema.Record(Schema.String, Schema.Union(Schema.String, Schema.Number))
})
type ProfileData = Schema.Schema.Type<typeof ProfileData>

// パフォーマンスレポート
const PerformanceReport = Schema.Struct({
  avgFrameTime: DeltaTime,
  p95FrameTime: DeltaTime,
  p99FrameTime: DeltaTime,
  maxFrameTime: DeltaTime,
  frameTimeDistribution: Schema.Array(Schema.Tuple(DeltaTime, Schema.Number)),
  slowestSystems: Schema.Array(Schema.Struct({
    systemName: Schema.String,
    avgDuration: DeltaTime,
    maxDuration: DeltaTime,
    callCount: Schema.Number
  })),
  renderBottlenecks: Schema.Array(Schema.Struct({
    phase: Schema.String,
    impact: Schema.Number.pipe(
      Schema.filter(n => n >= 0 && n <= 1, { message: () => "Impact must be 0-1" })
    )
  })),
  generatedAt: Schema.Number
})
type PerformanceReport = Schema.Schema.Type<typeof PerformanceReport>

// ゲームループプロファイラー
const createGameLoopProfiler = Effect.gen(function* () {
  const MAX_SAMPLES = 1000
  const profileDataRef = yield* STM.TRef.make<ProfileData[]>([])
  const activeProfilingRef = yield* STM.TRef.make(false)

  // プロファイルデータ収集Stream
  const profilingStream = Stream.repeatEffect(
    Effect.gen(function* () {
      const isActive = yield* STM.TRef.get(activeProfilingRef).pipe(STM.commit)
      return Match.value(isActive).pipe(
        Match.when(true, () => Effect.some("profiling-active")),
        Match.orElse(() => Effect.none)
      )
    })
  ).pipe(
    Stream.schedule(Schedule.spaced("16 millis")), // 60fps相当
    Stream.take(MAX_SAMPLES)
  )

  const startProfiling = STM.TRef.set(activeProfilingRef, true).pipe(STM.commit)

  const stopProfiling = STM.TRef.set(activeProfilingRef, false).pipe(STM.commit)

  const recordProfile = (phase: string, duration: DeltaTime, metadata: Record<string, string | number> = {}) =>
    STM.gen(function* () {
      const isActive = yield* STM.TRef.get(activeProfilingRef)

      return Match.value(isActive).pipe(
        Match.when(true, () =>
          STM.TRef.update(profileDataRef, data => {
            const newData: ProfileData = {
              phase,
              duration,
              timestamp: performance.now(),
              metadata
            }
            return [...data.slice(-(MAX_SAMPLES - 1)), newData]
          })
        ),
        Match.orElse(() => STM.void)
      )
    }).pipe(STM.commit)

  const generateReport = Effect.gen(function* () {
    const profileData = yield* STM.TRef.get(profileDataRef).pipe(STM.commit)

    return Match.value(profileData.length === 0).pipe(
      Match.when(true, () => createEmptyReport()),
      Match.orElse(() => analyzeProfileData(profileData))
    )
  })

  const analyzeProfileData = (data: ProfileData[]) => {
    const frameTimes = data
      .filter(d => d.phase === "frame")
      .map(d => d.duration)
      .sort((a, b) => a - b)

    const systemStats = data.reduce((acc, profile) => {
      if (!acc[profile.phase]) {
        acc[profile.phase] = { durations: [], count: 0 }
      }
      acc[profile.phase].durations.push(profile.duration)
      acc[profile.phase].count++
      return acc
    }, {} as Record<string, { durations: DeltaTime[], count: number }>)

    const slowestSystems = Object.entries(systemStats)
      .map(([systemName, stats]) => ({
        systemName,
        avgDuration: Schema.decodeSync(DeltaTime)(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length),
        maxDuration: Schema.decodeSync(DeltaTime)(Math.max(...stats.durations)),
        callCount: stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10)

    const renderBottlenecks = Object.entries(systemStats)
      .filter(([phase]) => phase.includes("render") || phase.includes("draw"))
      .map(([phase, stats]) => ({
        phase,
        impact: Math.min(1, stats.durations.reduce((a, b) => a + b, 0) / (frameTimes.length * 16.67))
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)

    return {
      avgFrameTime: Schema.decodeSync(DeltaTime)(frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length || 0),
      p95FrameTime: Schema.decodeSync(DeltaTime)(frameTimes[Math.floor(frameTimes.length * 0.95)] || 0),
      p99FrameTime: Schema.decodeSync(DeltaTime)(frameTimes[Math.floor(frameTimes.length * 0.99)] || 0),
      maxFrameTime: Schema.decodeSync(DeltaTime)(Math.max(...frameTimes) || 0),
      frameTimeDistribution: createDistribution(frameTimes),
      slowestSystems,
      renderBottlenecks,
      generatedAt: performance.now()
    }
  }

  const createEmptyReport = (): PerformanceReport => ({
    avgFrameTime: Schema.decodeSync(DeltaTime)(0),
    p95FrameTime: Schema.decodeSync(DeltaTime)(0),
    p99FrameTime: Schema.decodeSync(DeltaTime)(0),
    maxFrameTime: Schema.decodeSync(DeltaTime)(0),
    frameTimeDistribution: [],
    slowestSystems: [],
    renderBottlenecks: [],
    generatedAt: performance.now()
  })

  const createDistribution = (times: DeltaTime[]): Array<[DeltaTime, number]> => {
    const buckets = new Map<number, number>()
    const bucketSize = 2 // 2ms buckets

    times.forEach(time => {
      const bucket = Math.floor(time / bucketSize) * bucketSize
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
    })

    return Array.from(buckets.entries())
      .map(([time, count]) => [Schema.decodeSync(DeltaTime)(time), count] as [DeltaTime, number])
      .sort(([a], [b]) => a - b)
  }

  return {
    startProfiling,
    stopProfiling,
    recordProfile,
    generateReport,
    profilingStream,
    isActive: STM.TRef.get(activeProfilingRef).pipe(STM.commit)
  }
})
```

### デバッグビジュアライゼーション

```typescript
// デバッグ表示設定
const DebugOverlayConfig = Schema.Struct({
  enabled: Schema.Boolean,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number
  }),
  size: Schema.Struct({
    width: Schema.Number.pipe(Schema.filter(n => n > 0)),
    height: Schema.Number.pipe(Schema.filter(n => n > 0))
  }),
  opacity: Schema.Number.pipe(
    Schema.filter(n => n >= 0 && n <= 1, { message: () => "Opacity must be 0-1" })
  ),
  refreshRate: Schema.Number.pipe(
    Schema.filter(n => n > 0, { message: () => "Refresh rate must be positive" })
  )
})
type DebugOverlayConfig = Schema.Schema.Type<typeof DebugOverlayConfig>

// デバッグ情報
const DebugInfo = Schema.Struct({
  gameLoopMetrics: GameLoopMetrics,
  performanceReport: PerformanceReport,
  frameHistory: Schema.Array(DeltaTime),
  systemStatus: Schema.Record(Schema.String, Schema.String)
})
type DebugInfo = Schema.Schema.Type<typeof DebugInfo>

// デバッグオーバーレイシステム
const createDebugOverlay = (config: DebugOverlayConfig) => Effect.gen(function* () {
  const canvasElement = yield* createDebugCanvas(config)
  const debugState = yield* STM.TRef.make({
    visible: config.enabled,
    lastUpdate: 0,
    frameHistory: [] as DeltaTime[]
  })

  const debugInfoStream = Stream.repeatEffect(
    Effect.gen(function* () {
      const state = yield* STM.TRef.get(debugState).pipe(STM.commit)

      return Match.value(state.visible).pipe(
        Match.when(true, () => Effect.some("update-debug")),
        Match.orElse(() => Effect.none)
      )
    })
  ).pipe(
    Stream.schedule(Schedule.spaced(`${1000 / config.refreshRate} millis`))
  )

  const renderDebugInfo = (debugInfo: DebugInfo) =>
    Effect.gen(function* () {
      const ctx = canvasElement.getContext('2d')

      return Match.value(ctx).pipe(
        Match.when(
          (context): context is CanvasRenderingContext2D => context !== null,
          (context) => renderDebugCanvas(context, debugInfo, config)
        ),
        Match.orElse(() => Effect.void)
      )
    })

  const renderDebugCanvas = (ctx: CanvasRenderingContext2D, info: DebugInfo, cfg: DebugOverlayConfig) =>
    Effect.gen(function* () {
      // 背景をクリア
      ctx.clearRect(0, 0, cfg.size.width, cfg.size.height)
      ctx.fillStyle = `rgba(0, 0, 0, ${cfg.opacity * 0.8})`
      ctx.fillRect(0, 0, cfg.size.width, cfg.size.height)

      // メトリクス表示
      yield* drawMetricsText(ctx, info.gameLoopMetrics)

      // パフォーマンスグラフ
      yield* drawPerformanceGraph(ctx, info.performanceReport, cfg)

      // システム状態
      yield* drawSystemStatus(ctx, info.systemStatus, cfg)
    })

  const drawMetricsText = (ctx: CanvasRenderingContext2D, metrics: GameLoopMetrics) =>
    Effect.gen(function* () {
      ctx.fillStyle = '#00ff00'
      ctx.font = '12px monospace'

      const lines = [
        `FPS: ${metrics.fps.toFixed(1)}`,
        `Frame: ${metrics.frameTime.toFixed(2)}ms`,
        `Update: ${metrics.updateTime.toFixed(2)}ms`,
        `Render: ${metrics.renderTime.toFixed(2)}ms`,
        `TPS: ${metrics.ticksPerSecond.toFixed(1)}`,
        `Skip: ${metrics.skippedFrames}`,
        `Alpha: ${(metrics.interpolationAlpha * 100).toFixed(1)}%`
      ]

      lines.forEach((line, i) => {
        ctx.fillText(line, 10, 20 + i * 16)
      })
    })

  const drawPerformanceGraph = (ctx: CanvasRenderingContext2D, report: PerformanceReport, cfg: DebugOverlayConfig) =>
    Effect.gen(function* () {
      const graphX = cfg.size.width * 0.35
      const graphY = 10
      const graphWidth = cfg.size.width * 0.6
      const graphHeight = 100

      // グラフ背景
      ctx.fillStyle = 'rgba(40, 40, 40, 0.8)'
      ctx.fillRect(graphX, graphY, graphWidth, graphHeight)

      // フレームタイムヒストグラム
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 1
      ctx.beginPath()

      report.frameTimeDistribution.forEach(([time, count], index) => {
        const x = graphX + (index / report.frameTimeDistribution.length) * graphWidth
        const y = graphY + graphHeight - (count / Math.max(...report.frameTimeDistribution.map(([, c]) => c))) * graphHeight

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()
    })

  const drawSystemStatus = (ctx: CanvasRenderingContext2D, status: Record<string, string>, cfg: DebugOverlayConfig) =>
    Effect.gen(function* () {
      ctx.fillStyle = '#ffff00'
      ctx.font = '10px monospace'

      const startY = cfg.size.height * 0.65
      Object.entries(status).forEach(([system, state], i) => {
        ctx.fillText(`${system}: ${state}`, 10, startY + i * 14)
      })
    })

  const toggleVisibility = STM.TRef.update(debugState, s => ({ ...s, visible: !s.visible })).pipe(STM.commit)

  const updateFrameHistory = (frameTime: DeltaTime) =>
    STM.TRef.update(debugState, s => ({
      ...s,
      frameHistory: [...s.frameHistory.slice(-99), frameTime], // 100フレーム分保持
      lastUpdate: performance.now()
    })).pipe(STM.commit)

  return {
    renderDebugInfo,
    toggleVisibility,
    updateFrameHistory,
    debugInfoStream,
    isVisible: STM.TRef.get(debugState).pipe(STM.map(s => s.visible), STM.commit)
  }
})

const createDebugCanvas = (config: DebugOverlayConfig) =>
  Effect.gen(function* () {
    const canvas = document.createElement('canvas')
    canvas.width = config.size.width
    canvas.height = config.size.height
    canvas.style.position = 'fixed'
    canvas.style.top = `${config.position.y}px`
    canvas.style.left = `${config.position.x}px`
    canvas.style.zIndex = '9999'
    canvas.style.pointerEvents = 'none'

    document.body.appendChild(canvas)

    return canvas
  })
```

## マルチスレッド対応

### Worker統合

```typescript
// Workerタスク定義
const WorkerTask = Schema.TaggedUnion("_tag", {
  Physics: Schema.Struct({
    _tag: Schema.Literal("Physics"),
    tickNumber: Schema.BigInt,
    deltaTime: DeltaTime,
    entities: Schema.Array(Schema.Any) // EntityDataの代置
  }),
  AI: Schema.Struct({
    _tag: Schema.Literal("AI"),
    tickNumber: Schema.BigInt,
    entityUpdates: Schema.Array(Schema.Any)
  }),
  Rendering: Schema.Struct({
    _tag: Schema.Literal("Rendering"),
    tickNumber: Schema.BigInt,
    visibleChunks: Schema.Array(Schema.Any)
  }),
  ChunkGeneration: Schema.Struct({
    _tag: Schema.Literal("ChunkGeneration"),
    coordinates: Schema.Array(Schema.Any), // ChunkCoordinateの代置
    seed: Schema.BigInt
  })
})
type WorkerTask = Schema.Schema.Type<typeof WorkerTask>

// Worker結果
const WorkerResult = Schema.Struct({
  taskId: Schema.String,
  workerId: Schema.String,
  result: Schema.Union(Schema.Any, Schema.String), // 成功またはエラー
  duration: DeltaTime,
  completedAt: Schema.Number
})
type WorkerResult = Schema.Schema.Type<typeof WorkerResult>

// マルチスレッド統合システム
const createWorkerIntegratedLoop = Effect.gen(function* () {
  const workerPool = yield* createWorkerPool()
  const taskQueue = yield* STM.TQueue.bounded<WorkerTask>(100)
  const resultQueue = yield* STM.TQueue.bounded<WorkerResult>(100)

  // Workerプールの作成
  const createWorkerPool = Effect.gen(function* () {
    const workers = {
      physics: yield* createPhysicsWorkerFiber(),
      ai: yield* createAIWorkerFiber(),
      rendering: yield* createRenderingWorkerFiber(),
      chunks: yield* createChunkGenerationWorkerFiber()
    }

    return {
      ...workers,
      getAllWorkers: () => Object.values(workers)
    }
  })

  // タスクスケジューラ
  const taskScheduler = Stream.fromTQueue(taskQueue).pipe(
    Stream.mapEffect(task =>
      Match.value(task).pipe(
        Match.tag("Physics", (physicsTask) =>
          schedulePhysicsTask(workerPool.physics, physicsTask)
        ),
        Match.tag("AI", (aiTask) =>
          scheduleAITask(workerPool.ai, aiTask)
        ),
        Match.tag("Rendering", (renderTask) =>
          scheduleRenderingTask(workerPool.rendering, renderTask)
        ),
        Match.tag("ChunkGeneration", (chunkTask) =>
          scheduleChunkTask(workerPool.chunks, chunkTask)
        ),
        Match.exhaustive
      ),
      { concurrency: 4 }
    ),
    Stream.runDrain
  )

  // 結果処理ストリーム
  const resultProcessor = Stream.fromTQueue(resultQueue).pipe(
    Stream.grouped(10),
    Stream.mapEffect(results =>
      Effect.gen(function* () {
        const groupedResults = results.reduce((acc, result) => {
          const workerType = result.workerId.split('-')[0]
          if (!acc[workerType]) acc[workerType] = []
          acc[workerType].push(result)
          return acc
        }, {} as Record<string, WorkerResult[]>)

        // Workerタイプ別に結果を同期
        yield* Effect.allPar([
          synchronizePhysicsResults(groupedResults.physics || []),
          synchronizeAIResults(groupedResults.ai || []),
          synchronizeRenderingResults(groupedResults.rendering || []),
          synchronizeChunkResults(groupedResults.chunks || [])
        ])
      })
    ),
    Stream.runDrain
  )

  const parallelUpdate = (tickNumber: bigint, deltaTime: DeltaTime) =>
    Effect.gen(function* () {
      const timestamp = performance.now()
      const taskId = `tick-${tickNumber}-${timestamp}`

      // 並列タスクのスケジュール
      const tasks: WorkerTask[] = [
        { _tag: "Physics", tickNumber, deltaTime, entities: [] },
        { _tag: "AI", tickNumber, entityUpdates: [] },
        { _tag: "Rendering", tickNumber, visibleChunks: [] }
      ]

      // タスクをキューに投入
      yield* Stream.fromIterable(tasks).pipe(
        Stream.mapEffect(task =>
          STM.TQueue.offer(taskQueue, task).pipe(STM.commit),
          { concurrency: "unbounded" }
        ),
        Stream.runDrain
      )

      // 結果の待機と同期
      const completedTasks = yield* Stream.fromTQueue(resultQueue).pipe(
        Stream.filter(result => result.taskId.startsWith(`tick-${tickNumber}`)),
        Stream.take(tasks.length),
        Stream.timeout("5 seconds"),
        Stream.runCollect,
        Effect.catchAll(error =>
          Effect.gen(function* () {
            yield* Effect.logError("Worker task timeout", { tickNumber, error })
            return []
          })
        )
      )

      return {
        tickNumber,
        completedTasks: completedTasks.length,
        totalTasks: tasks.length,
        duration: Schema.decodeSync(DeltaTime)(performance.now() - timestamp)
      }
    })

  // Worker Fiberの作成メソッド
  const createPhysicsWorkerFiber = Effect.gen(function* () {
    const fiber = yield* Effect.fork(
      Effect.gen(function* () {
        const worker = new Worker("/workers/physics-worker.js")

        // Workerメッセージハンドリング
        const messageStream = Stream.fromAsyncIterable(
          (async function* () {
            while (true) {
              const message = await new Promise(resolve => {
                worker.onmessage = (e) => resolve(e.data)
              })
              yield message
            }
          })()
        )

        yield* messageStream.pipe(
          Stream.mapEffect(message =>
            STM.TQueue.offer(resultQueue, message as WorkerResult).pipe(STM.commit)
          ),
          Stream.runDrain
        )
      })
    )

    return { id: "physics-worker", fiber }
  })

  const createAIWorkerFiber = Effect.gen(function* () {
    // AI Workerの同様な実装
    const fiber = yield* Effect.fork(Effect.void) // 簡略化
    return { id: "ai-worker", fiber }
  })

  const createRenderingWorkerFiber = Effect.gen(function* () {
    // Rendering Workerの同様な実装
    const fiber = yield* Effect.fork(Effect.void) // 簡略化
    return { id: "rendering-worker", fiber }
  })

  const createChunkGenerationWorkerFiber = Effect.gen(function* () {
    // Chunk Generation Workerの同様な実装
    const fiber = yield* Effect.fork(Effect.void) // 簡略化
    return { id: "chunks-worker", fiber }
  })

  return {
    parallelUpdate,
    taskScheduler: Effect.fork(taskScheduler),
    resultProcessor: Effect.fork(resultProcessor),
    shutdown: Effect.gen(function* () {
      const allWorkers = workerPool.getAllWorkers()
      yield* Effect.allPar(allWorkers.map(worker => Fiber.interrupt(worker.fiber)))
    })
  }
})

// Workerタスクスケジューラ関数
const schedulePhysicsTask = (worker: { id: string; fiber: Fiber.Fiber<void, never> }, task: WorkerTask & { _tag: "Physics" }) =>
  Effect.gen(function* () {
    // Physics Workerへのタスク送信ロジック
    yield* Effect.logDebug(`Scheduling physics task for tick ${task.tickNumber}`)
    // 実際のメッセージ送信処理は省略
  })

const scheduleAITask = (worker: { id: string; fiber: Fiber.Fiber<void, never> }, task: WorkerTask & { _tag: "AI" }) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Scheduling AI task for tick ${task.tickNumber}`)
  })

const scheduleRenderingTask = (worker: { id: string; fiber: Fiber.Fiber<void, never> }, task: WorkerTask & { _tag: "Rendering" }) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Scheduling rendering task for tick ${task.tickNumber}`)
  })

const scheduleChunkTask = (worker: { id: string; fiber: Fiber.Fiber<void, never> }, task: WorkerTask & { _tag: "ChunkGeneration" }) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Scheduling chunk generation task with ${task.coordinates.length} coordinates`)
  })

// 結果同期関数
const synchronizePhysicsResults = (results: WorkerResult[]) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Synchronizing ${results.length} physics results`)
    // 物理演算結果の同期処理
  })

const synchronizeAIResults = (results: WorkerResult[]) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Synchronizing ${results.length} AI results`)
  })

const synchronizeRenderingResults = (results: WorkerResult[]) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Synchronizing ${results.length} rendering results`)
  })

const synchronizeChunkResults = (results: WorkerResult[]) =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`Synchronizing ${results.length} chunk generation results`)
  })
```

このゲームループシステムにより、ts-minecraftは安定した物理演算と滑らかなレンダリングを実現し、様々なハードウェア環境で最適なパフォーマンスを発揮します。