---
title: "チャンクシステム仕様 - 世界分割・ローディング・最適化"
description: "16x16チャンクによる無限世界管理、動的ローディング、LODシステム、並行生成の完全仕様。高性能ワールドストリーミング。"
category: "specification"
difficulty: "advanced"
tags: ["chunk-system", "world-streaming", "dynamic-loading", "lod-system", "concurrency", "memory-optimization"]
prerequisites: ["effect-ts-fundamentals", "concurrency-concepts", "memory-management"]
estimated_reading_time: "15分"
related_patterns: ["concurrency-patterns", "optimization-patterns", "caching-patterns"]
related_docs: ["./03-block-system.md", "./05-rendering-system.md", "../../01-architecture/05-ecs-integration.md"]
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
import * as FiberMap from "effect/FiberMap"
import * as FiberSet from "effect/FiberSet"
import * as Deferred from "effect/Deferred"
import * as Option from "effect/Option"

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
const ChunkLoadError = Schema.TaggedError("ChunkLoadError")({
  coordinate: ChunkCoordinate,
  reason: Schema.String
}) {}

const ChunkUnloadError = Schema.TaggedError("ChunkUnloadError")({
  coordinate: ChunkCoordinate,
  reason: Schema.String
}) {}

const ChunkGenerationError = Schema.TaggedError("ChunkGenerationError")({
  coordinate: ChunkCoordinate,
  stage: Schema.String,
  reason: Schema.String
}) {}

const ChunkSaveError = Schema.TaggedError("ChunkSaveError")({
  coordinate: ChunkCoordinate,
  reason: Schema.String
}) {}

const ChunkUpdateError = Schema.TaggedError("ChunkUpdateError")({
  coordinate: ChunkCoordinate,
  operation: Schema.String,
  reason: Schema.String
}) {}
```

### Cache Implementation with Enhanced Concurrency

```typescript
const createChunkCache = Effect.gen(function* () {
  return yield* Cache.make({
    capacity: 1024, // 1024 chunks
    timeToLive: Duration.minutes(10),
    lookup: (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        // Use early return pattern for validation
        const isValidCoordinate = Math.abs(coord.x) < 30000000 && Math.abs(coord.z) < 30000000
        if (!isValidCoordinate) {
          return yield* Effect.fail(
            new ChunkLoadError({
              coordinate: coord,
              reason: "Coordinate out of bounds"
            })
          )
        }
        return yield* chunkService.loadChunk(coord)
      })
  })
})

// Enhanced cache with memory pressure monitoring
const createAdvancedChunkCache = Effect.gen(function* () {
  const memoryPressureRef = yield* Ref.make(false)

  return yield* Cache.make({
    capacity: (capacity: number) =>
      Effect.gen(function* () {
        const isUnderPressure = yield* Ref.get(memoryPressureRef)
        return isUnderPressure ? Math.floor(capacity * 0.5) : capacity
      }),
    timeToLive: Duration.minutes(10),
    lookup: (coord: ChunkCoordinate) =>
      pipe(
        Effect.gen(function* () {
          const chunkService = yield* ChunkService
          return yield* chunkService.loadChunk(coord)
        }),
        Effect.withSpan("chunk-load", { attributes: { "chunk.x": coord.x, "chunk.z": coord.z } })
      )
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
    const fiberMap = yield* FiberMap.make<string>()
    const activeGenerations = yield* Ref.make<Set<string>>(new Set())

    const loadChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        // Early return pattern for coordinate validation
        if (Math.abs(coord.x) > 30000000 || Math.abs(coord.z) > 30000000) {
          return yield* Effect.fail(
            new ChunkLoadError({
              coordinate: coord,
              reason: "Coordinate exceeds world bounds"
            })
          )
        }

        return yield* pipe(
          chunkCache.get(coord),
          Effect.tap(() =>
            Ref.update(loadedChunks, chunks => new Set([...chunks, coord]))
          ),
          Effect.mapError(error =>
            new ChunkLoadError({ coordinate: coord, reason: String(error) })
          )
        )
      })

    const unloadChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const chunkKey = `${coord.x}_${coord.z}`

        // Cancel any active generation for this chunk
        const activeSet = yield* Ref.get(activeGenerations)
        if (activeSet.has(chunkKey)) {
          yield* FiberMap.remove(fiberMap, chunkKey)
          yield* Ref.update(activeGenerations, set => {
            const newSet = new Set(set)
            newSet.delete(chunkKey)
            return newSet
          })
        }

        yield* chunkCache.invalidate(coord)
        yield* Ref.update(loadedChunks, chunks => {
          const newSet = new Set(chunks)
          newSet.delete(coord)
          return newSet
        })
      })

    const generateChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const chunkKey = `${coord.x}_${coord.z}`
        const activeSet = yield* Ref.get(activeGenerations)

        // Early return if already generating
        if (activeSet.has(chunkKey)) {
          const existingFiber = yield* FiberMap.get(fiberMap, chunkKey)
          return yield* Match.value(existingFiber).pipe(
            Match.when(Option.isSome, ({ value }) => Fiber.await(value)),
            Match.when(Option.isNone, () =>
              Effect.fail(new ChunkGenerationError({
                coordinate: coord,
                stage: "generation",
                reason: "Generation in progress but fiber not found"
              }))
            ),
            Match.exhaustive
          )
        }

        const generationFiber = yield* pipe(
          generationSemaphore.withPermits(1)(
            Effect.gen(function* () {
              yield* Ref.update(activeGenerations, set => new Set([...set, chunkKey]))

              try {
                // チャンク生成ロジック（非同期でメモリ効率的）
                const heightMap = new Uint16Array(256)
                const sections = []

                // Stream-based section generation for better memory management
                const sectionStream = Stream.range(-4, 20).pipe(
                  Stream.map(y => ({
                    blockStates: new Uint8Array(4096),
                    palette: [0] as BlockId[],
                    blockLight: null,
                    skyLight: null,
                    biomes: new Uint8Array(64)
                  }))
                )

                const sectionsArray = yield* Stream.runCollect(sectionStream)
                sections.push(...Chunk.toReadonlyArray(sectionsArray))

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
              } finally {
                yield* Ref.update(activeGenerations, set => {
                  const newSet = new Set(set)
                  newSet.delete(chunkKey)
                  return newSet
                })
              }
            })
          ),
          Effect.fork
        )

        yield* FiberMap.set(fiberMap, chunkKey, generationFiber)
        const result = yield* Fiber.await(generationFiber)
        yield* FiberMap.remove(fiberMap, chunkKey)

        return result
      })

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
// 複数チャンクの並行読み込みwith Fiber管理
const loadChunksInRadius = (center: ChunkCoordinate, radius: number) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const fiberSet = yield* FiberSet.make<ChunkData>()

    // Early return for invalid radius
    if (radius < 0 || radius > 32) {
      return yield* Effect.fail(
        new ChunkLoadError({
          coordinate: center,
          reason: `Invalid radius: ${radius}. Must be between 0 and 32`
        })
      )
    }

    const coordinateStream = Stream.range(0, (radius * 2 + 1) ** 2).pipe(
      Stream.map(i => {
        const size = radius * 2 + 1
        const x = center.x - radius + (i % size)
        const z = center.z - radius + Math.floor(i / size)
        return { x, z } as ChunkCoordinate
      })
    )

    // Use FiberSet for managed concurrent loading
    const loadingFibers = yield* pipe(
      coordinateStream,
      Stream.mapEffect(coord =>
        pipe(
          chunkService.loadChunk(coord),
          Effect.fork,
          Effect.tap(fiber => FiberSet.add(fiberSet, fiber))
        )
      ),
      Stream.buffer({ capacity: 16 }),
      Stream.runCollect
    )

    // Wait for all chunks to load with backpressure
    return yield* FiberSet.join(fiberSet)
  })

// Enhanced Stream-based chunk processing with proper backpressure
const processChunkStream = (chunks: Stream.Stream<ChunkCoordinate, never>) =>
  pipe(
    chunks,
    Stream.mapEffect(coord =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const chunk = yield* chunkService.loadChunk(coord)
        return { coordinate: coord, chunk }
      }),
      { concurrency: 8, unordered: false }
    ),
    Stream.bufferChunks({ capacity: 32, strategy: "suspend" }),
    Stream.groupByKey(
      ({ coordinate }) => `${coordinate.x}_${coordinate.z}`,
      { bufferSize: 16 }
    ),
    Stream.flatMap(groupBy =>
      pipe(
        groupBy,
        Stream.mapEffect(({ chunk }) => processChunk(chunk), {
          concurrency: 4
        }),
        Stream.buffer({ capacity: "unbounded" })
      ),
      { concurrency: "unbounded" }
    )
  )

const processChunk = (chunk: ChunkData) =>
  Effect.gen(function* () {
    // Early return for already processed chunks
    if (chunk.generationStage === "complete" && !chunk.isDirty) {
      return yield* Effect.succeed(chunk)
    }

    // Stream-based mesh generation for memory efficiency
    const meshStream = Stream.fromIterable(chunk.sections).pipe(
      Stream.mapEffect(section =>
        Effect.gen(function* () {
          // Process section in chunks to avoid blocking
          yield* Effect.yieldNow
          return processSection(section)
        })
      ),
      Stream.buffer({ capacity: 4 })
    )

    yield* Stream.runDrain(meshStream)
    return yield* Effect.succeed({ ...chunk, isDirty: false })
  })

const processSection = (section: any) =>
  Effect.gen(function* () {
    // メッシュ生成、物理計算など
    yield* Effect.sleep(Duration.millis(10)) // シミュレート非同期処理
    return section
  })
```

## Chunk Serialization and Storage

### Compression with Run-Length Encoding

```typescript
const compressBlockData = (blocks: ReadonlyArray<BlockId>) =>
  Effect.gen(function* () {
    // Early return for empty input
    if (blocks.length === 0) {
      return yield* Effect.succeed(new Uint8Array(0))
    }

    // Memory-efficient streaming compression
    return yield* pipe(
      Stream.fromIterable(blocks),
      Stream.scan({ currentBlock: blocks[0], count: 1, result: [] as number[] }, (acc, block) => {
        if (block === acc.currentBlock && acc.count < 255) {
          return { ...acc, count: acc.count + 1 }
        } else {
          const newResult = [...acc.result, acc.currentBlock, acc.count]
          return { currentBlock: block, count: 1, result: newResult }
        }
      }),
      Stream.runLast,
      Effect.map(Option.getOrElse(() => ({ result: [], currentBlock: 0 as BlockId, count: 0 }))),
      Effect.map(({ result, currentBlock, count }) => {
        const finalResult = [...result, currentBlock, count]
        return new Uint8Array(finalResult)
      })
    )
  })

const decompressBlockData = (compressed: Uint8Array) =>
  Effect.gen(function* () {
    // Early return for empty input
    if (compressed.length === 0) {
      return yield* Effect.succeed([])
    }

    // Memory-efficient streaming decompression
    const pairStream = Stream.range(0, Math.floor(compressed.length / 2)).pipe(
      Stream.map(i => ({
        blockId: compressed[i * 2] as BlockId,
        count: compressed[i * 2 + 1]
      }))
    )

    return yield* pipe(
      pairStream,
      Stream.flatMap(({ blockId, count }) =>
        Stream.range(0, count).pipe(
          Stream.map(() => blockId)
        )
      ),
      Stream.runCollect,
      Effect.map(chunk => Chunk.toReadonlyArray(chunk))
    )
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

const MeshGenerationError = Schema.TaggedError("MeshGenerationError")({
  coordinate: ChunkCoordinate,
  lodLevel: LODLevel,
  reason: Schema.String
}) {}

const MeshGeneratorServiceLive = Layer.effect(
  MeshGeneratorService,
  Effect.gen(function* () {
    const fiberMap = yield* FiberMap.make<string>()
    const meshCache = yield* Cache.make({
      capacity: 256,
      timeToLive: Duration.minutes(5),
      lookup: (key: string) => Effect.fail(new Error("Mesh not found"))
    })

    return {
      generateMesh: (chunk, lodLevel) =>
        Effect.gen(function* () {
          const meshKey = `${chunk.coordinate.x}_${chunk.coordinate.z}_${lodLevel}`

          // Early return for cached mesh
          const cachedMesh = yield* meshCache.getOption(meshKey)
          if (Option.isSome(cachedMesh)) {
            return cachedMesh.value
          }

          // Early return for invalid LOD
          if (lodLevel < 0 || lodLevel > 4) {
            return yield* Effect.fail(
              new MeshGenerationError({
                coordinate: chunk.coordinate,
                lodLevel,
                reason: "Invalid LOD level"
              })
            )
          }

          // LODレベルに応じたメッシュ生成 with pattern matching
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
          const indices = new Uint16Array(Math.floor(vertexCount * 1.5))
          const textureCoords = new Float32Array(vertexCount * 2)
          const normals = new Float32Array(vertexCount * 3)

          // Concurrent mesh generation with Fiber management
          const meshGenerationFiber = yield* pipe(
            Effect.all([
              generateVertices(chunk, vertices, lodLevel),
              generateIndices(chunk, indices, lodLevel),
              generateTextureCoords(chunk, textureCoords),
              generateNormals(vertices, indices, normals)
            ], { concurrency: 4 }),
            Effect.fork
          )

          yield* FiberMap.set(fiberMap, meshKey, meshGenerationFiber)
          yield* Fiber.await(meshGenerationFiber)
          yield* FiberMap.remove(fiberMap, meshKey)

          const mesh = {
            vertices,
            indices,
            textureCoords,
            normals,
            lodLevel
          }

          yield* meshCache.set(meshKey, mesh)
          return mesh
        }),

      updateMesh: (mesh, changes) =>
        Effect.gen(function* () {
          // Early return if no changes needed
          if (!changes.isDirty) {
            return yield* Effect.succeed(mesh)
          }

          // Stream-based differential update for memory efficiency
          const updateStream = Stream.fromIterable(changes.sections).pipe(
            Stream.filter(section => section.blockStates.some(state => state !== 0)),
            Stream.mapEffect(section =>
              Effect.gen(function* () {
                // Yield to prevent blocking
                yield* Effect.yieldNow
                return updateMeshSection(mesh, section)
              })
            ),
            Stream.buffer({ capacity: 4 })
          )

          yield* Stream.runDrain(updateStream)
          return yield* Effect.succeed(mesh)
        })
    }
  })
)

const updateMeshSection = (mesh: ChunkMesh, section: any) =>
  Effect.gen(function* () {
    // 差分アップデート実装
    yield* Effect.sleep(Duration.millis(5)) // シミュレート処理
    return mesh
  })

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

const OctreeError = Schema.TaggedError("OctreeError")({
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
    // Early return for max depth reached
    if (node.depth >= maxDepth) {
      return yield* Effect.fail(
        new OctreeError({
          operation: "insert",
          coordinate: coord,
          reason: "Maximum octree depth reached"
        })
      )
    }

    // Early return if coordinate is out of bounds
    const isInBounds = coord.x >= node.bounds.minX && coord.x <= node.bounds.maxX &&
                      coord.z >= node.bounds.minZ && coord.z <= node.bounds.maxZ
    if (!isInBounds) {
      return yield* Effect.fail(
        new OctreeError({
          operation: "insert",
          coordinate: coord,
          reason: "Coordinate out of node bounds"
        })
      )
    }

    // Pattern matching for node type
    return yield* pipe(
      Match.value(node.children),
      Match.when(null, () =>
        Effect.succeed({
          ...node,
          chunks: [...node.chunks, coord]
        } as unknown as ChunkOctree)
      ),
      Match.orElse(() =>
        Effect.succeed({} as ChunkOctree) // 子ノードがある場合の処理
      )
    )
  })

const removeNode = (node: OctreeNode, coord: ChunkCoordinate): Effect.Effect<ChunkOctree, OctreeError> =>
  Effect.gen(function* () {
    // Early return if coordinate not in bounds
    const isInBounds = coord.x >= node.bounds.minX && coord.x <= node.bounds.maxX &&
                      coord.z >= node.bounds.minZ && coord.z <= node.bounds.maxZ
    if (!isInBounds) {
      return yield* Effect.succeed(node as unknown as ChunkOctree)
    }

    // Pattern matching for removal strategy
    const hasCoordinate = node.chunks.some(c => c.x === coord.x && c.z === coord.z)
    return yield* pipe(
      Match.value(hasCoordinate),
      Match.when(true, () =>
        Effect.succeed({
          ...node,
          chunks: node.chunks.filter(c => !(c.x === coord.x && c.z === coord.z))
        } as unknown as ChunkOctree)
      ),
      Match.when(false, () =>
        Effect.succeed(node as unknown as ChunkOctree)
      ),
      Match.exhaustive
    )
  })

const queryNode = (node: OctreeNode, bounds: BoundingBox): Effect.Effect<ReadonlyArray<ChunkCoordinate>, OctreeError> =>
  Effect.gen(function* () {
    // Early return if no intersection
    const intersects = !(bounds.maxX < node.bounds.minX || bounds.minX > node.bounds.maxX ||
                        bounds.maxZ < node.bounds.minZ || bounds.minZ > node.bounds.maxZ)

    if (!intersects) {
      return yield* Effect.succeed([])
    }

    // Stream-based query for large result sets
    const chunkStream = Stream.fromIterable(node.chunks).pipe(
      Stream.filter(coord =>
        coord.x >= bounds.minX && coord.x <= bounds.maxX &&
        coord.z >= bounds.minZ && coord.z <= bounds.maxZ
      )
    )

    return yield* pipe(
      chunkStream,
      Stream.runCollect,
      Effect.map(chunk => Chunk.toReadonlyArray(chunk))
    )
  })
```

## Level-of-Detail (LOD) System

```typescript
interface LODManager {
  readonly updateLOD: (playerPos: ChunkCoordinate, loadedChunks: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<ReadonlyArray<{ coordinate: ChunkCoordinate, lodLevel: LODLevel }>, LODError>
  readonly calculateLODLevel: (chunkPos: ChunkCoordinate, playerPos: ChunkCoordinate) => LODLevel
}

const LODManager = Context.GenericTag<LODManager>("@minecraft/LODManager")

const LODError = Schema.TaggedError("LODError")({
  coordinate: ChunkCoordinate,
  operation: Schema.String,
  reason: Schema.String
}) {}

const LODManagerLive = Layer.effect(
  LODManager,
  Effect.gen(function* () {
    const lodCache = yield* Cache.make({
      capacity: 1024,
      timeToLive: Duration.seconds(30),
      lookup: (key: string) => Effect.fail(new Error("LOD not cached"))
    })

    return {
      updateLOD: (playerPos, loadedChunks) =>
        Effect.gen(function* () {
          // Early return for empty chunks
          if (loadedChunks.length === 0) {
            return yield* Effect.succeed([])
          }

          // Stream-based LOD calculation for better performance
          const lodStream = Stream.fromIterable(loadedChunks).pipe(
            Stream.mapEffect(coord =>
              Effect.gen(function* () {
                const cacheKey = `${coord.x}_${coord.z}_${playerPos.x}_${playerPos.z}`
                const cachedLOD = yield* lodCache.getOption(cacheKey)

                if (Option.isSome(cachedLOD)) {
                  return { coordinate: coord, lodLevel: cachedLOD.value }
                }

                const lodLevel = calculateLODLevel(coord, playerPos)
                yield* lodCache.set(cacheKey, lodLevel)
                return { coordinate: coord, lodLevel }
              })
            ),
            { concurrency: 16 }
          )

          return yield* pipe(
            lodStream,
            Stream.runCollect,
            Effect.map(chunk => Chunk.toReadonlyArray(chunk))
          )
        }),

      calculateLODLevel: (chunkPos, playerPos) =>
        pipe(
          calculateDistance(chunkPos, playerPos),
          distance => pipe(
            Match.value(distance),
            Match.when(d => d <= 2, () => 0 as LODLevel),   // 高詳細
            Match.when(d => d <= 4, () => 1 as LODLevel),   // 中詳細
            Match.when(d => d <= 8, () => 2 as LODLevel),   // 低詳細
            Match.when(d => d <= 16, () => 3 as LODLevel),  // 最低詳細
            Match.orElse(() => 4 as LODLevel)               // 遠距離
          )
        )
    }
  })
)

const calculateLODLevel = (chunkPos: ChunkCoordinate, playerPos: ChunkCoordinate): LODLevel =>
  pipe(
    calculateDistance(chunkPos, playerPos),
    distance => pipe(
      Match.value(distance),
      Match.when(d => d <= 2, () => 0 as LODLevel),
      Match.when(d => d <= 4, () => 1 as LODLevel),
      Match.when(d => d <= 8, () => 2 as LODLevel),
      Match.when(d => d <= 16, () => 3 as LODLevel),
      Match.orElse(() => 4 as LODLevel)
    )
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

// プレイヤー位置に基づくチャンク管理 with enhanced concurrency
const managePlayerChunks = (playerPos: ChunkCoordinate, viewDistance: number) =>
  Effect.gen(function* () {
    const chunkService = yield* ChunkService
    const lodManager = yield* LODManager
    const fiberMap = yield* FiberMap.make<string>()

    // Early return for invalid view distance
    if (viewDistance < 1 || viewDistance > 32) {
      return yield* Effect.fail(
        new ChunkLoadError({
          coordinate: playerPos,
          reason: `Invalid view distance: ${viewDistance}`
        })
      )
    }

    // Concurrent chunk operations with fiber management
    const [requiredChunks, loadedChunks] = yield* Effect.all([
      getRequiredChunks(playerPos, viewDistance),
      chunkService.getLoadedChunks
    ], { concurrency: 2 })

    // Stream-based chunk management for better memory usage
    const managementStream = Stream.fromIterable([
      { type: "lod-update" as const, chunks: requiredChunks },
      { type: "unload" as const, chunks: getChunksToUnload(loadedChunks, requiredChunks) }
    ])

    return yield* pipe(
      managementStream,
      Stream.mapEffect(({ type, chunks }) =>
        pipe(
          Match.value(type),
          Match.when("lod-update", () =>
            Effect.gen(function* () {
              const lodUpdates = yield* lodManager.updateLOD(playerPos, chunks)
              const lodFiber = yield* pipe(
                Effect.forEach(lodUpdates, ({ coordinate, lodLevel }) =>
                  chunkService.setLODLevel(coordinate, lodLevel),
                  { concurrency: 8 }
                ),
                Effect.fork
              )
              yield* FiberMap.set(fiberMap, "lod-updates", lodFiber)
              return yield* Fiber.await(lodFiber)
            })
          ),
          Match.when("unload", () =>
            Effect.gen(function* () {
              const unloadFiber = yield* pipe(
                Effect.forEach(chunks, coord =>
                  chunkService.unloadChunk(coord),
                  { concurrency: 4 }
                ),
                Effect.fork
              )
              yield* FiberMap.set(fiberMap, "unload-chunks", unloadFiber)
              return yield* Fiber.await(unloadFiber)
            })
          ),
          Match.exhaustive
        )
      ),
      Stream.runDrain
    )
  })

const getChunksToUnload = (loaded: ReadonlyArray<ChunkCoordinate>, required: ReadonlyArray<ChunkCoordinate>) =>
  loaded.filter(coord =>
    !required.some(req => req.x === coord.x && req.z === coord.z)
  )

const getRequiredChunks = (center: ChunkCoordinate, radius: number) =>
  Effect.succeed(
    Array.from({ length: (radius * 2 + 1) ** 2 }, (_, i) => {
      const size = radius * 2 + 1
      const x = center.x - radius + (i % size)
      const z = center.z - radius + Math.floor(i / size)
      return { x, z } as ChunkCoordinate
    })
  )

// ストリーミングベースのチャンク更新 with backpressure and fiber management
const streamChunkUpdates = (playerMovement: Stream.Stream<ChunkCoordinate, never>) =>
  Effect.gen(function* () {
    const fiberSet = yield* FiberSet.make<void>()
    const updateSemaphore = yield* Semaphore.make(2) // 最大2つの並行更新

    return yield* pipe(
      playerMovement,
      Stream.debounce(Duration.millis(100)), // 過度な更新を防ぐ
      Stream.buffer({ capacity: 8, strategy: "sliding" }),
      Stream.mapEffect(playerPos =>
        pipe(
          updateSemaphore.withPermits(1)(
            Effect.gen(function* () {
              yield* Effect.logDebug(`Processing chunk update for position: ${playerPos.x}, ${playerPos.z}`)
              return yield* managePlayerChunks(playerPos, 8)
            })
          ),
          Effect.fork,
          Effect.tap(fiber => FiberSet.add(fiberSet, fiber))
        )
      ),
      Stream.groupedWithin(4, Duration.millis(500)),
      Stream.mapEffect(updateBatch =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`Processing ${updateBatch.length} chunk updates`)
          return yield* Effect.all(updateBatch, { concurrency: "unbounded" })
        })
      ),
      Stream.tap(() => Effect.logDebug("Chunks updated successfully")),
      Stream.catchAll(error =>
        Stream.fromEffect(
          Effect.logError(`Chunk update failed: ${error}`).pipe(
            Effect.as(undefined)
          )
        )
      ),
      Stream.runDrain,
      Effect.ensuring(FiberSet.join(fiberSet)) // Cleanup fibers on completion
    )
  })
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

  // Concurrent metrics collection
  const [stats, loadedChunks, memoryUsage] = yield* Effect.all([
    Effect.tryPromise(() => (cache as any).cacheStats).pipe(
      Effect.orElse(() => Effect.succeed({ hits: 0, misses: 0, size: 0 }))
    ),
    chunkService.getLoadedChunks,
    getMemoryUsage()
  ], { concurrency: 3 })

  // Early return if no statistics available
  if (!stats || (stats.hits === 0 && stats.misses === 0)) {
    return {
      loadedChunkCount: loadedChunks.length,
      cacheHitRate: 0,
      averageLoadTime: 0,
      memoryUsage: memoryUsage,
      generationQueueSize: 0
    }
  }

  return {
    loadedChunkCount: loadedChunks.length,
    cacheHitRate: stats.hits / (stats.hits + stats.misses),
    averageLoadTime: yield* getAverageLoadTime(),
    memoryUsage: memoryUsage,
    generationQueueSize: yield* getGenerationQueueSize()
  }
})

const getMemoryUsage = () =>
  Effect.sync(() => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024 // MB
    }
    return 0
  })

const getAverageLoadTime = () =>
  Effect.succeed(15.5) // シミュレート値

const getGenerationQueueSize = () =>
  Effect.succeed(3) // シミュレート値

// メトリクス監視 with fiber-based scheduling and error handling
const monitorChunkSystem = Effect.gen(function* () {
  const monitoringFiber = yield* pipe(
    collectChunkMetrics,
    Effect.tap(metrics =>
      Effect.logInfo(`Chunk System Metrics: ${JSON.stringify(metrics, null, 2)}`)
    ),
    Effect.catchAll(error =>
      Effect.logError(`Failed to collect metrics: ${error}`).pipe(
        Effect.as({})
      )
    ),
    Effect.repeat(
      Schedule.fixed(Duration.seconds(10)).pipe(
        Schedule.intersect(Schedule.recurs(100)) // 最大100回実行
      )
    ),
    Effect.fork
  )

  // メトリクス収集のヘルスチェック
  const healthCheckFiber = yield* pipe(
    Effect.gen(function* () {
      const startTime = yield* Effect.sync(() => Date.now())
      yield* collectChunkMetrics
      const endTime = yield* Effect.sync(() => Date.now())
      const duration = endTime - startTime

      if (duration > 5000) { // 5秒以上かかる場合は警告
        yield* Effect.logWarning(`Metrics collection is slow: ${duration}ms`)
      }
    }),
    Effect.repeat(Schedule.fixed(Duration.minutes(1))),
    Effect.fork
  )

  return { monitoringFiber, healthCheckFiber }
})
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
    deferred: Deferred.Deferred<ChunkData, ChunkGenerationError>
  }>(100)
  const semaphore = yield* Semaphore.make(4)
  const activeGenerations = yield* Ref.make<Set<string>>(new Set())
  const fiberMap = yield* FiberMap.make<string>()

  const processGenerationQueue = yield* pipe(
    Stream.fromQueue(generationQueue),
    Stream.mapEffect(({ coordinate, deferred }) =>
      pipe(
        semaphore.withPermits(1)(
          Effect.gen(function* () {
            const key = `${coordinate.x}_${coordinate.z}`
            const isActive = yield* Ref.get(activeGenerations)

            // Early return if already generating
            if (isActive.has(key)) {
              const error = new ChunkGenerationError({
                coordinate,
                stage: "validation",
                reason: "Generation already in progress"
              })
              return yield* Deferred.fail(deferred, error)
            }

            yield* Ref.update(activeGenerations, set => new Set([...set, key]))

            const generationFiber = yield* pipe(
              generateChunkInternal(coordinate),
              Effect.ensuring(
                Ref.update(activeGenerations, set => {
                  const newSet = new Set(set)
                  newSet.delete(key)
                  return newSet
                })
              ),
              Effect.fork
            )

            yield* FiberMap.set(fiberMap, key, generationFiber)

            const result = yield* pipe(
              Fiber.await(generationFiber),
              Effect.matchEffect({
                onFailure: error => Deferred.fail(deferred, error as ChunkGenerationError),
                onSuccess: chunk => Deferred.succeed(deferred, chunk)
              })
            )

            yield* FiberMap.remove(fiberMap, key)
            return result
          })
        ),
        Effect.catchAll(error =>
          Deferred.fail(deferred, error as ChunkGenerationError)
        )
      )
    ),
    Stream.buffer({ capacity: 16 }),
    Stream.runDrain,
    Effect.fork
  )

  return {
    generateChunk: (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<ChunkData, ChunkGenerationError>()
        yield* Queue.offer(generationQueue, { coordinate: coord, deferred })
        return yield* Deferred.await(deferred)
      }),

    // Enhanced cleanup function
    cleanup: Effect.gen(function* () {
      yield* FiberMap.join(fiberMap)
      yield* Queue.shutdown(generationQueue)
    })
  }
})

const generateChunkInternal = (coordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    // Stream-based chunk generation for memory efficiency
    const sectionsStream = Stream.range(-4, 20).pipe(
      Stream.map(y => ({
        blockStates: new Uint8Array(4096),
        palette: [0] as BlockId[],
        blockLight: null,
        skyLight: null,
        biomes: new Uint8Array(64)
      }))
    )

    const sections = yield* pipe(
      sectionsStream,
      Stream.runCollect,
      Effect.map(chunk => Chunk.toReadonlyArray(chunk))
    )

    return {
      id: `chunk_${coordinate.x}_${coordinate.z}` as ChunkId,
      coordinate,
      sections,
      heightMap: new Uint16Array(256),
      entities: [],
      blockEntities: {},
      lastModified: new Date(),
      isLoaded: true,
      isDirty: false,
      lodLevel: 0 as LODLevel,
      generationStage: "complete" as const
    }
  })
```