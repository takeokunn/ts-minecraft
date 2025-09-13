# Infrastructure層 - 技術詳細・外部システム連携

Infrastructure層は、外部技術（データベース、ファイルシステム、ネットワーク、UI フレームワーク等）との結合部分を担う層です。Domain層のポートを実装し、技術的な詳細を抽象化します。

## アーキテクチャ構成

```
src/infrastructure/
├── adapters/          # ポート実装・技術アダプター
├── repositories/      # データ永続化実装
├── workers/          # Web Workers・マルチスレッド処理
├── performance/      # パフォーマンス最適化層
├── storage/          # ストレージ管理
├── services/         # インフラサービス
├── communication/    # システム間通信
└── monitoring/       # 監視・メトリクス
```

## 1. Adapters（アダプター）

Domain層のポートを実装する技術アダプター群。

### レンダリングアダプター

#### Three.js Adapter
```typescript
// src/infrastructure/adapters/three-js.adapter.ts
export const ThreeJSAdapter: IRenderPort = {
  renderChunk: (meshData: MeshData) =>
    Effect.gen(function* () {
      // Three.jsメッシュ作成
      const geometry = new THREE.BufferGeometry()
      geometry.setIndex(meshData.indices)
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3))
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2))
      
      // マテリアル適用
      const material = yield* getMaterial(meshData.materialId)
      const mesh = new THREE.Mesh(geometry, material)
      
      // シーンに追加
      yield* addToScene(mesh)
    }),
    
  updateCamera: (camera: CameraState) =>
    Effect.gen(function* () {
      const threeCamera = yield* getThreeCamera()
      threeCamera.position.set(camera.position.x, camera.position.y, camera.position.z)
      threeCamera.lookAt(camera.target.x, camera.target.y, camera.target.z)
      threeCamera.updateProjectionMatrix()
    })
}
```

**機能:**
- Three.jsレンダリングパイプライン
- メッシュ・マテリアル管理
- カメラ制御
- ライティング・シャドウ

#### WebGPU Adapter
```typescript
// src/infrastructure/adapters/webgpu.adapter.ts
export const WebGPUAdapter: IRenderPort = {
  renderChunk: (meshData: MeshData) =>
    Effect.gen(function* () {
      // WebGPUバッファ作成
      const vertexBuffer = yield* createVertexBuffer(meshData.vertices)
      const indexBuffer = yield* createIndexBuffer(meshData.indices)
      
      // レンダーパス作成
      const renderPass = yield* createRenderPass()
      
      // 描画実行
      renderPass.setVertexBuffer(0, vertexBuffer)
      renderPass.setIndexBuffer(indexBuffer, 'uint16')
      renderPass.drawIndexed(meshData.indices.length)
    })
}
```

**機能:**
- 最新WebGPU API活用
- 高性能GPU演算
- 並列レンダリング
- カスタムシェーダー

### 入力アダプター

#### Browser Input Adapter
```typescript
// src/infrastructure/adapters/browser-input.adapter.ts
export const BrowserInputAdapter: IInputPort = {
  getKeyState: (key: KeyCode) =>
    Effect.gen(function* () {
      const inputManager = yield* getInputManager()
      return inputManager.keys[key] || false
    }),
    
  getMousePosition: () =>
    Effect.gen(function* () {
      const inputManager = yield* getInputManager()
      return makePosition(inputManager.mouse.x, inputManager.mouse.y, 0)
    }),
    
  onKeyPress: (callback: (key: KeyCode) => void) =>
    Effect.gen(function* () {
      document.addEventListener('keydown', (event) => {
        callback(event.code as KeyCode)
      })
    })
}
```

**機能:**
- キーボード・マウス入力処理
- タッチスクリーン対応
- ゲームパッド統合
- 入力バッファリング

### 地形生成アダプター

#### Terrain Generator Adapter
```typescript
// src/infrastructure/adapters/terrain-generator.adapter.ts
export const TerrainGeneratorAdapter: ITerrainGeneratorPort = {
  generateChunk: (coord: ChunkCoordinate) =>
    Effect.gen(function* () {
      // Simplex Noiseによる地形生成
      const noise = yield* createSimplexNoise(coord.x * 16, coord.z * 16)
      
      // 高度マップ生成
      const heightMap = yield* generateHeightMap(noise, 64, 256)
      
      // バイオーム決定
      const biome = yield* determineBiome(coord, heightMap)
      
      // ブロック配置
      const blocks = yield* generateBlocks(heightMap, biome)
      
      return {
        coordinate: coord,
        blocks,
        biome,
        isGenerated: true
      }
    }),
    
  generateNoise: (settings: NoiseSettings) =>
    Effect.gen(function* () {
      const noise = new SimplexNoise(settings.seed)
      return Array.from({ length: settings.size }, (_, i) =>
        noise.noise2D(i * settings.frequency, 0) * settings.amplitude
      )
    })
}
```

**機能:**
- Simplex Noise地形生成
- マルチオクターブノイズ
- バイオーム生成
- 構造物配置

### Math アダプター

#### Native Math Adapter
```typescript
// src/infrastructure/adapters/native-math.adapter.ts
export const NativeMathAdapter: IMathPort = {
  vector3: {
    create: (x: number, y: number, z: number) => ({ x, y, z }),
    add: (a: Vector3, b: Vector3) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    multiply: (v: Vector3, scalar: number) => ({ x: v.x * scalar, y: v.y * scalar, z: v.z * scalar }),
    magnitude: (v: Vector3) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    normalize: (v: Vector3) => {
      const mag = this.magnitude(v)
      return mag > 0 ? this.multiply(v, 1 / mag) : { x: 0, y: 0, z: 0 }
    }
  },
  
  matrix4: {
    create: () => new Float32Array(16),
    multiply: (a: Matrix4, b: Matrix4) => multiplyMatrix4(a, b),
    translate: (m: Matrix4, v: Vector3) => translateMatrix4(m, v),
    rotate: (m: Matrix4, angle: number, axis: Vector3) => rotateMatrix4(m, angle, axis)
  }
}
```

**機能:**
- 高性能数学演算
- ベクトル・行列計算
- 四元数操作
- 幾何学計算

## 2. Repositories（リポジトリ）

データ永続化とクエリ実装。

### World Repository
```typescript
// src/infrastructure/repositories/world.repository.ts
export const WorldRepositoryLive = Layer.succeed(
  WorldRepositoryPort,
  {
    saveWorld: (world: WorldState) =>
      Effect.gen(function* () {
        // IndexedDB保存
        const db = yield* getIndexedDB()
        const transaction = db.transaction(['worlds'], 'readwrite')
        const store = transaction.objectStore('worlds')
        
        yield* Effect.promise(() => store.put({
          id: world.id,
          data: JSON.stringify(world),
          timestamp: Date.now()
        }))
      }),
      
    loadWorld: (id: string) =>
      Effect.gen(function* () {
        const db = yield* getIndexedDB()
        const transaction = db.transaction(['worlds'], 'readonly')
        const store = transaction.objectStore('worlds')
        
        const result = yield* Effect.promise(() => store.get(id))
        
        if (!result) {
          return yield* Effect.fail(new WorldNotFoundError(id))
        }
        
        return JSON.parse(result.data) as WorldState
      }),
      
    queryEntities: <T>(query: Query) =>
      Effect.gen(function* () {
        // ECSクエリ実行
        const world = yield* getCurrentWorld()
        const entities = world.entities.filter(query.predicate)
        return entities.map(query.selector) as T[]
      })
  }
)
```

### Entity Repository
```typescript
// src/infrastructure/repositories/entity.repository.ts
export const EntityRepositoryLive = Layer.succeed(
  EntityRepositoryPort,
  {
    createEntity: (components: ComponentData[]) =>
      Effect.gen(function* () {
        const entityId = yield* generateEntityId()
        const entity = {
          id: entityId,
          components: new Map(components.map(c => [c.type, c.data]))
        }
        
        yield* addToWorld(entity)
        return entityId
      }),
      
    getEntity: (id: EntityId) =>
      Effect.gen(function* () {
        const world = yield* getCurrentWorld()
        const entity = world.entities.get(id)
        
        if (!entity) {
          return yield* Effect.fail(new EntityNotFoundError(id))
        }
        
        return entity
      }),
      
    queryBySoA: <T>(query: SoAQuery<T>) =>
      Effect.gen(function* () {
        // Structure of Arrays クエリ最適化
        const componentArrays = yield* getComponentArrays(query.componentTypes)
        const results: T[] = []
        
        for (let i = 0; i < componentArrays[0].length; i++) {
          if (query.predicate(i, componentArrays)) {
            results.push(query.selector(i, componentArrays))
          }
        }
        
        return results
      })
  }
)
```

### Chunk Repository
```typescript
// src/infrastructure/repositories/chunk.repository.ts
export const ChunkRepositoryLive = Layer.succeed(
  ChunkRepositoryPort,
  {
    saveChunk: (chunk: ChunkData) =>
      Effect.gen(function* () {
        // 圧縮保存
        const compressed = yield* compressChunkData(chunk)
        
        // IndexedDB保存
        const db = yield* getChunkDB()
        yield* Effect.promise(() => 
          db.put('chunks', {
            coordinate: `${chunk.coordinate.x},${chunk.coordinate.z}`,
            data: compressed,
            timestamp: Date.now()
          })
        )
      }),
      
    loadChunk: (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const db = yield* getChunkDB()
        const key = `${coord.x},${coord.z}`
        
        const result = yield* Effect.promise(() => db.get('chunks', key))
        
        if (!result) {
          return yield* Effect.fail(new ChunkNotFoundError(coord))
        }
        
        return yield* decompressChunkData(result.data)
      })
  }
)
```

## 3. Workers（Web Workers）

マルチスレッド処理による負荷分散。

### Worker Management
```typescript
// src/infrastructure/workers/unified/worker-manager.ts
export const WorkerManager = {
  mesh: new MeshGenerationWorker(),
  terrain: new TerrainGenerationWorker(),
  physics: new PhysicsWorker(),
  lighting: new LightingWorker(),
  computation: new ComputationWorker(),
  
  executeTask: <T>(workerType: WorkerType, task: WorkerTask) =>
    Effect.gen(function* () {
      const worker = this[workerType]
      
      if (!worker.isAvailable()) {
        yield* queueTask(workerType, task)
        return yield* waitForCompletion(task.id)
      }
      
      return yield* worker.execute(task) as T
    })
}
```

### Mesh Generation Worker
```typescript
// src/infrastructure/workers/unified/workers/mesh-generation.worker.ts
self.onmessage = (event) => {
  const { type, data } = event.data
  
  switch (type) {
    case 'GENERATE_MESH':
      const result = generateChunkMesh(data.chunkData)
      self.postMessage({
        type: 'MESH_GENERATED',
        taskId: data.taskId,
        result
      })
      break
      
    case 'OPTIMIZE_MESH':
      const optimized = optimizeMeshData(data.meshData)
      self.postMessage({
        type: 'MESH_OPTIMIZED',
        taskId: data.taskId,
        result: optimized
      })
      break
  }
}

function generateChunkMesh(chunkData: ChunkData): MeshData {
  const vertices: number[] = []
  const indices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  
  // ブロック単位でメッシュ生成
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 256; y++) {
      for (let z = 0; z < 16; z++) {
        const block = chunkData.blocks[x][y][z]
        if (block.type !== BlockType.AIR) {
          addBlockFaces(vertices, indices, normals, uvs, block, x, y, z)
        }
      }
    }
  }
  
  return { vertices, indices, normals, uvs }
}
```

### Physics Worker
```typescript
// src/infrastructure/workers/unified/workers/physics.worker.ts
self.onmessage = (event) => {
  const { type, data } = event.data
  
  switch (type) {
    case 'PHYSICS_STEP':
      const result = simulatePhysicsStep(data.entities, data.deltaTime)
      self.postMessage({
        type: 'PHYSICS_UPDATED',
        taskId: data.taskId,
        result
      })
      break
      
    case 'COLLISION_CHECK':
      const collisions = checkCollisions(data.entities, data.staticGeometry)
      self.postMessage({
        type: 'COLLISIONS_DETECTED',
        taskId: data.taskId,
        result: collisions
      })
      break
  }
}
```

## 4. Performance（パフォーマンス最適化）

システム全体のパフォーマンス管理層。

### メモリプール管理
```typescript
// src/infrastructure/performance/memory-pool.layer.ts
export const MemoryPoolLive = Layer.succeed(
  MemoryPoolService,
  {
    vector3Pool: createObjectPool<Vector3>(() => ({ x: 0, y: 0, z: 0 }), 1000),
    matrix4Pool: createObjectPool<Matrix4>(() => new Float32Array(16), 100),
    meshDataPool: createObjectPool<MeshData>(() => ({
      vertices: new Float32Array(65536),
      indices: new Uint16Array(32768),
      normals: new Float32Array(65536),
      uvs: new Float32Array(43690)
    }), 50),
    
    acquire: <T>(poolType: PoolType) =>
      Effect.gen(function* () {
        const pool = this[poolType + 'Pool']
        const object = pool.acquire()
        
        if (!object) {
          return yield* Effect.fail(new PoolExhaustedError(poolType))
        }
        
        return object as T
      }),
      
    release: <T>(poolType: PoolType, object: T) =>
      Effect.gen(function* () {
        const pool = this[poolType + 'Pool']
        pool.release(object)
      })
  }
)
```

### FPS カウンター
```typescript
// src/infrastructure/performance/fps-counter.layer.ts
export const FPSCounterLive = Layer.succeed(
  FPSCounterService,
  {
    frameCount: 0,
    lastTime: performance.now(),
    fps: 0,
    
    update: () =>
      Effect.gen(function* () {
        this.frameCount++
        const currentTime = performance.now()
        
        if (currentTime - this.lastTime >= 1000) {
          this.fps = this.frameCount
          this.frameCount = 0
          this.lastTime = currentTime
          
          yield* updateFPSDisplay(this.fps)
        }
      }),
      
    getFPS: () => Effect.succeed(this.fps)
  }
)
```

### Worker Pool管理
```typescript
// src/infrastructure/performance/worker-pool.layer.ts
export const WorkerPoolLive = Layer.succeed(
  WorkerPoolService,
  {
    pools: new Map<WorkerType, WorkerPool>(),
    
    initializePool: (workerType: WorkerType, size: number) =>
      Effect.gen(function* () {
        const workers = Array.from({ length: size }, () => new Worker(getWorkerScript(workerType)))
        const pool = new WorkerPool(workers)
        this.pools.set(workerType, pool)
      }),
      
    executeTask: <T>(workerType: WorkerType, task: WorkerTask) =>
      Effect.gen(function* () {
        const pool = this.pools.get(workerType)
        
        if (!pool) {
          return yield* Effect.fail(new WorkerPoolNotFoundError(workerType))
        }
        
        const worker = yield* pool.acquireWorker()
        const result = yield* worker.execute<T>(task)
        pool.releaseWorker(worker)
        
        return result
      })
  }
)
```

## 5. Storage（ストレージ管理）

データ保存・キャッシュ戦略。

### Chunk Cache
```typescript
// src/infrastructure/storage/chunk-cache.ts
export const ChunkCacheLive = Layer.succeed(
  ChunkCacheService,
  {
    cache: new Map<string, CachedChunk>(),
    maxSize: 1000,
    
    get: (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const key = `${coord.x},${coord.z}`
        const cached = this.cache.get(key)
        
        if (!cached) {
          return yield* Effect.fail(new ChunkNotCachedError(coord))
        }
        
        // LRU更新
        cached.lastAccessed = Date.now()
        
        return cached.chunk
      }),
      
    set: (chunk: ChunkData) =>
      Effect.gen(function* () {
        const key = `${chunk.coordinate.x},${chunk.coordinate.z}`
        
        // サイズ制限チェック
        if (this.cache.size >= this.maxSize) {
          yield* evictLRU()
        }
        
        this.cache.set(key, {
          chunk,
          lastAccessed: Date.now(),
          size: calculateChunkSize(chunk)
        })
      }),
      
    evictLRU: () =>
      Effect.gen(function* () {
        let oldest = { key: '', time: Date.now() }
        
        for (const [key, cached] of this.cache.entries()) {
          if (cached.lastAccessed < oldest.time) {
            oldest = { key, time: cached.lastAccessed }
          }
        }
        
        this.cache.delete(oldest.key)
      })
  }
)
```

## 6. Communication（システム間通信）

外部システムとの通信管理。

### WebSocket Adapter
```typescript
// src/infrastructure/adapters/websocket.adapter.ts
export const WebSocketAdapter: ISystemCommunicationPort = {
  connect: (url: string) =>
    Effect.gen(function* () {
      const ws = new WebSocket(url)
      
      yield* Effect.promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = (error) => reject(new ConnectionError(error.message))
      })
      
      return ws
    }),
    
  send: (connection: WebSocket, message: Message) =>
    Effect.gen(function* () {
      if (connection.readyState !== WebSocket.OPEN) {
        return yield* Effect.fail(new ConnectionClosedError())
      }
      
      const serialized = JSON.stringify(message)
      connection.send(serialized)
    }),
    
  onMessage: (connection: WebSocket, handler: (message: Message) => void) =>
    Effect.gen(function* () {
      connection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Message
          handler(message)
        } catch (error) {
          console.error('Failed to parse message:', error)
        }
      }
    })
}
```

## 7. 特徴的な実装パターン

### Adapter Pattern活用
- ポートベースの依存性逆転
- 技術スタック交換可能性
- テスタビリティの向上

### Worker-based並列処理
- CPU集約的処理の分散
- メインスレッドブロッキング回避
- スケーラブルな処理能力

### 高度なパフォーマンス最適化
- オブジェクトプール再利用
- メモリ使用量最適化
- FPS安定化技術

### ストレージ戦略
- 多層キャッシュシステム
- LRU ベース効率的管理
- データ圧縮による容量最適化

Infrastructure層は、Domain層とApplication層のビジネスロジックを支える技術基盤を提供し、システム全体のパフォーマンスと安定性を保証する重要な層です。