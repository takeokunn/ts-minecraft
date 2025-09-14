---
title: "エントリーポイント・起動フロー実践ガイド"
description: "TypeScript Minecraftプロジェクトの各エントリーポイントと起動シーケンスの詳細解説。Effect-TS 3.17+パターンによる型安全な初期化プロセス"
category: "guide"
difficulty: "intermediate"
tags: ["entry-points", "startup", "effect-ts", "architecture", "web-workers", "initialization"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals", "development-conventions"]
estimated_reading_time: "15分"
related_patterns: ["service-patterns-catalog", "error-handling-patterns"]
related_docs: ["./00-development-conventions.md", "../01-architecture/00-overall-design.md"]
---

# エントリーポイント・起動フロー実践ガイド

## 🎯 Problem Statement

大規模なTypeScriptゲームプロジェクトでは以下の初期化課題が発生します：

- **複雑な依存関係**: 各サービス間の初期化順序の管理が困難
- **非同期初期化エラー**: 設定読み込み失敗やリソース不足による起動失敗
- **パフォーマンス問題**: すべてを同期的に初期化することで発生する長い起動時間
- **デバッグの困難さ**: 起動エラーの原因特定が困難
- **スケーラビリティ**: 新機能追加時の初期化プロセスへの影響

## 🚀 Solution Approach

Effect-TS 3.17+とLayerパターンにより、以下を実現：

1. **段階的初期化** - 依存関係に基づく順次起動
2. **型安全な設定管理** - Schemaベースの設定バリデーション
3. **並列処理最適化** - Web Workersによるマルチスレッド活用
4. **障害復旧** - エラー時の自動復旧とフォールバック
5. **開発体験向上** - 詳細なログとデバッグ支援

## ⚡ Quick Guide (5分)

### エントリーポイント一覧チェックリスト

- [ ] **メインエントリー** (`src/main.ts`) - ゲームエンジンの核心
- [ ] **Webアプリ** (`src/presentation/web/main.ts`) - UI/レンダリング
- [ ] **メッシュWorker** - チャンク生成処理
- [ ] **地形Worker** - 地形生成・バイオーム
- [ ] **物理Worker** - 衝突判定・物理演算
- [ ] **ライティングWorker** - 光の伝播計算
- [ ] **計算Worker** - 汎用数値計算

### 基本起動パターン

```typescript
// 1. 設定の定義とバリデーション
const AppConfigSchema = Schema.Struct({
  world: Schema.Struct({
    seed: Schema.Number.pipe(Schema.int()),
    renderDistance: Schema.Number.pipe(Schema.between(4, 32))
  }),
  performance: Schema.Struct({
    targetFPS: Schema.Number.pipe(Schema.between(30, 144)),
    enableWorkers: Schema.Boolean
  })
})

// 2. Layer-based初期化
const MainAppLive = Layer.mergeAll(
  ConfigServiceLive,
  WorldServiceLive,
  RendererLive,
  InputServiceLive
)

// 3. 型安全な起動プロセス
const startApplication = Effect.gen(function* () {
  const config = yield* ConfigService
  const world = yield* WorldService

  yield* world.initialize(config.world)
  yield* Effect.logInfo("Application started successfully")
}).pipe(Effect.provide(MainAppLive))
```

## 📋 Detailed Instructions

### Step 1: メインエントリーポイントの実装

メインエントリーポイント (`src/main.ts`) は全体の統合を担います：

```typescript
import { Effect, Context, Layer, Schema } from "effect"

// 1. 設定スキーマの定義
const GameMode = Schema.Literal("CREATIVE", "SURVIVAL", "ADVENTURE")

const WorldConfig = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int()),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  renderDistance: Schema.Number.pipe(Schema.between(4, 32)),
  simulationDistance: Schema.Number.pipe(Schema.between(4, 16)),
  difficulty: Schema.Literal("PEACEFUL", "EASY", "NORMAL", "HARD")
})

const PlayerConfig = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  gameMode: GameMode,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number.pipe(Schema.between(-64, 320)),
    z: Schema.Number
  })
})

const PerformanceConfig = Schema.Struct({
  targetFPS: Schema.Number.pipe(Schema.between(30, 144)),
  enableVSync: Schema.Boolean,
  workerCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
  enableProfiling: Schema.Boolean,
  memoryLimit: Schema.Number.pipe(Schema.positive()) // MB
})

const AppConfigSchema = Schema.Struct({
  version: Schema.String,
  world: WorldConfig,
  player: PlayerConfig,
  performance: PerformanceConfig,
  debug: Schema.Boolean
})

export type AppConfig = Schema.Schema.Type<typeof AppConfigSchema>

// 2. エラー型の定義
export class AppInitError extends Schema.TaggedError("AppInitError")<{
  readonly stage: string
  readonly message: string
  readonly cause?: unknown
  readonly timestamp: number
}> {}

export class ConfigValidationError extends Schema.TaggedError("ConfigValidationError")<{
  readonly field: string
  readonly value: unknown
  readonly expectedType: string
  readonly message: string
  readonly timestamp: number
}> {}

// 3. 設定サービスの実装
export interface ConfigService {
  readonly getConfig: Effect.Effect<AppConfig, ConfigValidationError>
  readonly validateConfig: (input: unknown) => Effect.Effect<AppConfig, ConfigValidationError>
}

export const ConfigService = Context.GenericTag<ConfigService>("@minecraft/ConfigService")

const makeConfigServiceLive = Effect.gen(function* () {
  return ConfigService.of({
    getConfig: Effect.gen(function* () {
      // デフォルト設定の提供
      const defaultConfig = {
        version: "1.0.0",
        world: {
          seed: 12345,
          name: "New World",
          renderDistance: 12,
          simulationDistance: 8,
          difficulty: "NORMAL"
        },
        player: {
          name: "Steve",
          gameMode: "SURVIVAL",
          position: { x: 0, y: 70, z: 0 }
        },
        performance: {
          targetFPS: 60,
          enableVSync: true,
          workerCount: Math.min(navigator.hardwareConcurrency || 4, 8),
          enableProfiling: false,
          memoryLimit: 1024
        },
        debug: false
      }

      // 環境変数からの設定上書き
      if (typeof window !== 'undefined' && window.gameConfig) {
        Object.assign(defaultConfig, window.gameConfig)
      }

      return yield* Schema.decodeUnknown(AppConfigSchema)(defaultConfig).pipe(
        Effect.mapError(error => new ConfigValidationError({
          field: "config",
          value: defaultConfig,
          expectedType: "AppConfig",
          message: `Configuration validation failed: ${error.message}`,
          timestamp: Date.now()
        }))
      )
    }),

    validateConfig: (input) =>
      Schema.decodeUnknown(AppConfigSchema)(input).pipe(
        Effect.mapError(error => new ConfigValidationError({
          field: "input",
          value: input,
          expectedType: "AppConfig",
          message: error.message,
          timestamp: Date.now()
        }))
      )
  })
})

export const ConfigServiceLive = Layer.effect(ConfigService, makeConfigServiceLive)
```

### Step 2: Webアプリケーションエントリーポイントの実装

UI/レンダリング担当のエントリーポイント (`src/presentation/web/main.ts`)：

```typescript
import { Effect, Layer } from "effect"
import * as THREE from "three"

// 1. レンダリングサービスの定義
export interface RenderService {
  readonly initialize: (canvas: HTMLCanvasElement) => Effect.Effect<void, RenderError>
  readonly render: (scene: THREE.Scene) => Effect.Effect<void, RenderError>
  readonly resize: (width: number, height: number) => Effect.Effect<void, never>
  readonly getRenderer: Effect.Effect<THREE.WebGLRenderer, never>
}

export const RenderService = Context.GenericTag<RenderService>("@minecraft/RenderService")

export class RenderError extends Schema.TaggedError("RenderError")<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
  readonly timestamp: number
}> {}

// 2. DOM管理サービス
export interface DOMService {
  readonly initializeCanvas: Effect.Effect<HTMLCanvasElement, DOMError>
  readonly setupEventListeners: Effect.Effect<void, never>
  readonly updateUI: (gameState: GameState) => Effect.Effect<void, never>
}

export const DOMService = Context.GenericTag<DOMService>("@minecraft/DOMService")

export class DOMError extends Schema.TaggedError("DOMError")<{
  readonly element: string
  readonly message: string
  readonly timestamp: number
}> {}

// 3. Webアプリケーション初期化
const makeWebAppLive = Effect.gen(function* () {
  const config = yield* ConfigService
  const domService = yield* DOMService
  const renderService = yield* RenderService

  // Canvas要素の初期化
  const canvas = yield* domService.initializeCanvas

  // レンダラーの初期化
  yield* renderService.initialize(canvas)

  // イベントリスナーの設定
  yield* domService.setupEventListeners

  // レンダリングループの開始
  yield* startRenderLoop(config.performance.targetFPS)

  return "WebApp initialized successfully"
})

export const WebAppLive = Layer.effect(
  Context.GenericTag<string>("WebApp"),
  makeWebAppLive
)

// 4. レンダリングループの実装
const startRenderLoop = (targetFPS: number) =>
  Effect.gen(function* () {
    const renderService = yield* RenderService
    const frameTime = 1000 / targetFPS

    const loop = Effect.gen(function* () {
      const startTime = Date.now()

      // フレームレンダリング
      yield* renderService.render(currentScene)

      // フレームレート調整
      const elapsed = Date.now() - startTime
      const remainingTime = Math.max(0, frameTime - elapsed)

      if (remainingTime > 0) {
        yield* Effect.sleep(`${remainingTime} millis`)
      }

      // 次のフレームをスケジュール
      yield* Effect.yieldNow
      yield* loop
    })

    yield* loop
  })

// 5. Webアプリケーションの起動
export const startWebApplication = Effect.gen(function* () {
  yield* Effect.logInfo("Starting web application...")

  const appLayers = Layer.mergeAll(
    ConfigServiceLive,
    DOMServiceLive,
    RenderServiceLive,
    WebAppLive
  )

  yield* Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.logInfo("Web application started successfully")
    })
  ).pipe(Effect.provide(appLayers))
})
```

### Step 3: Web Workersの実装

#### メッシュ生成Worker (`src/workers/mesh-generation.worker.ts`)

```typescript
import { Effect, Schema } from "effect"

// 1. Worker入力データのスキーマ
const ChunkDataSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
  blocks: Schema.Array(Schema.Array(Schema.Array(Schema.Number))),
  neighborData: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

const MeshGenerationTaskSchema = Schema.Struct({
  id: Schema.String,
  chunkData: ChunkDataSchema,
  options: Schema.Struct({
    enableGreedyMeshing: Schema.Boolean,
    enableAO: Schema.Boolean, // Ambient Occlusion
    lodLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 3))
  })
})

export type MeshGenerationTask = Schema.Schema.Type<typeof MeshGenerationTaskSchema>

// 2. Worker出力データのスキーマ
const VertexDataSchema = Schema.Struct({
  positions: Schema.Array(Schema.Number),
  normals: Schema.Array(Schema.Number),
  uvs: Schema.Array(Schema.Number),
  indices: Schema.Array(Schema.Number),
  vertexCount: Schema.Number.pipe(Schema.int())
})

const MeshGenerationResultSchema = Schema.Struct({
  id: Schema.String,
  success: Schema.Boolean,
  vertexData: Schema.optional(VertexDataSchema),
  error: Schema.optional(Schema.String),
  processingTime: Schema.Number
})

export type MeshGenerationResult = Schema.Schema.Type<typeof MeshGenerationResultSchema>

// 3. メッシュ生成の核心ロジック
const generateChunkMesh = (task: MeshGenerationTask): Effect.Effect<VertexDataSchema, string> =>
  Effect.gen(function* () {
    const startTime = Date.now()

    yield* Effect.logDebug(`Generating mesh for chunk (${task.chunkData.x}, ${task.chunkData.z})`)

    // ブロック面の生成
    const faces = yield* generateBlockFaces(task.chunkData)

    // Greedy Meshingによる最適化
    const optimizedFaces = task.options.enableGreedyMeshing
      ? yield* applyGreedyMeshing(faces)
      : faces

    // 頂点データの構築
    const vertexData = yield* buildVertexData(optimizedFaces)

    // アンビエントオクルージョンの適用
    if (task.options.enableAO) {
      yield* applyAmbientOcclusion(vertexData, task.chunkData)
    }

    const processingTime = Date.now() - startTime
    yield* Effect.logDebug(`Mesh generation completed in ${processingTime}ms`)

    return vertexData
  })

// 4. Workerメインループ
const workerMain = Effect.gen(function* () {
  yield* Effect.logInfo("Mesh generation worker started")

  // メッセージリスナーの設定
  self.addEventListener('message', (event) => {
    const processMessage = Effect.gen(function* () {
      const task = yield* Schema.decodeUnknown(MeshGenerationTaskSchema)(event.data).pipe(
        Effect.mapError(error => `Invalid task data: ${error.message}`)
      )

      const result = yield* generateChunkMesh(task).pipe(
        Effect.map(vertexData => ({
          id: task.id,
          success: true,
          vertexData,
          processingTime: Date.now()
        } as MeshGenerationResult)),
        Effect.catchAll(error => Effect.succeed({
          id: task.id,
          success: false,
          error: typeof error === 'string' ? error : 'Unknown error',
          processingTime: Date.now()
        } as MeshGenerationResult))
      )

      self.postMessage(result)
    })

    Effect.runFork(processMessage)
  })
})

// Worker起動
Effect.runFork(workerMain)
```

### Step 4: 統合起動フローの実装

全システムを統合する起動シーケンス：

```typescript
// 1. アプリケーション全体のLayerの定義
const ApplicationLive = Layer.mergeAll(
  ConfigServiceLive,
  WorldServiceLive,
  PlayerServiceLive,
  RenderServiceLive,
  InputServiceLive,
  AudioServiceLive,
  NetworkServiceLive,
  WorkerPoolServiceLive
)

// 2. 段階的初期化フローの実装
const initializeApplication = Effect.gen(function* () {
  yield* Effect.logInfo("🚀 Starting TypeScript Minecraft...")

  // Phase 1: 基本設定の読み込みと検証
  yield* Effect.logInfo("📋 Phase 1: Configuration validation")
  const config = yield* ConfigService.getConfig

  // Phase 2: 重要なサービスの初期化
  yield* Effect.logInfo("🔧 Phase 2: Core services initialization")
  const world = yield* WorldService
  const player = yield* PlayerService

  // Phase 3: レンダリング環境のセットアップ
  yield* Effect.logInfo("🎨 Phase 3: Rendering system setup")
  const renderer = yield* RenderService
  yield* renderer.initialize()

  // Phase 4: Worker プールの起動
  yield* Effect.logInfo("👷 Phase 4: Worker pool initialization")
  const workerPool = yield* WorkerPoolService
  yield* workerPool.initializeAll()

  // Phase 5: ゲームワールドの初期化
  yield* Effect.logInfo("🌍 Phase 5: World initialization")
  yield* world.initialize(config.world)
  yield* player.spawn(config.player)

  // Phase 6: ゲームループの開始
  yield* Effect.logInfo("🎮 Phase 6: Game loop startup")
  yield* startGameLoop(config.performance)

  yield* Effect.logInfo("✅ Application started successfully!")
})

// 3. エラー回復を含む起動プロセス
export const startApplication = initializeApplication.pipe(
  Effect.catchTags({
    "ConfigValidationError": (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Configuration error: ${error.message}`)
        yield* Effect.logInfo("🔧 Attempting to use default configuration...")
        return yield* initializeWithDefaults()
      }),

    "AppInitError": (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Initialization failed at ${error.stage}: ${error.message}`)
        yield* Effect.logInfo("🔄 Attempting recovery...")

        if (error.stage === "worker_initialization") {
          // Workerなしでの起動を試行
          return yield* initializeWithoutWorkers()
        }

        return yield* Effect.fail(error)
      })
  }),
  Effect.provide(ApplicationLive),
  Effect.retry(
    Schedule.exponential("1 second").pipe(
      Schedule.intersect(Schedule.recurs(3))
    )
  )
)
```

## 💡 Best Practices

### 1. 設定管理のベストプラクティス

```typescript
// ✅ 環境別設定の階層化
const createConfigForEnvironment = (env: string) => {
  const baseConfig = getBaseConfig()
  const envConfig = getEnvironmentConfig(env)
  const userConfig = getUserConfig()

  return mergeConfigs(baseConfig, envConfig, userConfig)
}

// ✅ 設定の段階的バリデーション
const validateConfigStepByStep = (config: unknown) =>
  Effect.gen(function* () {
    // 基本構造の検証
    const basicStructure = yield* validateBasicStructure(config)

    // 値の範囲検証
    const valueValidation = yield* validateValueRanges(basicStructure)

    // 依存関係の検証
    const dependencyValidation = yield* validateDependencies(valueValidation)

    return dependencyValidation
  })
```

### 2. Worker管理のベストプラクティス

```typescript
// ✅ Workerプールの動的管理
const createWorkerPool = (config: WorkerPoolConfig) =>
  Effect.gen(function* () {
    const pool = new Map<WorkerType, Worker[]>()

    for (const [type, count] of Object.entries(config.workerCounts)) {
      const workers = []
      for (let i = 0; i < count; i++) {
        const worker = yield* createWorker(type)
        workers.push(worker)
      }
      pool.set(type, workers)
    }

    return pool
  })

// ✅ Workerエラー時の自動復旧
const handleWorkerError = (worker: Worker, type: WorkerType) =>
  Effect.gen(function* () {
    yield* Effect.logWarning(`Worker ${type} crashed, restarting...`)

    // 古いWorkerの終了
    worker.terminate()

    // 新しいWorkerの作成
    const newWorker = yield* createWorker(type)

    // プールの更新
    yield* updateWorkerPool(type, newWorker)

    yield* Effect.logInfo(`Worker ${type} restarted successfully`)
  })
```

### 3. 起動パフォーマンスの最適化

```typescript
// ✅ 並列初期化の活用
const parallelInitialization = Effect.gen(function* () {
  const [config, capabilities, userPrefs] = yield* Effect.all([
    loadConfig(),
    detectCapabilities(),
    loadUserPreferences()
  ], { concurrency: "unbounded" })

  return { config, capabilities, userPrefs }
})

// ✅ 遅延初期化パターン
const lazyInitialization = {
  audioEngine: lazy(() => createAudioEngine()),
  particleSystem: lazy(() => createParticleSystem()),
  networkManager: lazy(() => createNetworkManager())
}
```

## ⚠️ Common Pitfalls

### 1. 初期化順序の問題

```typescript
// ❌ 依存関係を無視した初期化
const badInitialization = Effect.gen(function* () {
  const renderer = yield* initializeRenderer() // Configが必要
  const config = yield* loadConfig()           // 順序が逆
})

// ✅ 正しい依存関係順序
const correctInitialization = Effect.gen(function* () {
  const config = yield* loadConfig()
  const renderer = yield* initializeRenderer(config)
})
```

### 2. エラー時のリソースリーク

```typescript
// ❌ リソースが解放されない
const leakyInitialization = Effect.gen(function* () {
  const workers = yield* createWorkers()
  yield* initializeRenderer() // エラー時にworkersが残る
})

// ✅ Scopeによる確実なクリーンアップ
const safeInitialization = Effect.scoped(
  Effect.gen(function* () {
    const workers = yield* createWorkersScoped()
    const renderer = yield* initializeRendererScoped()
    return { workers, renderer }
  })
)
```

## 🔧 Advanced Techniques

### 1. 条件付き機能の初期化

```typescript
// デバイス能力に基づく機能の有効化
const conditionalInitialization = Effect.gen(function* () {
  const capabilities = yield* detectCapabilities()

  const features = []

  if (capabilities.supportsWebGPU) {
    features.push(yield* initializeWebGPURenderer())
  } else {
    features.push(yield* initializeWebGLRenderer())
  }

  if (capabilities.supportsWorkers && capabilities.coreCount > 4) {
    features.push(yield* initializeWorkerPool())
  }

  if (capabilities.hasAudioContext) {
    features.push(yield* initializeAudioEngine())
  }

  return features
})
```

### 2. プログレッシブローディング

```typescript
// 段階的な機能有効化
const progressiveLoading = Effect.gen(function* () {
  // 最小限の機能で起動
  yield* initializeCore()
  yield* updateLoadingProgress(25)

  // UI要素の追加
  yield* initializeUI()
  yield* updateLoadingProgress(50)

  // 重い処理は後で
  yield* Effect.fork(initializeHeavyFeatures())
  yield* updateLoadingProgress(100)
})
```

### 3. A/Bテスト対応の起動

```typescript
// 実験的機能のテスト
const experimentalInitialization = Effect.gen(function* () {
  const userId = yield* getUserId()
  const experiments = yield* getActiveExperiments(userId)

  if (experiments.includes("new-renderer")) {
    yield* initializeExperimentalRenderer()
  } else {
    yield* initializeStableRenderer()
  }
})
```

## 🎯 Startup Decision Tree

```
起動エラーが発生した場合:
├─ 設定エラー？
│  ├─ Yes: デフォルト設定で再試行
│  │      ├─ 成功: 警告表示で継続
│  │      └─ 失敗: 致命的エラー
│  └─ No: 次のチェック
├─ Worker初期化失敗？
│  ├─ Yes: Workerなしモードで起動
│  └─ No: 次のチェック
├─ レンダラー初期化失敗？
│  ├─ Yes: フォールバックレンダラーを試行
│  └─ No: 致命的エラーとして処理
└─ リソース不足？
   ├─ Yes: 低品質モードで起動
   └─ No: 詳細エラー報告
```

このガイドに従うことで、堅牢で高性能な起動プロセスを実装できます。