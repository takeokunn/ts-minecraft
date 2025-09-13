# Presentation層 - ユーザーインターフェース・制御

Presentation層は、ユーザーとアプリケーションの間のインターフェースを担う層です。関数型MVVMパターンを採用し、Effect-TSによる型安全なUI状態管理、ユーザー操作の処理、開発者ツールを提供します。

## アーキテクチャ構成

```
src/presentation/
├── controllers/       # MVVMのコントローラー
├── view-models/      # ビューモデル（データバインディング）
├── cli/              # 開発者CLI・デバッグツール
├── web/             # Webエントリーポイント
└── services/        # Presentationサービス
```

## 1. Controllers（コントローラー）

MVVMパターンのコントローラー層。ユーザー操作をアプリケーション層に橋渡し。

### Game Controller
```typescript
// src/presentation/controllers/game.controller.ts
import { Match } from "effect"

const GameStartError = Schema.Struct({
  _tag: Schema.Literal("GameStartError"),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
})

type GameStartError = Schema.Schema.Type<typeof GameStartError>

const GameStopError = Schema.Struct({
  _tag: Schema.Literal("GameStopError"),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
})

type GameStopError = Schema.Schema.Type<typeof GameStopError>

interface GameControllerService {
  readonly startGame: (config: GameConfig) => Effect.Effect<void, GameStartError>
  readonly pauseGame: () => Effect.Effect<void>
  readonly stopGame: () => Effect.Effect<void, GameStopError>
  readonly handleInput: (input: InputEvent) => Effect.Effect<void>
  readonly updateGameState: (deltaTime: number) => Effect.Effect<void>
}

const GameController = Context.GenericTag<GameControllerService>("@app/GameController")

const startGame = (config: GameConfig): Effect.Effect<void, GameStartError> =>
  Effect.gen(function* () {
    // 早期リターン: 設定検証
    if (!config.worldConfig) {
      return yield* Effect.fail({
        _tag: "GameStartError" as const,
        message: "World config is required"
      })
    }

    // ゲーム初期化
    yield* initializeWorld(config.worldConfig)
    yield* createPlayer(config.playerConfig)

    // レンダリング開始
    yield* startRenderLoop()

    // 入力システム初期化
    yield* initializeInputSystem()

    // ゲームループ開始
    yield* startGameLoop()
  })

const handleInput = (input: InputEvent): Effect.Effect<void> =>
  Match.value(input).pipe(
    Match.tag("MOVE", (moveInput) => handlePlayerMovement(moveInput)),
    Match.tag("BLOCK_PLACE", (placeInput) => handleBlockPlacement(placeInput)),
    Match.tag("INVENTORY", () => handleInventoryToggle()),
    Match.exhaustive
  )

const updateGameState = (deltaTime: number): Effect.Effect<void> =>
  Effect.gen(function* () {
    // 早期リターン: デルタタイム検証
    if (deltaTime <= 0) {
      return yield* Effect.unit
    }

    // アプリケーション層のワールド更新呼び出し
    yield* updateWorld(deltaTime)

    // ビューモデル更新
    yield* updateGameStateViewModel(deltaTime)

    // UI更新
    yield* updateUI()
  })

const makeGameControllerLive = Effect.gen(function* () {
  return GameController.of({
    startGame,
    pauseGame: () => Effect.gen(function* () {
      yield* pauseGameLoop()
      yield* pauseRenderLoop()
    }),
    stopGame: (config: GameConfig) => Effect.gen(function* () {
      yield* stopGameLoop()
      yield* stopRenderLoop()
      yield* cleanupResources()
    }),
    handleInput,
    updateGameState
  })
})

const GameControllerLive = Layer.effect(GameController, makeGameControllerLive)
```

**機能:**
- ゲームライフサイクル管理
- 入力イベント処理・振り分け
- アプリケーション層との連携
- ゲーム状態更新

### UI Controller
```typescript
// src/presentation/controllers/ui.controller.ts
export interface UIControllerService {
  showMainMenu: () => Effect.Effect<void>
  showInventory: () => Effect.Effect<void>
  showSettings: () => Effect.Effect<void>
  handleMenuSelection: (menuId: string) => Effect.Effect<void>
  updateHUD: (gameState: GameState) => Effect.Effect<void>
}

export const UIController: UIControllerService = {
  showMainMenu: () =>
    Effect.gen(function* () {
      // メニューUI表示
      const menuElement = yield* getMenuElement()
      menuElement.style.display = 'block'
      
      // フォーカス設定
      yield* setFocus(menuElement)
      
      // メニュー操作バインディング
      yield* bindMenuControls()
    }),
    
  showInventory: () =>
    Effect.gen(function* () {
      // インベントリデータ取得
      const player = yield* getCurrentPlayer()
      const inventory = player.inventory
      
      // インベントリUI更新
      yield* updateInventoryDisplay(inventory)
      
      // モーダル表示
      const modal = yield* getInventoryModal()
      modal.classList.add('active')
    }),
    
  updateHUD: (gameState: GameState) =>
    Effect.gen(function* () {
      // ヘルスバー更新
      yield* updateHealthBar(gameState.player.health)
      
      // 座標表示更新  
      yield* updatePositionDisplay(gameState.player.position)
      
      // FPS表示更新
      yield* updateFPSDisplay(gameState.performance.fps)
      
      // ホットバー更新
      yield* updateHotbar(gameState.player.inventory.hotbar)
    })
}
```

**機能:**
- メニュー・モーダル管理
- HUD（ヘルスバー、座標表示等）更新
- インベントリUI制御
- ユーザー操作イベント処理

### Debug Controller
```typescript
// src/presentation/controllers/debug.controller.ts
import { Match } from "effect"

interface DebugControllerService {
  readonly toggleDebugMode: () => Effect.Effect<void>
  readonly showEntityInspector: () => Effect.Effect<void>
  readonly showPerformanceProfiler: () => Effect.Effect<void>
  readonly executeDebugCommand: (command: string) => Effect.Effect<string>
}

const DebugController = Context.GenericTag<DebugControllerService>("@app/DebugController")

const toggleDebugMode = (): Effect.Effect<void> =>
  Effect.gen(function* () {
    const isDebug = yield* getDebugMode()

    const action = isDebug
      ? Effect.gen(function* () {
          yield* disableDebugOverlay()
          yield* hideDebugInfo()
        })
      : Effect.gen(function* () {
          yield* enableDebugOverlay()
          yield* showDebugInfo()
        })

    yield* action
    yield* setDebugMode(!isDebug)
  })

const showEntityInspector = (): Effect.Effect<void> =>
  Effect.gen(function* () {
    // 全エンティティ取得
    const entities = yield* getAllEntities()

    // エンティティリスト表示
    const inspector = yield* getEntityInspector()
    inspector.updateEntityList(entities)
    inspector.show()
  })

// 単一責務の関数に分割
const handleTeleportCommand = (args: string[]): Effect.Effect<string> =>
  Effect.gen(function* () {
    const [x, y, z] = args.map(Number)

    // 早期リターン: 座標検証
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      return "Invalid coordinates. Usage: tp <x> <y> <z>"
    }

    yield* teleportPlayer(makePosition(x, y, z))
    return `Teleported to ${x}, ${y}, ${z}`
  })

const handleGiveCommand = (args: string[]): Effect.Effect<string> =>
  Effect.gen(function* () {
    const itemType = args[0]
    const count = parseInt(args[1]) || 1

    // 早期リターン: アイテムタイプ検証
    if (!itemType) {
      return "Item type is required. Usage: give <itemType> [count]"
    }

    if (count <= 0) {
      return "Count must be greater than 0"
    }

    yield* giveItem(itemType, count)
    return `Gave ${count} ${itemType}`
  })

const handleTimeCommand = (args: string[]): Effect.Effect<string> =>
  Effect.gen(function* () {
    const time = args[0]

    // 早期リターン: 時間値検証
    if (!time) {
      return "Time value is required. Usage: time <time>"
    }

    yield* setWorldTime(time)
    return `Time set to ${time}`
  })

const executeDebugCommand = (command: string): Effect.Effect<string> =>
  Effect.gen(function* () {
    // 早期リターン: コマンド検証
    if (!command.trim()) {
      return "Command is empty"
    }

    const parts = command.trim().split(' ')
    const cmd = parts[0]
    const args = parts.slice(1)

    return yield* Match.value(cmd).pipe(
      Match.when("tp", () => handleTeleportCommand(args)),
      Match.when("give", () => handleGiveCommand(args)),
      Match.when("time", () => handleTimeCommand(args)),
      Match.orElse(() => Effect.succeed(`Unknown command: ${cmd}`))
    )
  })

const makeDebugControllerLive = Effect.gen(function* () {
  return DebugController.of({
    toggleDebugMode,
    showEntityInspector,
    showPerformanceProfiler: () => Effect.gen(function* () {
      const profiler = yield* getPerformanceProfiler()
      profiler.show()
    }),
    executeDebugCommand
  })
})

const DebugControllerLive = Layer.effect(DebugController, makeDebugControllerLive)
```

**機能:**
- デバッグモード切り替え
- エンティティ・パフォーマンス監視
- デバッグコマンド実行
- 開発者ツール制御

## 2. View Models（ビューモデル）

データバインディングによるリアクティブなUI状態管理。

### Game State View Model
```typescript
// src/presentation/view-models/game-state.view-model.ts

const GameStateData = Schema.Struct({
  isPlaying: Schema.Boolean,
  isPaused: Schema.Boolean,
  isLoading: Schema.Boolean,
  currentFPS: Schema.Number,
  frameTime: Schema.Number,
  loadingProgress: Schema.Number.pipe(Schema.clamp(0, 100)),
  errorMessage: Schema.NullOr(Schema.String)
})

type GameStateData = Schema.Schema.Type<typeof GameStateData>

interface GameStateViewModelService {
  readonly getState: () => Effect.Effect<GameStateData>
  readonly updateFPS: (fps: number) => Effect.Effect<void>
  readonly setLoading: (isLoading: boolean, progress?: number) => Effect.Effect<void>
  readonly setError: (error: string | null) => Effect.Effect<void>
  readonly setPlaying: (isPlaying: boolean) => Effect.Effect<void>
}

const GameStateViewModel = Context.GenericTag<GameStateViewModelService>("@app/GameStateViewModel")

const createInitialState = (): GameStateData => ({
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  currentFPS: 60,
  frameTime: 16.67,
  loadingProgress: 0,
  errorMessage: null
})

// 純粋関数として状態更新ロジックを分離
const calculateFrameTime = (fps: number): number => 1000 / Math.max(fps, 1)

const validateFPS = (fps: number): boolean => fps > 0 && fps <= 1000

const updateFPS = (currentState: GameStateData, fps: number): Effect.Effect<GameStateData> =>
  Effect.gen(function* () {
    // 早期リターン: FPS検証
    if (!validateFPS(fps)) {
      return currentState
    }

    const newState = {
      ...currentState,
      currentFPS: fps,
      frameTime: calculateFrameTime(fps)
    }

    yield* notifyStateChange('fps', fps)
    return newState
  })

const setLoading = (
  currentState: GameStateData,
  isLoading: boolean,
  progress?: number
): Effect.Effect<GameStateData> =>
  Effect.gen(function* () {
    const newState = {
      ...currentState,
      isLoading,
      loadingProgress: progress !== undefined ? Math.max(0, Math.min(100, progress)) : currentState.loadingProgress
    }

    yield* notifyStateChange('loading', { isLoading, progress })
    return newState
  })

const setError = (currentState: GameStateData, error: string | null): Effect.Effect<GameStateData> =>
  Effect.gen(function* () {
    const newState = {
      ...currentState,
      errorMessage: error
    }

    yield* notifyStateChange('error', error)
    return newState
  })

const makeGameStateViewModelLive = Effect.gen(function* () {
  const stateRef = yield* Ref.make(createInitialState())

  return GameStateViewModel.of({
    getState: () => Ref.get(stateRef),

    updateFPS: (fps: number) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        const newState = yield* updateFPS(currentState, fps)
        yield* Ref.set(stateRef, newState)
      }),

    setLoading: (isLoading: boolean, progress?: number) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        const newState = yield* setLoading(currentState, isLoading, progress)
        yield* Ref.set(stateRef, newState)
      }),

    setError: (error: string | null) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        const newState = yield* setError(currentState, error)
        yield* Ref.set(stateRef, newState)
      }),

    setPlaying: (isPlaying: boolean) =>
      Ref.update(stateRef, (state) => ({ ...state, isPlaying, isPaused: false }))
  })
})

const GameStateViewModelLive = Layer.effect(GameStateViewModel, makeGameStateViewModelLive)
```

### Player Status View Model
```typescript
// src/presentation/view-models/player-status.view-model.ts
export interface PlayerStatusViewModel {
  readonly health: number
  readonly maxHealth: number
  readonly position: Position
  readonly velocity: Vector3
  readonly selectedSlot: number
  readonly inventory: InventoryItem[]
}

export const PlayerStatusViewModelLive = Layer.succeed(
  PlayerStatusViewModelService,
  {
    state: {
      health: 100,
      maxHealth: 100,
      position: makePosition(0, 0, 0),
      velocity: { x: 0, y: 0, z: 0 },
      selectedSlot: 0,
      inventory: []
    },
    
    updateHealth: (health: number) =>
      Effect.gen(function* () {
        this.state.health = Math.max(0, Math.min(health, this.state.maxHealth))
        yield* updateHealthBar(this.state.health / this.state.maxHealth)
      }),
      
    updatePosition: (position: Position) =>
      Effect.gen(function* () {
        this.state.position = position
        yield* updateCoordinateDisplay(position)
      }),
      
    updateInventory: (inventory: InventoryItem[]) =>
      Effect.gen(function* () {
        this.state.inventory = inventory
        yield* updateInventoryDisplay(inventory)
        yield* updateHotbarDisplay(inventory.slice(0, 9))
      })
  }
)
```

### World Info View Model
```typescript
// src/presentation/view-models/world-info.view-model.ts
export interface WorldInfoViewModel {
  readonly worldName: string
  readonly seed: number
  readonly gameMode: GameMode
  readonly difficulty: Difficulty
  readonly weather: Weather
  readonly dayTime: number
  readonly loadedChunks: number
  readonly entities: number
}

export const WorldInfoViewModelLive = Layer.succeed(
  WorldInfoViewModelService,
  {
    updateWorldStats: () =>
      Effect.gen(function* () {
        // 統計情報収集
        const stats = yield* getWorldStatistics()
        
        this.state.loadedChunks = stats.chunkCount
        this.state.entities = stats.entityCount
        
        // UI更新
        yield* updateStatsDisplay(stats)
      }),
      
    updateTime: (dayTime: number) =>
      Effect.gen(function* () {
        this.state.dayTime = dayTime
        yield* updateTimeDisplay(formatGameTime(dayTime))
      }),
      
    updateWeather: (weather: Weather) =>
      Effect.gen(function* () {
        this.state.weather = weather
        yield* updateWeatherDisplay(weather)
      })
  }
)
```

## 3. CLI Tools（コマンドラインインターフェース・開発者ツール）

開発・デバッグ用のCLIツール群。

### Entity Inspector
```typescript
// src/presentation/cli/entity-inspector.ts
export interface EntityInspectorService {
  listEntities: () => Effect.Effect<EntitySummary[]>
  inspectEntity: (id: EntityId) => Effect.Effect<EntityDetails>
  watchEntity: (id: EntityId) => Effect.Effect<void>
  filterEntities: (filter: EntityFilter) => Effect.Effect<EntitySummary[]>
}

export const EntityInspector: EntityInspectorService = {
  listEntities: () =>
    Effect.gen(function* () {
      const entities = yield* getAllEntities()
      return entities.map(entity => ({
        id: entity.id,
        type: entity.archetype,
        position: entity.components.position,
        componentCount: entity.components.size
      }))
    }),
    
  inspectEntity: (id: EntityId) =>
    Effect.gen(function* () {
      const entity = yield* getEntity(id)
      
      return {
        id: entity.id,
        archetype: entity.archetype,
        components: Array.from(entity.components.entries()).map(([type, data]) => ({
          type,
          data: JSON.stringify(data, null, 2)
        })),
        lastUpdated: entity.lastUpdated,
        performance: yield* getEntityPerformanceStats(id)
      }
    }),
    
  watchEntity: (id: EntityId) =>
    Effect.gen(function* () {
      // リアルタイム監視開始
      const subscription = yield* subscribeToEntityChanges(id)
      
      subscription.subscribe((changes) => {
        console.log(`Entity ${id} updated:`, changes)
      })
    })
}
```

### World Editor
```typescript  
// src/presentation/cli/world-editor.ts
export interface WorldEditorService {
  setBlock: (position: Position, blockType: BlockType) => Effect.Effect<void>
  fillArea: (from: Position, to: Position, blockType: BlockType) => Effect.Effect<void>
  copyArea: (from: Position, to: Position) => Effect.Effect<ClipboardData>
  pasteArea: (position: Position, data: ClipboardData) => Effect.Effect<void>
  generateStructure: (position: Position, structure: StructureType) => Effect.Effect<void>
}

export const WorldEditor: WorldEditorService = {
  setBlock: (position: Position, blockType: BlockType) =>
    Effect.gen(function* () {
      yield* placeBlock(position, blockType)
      yield* updateChunkMesh(getChunkCoordinate(position))
      console.log(`Block placed: ${blockType} at ${position.x}, ${position.y}, ${position.z}`)
    }),
    
  fillArea: (from: Position, to: Position, blockType: BlockType) =>
    Effect.gen(function* () {
      const blocks: Array<{ position: Position; type: BlockType }> = []
      
      for (let x = from.x; x <= to.x; x++) {
        for (let y = from.y; y <= to.y; y++) {
          for (let z = from.z; z <= to.z; z++) {
            blocks.push({
              position: makePosition(x, y, z),
              type: blockType
            })
          }
        }
      }
      
      yield* batchPlaceBlocks(blocks)
      console.log(`Filled ${blocks.length} blocks with ${blockType}`)
    }),
    
  generateStructure: (position: Position, structure: StructureType) =>
    Effect.gen(function* () {
      const structureData = yield* loadStructure(structure)
      yield* pasteStructure(position, structureData)
      console.log(`Generated ${structure} at ${position.x}, ${position.y}, ${position.z}`)
    })
}
```

### Performance Profiler
```typescript
// src/presentation/cli/performance-profiler.ts
export interface PerformanceProfilerService {
  startProfiling: (duration?: number) => Effect.Effect<void>
  stopProfiling: () => Effect.Effect<ProfileReport>
  getMetrics: () => Effect.Effect<PerformanceMetrics>
  profileFunction: <T>(fn: () => T, label: string) => Effect.Effect<T>
}

export const PerformanceProfiler: PerformanceProfilerService = {
  startProfiling: (duration = 10000) =>
    Effect.gen(function* () {
      console.log(`Starting performance profiling for ${duration}ms`)
      
      const profiler = yield* createProfiler()
      profiler.start()
      
      // 自動停止
      setTimeout(() => {
        profiler.stop()
        console.log('Profiling completed')
      }, duration)
    }),
    
  getMetrics: () =>
    Effect.gen(function* () {
      const fps = yield* getCurrentFPS()
      const memory = yield* getMemoryUsage()
      const renderTime = yield* getRenderTime()
      const updateTime = yield* getUpdateTime()
      
      return {
        fps,
        frameTime: 1000 / fps,
        memory: {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        },
        timing: {
          render: renderTime,
          update: updateTime,
          total: renderTime + updateTime
        }
      }
    }),
    
  profileFunction: <T>(fn: () => T, label: string) =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const result = fn()
      const endTime = performance.now()
      
      console.log(`${label}: ${(endTime - startTime).toFixed(2)}ms`)
      
      return result
    })
}
```

### Network Inspector
```typescript
// src/presentation/cli/network-inspector.ts
export interface NetworkInspectorService {
  monitorConnections: () => Effect.Effect<ConnectionInfo[]>
  inspectMessages: (connectionId: string) => Effect.Effect<MessageLog[]>
  simulateLatency: (latency: number) => Effect.Effect<void>
  simulatePacketLoss: (lossRate: number) => Effect.Effect<void>
}

export const NetworkInspector: NetworkInspectorService = {
  monitorConnections: () =>
    Effect.gen(function* () {
      const connections = yield* getAllConnections()
      
      return connections.map(conn => ({
        id: conn.id,
        type: conn.type,
        status: conn.status,
        latency: conn.latency,
        bytesReceived: conn.bytesReceived,
        bytesSent: conn.bytesSent,
        messagesReceived: conn.messagesReceived,
        messagesSent: conn.messagesSent
      }))
    }),
    
  simulateLatency: (latency: number) =>
    Effect.gen(function* () {
      const networkLayer = yield* getNetworkLayer()
      networkLayer.setSimulatedLatency(latency)
      console.log(`Simulating ${latency}ms latency`)
    })
}
```

## 4. Web Entry Point

Webアプリケーションのエントリーポイント。

### Main Entry
```typescript
// src/presentation/web/main.ts
export const initializeWebApp = () =>
  Effect.gen(function* () {
    // DOM準備完了待機
    yield* waitForDOMReady()
    
    // Canvas要素取得
    const canvas = yield* getCanvasElement()
    
    // レンダリングシステム初期化
    yield* initializeRenderer(canvas)
    
    // コントローラー初期化
    yield* initializeControllers()
    
    // ビューモデル初期化  
    yield* initializeViewModels()
    
    // イベントリスナー設定
    yield* setupEventListeners()
    
    // アプリケーション開始
    yield* startApplication()
    
    console.log('Web application initialized successfully')
  })

const setupEventListeners = () =>
  Effect.gen(function* () {
    // キーボードイベント
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    
    // マウスイベント
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    
    // ウィンドウイベント
    window.addEventListener('resize', handleWindowResize)
    window.addEventListener('beforeunload', handleBeforeUnload)
  })
```

## 5. 特徴的な実装パターン

### MVVMパターン採用
- Model（Domain/Application層）
- View（HTML/CSS/DOM）
- ViewModel（データバインディング層）
- Controller（ユーザー操作制御）

### リアクティブなUI更新
- ビューモデルの状態変更を自動的にUIに反映
- Effect-TSによる副作用管理
- イベント駆動アーキテクチャ

### 豊富な開発者ツール
- エンティティ監視・操作
- パフォーマンスプロファイリング  
- ネットワーク監視
- ワールド編集機能

### Webプラットフォーム最適化
- Canvas APIによる描画
- Web Workers活用
- ブラウザAPIとの統合
- レスポンシブデザイン対応

Presentation層は、ユーザーとシステムの接点として、直感的で使いやすいインターフェースを提供し、開発・デバッグを支援する重要な層です。