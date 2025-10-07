# Effect-TS高度機能（Fiber/STM/Queue/Pool/Stream）導入設計書

## 📊 既存使用状況調査

### Fiber使用状況（4箇所）

| ファイル                                                                                     | 使用パターン                                         | 目的                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| `application/world/application_service/world_generation_orchestrator/generation_pipeline.ts` | `STM.ref<Map<string, Fiber.RuntimeFiber>>`           | パイプライン実行Fiber管理              |
| `presentation/inventory/state/reactive-system.ts`                                            | `start(): Effect<Fiber.RuntimeFiber>`, `stop(fiber)` | インベントリ同期のバックグラウンド実行 |

**評価**:

- ✅ Fiber使用は適切（バックグラウンドタスク管理）
- ⚠️ ワールド生成の並列化は未実装（`executionFibers`はSTM管理されているが実際の並列実行は未実装）

### Queue使用状況（3箇所）

| ファイル                                     | 使用パターン                                         | 目的                             |
| -------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| `infrastructure/audio/audio-service-live.ts` | `Queue.unbounded<AudioEvent>()` + `Stream.fromQueue` | オーディオイベントストリーミング |
| `domain/chunk_system/repository.*.ts`        | `Queue.unbounded<ChunkEvent>()` + `Stream.fromQueue` | チャンクシステムイベント通知     |

**評価**:

- ✅ イベント駆動アーキテクチャの基礎実装済み
- ⚠️ バックプレッシャー制御なし（`unbounded`のみ使用）
- ❌ ゲームループやチャンクロードキューは未実装

### Pool使用状況（3箇所）

| ファイル                                          | 使用パターン                                   | 目的                    |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| `infrastructure/three/renderer/webgl_renderer.ts` | `Pool.make<THREE.WebGLRenderer>` (poolSize: 3) | WebGLレンダラーの再利用 |
| `infrastructure/cannon/service.ts`                | `Pool.make<CANNON.World>` (poolSize: 2)        | 物理ワールドの再利用    |
| `infrastructure/ecs/entity-manager.ts`            | カスタムentityPool実装                         | エンティティID再利用    |

**評価**:

- ✅ インフラストラクチャ層でのPool活用は適切
- ⚠️ チャンクプール、テクスチャプールは未実装
- ❌ `Pool.use`パターンの統一が必要

### Stream使用状況（17箇所）

| カテゴリ                   | ファイル                                                                                                                               | 使用パターン                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **イベントストリーミング** | `infrastructure/audio/audio-service-live.ts`, `domain/chunk_system/repository.*.ts`, `presentation/inventory/state/reactive-system.ts` | `Queue` + `Stream.fromQueue`                                                       |
| **大量データ処理**         | `domain/chunk/domain_service/operations.ts`                                                                                            | `Stream.fromIterable` + `Stream.mapEffect` + `Stream.buffer`                       |
| **衝突検出**               | `domain/physics/system/collision_detection.ts`                                                                                         | `Stream.fromIterable` + `Stream.mapEffect` + `Stream.filterMap` + `Stream.runFold` |
| **イベントソーシング**     | `domain/world/aggregate/world_generator/events.ts`, `domain/world/aggregate/generation_session/events.ts`                              | `Stream<Event, Error>`インターフェース定義（実装はプレースホルダー）               |
| **インベントリUI**         | `presentation/inventory/state/store.ts`, `presentation/inventory/view-model/inventory-view-model.ts`                                   | `Stream.repeatEffect` + `Stream.schedule`                                          |

**評価**:

- ✅ Streamの多様な活用（イベント、データ処理、状態管理）
- ✅ バッファリング・バックプレッシャー制御の部分的実装
- ⚠️ イベントソーシングのStreamは未実装（プレースホルダーのみ）
- ❌ ネットワークストリーム未実装

### STM使用状況（3箇所）

| ファイル                                                                                                                                                                              | 使用パターン                                                        | 目的                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `application/world/application_service/factory.ts`, `application/world/application_service/index.ts`                                                                                  | `STM.TRef.make<'stopped' \| 'starting' \| 'running' \| 'stopping'>` | ワールドシステム状態管理            |
| `application/world/application_service/world_generation_orchestrator/generation_pipeline.ts`                                                                                          | `STM.ref<Map>` (pipelines, configurations, executionFibers)         | パイプライン状態の並行安全管理      |
| `domain/world/aggregate/biome_system/biome_system.ts`, `domain/world/aggregate/world_generator/world_generator.ts`, `domain/world/aggregate/generation_session/generation_session.ts` | `STM.gen`, `STM.fromEffect`                                         | Aggregate操作のトランザクション管理 |

**評価**:

- ✅ DDD Aggregateとの統合（STMによるトランザクション境界）
- ✅ 並行安全な状態遷移管理
- ⚠️ `STM.commit`の頻度が高い（パフォーマンス懸念）
- ❌ プレイヤー状態、インベントリ状態はSTM未導入

---

## 🎯 導入候補箇所（優先度付き）

### 🔴 High優先度（パフォーマンス向上効果大）

#### H-1: チャンク生成の並列化（Fiber）

**対象**: `domain/world/domain_service/procedural_generation/`

**現状問題**:

```typescript
// 現在: 逐次処理
for (const chunkCoord of chunksToGenerate) {
  const chunk = yield * generateChunk(chunkCoord)
}
```

**改善案**:

```typescript
// Fiber並列化
export const generateChunksInParallel = (
  chunkIds: ReadonlyArray<ChunkCoordinate>
): Effect.Effect<ReadonlyArray<Chunk>, ChunkGenerationError, ChunkGenerator> =>
  Effect.forEach(
    chunkIds,
    (coord) => generateChunk(coord),
    { concurrency: 4 } // CPU並列度制限
  )

// バックグラウンド生成（既存のFiberパターン拡張）
export const generateChunksInBackground = (
  chunkIds: ReadonlyArray<ChunkCoordinate>
): Effect.Effect<Fiber.RuntimeFiber<ReadonlyArray<Chunk>, ChunkGenerationError>> =>
  Effect.fork(generateChunksInParallel(chunkIds))
```

**期待効果**:

- チャンク生成スループット: 1→4倍（4並列時）
- プレイヤー移動時のロード待機時間削減

**リスク**:

- CPU使用率増加（ゲームループ60FPSとの競合）
- メモリ使用量増加（同時生成チャンク数×チャンクサイズ）

**対策**:

- `concurrency`を動的調整（FPS低下時は並列度を下げる）
- `Stream.mapEffect`でストリーミング処理に変更（メモリ効率化）

---

#### H-2: イベントキューによるゲームループ最適化（Queue）

**対象**: `domain/game_loop/`, `domain/entities/types/events.ts`

**現状問題**:

- イベント処理が同期的（フレーム処理がブロックされる）
- 大量イベント発生時のフレームドロップ

**改善案**:

```typescript
// ゲームイベントキュー（バックプレッシャー制御付き）
export const makeGameEventQueue = Effect.gen(function* () {
  const queue = yield* Queue.bounded<GameEvent>(256) // バックプレッシャー制御

  const events = Stream.fromQueue(queue).pipe(
    Stream.buffer({ capacity: 16 }), // バッファリング
    Stream.mapEffect(processEvent, { concurrency: 2 }) // 並列処理
  )

  return { queue, events }
})

// イベント発行（非ブロッキング）
export const publishEvent = (event: GameEvent) =>
  Queue.offer(eventQueue, event).pipe(
    Effect.catchTag('QueueFull', () => Effect.logWarning('Event queue full, dropping event'))
  )
```

**期待効果**:

- フレーム処理のブロッキング削減
- イベント処理スループット向上

**リスク**:

- イベント順序保証の複雑化
- キュー満杯時のイベントロス

**対策**:

- 優先度付きキュー実装（重要イベントは必ず処理）
- `Queue.take`のタイムアウト設定

---

#### H-3: チャンクロードキュー（Queue + Stream）

**対象**: `application/chunk/`, `domain/chunk_loader/`

**現状問題**:

- チャンクロード要求が無秩序
- プレイヤー周辺の優先度制御なし

**改善案**:

```typescript
// 優先度付きチャンクロードキュー
export interface ChunkLoadRequest {
  readonly coordinate: ChunkCoordinate
  readonly priority: number // プレイヤー距離ベース
  readonly requestedAt: number
}

export const makeChunkLoadQueue = Effect.gen(function* () {
  const queue = yield* Queue.bounded<ChunkLoadRequest>(128)

  // 優先度順にソート処理
  const loadStream = Stream.fromQueue(queue).pipe(
    Stream.groupedWithin(16, '100 millis'), // バッチ処理
    Stream.map((chunk) => Chunk.toReadonlyArray(chunk).sort((a, b) => b.priority - a.priority)),
    Stream.mapEffect(loadChunkBatch, { concurrency: 4 })
  )

  return { queue, loadStream }
})
```

**期待効果**:

- プレイヤー周辺チャンクの優先ロード
- ロード処理の効率化（バッチ処理）

---

### 🟡 Medium優先度（堅牢性向上）

#### M-1: プレイヤー状態のSTM管理

**対象**: `domain/player/aggregate/`, `application/physics/`

**現状問題**:

- 複数システムからの状態更新競合（物理、入力、ネットワーク）
- 状態の一貫性保証なし

**改善案**:

```typescript
// STMによるプレイヤー状態管理
export const makePlayerState = Effect.gen(function* () {
  const position = yield* STM.TRef.make(Vector3.ZERO)
  const velocity = yield* STM.TRef.make(Vector3.ZERO)
  const health = yield* STM.TRef.make(100)

  // トランザクション境界での更新
  const updatePhysics = (newPos: Vector3, newVel: Vector3) =>
    STM.commit(
      STM.gen(function* () {
        yield* STM.TRef.set(position, newPos)
        yield* STM.TRef.set(velocity, newVel)
      })
    )

  // 競合検出と自動リトライ
  const takeDamage = (damage: number) =>
    STM.commit(
      STM.gen(function* () {
        const current = yield* STM.TRef.get(health)
        if (current <= 0) return yield* STM.fail('AlreadyDead')
        yield* STM.TRef.set(health, Math.max(0, current - damage))
      })
    )

  return { position, velocity, health, updatePhysics, takeDamage }
})
```

**期待効果**:

- 状態更新の原子性保証
- 競合時の自動リトライ
- デッドロック防止

**リスク**:

- STMのオーバーヘッド（60FPSゲームループでの影響）

**対策**:

- ホットパス（毎フレーム更新）では通常のRefを使用
- 重要な状態遷移のみSTM使用（ダメージ、アイテム取得等）

---

#### M-2: ワールド状態のSTM管理

**対象**: `domain/world/aggregate/`, `application/world/`

**現状問題**:

- ロード済みチャンクMapの並行更新競合
- プレイヤーセット更新の競合

**改善案**:

```typescript
export const WorldStateLive = Layer.effect(
  WorldState,
  Effect.gen(function* () {
    const loadedChunks = yield* STM.TRef.make<ReadonlyMap<ChunkId, Chunk>>(new Map())
    const activePlayers = yield* STM.TRef.make<ReadonlySet<PlayerId>>(new Set())

    const addChunk = (id: ChunkId, chunk: Chunk) =>
      STM.commit(STM.TRef.update(loadedChunks, (map) => new Map(map).set(id, chunk)))

    const addPlayer = (id: PlayerId) => STM.commit(STM.TRef.update(activePlayers, (set) => new Set(set).add(id)))

    // 複合トランザクション（チャンク追加 + プレイヤー追跡）
    const loadChunkForPlayer = (chunkId: ChunkId, chunk: Chunk, playerId: PlayerId) =>
      STM.commit(
        STM.gen(function* () {
          yield* STM.TRef.update(loadedChunks, (map) => new Map(map).set(chunkId, chunk))
          yield* STM.TRef.update(activePlayers, (set) => new Set(set).add(playerId))
        })
      )

    return WorldState.of({ loadedChunks, activePlayers, addChunk, addPlayer, loadChunkForPlayer })
  })
)
```

**期待効果**:

- マルチプレイヤー環境での状態一貫性
- トランザクション境界の明示化

---

#### M-3: インベントリ状態のSTM管理（既存CQRS拡張）

**対象**: `domain/inventory/aggregate/`, `application/inventory/`

**現状問題**:

- インベントリ操作の並行制御が手動実装
- トランザクション境界が不明確

**改善案**:

```typescript
// 既存のInventory Aggregateを拡張
export const transferItemTransactional = (
  fromInventory: STM.TRef<Inventory>,
  toInventory: STM.TRef<Inventory>,
  itemId: ItemId,
  quantity: number
) =>
  STM.commit(
    STM.gen(function* () {
      const from = yield* STM.TRef.get(fromInventory)
      const to = yield* STM.TRef.get(toInventory)

      // バリデーション
      const fromItem = Option.fromNullable(from.items.get(itemId))
      if (Option.isNone(fromItem)) {
        return yield* STM.fail('ItemNotFound')
      }
      if (fromItem.value.quantity < quantity) {
        return yield* STM.fail('InsufficientQuantity')
      }

      // アトミック転送
      const updatedFrom = removeItem(from, itemId, quantity)
      const updatedTo = addItem(to, itemId, quantity)

      yield* STM.TRef.set(fromInventory, updatedFrom)
      yield* STM.TRef.set(toInventory, updatedTo)
    })
  )
```

**期待効果**:

- アイテム転送の原子性保証（duplication/loss防止）
- マルチプレイヤー環境での競合解決

---

### 🟢 Low優先度（将来拡張）

#### L-1: テクスチャプール（Pool）

**対象**: `infrastructure/three/`

**改善案**:

```typescript
export const makeTexturePool = (
  textureLoader: THREE.TextureLoader,
  maxTextures: number = 256
): Effect.Effect<Pool.Pool<THREE.Texture, TextureError>, never, Scope.Scope> =>
  Pool.make({
    acquire: Effect.acquireRelease(loadTexture(textureLoader), (texture) => Effect.sync(() => texture.dispose())),
    size: maxTextures,
  })
```

---

#### L-2: メッシュプール（Pool）

**対象**: `infrastructure/three/`

**改善案**:

```typescript
export const makeGeometryPool = <G extends THREE.BufferGeometry>(
  factory: Effect.Effect<G, GeometryError>,
  poolSize: number = 64
): Effect.Effect<Pool.Pool<G, GeometryError>, never, Scope.Scope> =>
  Pool.make({
    acquire: Effect.acquireRelease(factory, (geometry) => Effect.sync(() => geometry.dispose())),
    size: poolSize,
  })
```

---

#### L-3: イベントソーシング実装（Stream）

**対象**: `domain/world/aggregate/world_generator/events.ts`

**現状**: プレースホルダー実装（`Stream.empty`）

**改善案**:

```typescript
export const EventStoreLive = Layer.effect(
  EventStoreTag,
  Effect.gen(function* () {
    const eventLog = yield* Ref.make<ReadonlyArray<WorldGeneratorEvent>>([])

    const save = (events: readonly WorldGeneratorEvent[]) => Ref.update(eventLog, (log) => [...log, ...events])

    const load = (aggregateId: string, fromVersion?: number) =>
      Stream.fromEffect(Ref.get(eventLog)).pipe(
        Stream.flatMap(Stream.fromIterable),
        Stream.filter((e) => e.aggregateId === aggregateId),
        Stream.filter((e) => fromVersion === undefined || e.version >= fromVersion)
      )

    const loadAll = () => Stream.fromEffect(Ref.get(eventLog)).pipe(Stream.flatMap(Stream.fromIterable))

    return EventStoreTag.of({ save, load, loadAll })
  })
)
```

---

#### L-4: ネットワークストリーム（Stream）

**対象**: 将来のマルチプレイヤー機能

**改善案**:

```typescript
// WebSocketストリーム
export const makeNetworkStream = (ws: WebSocket): Stream.Stream<NetworkMessage, NetworkError> =>
  Stream.async<NetworkMessage, NetworkError>((emit) => {
    ws.onmessage = (event) => {
      const result = Schema.decodeUnknown(NetworkMessageSchema)(event.data)
      if (Either.isRight(result)) {
        emit.single(result.right)
      } else {
        emit.fail(new NetworkError({ cause: result.left }))
      }
    }

    ws.onerror = (error) => {
      emit.fail(new NetworkError({ cause: error }))
    }

    ws.onclose = () => {
      emit.end()
    }
  })
```

---

## ⚙️ パフォーマンス影響評価

### 60FPS維持可能性評価

#### ゲームループへの影響分析

| 機能                             | 実行頻度                   | オーバーヘッド見積もり  | 影響                    | 対策                  |
| -------------------------------- | -------------------------- | ----------------------- | ----------------------- | --------------------- |
| **Fiber並列チャンク生成**        | 非同期（バックグラウンド） | CPU並列化による負荷分散 | ✅ 影響小（別スレッド） | `concurrency`動的調整 |
| **Queue.offer（イベント発行）**  | 毎フレーム                 | <0.1ms                  | ✅ 影響小               | -                     |
| **Stream処理（イベント消費）**   | バックグラウンド           | バッファリングで分散    | ✅ 影響小               | `Stream.buffer`活用   |
| **STM.commit（プレイヤー状態）** | 毎フレーム（物理更新）     | 0.1-0.5ms               | ⚠️ 影響中               | ホットパスはRef使用   |
| **STM.commit（ワールド状態）**   | チャンクロード時のみ       | 0.5-1ms                 | ✅ 影響小（頻度低）     | -                     |
| **Pool.use（Renderer）**         | 毎フレーム                 | <0.1ms（既存実装）      | ✅ 影響小               | -                     |

**結論**:

- ✅ **60FPS維持可能**（STMのホットパス回避により）
- ⚠️ STMは重要な状態遷移のみ使用（毎フレーム更新はRef継続）

---

### メモリ使用量見積もり

#### 追加メモリ使用量

| 機能                                     | メモリ使用量     | 備考                           |
| ---------------------------------------- | ---------------- | ------------------------------ |
| **Queue.bounded（ゲームイベント256個）** | ~100KB           | イベントオブジェクトサイズ依存 |
| **Queue.bounded（チャンクロード128個）** | ~50KB            | ChunkCoordinate + 優先度       |
| **Fiber（チャンク生成4並列）**           | ~200MB           | チャンク4個×50MB（一時的）     |
| **STM.TRef（プレイヤー状態）**           | ~10KB/プレイヤー | -                              |
| **STM.TRef（ワールド状態）**             | ~500KB           | チャンクMap + プレイヤーSet    |
| **Pool（テクスチャ256個）**              | ~512MB           | テクスチャサイズ依存           |
| **Pool（メッシュ64個）**                 | ~128MB           | ジオメトリサイズ依存           |

**合計追加メモリ**: ~1.5GB（最大時）

**既存要件**: メモリ使用量<2GB

**結論**:

- ✅ **メモリ要件を満たす**（1.5GB追加 + 既存0.5GB = 2GB以内）
- ⚠️ Poolサイズの動的調整が必要（テクスチャ・メッシュ）

---

## 🏗️ アーキテクチャ設計

### Fiber並行処理設計

```typescript
// domain/world/domain_service/procedural_generation/parallel_generator.ts

/**
 * チャンク生成の並列化Service
 */
export interface ParallelChunkGenerator {
  readonly generateParallel: (
    coordinates: ReadonlyArray<ChunkCoordinate>,
    options?: { concurrency?: number }
  ) => Effect.Effect<ReadonlyArray<Chunk>, ChunkGenerationError>

  readonly generateInBackground: (
    coordinates: ReadonlyArray<ChunkCoordinate>
  ) => Effect.Effect<Fiber.RuntimeFiber<ReadonlyArray<Chunk>, ChunkGenerationError>>
}

export const ParallelChunkGeneratorTag = Context.GenericTag<ParallelChunkGenerator>(
  '@minecraft/domain/world/ParallelChunkGenerator'
)

export const ParallelChunkGeneratorLive = Layer.effect(
  ParallelChunkGeneratorTag,
  Effect.gen(function* () {
    const generator = yield* ChunkGeneratorTag

    // 並列生成（メモリ効率化版）
    const generateParallel = (coordinates: ReadonlyArray<ChunkCoordinate>, options?: { concurrency?: number }) =>
      pipe(
        Stream.fromIterable(coordinates),
        Stream.mapEffect((coord) => generator.generate(coord), { concurrency: options?.concurrency ?? 4 }),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

    // バックグラウンド生成
    const generateInBackground = (coordinates: ReadonlyArray<ChunkCoordinate>) =>
      Effect.fork(generateParallel(coordinates))

    return ParallelChunkGeneratorTag.of({ generateParallel, generateInBackground })
  })
)
```

---

### STM設計（ワールド状態管理）

```typescript
// domain/world/aggregate/world_state/stm_state.ts

export interface WorldStateSTM {
  readonly loadedChunks: STM.TRef<ReadonlyMap<ChunkId, Chunk>>
  readonly activePlayers: STM.TRef<ReadonlySet<PlayerId>>

  readonly addChunk: (id: ChunkId, chunk: Chunk) => Effect.Effect<void>
  readonly removeChunk: (id: ChunkId) => Effect.Effect<void>
  readonly addPlayer: (id: PlayerId) => Effect.Effect<void>
  readonly removePlayer: (id: PlayerId) => Effect.Effect<void>

  // トランザクション境界での複合操作
  readonly loadChunkForPlayer: (chunkId: ChunkId, chunk: Chunk, playerId: PlayerId) => Effect.Effect<void>
}

export const WorldStateSTMLive = Layer.effect(
  WorldStateSTMTag,
  Effect.gen(function* () {
    const loadedChunks = yield* STM.TRef.make<ReadonlyMap<ChunkId, Chunk>>(new Map())
    const activePlayers = yield* STM.TRef.make<ReadonlySet<PlayerId>>(new Set())

    const addChunk = (id: ChunkId, chunk: Chunk) =>
      STM.commit(STM.TRef.update(loadedChunks, (map) => new Map(map).set(id, chunk)))

    const removeChunk = (id: ChunkId) =>
      STM.commit(
        STM.TRef.update(loadedChunks, (map) => {
          const newMap = new Map(map)
          newMap.delete(id)
          return newMap
        })
      )

    const addPlayer = (id: PlayerId) => STM.commit(STM.TRef.update(activePlayers, (set) => new Set(set).add(id)))

    const removePlayer = (id: PlayerId) =>
      STM.commit(
        STM.TRef.update(activePlayers, (set) => {
          const newSet = new Set(set)
          newSet.delete(id)
          return newSet
        })
      )

    // 複合トランザクション
    const loadChunkForPlayer = (chunkId: ChunkId, chunk: Chunk, playerId: PlayerId) =>
      STM.commit(
        STM.gen(function* () {
          yield* STM.TRef.update(loadedChunks, (map) => new Map(map).set(chunkId, chunk))
          yield* STM.TRef.update(activePlayers, (set) => new Set(set).add(playerId))
        })
      )

    return WorldStateSTMTag.of({
      loadedChunks,
      activePlayers,
      addChunk,
      removeChunk,
      addPlayer,
      removePlayer,
      loadChunkForPlayer,
    })
  })
)
```

---

### Queue + Stream設計（チャンクロードキュー）

```typescript
// application/chunk/application_service/chunk_load_queue.ts

export interface ChunkLoadRequest extends Schema.Schema.Type<typeof ChunkLoadRequestSchema> {}
export const ChunkLoadRequestSchema = Schema.Struct({
  coordinate: ChunkCoordinateSchema,
  priority: Schema.Number,
  requestedAt: Schema.Number,
})

export interface ChunkLoadQueue {
  readonly enqueue: (request: ChunkLoadRequest) => Effect.Effect<void, QueueFullError>
  readonly start: () => Effect.Effect<Fiber.RuntimeFiber<void, ChunkLoadError>>
  readonly stop: (fiber: Fiber.RuntimeFiber<void, ChunkLoadError>) => Effect.Effect<void>
}

export const ChunkLoadQueueLive = Layer.effect(
  ChunkLoadQueueTag,
  Effect.gen(function* () {
    const queue = yield* Queue.bounded<ChunkLoadRequest>(128)
    const chunkDataProvider = yield* ChunkDataProviderTag

    const enqueue = (request: ChunkLoadRequest) =>
      Queue.offer(queue, request).pipe(
        Effect.catchTag('QueueFull', () => Effect.fail(new QueueFullError({ message: 'Chunk load queue full' })))
      )

    const processQueue = pipe(
      Stream.fromQueue(queue),
      Stream.groupedWithin(16, '100 millis'), // バッチ処理
      Stream.map(
        (chunk) => Chunk.toReadonlyArray(chunk).sort((a, b) => b.priority - a.priority) // 優先度順
      ),
      Stream.mapEffect(
        (batch) => Effect.forEach(batch, (req) => chunkDataProvider.loadChunk(req.coordinate), { concurrency: 4 }),
        { concurrency: 1 } // バッチ自体は順次処理
      ),
      Stream.runDrain
    )

    const start = () => Effect.fork(processQueue)
    const stop = (fiber: Fiber.RuntimeFiber<void, ChunkLoadError>) => Fiber.interrupt(fiber)

    return ChunkLoadQueueTag.of({ enqueue, start, stop })
  })
)
```

---

### Pool設計（テクスチャプール）

```typescript
// infrastructure/three/texture/texture_pool.ts

export interface TexturePool {
  readonly acquire: (path: string) => Effect.Effect<THREE.Texture, TextureError, Scope.Scope>
}

export const TexturePoolLive = Layer.scoped(
  TexturePoolTag,
  Effect.gen(function* () {
    const textureLoader = new THREE.TextureLoader()

    // Poolサイズを動的調整可能に
    const poolSizeRef = yield* Ref.make(256)

    const pool = yield* Pool.make({
      acquire: Effect.acquireRelease(
        Effect.try({
          try: () => textureLoader.load('/path/to/texture'),
          catch: (error) => new TextureError({ cause: error }),
        }),
        (texture) => Effect.sync(() => texture.dispose())
      ),
      size: yield* Ref.get(poolSizeRef),
    })

    const acquire = (path: string) => Pool.get(pool)

    return TexturePoolTag.of({ acquire })
  })
)
```

---

## 📋 実装ロードマップ

### Phase 1: 基礎実装（High優先度）

**期間**: 2週間

#### Week 1: Fiber並列チャンク生成

- [ ] `ParallelChunkGenerator` Service実装
- [ ] 既存`TerrainGenerator`をStream化
- [ ] `concurrency`動的調整ロジック
- [ ] パフォーマンステスト（60FPS維持確認）

#### Week 2: Queue + Streamゲームループ最適化

- [ ] `GameEventQueue` Service実装
- [ ] 既存イベント処理をQueue経由に移行
- [ ] バックプレッシャー制御テスト
- [ ] チャンクロードキュー実装

**完了条件**:

- ✅ チャンク生成スループット4倍向上
- ✅ 60FPS維持（平均55FPS以上）
- ✅ メモリ使用量<2GB

---

### Phase 2: STM導入（Medium優先度）

**期間**: 2週間

#### Week 3: ワールド状態STM化

- [ ] `WorldStateSTM` Service実装
- [ ] 既存`Ref<Map>`をSTM.TRefに移行
- [ ] トランザクション境界の明示化
- [ ] 競合テスト（複数プレイヤーシミュレーション）

#### Week 4: プレイヤー・インベントリSTM化

- [ ] `PlayerStateSTM` Service実装
- [ ] `InventorySTM`（既存CQRS拡張）
- [ ] トランザクション性能テスト
- [ ] ロールバック処理実装

**完了条件**:

- ✅ 状態更新の原子性保証
- ✅ 競合時の自動リトライ動作確認
- ✅ パフォーマンス低下<10%

---

### Phase 3: Pool最適化（Low優先度）

**期間**: 1週間

#### Week 5: テクスチャ・メッシュPool

- [ ] `TexturePool` Service実装
- [ ] `GeometryPool` Service実装
- [ ] 動的Poolサイズ調整
- [ ] メモリ使用量モニタリング

**完了条件**:

- ✅ メモリ使用量削減20%
- ✅ テクスチャロード時間削減

---

### Phase 4: 将来拡張（イベントソーシング・ネットワーク）

**期間**: TBD（マルチプレイヤー機能実装時）

- [ ] イベントソーシング実装
- [ ] WebSocketストリーム実装
- [ ] 永続化層（IndexedDB + Stream）

---

## 🔍 注意事項

### パフォーマンス監視

```typescript
// パフォーマンスモニタリング用Middleware
export const PerformanceMonitoringMiddleware = Layer.effectDiscard(
  Effect.gen(function* () {
    const fpsRef = yield* Ref.make(60)

    // FPSが閾値を下回ったらFiber並列度を削減
    const adjustConcurrency = Effect.gen(function* () {
      const fps = yield* Ref.get(fpsRef)
      if (fps < 50) {
        yield* Effect.logWarning('FPS低下検出、並列度を削減')
        // concurrencyを4→2に削減
      }
    }).pipe(Effect.schedule(Schedule.spaced('1 second')), Effect.fork)

    yield* adjustConcurrency
  })
)
```

### STM使用ガイドライン

- ✅ **STM使用推奨**: 重要な状態遷移（ダメージ、アイテム転送、チャンク追加）
- ❌ **STM使用非推奨**: ホットパス（毎フレーム更新）→ Ref継続使用
- ⚠️ **STM.commit頻度**: 1フレームあたり最大10回以下に制限

### メモリ管理

- `Queue.bounded`を優先（`unbounded`は禁止）
- Poolサイズは動的調整可能に実装
- `Stream.buffer`のcapacityは控えめに設定（16-32程度）

---

## 📚 参考資料

- Effect-TS公式ドキュメント: Fiber, STM, Queue, Pool, Stream
- 既存実装パターン: `phase1-refactoring-patterns` memory
- DDD統合: `ddd-architecture-analysis-2025` memory
- Application Service移行: `fr-1-application-service-migration-pattern` memory
