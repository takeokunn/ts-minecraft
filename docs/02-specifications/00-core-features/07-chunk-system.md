---
title: "07 Chunk System"
description: "07 Chunk Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "5分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Chunk System - Effect-TS Implementation

## Core Data Structures

### Branded Types and Schema Definitions

```typescript
import { Schema, Brand, Effect, Cache, Stream, Match, pipe } from "effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Chunk from "effect/Chunk"
import * as Queue from "effect/Queue"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import * as Duration from "effect/Duration"
import * as Semaphore from "effect/Semaphore"
import * as Fiber from "effect/Fiber"

// Branded Types
type ChunkId = string & Brand.Brand<"ChunkId">
type ChunkCoordinate = { x: number; z: number } & Brand.Brand<"ChunkCoordinate">
type BlockId = number & Brand.Brand<"BlockId">
type ChunkHeight = number & Brand.Brand<"ChunkHeight">
type LODLevel = number & Brand.Brand<"LODLevel">

// Schema Definitions
const ChunkId = Schema.String.pipe(
  Schema.brand("ChunkId"),
  Schema.pattern(/^chunk_(-?\d+)_(-?\d+)$/)
)

const ChunkCoordinate = Schema.Struct({
  x: Schema.Int,
  z: Schema.Int
}).pipe(Schema.brand("ChunkCoordinate"))

const BlockId = Schema.Number.pipe(
  Schema.brand("BlockId"),
  Schema.int(),
  Schema.between(0, 65535)
)

const ChunkHeight = Schema.Number.pipe(
  Schema.brand("ChunkHeight"),
  Schema.int(),
  Schema.between(-64, 320)
)

const LODLevel = Schema.Number.pipe(
  Schema.brand("LODLevel"),
  Schema.int(),
  Schema.between(0, 4)
)
```

### Chunk Data Schema

```typescript
const ChunkSection = Schema.Struct({
  blockStates: Schema.Uint8Array,
  palette: Schema.Array(BlockId),
  blockLight: Schema.NullOr(Schema.Uint8Array),
  skyLight: Schema.NullOr(Schema.Uint8Array),
  biomes: Schema.Uint8Array
})

const ChunkData = Schema.Struct({
  id: ChunkId,
  coordinate: ChunkCoordinate,
  sections: Schema.Array(ChunkSection),
  heightMap: Schema.Uint16Array,
  entities: Schema.Array(Schema.Unknown), // EntityId参照
  blockEntities: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  lastModified: Schema.DateFromSelf,
  isLoaded: Schema.Boolean,
  isDirty: Schema.Boolean,
  lodLevel: LODLevel,
  generationStage: Schema.Literal("empty", "structure", "surface", "decoration", "complete")
})

type ChunkData = Schema.Schema.Type<typeof ChunkData>
```

## Service Layer

### Chunk Service Interface

```typescript
interface ChunkService {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkLoadError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, ChunkUnloadError>
  readonly generateChunk: (coord: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly saveChunk: (chunk: ChunkData) => Effect.Effect<void, ChunkSaveError>
  readonly getChunkCache: Effect.Effect<Cache.Cache<ChunkCoordinate, ChunkData, ChunkLoadError>>
  readonly getLoadedChunks: Effect.Effect<ReadonlyArray<ChunkCoordinate>>
  readonly setLODLevel: (coord: ChunkCoordinate, level: LODLevel) => Effect.Effect<void, ChunkUpdateError>
}

const ChunkService = Context.GenericTag<ChunkService>("@minecraft/ChunkService")

// Error Types
class ChunkLoadError extends Schema.TaggedError<ChunkLoadError>()("ChunkLoadError", {
  coordinate: ChunkCoordinate,
  reason: Schema.String
}) {}

class ChunkUnloadError extends Schema.TaggedError<ChunkUnloadError>()("ChunkUnloadError", {
  coordinate: ChunkCoordinate,
  reason: Schema.String
}) {}

class ChunkGenerationError extends Schema.TaggedError<ChunkGenerationError>()("ChunkGenerationError", {
  coordinate: ChunkCoordinate,
  stage: Schema.String,
  reason: Schema.String
}) {}

class ChunkSaveError extends Schema.TaggedError<ChunkSaveError>()("ChunkSaveError", {
  coordinate: ChunkCoordinate,
  reason: Schema.String
}) {}

class ChunkUpdateError extends Schema.TaggedError<ChunkUpdateError>()("ChunkUpdateError", {
  coordinate: ChunkCoordinate,
  operation: Schema.String,
  reason: Schema.String
}) {}
```

### Cache Implementation

```typescript
const createChunkCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: 1024, // 1024 chunks
    timeToLive: Duration.minutes(10),
    lookup: (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        return yield* chunkService.loadChunk(coord)
      })
  })
})
```

## Chunk Loading and Caching

```typescript
const ChunkServiceLive = Layer.effect(
  ChunkService,
  Effect.gen(function* () {
    const chunkCache = yield* createChunkCache
    const generationSemaphore = yield* Semaphore.make(4) // 最大4つの並行生成
    const loadedChunks = yield* Ref.make<ReadonlySet<ChunkCoordinate>>(new Set())

    const loadChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        return yield* pipe(
          chunkCache.get(coord),
          Effect.tap(() =>
            Ref.update(loadedChunks, chunks => new Set([...chunks, coord]))
          ),
          Effect.mapError(error => new ChunkLoadError({ coordinate: coord, reason: String(error) }))
        )
      })

    const unloadChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        yield* chunkCache.invalidate(coord)
        yield* Ref.update(loadedChunks, chunks => {
          const newSet = new Set(chunks)
          newSet.delete(coord)
          return newSet
        })
      })

    const generateChunk = (coord: ChunkCoordinate) =>
      generationSemaphore.withPermits(1)(
        Effect.gen(function* () {
          // チャンク生成ロジック
          const heightMap = new Uint16Array(256)
          const sections = []

          // 基本地形生成
          for (let y = -4; y < 20; y++) {
            const blockStates = new Uint8Array(4096) // 16x16x16 blocks
            const palette = [0] // air block

            sections.push({
              blockStates,
              palette,
              blockLight: null,
              skyLight: null,
              biomes: new Uint8Array(64) // 4x4x4 biomes per section
            })
          }

          return {
            id: `chunk_${coord.x}_${coord.z}` as ChunkId,
            coordinate: coord,
            sections,
            heightMap,
            entities: [],
            blockEntities: {},
            lastModified: new Date(),
            isLoaded: true,
            isDirty: false,
            lodLevel: 0 as LODLevel,
            generationStage: "complete" as const
          }
        })
      )

    return ChunkService.of({
      loadChunk,
      unloadChunk,
      generateChunk,
      saveChunk: (chunk) => Effect.succeed(undefined),
      getChunkCache: Effect.succeed(chunkCache),
      getLoadedChunks: pipe(
        Ref.get(loadedChunks),
        Effect.map(set => Array.from(set))
      ),
      setLODLevel: (coord, level) =>
        Effect.gen(function* () {
          const chunk = yield* loadChunk(coord)
          const updatedChunk = { ...chunk, lodLevel: level }
          yield* chunkCache.set(coord, updatedChunk)
        })
    })
  })
)
```

## Concurrent Chunk Processing

```typescript
// 複数チャンクの並行読み込み
const loadChunksInRadius = (center: ChunkCoordinate, radius: number) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const coordinates: ChunkCoordinate[] = []

    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        coordinates.push({ x, z } as ChunkCoordinate)
      }
    }

    return yield* pipe(
      coordinates,
      Effect.forEach(coord => chunkService.loadChunk(coord), {
        concurrency: 8 // 最大8つの並行読み込み
      })
    )
  })

// Stream ベースのチャンク処理
const processChunkStream = (chunks: Stream.Stream<ChunkCoordinate, never>) =>
  pipe(
    chunks,
    Stream.mapEffect(coord =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.loadChunk(coord)
        // チャンク処理ロジック
        return chunk
      })
    ),
    Stream.buffer({ capacity: 16 }),
    Stream.groupedWithin(4, Duration.millis(100)),
    Stream.mapEffect(chunkBatch =>
      Effect.forEach(chunkBatch, processChunk, { concurrency: 4 })
    )
  )

const processChunk = (chunk: ChunkData) =>
  Effect.gen(function* () {
    // メッシュ生成、物理計算など
    yield* Effect.succeed(undefined)
  })
```

## Chunk Serialization and Storage

### Compression with Run-Length Encoding

```typescript
const compressBlockData = (blocks: ReadonlyArray<BlockId>) =>
  Effect.gen(function* () {
    return yield* pipe(
      blocks,
      Effect.succeed,
      Effect.map(blockArray => {
        const compressed: number[] = []
        let currentBlock = blockArray[0]
        let count = 1

        for (let i = 1; i < blockArray.length; i++) {
          if (blockArray[i] === currentBlock && count < 255) {
            count++
          } else {
            compressed.push(currentBlock, count)
            currentBlock = blockArray[i]
            count = 1
          }
        }
        compressed.push(currentBlock, count)
        return new Uint8Array(compressed)
      })
    )
  })

const decompressBlockData = (compressed: Uint8Array) =>
  Effect.gen(function* () {
    const blocks: BlockId[] = []

    for (let i = 0; i < compressed.length; i += 2) {
      const blockId = compressed[i] as BlockId
      const count = compressed[i + 1]

      for (let j = 0; j < count; j++) {
        blocks.push(blockId)
      }
    }

    return blocks
  })
```

### Chunk Mesh Generation

```typescript
interface ChunkMesh {
  readonly vertices: Float32Array
  readonly indices: Uint16Array
  readonly textureCoords: Float32Array
  readonly normals: Float32Array
  readonly lodLevel: LODLevel
}

const ChunkMesh = Schema.Struct({
  vertices: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint16Array),
  textureCoords: Schema.instanceOf(Float32Array),
  normals: Schema.instanceOf(Float32Array),
  lodLevel: LODLevel
})

interface MeshGeneratorService {
  readonly generateMesh: (chunk: ChunkData, lodLevel: LODLevel) => Effect.Effect<ChunkMesh, MeshGenerationError>
  readonly updateMesh: (mesh: ChunkMesh, changes: ChunkData) => Effect.Effect<ChunkMesh, MeshGenerationError>
}

const MeshGeneratorService = Context.GenericTag<MeshGeneratorService>("@minecraft/MeshGeneratorService")

class MeshGenerationError extends Schema.TaggedError<MeshGenerationError>()("MeshGenerationError", {
  coordinate: ChunkCoordinate,
  lodLevel: LODLevel,
  reason: Schema.String
}) {}

const MeshGeneratorServiceLive = Layer.effect(
  MeshGeneratorService,
  Effect.succeed({
    generateMesh: (chunk, lodLevel) =>
      Effect.gen(function* () {
        // LODレベルに応じたメッシュ生成
        const vertexCount = pipe(
          Match.value(lodLevel),
          Match.when(0 as LODLevel, () => 65536), // フル詳細
          Match.when(1 as LODLevel, () => 16384), // 半分詳細
          Match.when(2 as LODLevel, () => 4096),  // 1/4詳細
          Match.when(3 as LODLevel, () => 1024),  // 1/16詳細
          Match.when(4 as LODLevel, () => 256),   // 最低詳細
          Match.exhaustive
        )

        const vertices = new Float32Array(vertexCount * 3)
        const indices = new Uint16Array(vertexCount * 1.5)
        const textureCoords = new Float32Array(vertexCount * 2)
        const normals = new Float32Array(vertexCount * 3)

        // メッシュ生成ロジック実装
        yield* generateVertices(chunk, vertices, lodLevel)
        yield* generateIndices(chunk, indices, lodLevel)
        yield* generateTextureCoords(chunk, textureCoords)
        yield* generateNormals(vertices, indices, normals)

        return {
          vertices,
          indices,
          textureCoords,
          normals,
          lodLevel
        }
      }),

    updateMesh: (mesh, changes) =>
      Effect.gen(function* () {
        // 差分アップデート
        return yield* Effect.succeed(mesh)
      })
  })
)

const generateVertices = (chunk: ChunkData, vertices: Float32Array, lodLevel: LODLevel) =>
  Effect.succeed(undefined) // 実装詳細省略

const generateIndices = (chunk: ChunkData, indices: Uint16Array, lodLevel: LODLevel) =>
  Effect.succeed(undefined) // 実装詳細省略

const generateTextureCoords = (chunk: ChunkData, textureCoords: Float32Array) =>
  Effect.succeed(undefined) // 実装詳細省略

const generateNormals = (vertices: Float32Array, indices: Uint16Array, normals: Float32Array) =>
  Effect.succeed(undefined) // 実装詳細省略
```

## Octree for Spatial Queries

```typescript
type OctreeNode = {
  readonly bounds: BoundingBox
  readonly children: ReadonlyArray<OctreeNode> | null
  readonly chunks: ReadonlyArray<ChunkCoordinate>
  readonly depth: number
}

const BoundingBox = Schema.Struct({
  minX: Schema.Number,
  minY: Schema.Number,
  minZ: Schema.Number,
  maxX: Schema.Number,
  maxY: Schema.Number,
  maxZ: Schema.Number
})

type BoundingBox = Schema.Schema.Type<typeof BoundingBox>

interface ChunkOctree {
  readonly insert: (coord: ChunkCoordinate) => Effect.Effect<ChunkOctree, OctreeError>
  readonly remove: (coord: ChunkCoordinate) => Effect.Effect<ChunkOctree, OctreeError>
  readonly query: (bounds: BoundingBox) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, OctreeError>
  readonly queryRadius: (center: ChunkCoordinate, radius: number) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, OctreeError>
}

class OctreeError extends Schema.TaggedError<OctreeError>()("OctreeError", {
  operation: Schema.String,
  coordinate: Schema.NullOr(ChunkCoordinate),
  reason: Schema.String
}) {}

const createOctree = (bounds: BoundingBox, maxDepth = 8) =>
  Effect.gen(function* () {
    const root: OctreeNode = {
      bounds,
      children: null,
      chunks: [],
      depth: 0
    }

    const insert = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        return yield* insertNode(root, coord, maxDepth)
      })

    const remove = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        return yield* removeNode(root, coord)
      })

    const query = (queryBounds: BoundingBox) =>
      Effect.gen(function* () {
        return yield* queryNode(root, queryBounds)
      })

    const queryRadius = (center: ChunkCoordinate, radius: number) =>
      Effect.gen(function* () {
        const queryBounds = {
          minX: center.x - radius,
          minY: -64,
          minZ: center.z - radius,
          maxX: center.x + radius,
          maxY: 320,
          maxZ: center.z + radius
        }
        return yield* query(queryBounds)
      })

    return { insert, remove, query, queryRadius }
  })

const insertNode = (node: OctreeNode, coord: ChunkCoordinate, maxDepth: number): Effect.Effect<ChunkOctree, OctreeError> =>
  Effect.gen(function* () {
    // Octree 挿入ロジック
    return yield* Effect.succeed({} as ChunkOctree)
  })

const removeNode = (node: OctreeNode, coord: ChunkCoordinate): Effect.Effect<ChunkOctree, OctreeError> =>
  Effect.gen(function* () {
    // Octree 削除ロジック
    return yield* Effect.succeed({} as ChunkOctree)
  })

const queryNode = (node: OctreeNode, bounds: BoundingBox): Effect.Effect<ReadonlyArray<ChunkCoordinate>, OctreeError> =>
  Effect.gen(function* () {
    // Octree クエリロジック
    return yield* Effect.succeed([])
  })
```

## Level-of-Detail (LOD) System

```typescript
interface LODManager {
  readonly updateLOD: (playerPos: ChunkCoordinate, loadedChunks: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<ReadonlyArray<{ coordinate: ChunkCoordinate, lodLevel: LODLevel }>, LODError>
  readonly calculateLODLevel: (chunkPos: ChunkCoordinate, playerPos: ChunkCoordinate) => LODLevel
}

const LODManager = Context.GenericTag<LODManager>("@minecraft/LODManager")

class LODError extends Schema.TaggedError<LODError>()("LODError", {
  coordinate: ChunkCoordinate,
  operation: Schema.String,
  reason: Schema.String
}) {}

const LODManagerLive = Layer.succeed(
  LODManager,
  {
    updateLOD: (playerPos, loadedChunks) =>
      Effect.gen(function* () {
        return pipe(
          loadedChunks,
          Effect.succeed,
          Effect.map(chunks =>
            chunks.map(coord => ({
              coordinate: coord,
              lodLevel: calculateDistance(coord, playerPos)
            }))
          )
        )
      }),

    calculateLODLevel: (chunkPos, playerPos) => {
      const distance = Math.sqrt(
        Math.pow(chunkPos.x - playerPos.x, 2) +
        Math.pow(chunkPos.z - playerPos.z, 2)
      )

      return pipe(
        Match.value(distance),
        Match.when(d => d <= 2, () => 0 as LODLevel),   // 高詳細
        Match.when(d => d <= 4, () => 1 as LODLevel),   // 中詳細
        Match.when(d => d <= 8, () => 2 as LODLevel),   // 低詳細
        Match.when(d => d <= 16, () => 3 as LODLevel),  // 最低詳細
        Match.orElse(() => 4 as LODLevel)               // 遠距離
      )
    }
  }
)

const calculateDistance = (pos1: ChunkCoordinate, pos2: ChunkCoordinate): number =>
  Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  )
```

## Integration Examples

### Complete Chunk System Integration

```typescript
// メインチャンクシステム
const ChunkSystemLive = Layer.mergeAll(
  ChunkServiceLive,
  MeshGeneratorServiceLive,
  LODManagerLive
)

// プレイヤー位置に基づくチャンク管理
const managePlayerChunks = (playerPos: ChunkCoordinate, viewDistance: number) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const lodManager = yield* LODManager

    // 読み込み必要範囲のチャンク取得
    const requiredChunks = yield* getRequiredChunks(playerPos, viewDistance)

    // 現在読み込み済みチャンク取得
    const loadedChunks = yield* chunkService.getLoadedChunks

    // LODレベル更新
    const lodUpdates = yield* lodManager.updateLOD(playerPos, requiredChunks)

    // 並行でLOD更新実行
    yield* Effect.forEach(lodUpdates, ({ coordinate, lodLevel }) =>
      chunkService.setLODLevel(coordinate, lodLevel),
      { concurrency: 8 }
    )

    // 不要なチャンクをアンロード
    const chunksToUnload = loadedChunks.filter(coord =>
      !requiredChunks.some(req => req.x === coord.x && req.z === coord.z)
    )

    yield* Effect.forEach(chunksToUnload, coord =>
      chunkService.unloadChunk(coord),
      { concurrency: 4 }
    )
  })

const getRequiredChunks = (center: ChunkCoordinate, radius: number) =>
  Effect.succeed(
    Array.from({ length: (radius * 2 + 1) ** 2 }, (_, i) => {
      const size = radius * 2 + 1
      const x = center.x - radius + (i % size)
      const z = center.z - radius + Math.floor(i / size)
      return { x, z } as ChunkCoordinate
    })
  )

// ストリーミングベースのチャンク更新
const streamChunkUpdates = (playerMovement: Stream.Stream<ChunkCoordinate, never>) =>
  pipe(
    playerMovement,
    Stream.debounce(Duration.millis(100)), // 過度な更新を防ぐ
    Stream.mapEffect(playerPos => managePlayerChunks(playerPos, 8)),
    Stream.tap(() => Effect.logDebug("Chunks updated")),
    Stream.runDrain
  )
```

### Performance Monitoring

```typescript
interface ChunkMetrics {
  readonly loadedChunkCount: number
  readonly cacheHitRate: number
  readonly averageLoadTime: number
  readonly memoryUsage: number
  readonly generationQueueSize: number
}

const collectChunkMetrics = Effect.gen(function* () {
  const chunkService = yield* ChunkService
  const cache = yield* chunkService.getChunkCache
  const stats = yield* cache.cacheStats
  const loadedChunks = yield* chunkService.getLoadedChunks

  return {
    loadedChunkCount: loadedChunks.length,
    cacheHitRate: stats.hits / (stats.hits + stats.misses),
    averageLoadTime: 0, // 実装必要
    memoryUsage: 0, // 実装必要
    generationQueueSize: 0 // 実装必要
  }
})

// メトリクス監視
const monitorChunkSystem = pipe(
  collectChunkMetrics,
  Effect.tap(metrics =>
    Effect.logInfo(`Chunk System Metrics: ${JSON.stringify(metrics)}`)
  ),
  Effect.repeat(Schedule.fixed(Duration.seconds(10))),
  Effect.fork
)
```

### Property-Based Testing Support

```typescript
import * as Arbitrary from "fast-check"

const chunkCoordinateArbitrary = Arbitrary.record({
  x: Arbitrary.integer({ min: -1000000, max: 1000000 }),
  z: Arbitrary.integer({ min: -1000000, max: 1000000 })
}).map(coord => coord as ChunkCoordinate)

const chunkDataArbitrary = Arbitrary.record({
  id: Arbitrary.string().map(s => `chunk_${s}` as ChunkId),
  coordinate: chunkCoordinateArbitrary,
  sections: Arbitrary.array(Arbitrary.record({
    blockStates: Arbitrary.uint8Array({ minLength: 4096, maxLength: 4096 }),
    palette: Arbitrary.array(Arbitrary.integer({ min: 0, max: 65535 }).map(n => n as BlockId)),
    blockLight: Arbitrary.option(Arbitrary.uint8Array({ minLength: 2048, maxLength: 2048 })),
    skyLight: Arbitrary.option(Arbitrary.uint8Array({ minLength: 2048, maxLength: 2048 })),
    biomes: Arbitrary.uint8Array({ minLength: 64, maxLength: 64 })
  }), { minLength: 1, maxLength: 24 }),
  heightMap: Arbitrary.uint16Array({ minLength: 256, maxLength: 256 }),
  entities: Arbitrary.array(Arbitrary.anything()),
  blockEntities: Arbitrary.dictionary(Arbitrary.string(), Arbitrary.anything()),
  lastModified: Arbitrary.date(),
  isLoaded: Arbitrary.boolean(),
  isDirty: Arbitrary.boolean(),
  lodLevel: Arbitrary.integer({ min: 0, max: 4 }).map(n => n as LODLevel),
  generationStage: Arbitrary.constantFrom("empty", "structure", "surface", "decoration", "complete")
}).map(data => data as ChunkData)

// Property-based test example
const testChunkRoundtrip = Effect.gen(function* () {
  const testData = yield* Effect.sync(() =>
    Arbitrary.sample(chunkDataArbitrary, 100)
  )

  for (const chunk of testData) {
    const compressed = yield* compressBlockData(chunk.sections[0].palette)
    const decompressed = yield* decompressBlockData(compressed)

    if (decompressed.length !== chunk.sections[0].palette.length) {
      yield* Effect.fail(new Error("Compression roundtrip failed"))
    }
  }
})
```

## 🚨 Common Issues & Solutions

### Error 1: Context not provided
```
TypeError: Service not found: @minecraft/ChunkService
```

**原因**: Layer.provide忘れ
**解決**:
```typescript
// ❌ 間違い
Effect.runPromise(myProgram)

// ✅ 正解
Effect.runPromise(pipe(
  myProgram,
  Effect.provide(ChunkServiceLive),
  Effect.provide(MeshGeneratorServiceLive),
  Effect.provide(LODManagerLive)
))
```

### Error 2: Schema validation failed
```
ParseError: Expected object, received string
```

**原因**: データ形状の不一致
**解決**: デバッグ用デコーダー使用
```typescript
// デバッグ情報付きデコード
const result = Schema.decodeEither(ChunkCoordinate)(data)
Match.value(result).pipe(
  Match.tag("Left", ({ left }) =>
    Console.log("Validation error details:", left.message)
  ),
  Match.tag("Right", ({ right }) =>
    Console.log("Successfully decoded:", right)
  )
)
```

### Error 3: Chunk loading timeout
```
ChunkLoadError: Chunk loading timed out
```

**原因**: 大きなチャンクの生成に時間がかかる
**解決**: タイムアウト時間の調整とリトライ戦略
```typescript
const loadWithTimeout = (coord: ChunkCoordinate) =>
  pipe(
    chunkService.loadChunk(coord),
    Effect.timeout(Duration.seconds(30)),
    Effect.retry(
      Schedule.exponential("1 seconds").pipe(
        Schedule.intersect(Schedule.recurs(3))
      )
    ),
    Effect.mapError(error => new ChunkLoadError({
      coordinate: coord,
      reason: `Timeout after retries: ${error}`
    }))
  )
```

### Error 4: Memory leak in chunk cache
```
Warning: High memory usage detected
```

**原因**: アンロードされていないチャンクの蓄積
**解決**: 定期的なキャッシュクリーンアップ
```typescript
const cleanupOldChunks = Effect.gen(function* () {
  const chunkService = yield* ChunkService
  const cache = yield* chunkService.getChunkCache
  const entries = yield* cache.entries
  const stats = yield* cache.cacheStats

  if (stats.size > 512) { // 閾値チェック
    const sorted = entries.sort(([,a], [,b]) =>
      a.lastModified.getTime() - b.lastModified.getTime()
    )

    const toRemove = sorted.slice(0, stats.size - 256)
    yield* Effect.forEach(toRemove, ([coord]) =>
      chunkService.unloadChunk(coord),
      { concurrency: 4 }
    )
  }
})

// 定期実行
const scheduleCleanup = pipe(
  cleanupOldChunks,
  Effect.repeat(Schedule.fixed(Duration.minutes(5)))
)
```

### Error 5: Race condition in chunk generation
```
ChunkGenerationError: Multiple generation attempts detected
```

**原因**: 同じチャンクの並行生成
**解決**: セマフォとキュー による排他制御
```typescript
const createChunkGenerator = Effect.gen(function* () {
  const generationQueue = yield* Queue.bounded<{
    coordinate: ChunkCoordinate
    deferred: Effect.Deferred<ChunkData, ChunkGenerationError>
  }>(100)
  const semaphore = yield* Semaphore.make(4)
  const activeGenerations = yield* Ref.make<Set<string>>(new Set())

  const processGenerationQueue = pipe(
    Stream.fromQueue(generationQueue),
    Stream.mapEffect(({ coordinate, deferred }) =>
      pipe(
        semaphore.withPermits(1)(
          Effect.gen(function* () {
            const key = `${coordinate.x}_${coordinate.z}`
            const isActive = yield* Ref.get(activeGenerations)

            if (isActive.has(key)) {
              return yield* Effect.fail(new ChunkGenerationError({
                coordinate,
                stage: "validation",
                reason: "Generation already in progress"
              }))
            }

            yield* Ref.update(activeGenerations, set => new Set([...set, key]))

            try {
              const chunk = yield* generateChunkInternal(coordinate)
              yield* Effect.Deferred.succeed(deferred, chunk)
            } finally {
              yield* Ref.update(activeGenerations, set => {
                const newSet = new Set(set)
                newSet.delete(key)
                return newSet
              })
            }
          })
        ),
        Effect.catchAll(error => Effect.Deferred.fail(deferred, error))
      )
    ),
    Stream.runDrain,
    Effect.fork
  )

  yield* processGenerationQueue

  return {
    generateChunk: (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const deferred = yield* Effect.Deferred.make<ChunkData, ChunkGenerationError>()
        yield* Queue.offer(generationQueue, { coordinate: coord, deferred })
        return yield* Effect.Deferred.await(deferred)
      })
  }
})
```