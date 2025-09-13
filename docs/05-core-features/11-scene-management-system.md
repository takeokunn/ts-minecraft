# Scene Management System（シーン管理システム）

## 概要

Scene Management Systemは、ゲームの異なる画面（スタート画面、メイン画面、ゲームオーバー画面など）を統合管理するシステムです。Effect-TS 3.17+の最新パターン（Schema.Struct、@app/ServiceNameネームスペース）とDDDの境界づけられたコンテキストを使用し、型安全なシーン遷移を実現します。

## アーキテクチャ原則

### 1. 純粋関数型設計
- **状態機械パターン**: シーン遷移を関数型状態機械として実装
- **イミュータブル状態**: シーン状態を不変データとして管理
- **Effect包含**: 全てのシーン操作をEffect型で表現

### 2. 最新Effect-TSパターン
- **Schema.Struct**: シーンデータ定義の統一
- **@app/SceneService**: Context.GenericTag時の統一ネームスペース
- **Match.value**: シーン種別による分岐処理
- **早期リターン**: 無効なシーン遷移の即座な拒否

### 3. レイヤー統合設計
- **Domain層**: シーン状態・遷移ルール管理
- **Application層**: シーン制御ワークフロー
- **Presentation層**: UI状態連携・画面表示制御
- **Infrastructure層**: ルートレベル状態永続化

## 必須シーン定義

### 基本シーン種別
```typescript
// シーン種別の定義
export const SceneType = Schema.Literal(
  "StartScreen",      // スタート画面
  "MainGame",         // メイン画面（ゲームプレイ）
  "GameOver",         // ゲームオーバー画面
  "Pause",           // ポーズ画面
  "Settings",        // 設定画面
  "Loading",         // ロード画面
  "Credits"          // クレジット画面
)
export type SceneType = Schema.Schema.Type<typeof SceneType>

// シーンデータスキーマ
export const Scene = Schema.Struct({
  type: SceneType,
  id: Schema.String,
  isActive: Schema.Boolean,
  isLoading: Schema.Boolean,
  data: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
export type Scene = Schema.Schema.Type<typeof Scene>

// シーン遷移結果
export const SceneTransition = Schema.Struct({
  from: Scene,
  to: Scene,
  transitionType: Schema.Literal("push", "replace", "pop"),
  duration: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})
export type SceneTransition = Schema.Schema.Type<typeof SceneTransition>
```

### シーン状態管理
```typescript
// シーンスタック（履歴管理）
export const SceneStack = Schema.Struct({
  scenes: Schema.Array(Scene),
  currentIndex: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  maxStackSize: Schema.Number.pipe(Schema.default(() => 10))
})
export type SceneStack = Schema.Schema.Type<typeof SceneStack>

// シーン管理状態
export const SceneManagerState = Schema.Struct({
  stack: SceneStack,
  isTransitioning: Schema.Boolean,
  currentTransition: Schema.NullOr(SceneTransition),
  transitionQueue: Schema.Array(SceneTransition),
  globalData: Schema.Record(Schema.String, Schema.Unknown)
})
export type SceneManagerState = Schema.Schema.Type<typeof SceneManagerState>
```

## エラー定義

```typescript
// シーン遷移エラー
export const SceneTransitionError = Schema.Struct({
  _tag: Schema.Literal("SceneTransitionError"),
  fromScene: Scene,
  toSceneType: SceneType,
  reason: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
export type SceneTransitionError = Schema.Schema.Type<typeof SceneTransitionError>

// シーン初期化エラー
export const SceneInitializationError = Schema.Struct({
  _tag: Schema.Literal("SceneInitializationError"),
  sceneType: SceneType,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
})
export type SceneInitializationError = Schema.Schema.Type<typeof SceneInitializationError>

// シーンライフサイクルエラー
export const SceneLifecycleError = Schema.Struct({
  _tag: Schema.Literal("SceneLifecycleError"),
  scene: Scene,
  lifecycle: Schema.Literal("enter", "update", "exit", "cleanup"),
  error: Schema.String
})
export type SceneLifecycleError = Schema.Schema.Type<typeof SceneLifecycleError>
```

## サービス定義

### Scene Manager Service
```typescript
interface SceneManagerService {
  // 基本シーン操作
  readonly getCurrentScene: () => Effect.Effect<Option.Option<Scene>, never>
  readonly transitionTo: (sceneType: SceneType, data?: unknown) => Effect.Effect<void, SceneTransitionError>
  readonly pushScene: (sceneType: SceneType, data?: unknown) => Effect.Effect<void, SceneTransitionError>
  readonly popScene: () => Effect.Effect<Option.Option<Scene>, SceneTransitionError>
  readonly replaceScene: (sceneType: SceneType, data?: unknown) => Effect.Effect<void, SceneTransitionError>

  // 状態管理
  readonly getSceneStack: () => Effect.Effect<SceneStack, never>
  readonly clearSceneStack: () => Effect.Effect<void, never>
  readonly isTransitioning: () => Effect.Effect<boolean, never>

  // ライフサイクル管理
  readonly initializeScene: (sceneType: SceneType, data?: unknown) => Effect.Effect<Scene, SceneInitializationError>
  readonly cleanupScene: (scene: Scene) => Effect.Effect<void, SceneLifecycleError>

  // イベント処理
  readonly handleSceneInput: (scene: Scene, input: InputEvent) => Effect.Effect<void, never>
  readonly updateScene: (scene: Scene, deltaTime: number) => Effect.Effect<Scene, SceneLifecycleError>
}

export const SceneManagerService = Context.GenericTag<SceneManagerService>("@app/SceneManagerService")
```

### Scene Service（個別シーン管理）
```typescript
interface SceneService {
  // シーン固有操作
  readonly createScene: (type: SceneType, data?: unknown) => Effect.Effect<Scene, SceneInitializationError>
  readonly validateSceneData: (scene: Scene) => Effect.Effect<void, ValidationError>

  // 遷移ルール管理
  readonly canTransitionTo: (from: SceneType, to: SceneType) => Effect.Effect<boolean, never>
  readonly getTransitionRules: () => Effect.Effect<ReadonlyMap<SceneType, ReadonlyArray<SceneType>>, never>

  // シーンライフサイクル
  readonly onSceneEnter: (scene: Scene) => Effect.Effect<void, SceneLifecycleError>
  readonly onSceneExit: (scene: Scene) => Effect.Effect<void, SceneLifecycleError>
  readonly onSceneUpdate: (scene: Scene, deltaTime: number) => Effect.Effect<Scene, SceneLifecycleError>
}

export const SceneService = Context.GenericTag<SceneService>("@app/SceneService")
```

## 実装パターン

### 1. シーン遷移制御（関数型状態機械）
```typescript
// 遷移ルール定義
const createTransitionRules = (): ReadonlyMap<SceneType, ReadonlyArray<SceneType>> =>
  new Map([
    ["StartScreen", ["MainGame", "Settings", "Credits"]],
    ["MainGame", ["Pause", "GameOver", "Settings"]],
    ["Pause", ["MainGame", "Settings", "StartScreen"]],
    ["GameOver", ["StartScreen", "MainGame"]],
    ["Settings", ["StartScreen", "MainGame", "Pause"]],
    ["Loading", ["StartScreen", "MainGame"]],
    ["Credits", ["StartScreen"]]
  ])

// 遷移バリデーション
const validateTransition = (
  from: SceneType,
  to: SceneType,
  rules: ReadonlyMap<SceneType, ReadonlyArray<SceneType>>
): Effect.Effect<void, SceneTransitionError> =>
  Effect.gen(function* () {
    const allowedTransitions = rules.get(from)

    // 早期リターン: ルールが存在しない場合
    if (!allowedTransitions) {
      return yield* Effect.fail({
        _tag: "SceneTransitionError" as const,
        fromScene: { type: from, id: "", isActive: false, isLoading: false, timestamp: Date.now() },
        toSceneType: to,
        reason: `No transition rules defined for scene: ${from}`,
        timestamp: Date.now()
      })
    }

    // 早期リターン: 無効な遷移の場合
    if (!allowedTransitions.includes(to)) {
      return yield* Effect.fail({
        _tag: "SceneTransitionError" as const,
        fromScene: { type: from, id: "", isActive: false, isLoading: false, timestamp: Date.now() },
        toSceneType: to,
        reason: `Invalid transition from ${from} to ${to}. Allowed: ${allowedTransitions.join(", ")}`,
        timestamp: Date.now()
      })
    }
  })

// シーン遷移実行
const executeTransition = (
  currentState: SceneManagerState,
  toSceneType: SceneType,
  transitionType: "push" | "replace" | "pop",
  data?: unknown
): Effect.Effect<SceneManagerState, SceneTransitionError> =>
  Effect.gen(function* () {
    const currentScene = getCurrentSceneFromStack(currentState.stack)

    // 現在のシーンが存在する場合は遷移バリデーション実行
    if (Option.isSome(currentScene)) {
      const transitionRules = yield* getTransitionRules()
      yield* validateTransition(currentScene.value.type, toSceneType, transitionRules)
    }

    // 新しいシーン作成
    const newScene = yield* createSceneInstance(toSceneType, data)

    // 遷移タイプによる処理分岐
    const newStack = yield* Match.value(transitionType).pipe(
      Match.when("push", () => pushToStack(currentState.stack, newScene)),
      Match.when("replace", () => replaceInStack(currentState.stack, newScene)),
      Match.when("pop", () => popFromStack(currentState.stack)),
      Match.exhaustive
    )

    return {
      ...currentState,
      stack: newStack,
      isTransitioning: true,
      currentTransition: {
        from: Option.getOrElse(currentScene, () => newScene),
        to: newScene,
        transitionType,
        metadata: data ? { data } : undefined
      }
    }
  })
```

### 2. シーンライフサイクル管理
```typescript
// シーン初期化
const initializeSpecificScene = (
  sceneType: SceneType,
  data?: unknown
): Effect.Effect<Scene, SceneInitializationError> =>
  Effect.gen(function* () {
    const sceneId = `${sceneType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // シーンタイプ別初期化処理
    yield* Match.value(sceneType).pipe(
      Match.when("StartScreen", () => initializeStartScreen(data)),
      Match.when("MainGame", () => initializeMainGame(data)),
      Match.when("GameOver", () => initializeGameOverScreen(data)),
      Match.when("Pause", () => initializePauseScreen()),
      Match.when("Settings", () => initializeSettingsScreen()),
      Match.when("Loading", () => initializeLoadingScreen(data)),
      Match.when("Credits", () => initializeCreditsScreen()),
      Match.exhaustive
    )

    const scene: Scene = {
      type: sceneType,
      id: sceneId,
      isActive: false,
      isLoading: true,
      data: data ? { sceneData: data } : undefined,
      timestamp: Date.now()
    }

    yield* Effect.log(`Scene initialized: ${sceneType} (${sceneId})`)
    return scene
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail({
        _tag: "SceneInitializationError" as const,
        sceneType,
        message: `Failed to initialize scene: ${sceneType}`,
        cause: error
      })
    )
  )

// シーン更新ループ
const updateSceneLoop = (
  scene: Scene,
  deltaTime: number
): Effect.Effect<Scene, SceneLifecycleError> =>
  Effect.gen(function* () {
    // 早期リターン: 非アクティブシーンはスキップ
    if (!scene.isActive) {
      return scene
    }

    // 早期リターン: 無効なdeltaTime
    if (deltaTime <= 0 || deltaTime > 1000) {
      return scene
    }

    // シーンタイプ別更新処理
    const updatedData = yield* Match.value(scene.type).pipe(
      Match.when("StartScreen", () => updateStartScreen(scene.data, deltaTime)),
      Match.when("MainGame", () => updateMainGame(scene.data, deltaTime)),
      Match.when("GameOver", () => updateGameOverScreen(scene.data, deltaTime)),
      Match.when("Pause", () => Effect.succeed(scene.data)), // ポーズ中は更新しない
      Match.when("Settings", () => updateSettingsScreen(scene.data, deltaTime)),
      Match.when("Loading", () => updateLoadingScreen(scene.data, deltaTime)),
      Match.when("Credits", () => updateCreditsScreen(scene.data, deltaTime)),
      Match.exhaustive
    )

    return {
      ...scene,
      data: updatedData,
      timestamp: Date.now()
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail({
        _tag: "SceneLifecycleError" as const,
        scene,
        lifecycle: "update",
        error: `Update failed: ${error}`
      })
    )
  )
```

### 3. 特定シーン実装例

#### Start Screen（スタート画面）
```typescript
// スタートスクリーンのデータ定義
const StartScreenData = Schema.Struct({
  selectedMenuIndex: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  menuItems: Schema.Array(Schema.String),
  isAnimating: Schema.Boolean,
  backgroundAnimation: Schema.optional(Schema.Unknown)
})
type StartScreenData = Schema.Schema.Type<typeof StartScreenData>

const initializeStartScreen = (data?: unknown): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // BGM開始
    yield* startBackgroundMusic("menu-theme")

    // UI要素初期化
    yield* initializeMenuUI()

    // アニメーション開始
    yield* startBackgroundAnimation()

    yield* Effect.log("Start screen initialized")
  })

const updateStartScreen = (
  currentData: unknown,
  deltaTime: number
): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    const data = currentData as StartScreenData | undefined

    const menuItems = ["新規ゲーム", "続きから", "設定", "終了"]

    const updatedData: StartScreenData = {
      selectedMenuIndex: data?.selectedMenuIndex ?? 0,
      menuItems,
      isAnimating: data?.isAnimating ?? true,
      backgroundAnimation: yield* updateBackgroundAnimation(deltaTime)
    }

    return updatedData
  })

const handleStartScreenInput = (input: InputEvent): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Match.value(input).pipe(
      Match.tag("MENU_UP", () => moveCursorUp()),
      Match.tag("MENU_DOWN", () => moveCursorDown()),
      Match.tag("MENU_SELECT", () => selectMenuItem()),
      Match.tag("MENU_BACK", () => Effect.unit),
      Match.orElse(() => Effect.unit)
    )
  })
```

#### Main Game（メインゲーム画面）
```typescript
const MainGameData = Schema.Struct({
  worldLoaded: Schema.Boolean,
  playerSpawned: Schema.Boolean,
  gameTime: Schema.Number,
  isPaused: Schema.Boolean,
  performance: Schema.Struct({
    fps: Schema.Number,
    frameTime: Schema.Number,
    memoryUsage: Schema.Number
  })
})
type MainGameData = Schema.Schema.Type<typeof MainGameData>

const initializeMainGame = (data?: unknown): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // ワールド初期化
    yield* initializeWorld()

    // プレイヤー生成
    yield* spawnPlayer()

    // レンダリングシステム開始
    yield* startRenderingSystem()

    // 物理システム開始
    yield* startPhysicsSystem()

    // HUD表示
    yield* showGameHUD()

    yield* Effect.log("Main game initialized")
  })

const updateMainGame = (
  currentData: unknown,
  deltaTime: number
): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    const data = currentData as MainGameData | undefined

    // ゲーム時間更新
    const gameTime = (data?.gameTime ?? 0) + deltaTime

    // パフォーマンス監視
    const performance = yield* getPerformanceMetrics()

    const updatedData: MainGameData = {
      worldLoaded: true,
      playerSpawned: true,
      gameTime,
      isPaused: data?.isPaused ?? false,
      performance
    }

    return updatedData
  })
```

#### Game Over Screen（ゲームオーバー画面）
```typescript
const GameOverData = Schema.Struct({
  playerStats: Schema.Struct({
    survivalTime: Schema.Number,
    blocksPlaced: Schema.Number,
    distanceTraveled: Schema.Number
  }),
  highScore: Schema.Boolean,
  selectedOption: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  fadeInProgress: Schema.Number.pipe(Schema.clamp(0, 1))
})
type GameOverData = Schema.Schema.Type<typeof GameOverData>

const initializeGameOverScreen = (data?: unknown): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // ゲーム統計取得
    const playerStats = yield* getPlayerStats()

    // ハイスコア判定
    const isHighScore = yield* checkHighScore(playerStats.survivalTime)

    // ゲームオーバー音楽再生
    yield* playGameOverSound()

    // UI表示
    yield* showGameOverUI(playerStats, isHighScore)

    yield* Effect.log("Game over screen initialized")
  })

const updateGameOverScreen = (
  currentData: unknown,
  deltaTime: number
): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    const data = currentData as GameOverData | undefined

    // フェードインアニメーション更新
    const fadeInProgress = Math.min(1, (data?.fadeInProgress ?? 0) + deltaTime / 2000)

    const updatedData: GameOverData = {
      playerStats: data?.playerStats ?? { survivalTime: 0, blocksPlaced: 0, distanceTraveled: 0 },
      highScore: data?.highScore ?? false,
      selectedOption: data?.selectedOption ?? 0,
      fadeInProgress
    }

    return updatedData
  })
```

## Layer構成

```typescript
// Scene Management Layer構成
export const SceneSystemLayer = Layer.mergeAll(
  SceneManagerServiceLive,
  SceneServiceLive,
  SceneTransitionServiceLive
).pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(LoggingLayer)
)

// 開発・テスト用の軽量Layer
export const SceneSystemTestLayer = Layer.mergeAll(
  TestSceneManagerServiceLive,
  TestSceneServiceLive
).pipe(
  Layer.provide(TestConfigLayer)
)

// 実装ライブレイヤー
export const SceneManagerServiceLive = Layer.effect(
  SceneManagerService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(createInitialSceneManagerState())
    const transitionRules = createTransitionRules()

    return SceneManagerService.of({
      getCurrentScene: () =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => getCurrentSceneFromStack(state.stack))
        ),

      transitionTo: (sceneType: SceneType, data?: unknown) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)
          const newState = yield* executeTransition(currentState, sceneType, "replace", data)
          yield* Ref.set(stateRef, newState)
          yield* Effect.log(`Scene transition: -> ${sceneType}`)
        }),

      pushScene: (sceneType: SceneType, data?: unknown) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)
          const newState = yield* executeTransition(currentState, sceneType, "push", data)
          yield* Ref.set(stateRef, newState)
          yield* Effect.log(`Scene pushed: ${sceneType}`)
        }),

      popScene: () =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)

          // 早期リターン: スタックが空の場合
          if (currentState.stack.scenes.length <= 1) {
            return Option.none()
          }

          const poppedScene = currentState.stack.scenes[currentState.stack.currentIndex]
          const newStack = removeFromStack(currentState.stack)

          const newState = {
            ...currentState,
            stack: newStack
          }

          yield* Ref.set(stateRef, newState)
          yield* Effect.log(`Scene popped: ${poppedScene.type}`)

          return Option.some(poppedScene)
        }),

      // その他のメソッド実装...
    })
  })
)
```

## 使用例

### 基本的なシーン遷移
```typescript
// ゲーム開始フロー
const startGameFlow = Effect.gen(function* () {
  const sceneManager = yield* SceneManagerService

  // スタート画面表示
  yield* sceneManager.transitionTo("StartScreen")

  // メニュー選択待機
  // ... ユーザー操作待機

  // メインゲーム開始
  yield* sceneManager.transitionTo("MainGame", {
    worldSeed: 12345,
    difficulty: "Normal"
  })
})

// ゲームオーバー処理
const gameOverFlow = Effect.gen(function* () {
  const sceneManager = yield* SceneManagerService

  // 現在のゲーム統計取得
  const gameStats = yield* getCurrentGameStats()

  // ゲームオーバー画面へ遷移
  yield* sceneManager.transitionTo("GameOver", gameStats)
})

// ポーズ/再開処理
const pauseResumeFlow = Effect.gen(function* () {
  const sceneManager = yield* SceneManagerService
  const currentScene = yield* sceneManager.getCurrentScene()

  const action = yield* Match.value(currentScene).pipe(
    Match.some(
      Match.when({ type: "MainGame" }, () =>
        sceneManager.pushScene("Pause") // ポーズ画面をプッシュ
      ),
      Match.when({ type: "Pause" }, () =>
        sceneManager.popScene() // ポーズ画面をポップしてメインゲームに戻る
      ),
      Match.orElse(() => Effect.unit)
    ),
    Match.none(() => Effect.unit),
    Match.exhaustive
  )

  yield* action
})
```

## テスト戦略

### 単体テスト
```typescript
export const SceneManagementTests = describe("Scene Management", () => {
  test("基本的なシーン遷移", () =>
    Effect.gen(function* () {
      const sceneManager = yield* SceneManagerService

      // スタート画面に遷移
      yield* sceneManager.transitionTo("StartScreen")
      const startScene = yield* sceneManager.getCurrentScene()

      expect(Option.isSome(startScene)).toBe(true)
      expect(startScene.value.type).toBe("StartScreen")

      // メインゲームに遷移
      yield* sceneManager.transitionTo("MainGame")
      const gameScene = yield* sceneManager.getCurrentScene()

      expect(Option.isSome(gameScene)).toBe(true)
      expect(gameScene.value.type).toBe("MainGame")
    }).pipe(
      Effect.provide(SceneSystemTestLayer)
    ))

  test("無効な遷移の拒否", () =>
    Effect.gen(function* () {
      const sceneManager = yield* SceneManagerService

      // スタート画面に遷移
      yield* sceneManager.transitionTo("StartScreen")

      // 無効な遷移（StartScreen -> GameOver）
      const result = yield* sceneManager.transitionTo("GameOver").pipe(
        Effect.either
      )

      expect(Either.isLeft(result)).toBe(true)
      expect(result.left._tag).toBe("SceneTransitionError")
    }))
})
```

### 統合テスト
```typescript
export const SceneIntegrationTests = describe("Scene統合テスト", () => {
  test("完全なゲームフロー", () =>
    Effect.gen(function* () {
      const sceneManager = yield* SceneManagerService

      // 1. スタート画面
      yield* sceneManager.transitionTo("StartScreen")
      yield* Effect.sleep("1 second") // UI表示待機

      // 2. メインゲーム開始
      yield* sceneManager.transitionTo("MainGame")
      yield* Effect.sleep("2 seconds") // ゲームプレイシミュレーション

      // 3. ポーズ
      yield* sceneManager.pushScene("Pause")
      yield* Effect.sleep("500 millis")

      // 4. ポーズ解除
      yield* sceneManager.popScene()
      yield* Effect.sleep("1 second")

      // 5. ゲームオーバー
      yield* sceneManager.transitionTo("GameOver", {
        survivalTime: 120000,
        score: 15000
      })

      // 最終状態確認
      const finalScene = yield* sceneManager.getCurrentScene()
      expect(Option.isSome(finalScene)).toBe(true)
      expect(finalScene.value.type).toBe("GameOver")
    }))
})
```

## パフォーマンス考慮事項

### メモリ効率化
- **シーンスタック制限**: 最大10シーンでメモリ使用量制御
- **遅延初期化**: シーン遷移時の必要最小限初期化
- **リソース解放**: 非表示シーンのリソース自動解放

### 遷移最適化
- **プリロード**: 次に遷移する可能性が高いシーンの事前準備
- **フェード効果**: GPU加速による滑らかな画面遷移
- **バックグラウンド処理**: UIスレッドをブロックしない非同期処理

### 状態管理効率化
- **不変データ**: コピーコスト最小化の構造共有
- **差分更新**: 変更された部分のみの更新処理
- **キャッシュ戦略**: よく使用される状態データのメモリキャッシュ

## システム統合

Scene Management Systemは以下のシステムと密接に連携します：

- **Rendering System**: 画面表示・エフェクト制御
- **Input System**: シーン固有の入力ハンドリング
- **Audio System**: BGM・効果音の切り替え
- **Save System**: シーン状態の永続化
- **Network System**: マルチプレイ時のシーン同期

これにより、統一されたユーザー体験と効率的なリソース管理を実現します。