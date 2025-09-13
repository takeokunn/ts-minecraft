# System Integration Patterns

Effect-TSを使用したシステム間統合パターン。外部システム、サービス間通信、データ永続化、イベント処理などの統合ポイントにおける実装パターンを提供します。

## Pattern 1: Service-to-Service Communication

**使用場面**: 異なるドメインサービス間の通信

**実装**:
```typescript
// 通信エラーの定義
export class ServiceCommunicationError extends Schema.TaggedError("ServiceCommunicationError")<{
  readonly sourceService: string
  readonly targetService: string
  readonly operation: string
  readonly reason: string
  readonly timestamp: number
}> {}

// プレイヤーサービス → インベントリサービス間通信
export interface PlayerInventoryBridge {
  readonly syncInventoryChanges: (playerId: string, changes: InventoryChange[]) => Effect.Effect<void, ServiceCommunicationError>
  readonly requestInventoryState: (playerId: string) => Effect.Effect<InventoryState, ServiceCommunicationError>
}

export const PlayerInventoryBridge = Context.GenericTag<PlayerInventoryBridge>("@minecraft/PlayerInventoryBridge")

const makePlayerInventoryBridge = Effect.gen(function* () {
  const playerService = yield* PlayerService
  const inventoryService = yield* InventoryService
  const eventBus = yield* EventBusService

  return PlayerInventoryBridge.of({
    syncInventoryChanges: (playerId, changes) => Effect.gen(function* () {
      // プレイヤーの存在確認
      const player = yield* playerService.getPlayer(playerId).pipe(
        Effect.catchTag("PlayerNotFoundError", (error) =>
          Effect.fail(new ServiceCommunicationError({
            sourceService: "PlayerService",
            targetService: "InventoryService",
            operation: "syncInventoryChanges",
            reason: `Player not found: ${error.message}`,
            timestamp: Date.now()
          }))
        )
      )

      // インベントリ更新と並行してイベント発行
      yield* Effect.all([
        inventoryService.applyChanges(playerId, changes),
        eventBus.publish({
          _tag: "InventoryChanged",
          playerId,
          changes,
          timestamp: Date.now()
        })
      ], { concurrency: 2 })
    }),

    requestInventoryState: (playerId) => Effect.gen(function* () {
      return yield* inventoryService.getInventoryState(playerId).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new ServiceCommunicationError({
            sourceService: "PlayerService",
            targetService: "InventoryService",
            operation: "requestInventoryState",
            reason: error.message,
            timestamp: Date.now()
          }))
        )
      )
    })
  })
})

export const PlayerInventoryBridgeLive = Layer.effect(PlayerInventoryBridge, makePlayerInventoryBridge)
```

## Pattern 2: Event-Driven Architecture

**使用場面**: 疎結合なシステム間でのイベント駆動通信

**実装**:
```typescript
// イベント定義
const GameEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("PlayerMoved"),
    playerId: Schema.String,
    oldPosition: PositionSchema,
    newPosition: PositionSchema,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("BlockPlaced"),
    playerId: Schema.String,
    position: PositionSchema,
    blockType: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ChunkGenerated"),
    coordinate: ChunkCoordinateSchema,
    timestamp: Schema.Number
  })
)

type GameEvent = Schema.Schema.Type<typeof GameEventSchema>

export class EventBusError extends Schema.TaggedError("EventBusError")<{
  readonly operation: string
  readonly reason: string
  readonly eventType?: string
  readonly timestamp: number
}> {}

export interface EventBusService {
  readonly publish: (event: GameEvent) => Effect.Effect<void, EventBusError>
  readonly subscribe: <T extends GameEvent["_tag"]>(
    eventType: T,
    handler: (event: Extract<GameEvent, { _tag: T }>) => Effect.Effect<void, never>
  ) => Effect.Effect<void, EventBusError>
}

export const EventBusService = Context.GenericTag<EventBusService>("@minecraft/EventBusService")

const makeEventBusService = Effect.gen(function* () {
  const subscribers = yield* Ref.make(new Map<string, Array<(event: GameEvent) => Effect.Effect<void, never>>>())

  return EventBusService.of({
    publish: (event) => Effect.gen(function* () {
      const currentSubscribers = yield* Ref.get(subscribers)
      const eventHandlers = currentSubscribers.get(event._tag) || []

      if (eventHandlers.length === 0) {
        return
      }

      // 全サブスクライバーに並列でイベント配信
      yield* Effect.forEach(eventHandlers,
        (handler) => handler(event).pipe(
          Effect.catchAll((error) =>
            Effect.logError(`Event handler failed for ${event._tag}`, error)
          )
        ),
        { concurrency: "unbounded" }
      )
    }),

    subscribe: (eventType, handler) => Effect.gen(function* () {
      yield* Ref.update(subscribers, (current) => {
        const existing = current.get(eventType) || []
        return new Map(current).set(eventType, [...existing, handler as any])
      })
    })
  })
})

export const EventBusServiceLive = Layer.effect(EventBusService, makeEventBusService)

// イベントハンドラーの実装例
const chunkEventHandler = Effect.gen(function* () {
  const eventBus = yield* EventBusService
  const renderService = yield* RenderService

  yield* eventBus.subscribe("BlockPlaced", (event) => Effect.gen(function* () {
    const chunkCoord = worldToChunk(event.position)
    yield* renderService.markChunkForRegeneration(chunkCoord)
    yield* Effect.logInfo(`Chunk ${chunkCoord.x},${chunkCoord.z} marked for regeneration due to block placement`)
  }))

  yield* eventBus.subscribe("ChunkGenerated", (event) => Effect.gen(function* () {
    yield* renderService.generateMeshForChunk(event.coordinate)
    yield* Effect.logInfo(`Mesh generated for chunk ${event.coordinate.x},${event.coordinate.z}`)
  }))
})
```

## Pattern 3: Message Queue Integration

**使用場面**: 非同期処理とメッセージキューイング

**実装**:
```typescript
export class MessageQueueError extends Schema.TaggedError("MessageQueueError")<{
  readonly operation: string
  readonly queueName: string
  readonly reason: string
  readonly timestamp: number
}> {}

const MessageSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  payload: Schema.Unknown,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 10)),
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxRetries: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  createdAt: Schema.Number,
  processAt: Schema.Number
})

type Message = Schema.Schema.Type<typeof MessageSchema>

export interface MessageQueueService {
  readonly enqueue: (queueName: string, message: Omit<Message, "id" | "createdAt">) => Effect.Effect<string, MessageQueueError>
  readonly dequeue: (queueName: string) => Effect.Effect<Option.Option<Message>, MessageQueueError>
  readonly ack: (queueName: string, messageId: string) => Effect.Effect<void, MessageQueueError>
  readonly nack: (queueName: string, messageId: string, delay?: number) => Effect.Effect<void, MessageQueueError>
}

export const MessageQueueService = Context.GenericTag<MessageQueueService>("@minecraft/MessageQueueService")

const makeMessageQueueService = Effect.gen(function* () {
  const queues = yield* Ref.make(new Map<string, Queue.Queue<Message>>())

  return MessageQueueService.of({
    enqueue: (queueName, messageData) => Effect.gen(function* () {
      const messageId = crypto.randomUUID()
      const message: Message = {
        ...messageData,
        id: messageId,
        createdAt: Date.now()
      }

      yield* Ref.update(queues, (current) => {
        const queue = current.get(queueName) || Queue.empty<Message>()
        const updatedQueue = Queue.enqueue(queue, message)
        return new Map(current).set(queueName, updatedQueue)
      })

      return messageId
    }),

    dequeue: (queueName) => Effect.gen(function* () {
      const currentQueues = yield* Ref.get(queues)
      const queue = currentQueues.get(queueName)

      if (!queue || Queue.isEmpty(queue)) {
        return Option.none()
      }

      const dequeued = Queue.dequeue(queue)
      yield* Ref.update(queues, (current) =>
        new Map(current).set(queueName, dequeued[1])
      )

      return Option.some(dequeued[0])
    }),

    ack: (queueName, messageId) => Effect.gen(function* () {
      yield* Effect.logDebug(`Message ${messageId} acknowledged from queue ${queueName}`)
    }),

    nack: (queueName, messageId, delay = 5000) => Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(delay))
      yield* Effect.logWarn(`Message ${messageId} requeued to ${queueName} after ${delay}ms delay`)
    })
  })
})

export const MessageQueueServiceLive = Layer.effect(MessageQueueService, makeMessageQueueService)

// 使用例: チャンク生成の非同期処理
const enqueueChunkGeneration = (coordinates: ChunkCoordinate[]) => Effect.gen(function* () {
  const messageQueue = yield* MessageQueueService

  yield* Effect.forEach(coordinates, (coord) =>
    messageQueue.enqueue("chunk-generation", {
      type: "GenerateChunk",
      payload: coord,
      priority: 5,
      retryCount: 0,
      maxRetries: 3,
      processAt: Date.now()
    }),
    { concurrency: 10 }
  )
})
```

## Pattern 4: External API Integration

**使用場面**: REST API、WebSocketなどの外部システム連携

**実装**:
```typescript
export class ExternalAPIError extends Schema.TaggedError("ExternalAPIError")<{
  readonly endpoint: string
  readonly method: string
  readonly statusCode?: number
  readonly message: string
  readonly timestamp: number
}> {}

// WebSocket統合パターン
export interface WebSocketService {
  readonly connect: (url: string) => Effect.Effect<WebSocket, ExternalAPIError>
  readonly send: (ws: WebSocket, message: unknown) => Effect.Effect<void, ExternalAPIError>
  readonly listen: (ws: WebSocket, handler: (data: unknown) => Effect.Effect<void, never>) => Effect.Effect<void, ExternalAPIError>
}

export const WebSocketService = Context.GenericTag<WebSocketService>("@minecraft/WebSocketService")

const makeWebSocketService = Effect.succeed(
  WebSocketService.of({
    connect: (url) => Effect.gen(function* () {
      return yield* Effect.async<WebSocket, ExternalAPIError>((resume) => {
        const ws = new WebSocket(url)

        ws.onopen = () => resume(Effect.succeed(ws))
        ws.onerror = (error) => resume(Effect.fail(new ExternalAPIError({
          endpoint: url,
          method: "CONNECT",
          message: `WebSocket connection failed: ${error}`,
          timestamp: Date.now()
        })))

        return Effect.sync(() => ws.close())
      })
    }),

    send: (ws, message) => Effect.gen(function* () {
      if (ws.readyState !== WebSocket.OPEN) {
        return yield* Effect.fail(new ExternalAPIError({
          endpoint: ws.url,
          method: "SEND",
          message: "WebSocket is not in OPEN state",
          timestamp: Date.now()
        }))
      }

      ws.send(JSON.stringify(message))
    }),

    listen: (ws, handler) => Effect.gen(function* () {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        Effect.runFork(handler(data))
      }

      ws.onerror = (error) => {
        Effect.runFork(Effect.logError(`WebSocket error: ${error}`))
      }
    })
  })
)

export const WebSocketServiceLive = Layer.effect(WebSocketService, makeWebSocketService)

// マルチプレイヤー同期の実装例
const multiplayerSync = Effect.gen(function* () {
  const wsService = yield* WebSocketService
  const eventBus = yield* EventBusService

  const ws = yield* wsService.connect("ws://localhost:8080/multiplayer")

  // サーバーからのメッセージを受信してイベントとして発行
  yield* wsService.listen(ws, (data) => Effect.gen(function* () {
    const event = yield* Effect.try(() => Schema.decodeUnknownSync(GameEventSchema)(data))
    yield* eventBus.publish(event)
  }))

  // ローカルイベントをサーバーに送信
  yield* eventBus.subscribe("PlayerMoved", (event) =>
    wsService.send(ws, event)
  )
})
```

## Pattern 5: Database Integration

**使用場面**: データの永続化とクエリ処理

**実装**:
```typescript
export class DatabaseError extends Schema.TaggedError("DatabaseError")<{
  readonly operation: string
  readonly table?: string
  readonly query?: string
  readonly message: string
  readonly timestamp: number
}> {}

// データベース抽象化
export interface DatabaseService {
  readonly query: <T>(sql: string, params: unknown[]) => Effect.Effect<T[], DatabaseError>
  readonly execute: (sql: string, params: unknown[]) => Effect.Effect<number, DatabaseError>
  readonly transaction: <T>(operations: Effect.Effect<T, DatabaseError>) => Effect.Effect<T, DatabaseError>
}

export const DatabaseService = Context.GenericTag<DatabaseService>("@minecraft/DatabaseService")

// インメモリ実装（開発用）
const makeInMemoryDatabaseService = Effect.gen(function* () {
  const tables = yield* Ref.make(new Map<string, any[]>())

  return DatabaseService.of({
    query: (sql, params) => Effect.gen(function* () {
      // 簡単なSQL解析（実際の実装ではより堅牢なパーサーを使用）
      const match = sql.match(/SELECT \* FROM (\w+)/)
      if (!match) {
        return yield* Effect.fail(new DatabaseError({
          operation: "query",
          query: sql,
          message: "Unsupported query format",
          timestamp: Date.now()
        }))
      }

      const tableName = match[1]
      const currentTables = yield* Ref.get(tables)
      return currentTables.get(tableName) || []
    }),

    execute: (sql, params) => Effect.gen(function* () {
      const insertMatch = sql.match(/INSERT INTO (\w+)/)
      if (insertMatch) {
        const tableName = insertMatch[1]
        yield* Ref.update(tables, (current) => {
          const table = current.get(tableName) || []
          return new Map(current).set(tableName, [...table, params[0]])
        })
        return 1
      }

      return 0
    }),

    transaction: (operations) => Effect.gen(function* () {
      // トランザクションの簡単な実装
      const snapshot = yield* Ref.get(tables)

      return yield* operations.pipe(
        Effect.catchAll((error) => Effect.gen(function* () {
          // ロールバック
          yield* Ref.set(tables, snapshot)
          return yield* Effect.fail(error)
        }))
      )
    })
  })
})

export const InMemoryDatabaseServiceLive = Layer.effect(DatabaseService, makeInMemoryDatabaseService)

// リポジトリパターンの実装
export interface ChunkRepository {
  readonly save: (chunk: ChunkData) => Effect.Effect<void, DatabaseError>
  readonly load: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<ChunkData>, DatabaseError>
  readonly delete: (coordinate: ChunkCoordinate) => Effect.Effect<void, DatabaseError>
}

export const ChunkRepository = Context.GenericTag<ChunkRepository>("@minecraft/ChunkRepository")

const makeChunkRepository = Effect.gen(function* () {
  const db = yield* DatabaseService

  return ChunkRepository.of({
    save: (chunk) => Effect.gen(function* () {
      const serialized = JSON.stringify(chunk)
      yield* db.execute(
        "INSERT OR REPLACE INTO chunks (x, z, data) VALUES (?, ?, ?)",
        [chunk.coordinate.x, chunk.coordinate.z, serialized]
      )
    }),

    load: (coordinate) => Effect.gen(function* () {
      const results = yield* db.query<{ data: string }>(
        "SELECT data FROM chunks WHERE x = ? AND z = ?",
        [coordinate.x, coordinate.z]
      )

      if (results.length === 0) {
        return Option.none()
      }

      const chunkData = JSON.parse(results[0].data)
      return Option.some(chunkData)
    }),

    delete: (coordinate) => Effect.gen(function* () {
      yield* db.execute(
        "DELETE FROM chunks WHERE x = ? AND z = ?",
        [coordinate.x, coordinate.z]
      )
    })
  })
})

export const ChunkRepositoryLive = Layer.effect(ChunkRepository, makeChunkRepository)
```

## Pattern 6: File System Integration

**使用場面**: ファイル操作、設定読み込み、アセット管理

**実装**:
```typescript
export class FileSystemError extends Schema.TaggedError("FileSystemError")<{
  readonly operation: string
  readonly path: string
  readonly reason: string
  readonly timestamp: number
}> {}

export interface FileSystemService {
  readonly readFile: (path: string) => Effect.Effect<string, FileSystemError>
  readonly writeFile: (path: string, content: string) => Effect.Effect<void, FileSystemError>
  readonly exists: (path: string) => Effect.Effect<boolean, FileSystemError>
  readonly createDirectory: (path: string) => Effect.Effect<void, FileSystemError>
  readonly listDirectory: (path: string) => Effect.Effect<string[], FileSystemError>
}

export const FileSystemService = Context.GenericTag<FileSystemService>("@minecraft/FileSystemService")

const makeFileSystemService = Effect.succeed(
  FileSystemService.of({
    readFile: (path) => Effect.gen(function* () {
      return yield* Effect.async<string, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "readFile",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(data))
            }
          })
        })
      })
    }),

    writeFile: (path, content) => Effect.gen(function* () {
      return yield* Effect.async<void, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.writeFile(path, content, 'utf8', (err) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "writeFile",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(void 0))
            }
          })
        })
      })
    }),

    exists: (path) => Effect.gen(function* () {
      return yield* Effect.async<boolean, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.access(path, (err) => {
            resume(Effect.succeed(!err))
          })
        })
      })
    }),

    createDirectory: (path) => Effect.gen(function* () {
      return yield* Effect.async<void, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.mkdir(path, { recursive: true }, (err) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "createDirectory",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(void 0))
            }
          })
        })
      })
    }),

    listDirectory: (path) => Effect.gen(function* () {
      return yield* Effect.async<string[], FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.readdir(path, (err, files) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "listDirectory",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(files))
            }
          })
        })
      })
    })
  })
)

export const FileSystemServiceLive = Layer.effect(FileSystemService, makeFileSystemService)

// 設定ファイル管理の実装例
const ConfigSchema = Schema.Struct({
  renderDistance: Schema.Number.pipe(Schema.int(), Schema.between(2, 32)),
  maxFPS: Schema.Number.pipe(Schema.int(), Schema.between(30, 240)),
  enableShadows: Schema.Boolean,
  textureQuality: Schema.Union(
    Schema.Literal("low"),
    Schema.Literal("medium"),
    Schema.Literal("high")
  )
})

type Config = Schema.Schema.Type<typeof ConfigSchema>

export interface ConfigService {
  readonly loadConfig: () => Effect.Effect<Config, FileSystemError>
  readonly saveConfig: (config: Config) => Effect.Effect<void, FileSystemError>
}

export const ConfigService = Context.GenericTag<ConfigService>("@minecraft/ConfigService")

const makeConfigService = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const configPath = "./config/game.json"

  return ConfigService.of({
    loadConfig: () => Effect.gen(function* () {
      const exists = yield* fs.exists(configPath)

      if (!exists) {
        // デフォルト設定を作成
        const defaultConfig: Config = {
          renderDistance: 16,
          maxFPS: 60,
          enableShadows: true,
          textureQuality: "high"
        }
        yield* fs.createDirectory("./config")
        yield* fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
      }

      const content = yield* fs.readFile(configPath)
      return Schema.decodeUnknownSync(ConfigSchema)(JSON.parse(content))
    }),

    saveConfig: (config) => Effect.gen(function* () {
      yield* fs.createDirectory("./config")
      yield* fs.writeFile(configPath, JSON.stringify(config, null, 2))
    })
  })
})

export const ConfigServiceLive = Layer.effect(ConfigService, makeConfigService)
```

## Pattern 7: Third-party Library Integration

**使用場面**: Three.js、物理エンジンなどの外部ライブラリ統合

**実装**:
```typescript
export class ThreeJSError extends Schema.TaggedError("ThreeJSError")<{
  readonly operation: string
  readonly component: string
  readonly message: string
  readonly timestamp: number
}> {}

// Three.jsレンダラーサービス
export interface ThreeJSService {
  readonly initializeRenderer: (canvas: HTMLCanvasElement) => Effect.Effect<THREE.WebGPURenderer, ThreeJSError>
  readonly createScene: () => Effect.Effect<THREE.Scene, ThreeJSError>
  readonly createCamera: (aspect: number) => Effect.Effect<THREE.PerspectiveCamera, ThreeJSError>
  readonly render: (renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, ThreeJSError>
}

export const ThreeJSService = Context.GenericTag<ThreeJSService>("@minecraft/ThreeJSService")

const makeThreeJSService = Effect.succeed(
  ThreeJSService.of({
    initializeRenderer: (canvas) => Effect.gen(function* () {
      return yield* Effect.try({
        try: async () => {
          const renderer = new THREE.WebGPURenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance"
          })
          await renderer.init()
          return renderer
        },
        catch: (error) => new ThreeJSError({
          operation: "initializeRenderer",
          component: "WebGPURenderer",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now()
        })
      })
    }),

    createScene: () => Effect.gen(function* () {
      return yield* Effect.sync(() => new THREE.Scene())
    }),

    createCamera: (aspect) => Effect.gen(function* () {
      return yield* Effect.sync(() =>
        new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
      )
    }),

    render: (renderer, scene, camera) => Effect.gen(function* () {
      return yield* Effect.try({
        try: async () => {
          await renderer.renderAsync(scene, camera)
        },
        catch: (error) => new ThreeJSError({
          operation: "render",
          component: "WebGPURenderer",
          message: error instanceof Error ? error.message : "Render failed",
          timestamp: Date.now()
        })
      })
    })
  })
)

export const ThreeJSServiceLive = Layer.effect(ThreeJSService, makeThreeJSService)

// メッシュ生成サービスの実装
export interface MeshGenerationService {
  readonly createChunkMesh: (chunkData: ChunkData) => Effect.Effect<THREE.Mesh, ThreeJSError>
  readonly updateMesh: (mesh: THREE.Mesh, chunkData: ChunkData) => Effect.Effect<void, ThreeJSError>
  readonly disposeMesh: (mesh: THREE.Mesh) => Effect.Effect<void, never>
}

export const MeshGenerationService = Context.GenericTag<MeshGenerationService>("@minecraft/MeshGenerationService")

const makeMeshGenerationService = Effect.gen(function* () {
  const threeJS = yield* ThreeJSService

  return MeshGenerationService.of({
    createChunkMesh: (chunkData) => Effect.gen(function* () {
      return yield* Effect.try({
        try: () => {
          const geometry = new THREE.BufferGeometry()
          const vertices: number[] = []
          const indices: number[] = []

          // チャンクデータからメッシュを生成
          chunkData.blocks.forEach((block, index) => {
            if (block.type !== "air") {
              const x = index % 16
              const y = Math.floor(index / 256)
              const z = Math.floor((index % 256) / 16)

              // ブロックの6面を追加（隣接チェックは省略）
              addBlockFaces(vertices, indices, x, y, z)
            }
          })

          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
          geometry.setIndex(indices)
          geometry.computeVertexNormals()

          const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
          return new THREE.Mesh(geometry, material)
        },
        catch: (error) => new ThreeJSError({
          operation: "createChunkMesh",
          component: "BufferGeometry",
          message: error instanceof Error ? error.message : "Mesh creation failed",
          timestamp: Date.now()
        })
      })
    }),

    updateMesh: (mesh, chunkData) => Effect.gen(function* () {
      // メッシュ更新ロジック
      yield* Effect.sync(() => {
        mesh.geometry.dispose()
        // 新しいジオメトリを作成して置換
      })
    }),

    disposeMesh: (mesh) => Effect.gen(function* () {
      yield* Effect.sync(() => {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose())
        } else {
          mesh.material.dispose()
        }
      })
    })
  })
})

export const MeshGenerationServiceLive = Layer.effect(MeshGenerationService, makeMeshGenerationService)

// ヘルパー関数
const addBlockFaces = (vertices: number[], indices: number[], x: number, y: number, z: number) => {
  const startIndex = vertices.length / 3

  // 6面の頂点を追加（簡略版）
  const blockFaces = [
    // Front face
    [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
    // Back face
    [x + 1, y, z], [x, y, z], [x, y + 1, z], [x + 1, y + 1, z],
    // Top face
    [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z], [x, y + 1, z],
    // Bottom face
    [x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1],
    // Right face
    [x + 1, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
    // Left face
    [x, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z]
  ]

  blockFaces.forEach(face => {
    vertices.push(...face)
  })

  // インデックスを追加（各面2つの三角形）
  for (let i = 0; i < 6; i++) {
    const faceStart = startIndex + i * 4
    indices.push(
      faceStart, faceStart + 1, faceStart + 2,
      faceStart, faceStart + 2, faceStart + 3
    )
  }
}
```

## Pattern 8: Cross-Layer Communication

**使用場面**: ドメイン層からインフラストラクチャ層への依存関係逆転

**実装**:
```typescript
// ドメイン層のポート定義
export interface ChunkStoragePort {
  readonly save: (chunk: ChunkData) => Effect.Effect<void, ChunkStorageError>
  readonly load: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<ChunkData>, ChunkStorageError>
}

export const ChunkStoragePort = Context.GenericTag<ChunkStoragePort>("@minecraft/domain/ChunkStoragePort")

export class ChunkStorageError extends Schema.TaggedError("ChunkStorageError")<{
  readonly operation: string
  readonly coordinate?: ChunkCoordinate
  readonly reason: string
  readonly timestamp: number
}> {}

// ドメインサービスの実装
export interface ChunkDomainService {
  readonly generateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly persistChunk: (chunk: ChunkData) => Effect.Effect<void, ChunkStorageError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkStorageError | ChunkGenerationError>
}

export const ChunkDomainService = Context.GenericTag<ChunkDomainService>("@minecraft/domain/ChunkDomainService")

const makeChunkDomainService = Effect.gen(function* () {
  const chunkStorage = yield* ChunkStoragePort // ポートに依存
  const terrainGenerator = yield* TerrainGeneratorService

  return ChunkDomainService.of({
    generateChunk: (coordinate) => Effect.gen(function* () {
      return yield* terrainGenerator.generate(coordinate)
    }),

    persistChunk: (chunk) => Effect.gen(function* () {
      yield* chunkStorage.save(chunk)
    }),

    loadChunk: (coordinate) => Effect.gen(function* () {
      const existingChunk = yield* chunkStorage.load(coordinate)

      return yield* Match.value(existingChunk).pipe(
        Match.when(Option.isSome, (chunk) => Effect.succeed(chunk.value)),
        Match.when(Option.isNone, () => Effect.gen(function* () {
          const newChunk = yield* terrainGenerator.generate(coordinate)
          yield* chunkStorage.save(newChunk)
          return newChunk
        })),
        Match.exhaustive
      )
    })
  })
})

export const ChunkDomainServiceLive = Layer.effect(ChunkDomainService, makeChunkDomainService)

// インフラストラクチャ層のアダプター実装
const makeFileSystemChunkStorageAdapter = Effect.gen(function* () {
  const fs = yield* FileSystemService

  return ChunkStoragePort.of({
    save: (chunk) => Effect.gen(function* () {
      const filePath = `./world/chunks/chunk_${chunk.coordinate.x}_${chunk.coordinate.z}.json`
      const serializedChunk = JSON.stringify(chunk)

      yield* fs.createDirectory("./world/chunks")
      yield* fs.writeFile(filePath, serializedChunk).pipe(
        Effect.mapError((error) => new ChunkStorageError({
          operation: "save",
          coordinate: chunk.coordinate,
          reason: error.reason,
          timestamp: Date.now()
        }))
      )
    }),

    load: (coordinate) => Effect.gen(function* () {
      const filePath = `./world/chunks/chunk_${coordinate.x}_${coordinate.z}.json`
      const exists = yield* fs.exists(filePath).pipe(
        Effect.mapError((error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          reason: error.reason,
          timestamp: Date.now()
        }))
      )

      if (!exists) {
        return Option.none()
      }

      const content = yield* fs.readFile(filePath).pipe(
        Effect.mapError((error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          reason: error.reason,
          timestamp: Date.now()
        }))
      )

      const chunkData = yield* Effect.try({
        try: () => JSON.parse(content) as ChunkData,
        catch: (error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          reason: `Failed to parse chunk data: ${error}`,
          timestamp: Date.now()
        })
      })

      return Option.some(chunkData)
    })
  })
})

export const FileSystemChunkStorageAdapterLive = Layer.effect(ChunkStoragePort, makeFileSystemChunkStorageAdapter)

// レイヤー構成
export const ChunkManagementLive = Layer.mergeAll(
  FileSystemServiceLive,
  TerrainGeneratorServiceLive
).pipe(
  Layer.provideMerge(FileSystemChunkStorageAdapterLive),
  Layer.provideMerge(ChunkDomainServiceLive)
)
```

## Anti-Patterns (避けるべき統合パターン)

### ❌ Anti-Pattern 1: 直接的な外部依存
```typescript
// これは避ける - 直接的なライブラリ呼び出し
const badService = Effect.gen(function* () {
  const fs = require('fs') // 直接require
  const data = fs.readFileSync('./config.json') // 同期的読み込み
  return JSON.parse(data)
})
```

### ❌ Anti-Pattern 2: Promise混在
```typescript
// これも避ける - PromiseとEffectの混在
const badAsyncService = async () => {
  const result = await Effect.runPromise(someEffect()) // 混在は避ける
  return result
}
```

### ❌ Anti-Pattern 3: エラーハンドリングの欠如
```typescript
// これも不適切 - エラー型の未定義
interface BadService {
  readonly operation: () => Effect.Effect<string, never> // エラー型がnever
}
```

### ❌ Anti-Pattern 4: 循環依存
```typescript
// これは避ける - サービス間の循環依存
const ServiceA = Context.GenericTag<{
  useB: () => Effect.Effect<string, never>
}>("ServiceA")

const ServiceB = Context.GenericTag<{
  useA: () => Effect.Effect<string, never> // 循環依存
}>("ServiceB")
```

## Best Practices

### 1. ポート・アダプターパターンの活用
```typescript
// ドメイン層でポートを定義
export interface DataPort {
  readonly save: (data: unknown) => Effect.Effect<void, DataError>
}

// インフラ層でアダプターを実装
export const FileSystemAdapter: DataPort = /* ... */
export const DatabaseAdapter: DataPort = /* ... */
```

### 2. 統合テストでの依存関係注入
```typescript
// テスト用のモックを提供
export const TestChunkStorageLive = Layer.succeed(
  ChunkStoragePort,
  ChunkStoragePort.of({
    save: () => Effect.succeed(void 0),
    load: () => Effect.succeed(Option.none())
  })
)
```

### 3. 適切なエラー境界の設定
```typescript
// 統合ポイントでエラーを適切に変換
const adaptedService = externalService.operation().pipe(
  Effect.mapError((externalError) => new IntegrationError({
    source: "ExternalService",
    operation: "operation",
    reason: externalError.message,
    timestamp: Date.now()
  }))
)
```

### 4. リソース管理の徹底
```typescript
// Effect.acquireReleaseでリソースを安全に管理
const safeExternalResource = Effect.acquireRelease(
  acquireExternalResource(),
  (resource) => Effect.sync(() => resource.cleanup())
)
```

### 5. 設定による統合方法の切り替え
```typescript
// 環境に応じて統合方法を切り替え
const StorageLayerLive = Config.string("STORAGE_TYPE").pipe(
  Effect.map(storageType => Match.value(storageType).pipe(
    Match.when("filesystem", () => FileSystemStorageLive),
    Match.when("database", () => DatabaseStorageLive),
    Match.when("memory", () => InMemoryStorageLive),
    Match.orElse(() => FileSystemStorageLive)
  )),
  Layer.fromEffect
)
```

## Testing Integration Patterns

### 統合テスト例
```typescript
const integrationTest = Effect.gen(function* () {
  const chunkService = yield* ChunkDomainService
  const coordinate = { x: 0, z: 0 }

  // チャンク生成
  const generatedChunk = yield* chunkService.generateChunk(coordinate)
  assert(generatedChunk.coordinate.x === coordinate.x)

  // チャンク永続化
  yield* chunkService.persistChunk(generatedChunk)

  // チャンク読み込み
  const loadedChunk = yield* chunkService.loadChunk(coordinate)
  assert.deepEqual(loadedChunk.blocks, generatedChunk.blocks)
}).pipe(
  Effect.provide(Layer.mergeAll(
    TestChunkStorageLive,
    TerrainGeneratorServiceLive
  ))
)

Effect.runPromise(integrationTest)
```

この統合パターンカタログを活用することで、TypeScript MinecraftプロジェクトでのEffect-TSを使った堅牢なシステム間統合を実現できます。各パターンは実際の使用場面に応じて適切に選択し、組み合わせて使用してください。