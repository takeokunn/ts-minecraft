# Presentation層 - ユーザーインターフェース・制御

Presentation層は、ユーザーとアプリケーションの間のインターフェースを担う層です。MVVMパターンを採用し、UI表示、ユーザー操作の処理、開発者ツールを提供します。

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
export interface GameControllerService {
  startGame: (config: GameConfig) => Effect.Effect<void, GameStartError>
  pauseGame: () => Effect.Effect<void>
  stopGame: () => Effect.Effect<void, GameStopError>
  handleInput: (input: InputEvent) => Effect.Effect<void>
  updateGameState: (deltaTime: number) => Effect.Effect<void>
}

export const GameController: GameControllerService = {
  startGame: (config: GameConfig) =>
    Effect.gen(function* () {
      // ゲーム初期化
      yield* initializeWorld(config.worldConfig)
      yield* createPlayer(config.playerConfig)
      
      // レンダリング開始
      yield* startRenderLoop()
      
      // 入力システム初期化
      yield* initializeInputSystem()
      
      // ゲームループ開始
      yield* startGameLoop()
    }),
    
  handleInput: (input: InputEvent) =>
    Effect.gen(function* () {
      switch (input.type) {
        case 'MOVE':
          yield* handlePlayerMovement(input as MovementInput)
          break
        case 'BLOCK_PLACE':
          yield* handleBlockPlacement(input as BlockPlaceInput)
          break
        case 'INVENTORY':
          yield* handleInventoryToggle()
          break
      }
    }),
    
  updateGameState: (deltaTime: number) =>
    Effect.gen(function* () {
      // アプリケーション層のワールド更新呼び出し
      yield* updateWorld(deltaTime)
      
      // ビューモデル更新
      yield* updateGameStateViewModel(deltaTime)
      
      // UI更新
      yield* updateUI()
    })
}
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
export interface DebugControllerService {
  toggleDebugMode: () => Effect.Effect<void>
  showEntityInspector: () => Effect.Effect<void>
  showPerformanceProfiler: () => Effect.Effect<void>
  executeDebugCommand: (command: string) => Effect.Effect<string>
}

export const DebugController: DebugControllerService = {
  toggleDebugMode: () =>
    Effect.gen(function* () {
      const isDebug = yield* getDebugMode()
      
      if (isDebug) {
        yield* disableDebugOverlay()
        yield* hideDebugInfo()
      } else {
        yield* enableDebugOverlay()
        yield* showDebugInfo()
      }
      
      yield* setDebugMode(!isDebug)
    }),
    
  showEntityInspector: () =>
    Effect.gen(function* () {
      // 全エンティティ取得
      const entities = yield* getAllEntities()
      
      // エンティティリスト表示
      const inspector = yield* getEntityInspector()
      inspector.updateEntityList(entities)
      inspector.show()
    }),
    
  executeDebugCommand: (command: string) =>
    Effect.gen(function* () {
      const parts = command.split(' ')
      const cmd = parts[0]
      const args = parts.slice(1)
      
      switch (cmd) {
        case 'tp':
          const [x, y, z] = args.map(Number)
          yield* teleportPlayer(makePosition(x, y, z))
          return `Teleported to ${x}, ${y}, ${z}`
          
        case 'give':
          const itemType = args[0]
          const count = parseInt(args[1]) || 1
          yield* giveItem(itemType, count)
          return `Gave ${count} ${itemType}`
          
        case 'time':
          const time = args[0]
          yield* setWorldTime(time)
          return `Time set to ${time}`
          
        default:
          return `Unknown command: ${cmd}`
      }
    })
}
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
export interface GameStateViewModel {
  readonly isPlaying: boolean
  readonly isPaused: boolean
  readonly isLoading: boolean
  readonly currentFPS: number
  readonly frameTime: number
  readonly loadingProgress: number
  readonly errorMessage: string | null
}

export const GameStateViewModelLive = Layer.succeed(
  GameStateViewModelService,
  {
    state: {
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      currentFPS: 60,
      frameTime: 16.67,
      loadingProgress: 0,
      errorMessage: null
    },
    
    updateFPS: (fps: number) =>
      Effect.gen(function* () {
        this.state.currentFPS = fps
        this.state.frameTime = 1000 / fps
        yield* notifyStateChange('fps', fps)
      }),
      
    setLoading: (isLoading: boolean, progress?: number) =>
      Effect.gen(function* () {
        this.state.isLoading = isLoading
        if (progress !== undefined) {
          this.state.loadingProgress = progress
        }
        yield* notifyStateChange('loading', { isLoading, progress })
      }),
      
    setError: (error: string | null) =>
      Effect.gen(function* () {
        this.state.errorMessage = error
        yield* notifyStateChange('error', error)
      })
  }
)
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