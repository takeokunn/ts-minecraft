# Chunk Management System - チャンク管理システム

## 概要

Chunk Management Systemは、Minecraft世界の効率的な管理を実現する中核システムです。チャンク生成、ロード/アンロード、メッシング、更新、隣接チャンク処理、永続化などを担当し、大規模な世界を滑らかに表現します。

## アーキテクチャ

### Domain Model（Effect-TS + DDD）

```typescript
import { Effect, Layer, Context, Schema, pipe, Match } from "effect"
import { Brand } from "effect"

// Value Objects
export const ChunkCoordinate = Schema.Struct({
  x: pipe(Schema.Number, Schema.int(), Schema.brand("ChunkX")),
  z: pipe(Schema.Number, Schema.int(), Schema.brand("ChunkZ"))
})

export const LocalBlockPosition = Schema.Struct({
  x: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
  y: pipe(Schema.Number, Schema.int(), Schema.between(0, 255)),
  z: pipe(Schema.Number, Schema.int(), Schema.between(0, 15))
})

export const ChunkGenerationState = Schema.Literal(
  "ungenerated",
  "generating",
  "generated",
  "decorating",
  "decorated",
  "lighting",
  "ready"
)

export const ChunkLoadState = Schema.Literal(
  "unloaded",
  "loading",
  "loaded",
  "active",
  "unloading"
)

// Entities
export const ChunkData = Schema.Struct({
  coordinate: ChunkCoordinate,
  blocks: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 65535))),
  heightMap: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 255))),
  biomeMap: Schema.Array(Schema.String),
  lightMap: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 15))),
  blockLightMap: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 15))),
  skyLightMap: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 15))),
  entities: Schema.Array(Schema.String.pipe(Schema.brand("EntityId"))),
  tileEntities: Schema.Map(Schema.String, Schema.Unknown),
  lastModified: Schema.DateTimeUtc,
  isDirty: Schema.Boolean,
  needsLighting: Schema.Boolean,
  needsDecoration: Schema.Boolean
})

export type ChunkData = Schema.Schema.Type<typeof ChunkData>

export const ChunkMesh = Schema.Struct({
  coordinate: ChunkCoordinate,
  opaqueGeometry: Schema.Unknown, // THREE.BufferGeometry
  transparentGeometry: Schema.Unknown, // THREE.BufferGeometry
  waterGeometry: Schema.Unknown, // THREE.BufferGeometry
  vertices: Schema.Array(Schema.Number),
  indices: Schema.Array(Schema.Number),
  uvs: Schema.Array(Schema.Number),
  normals: Schema.Array(Schema.Number),
  colors: Schema.Array(Schema.Number),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  triangleCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  needsRebuild: Schema.Boolean,
  lodLevel: pipe(Schema.Number, Schema.int(), Schema.between(0, 4)),
  lastRebuild: Schema.DateTimeUtc
})

export type ChunkMesh = Schema.Schema.Type<typeof ChunkMesh>

export const Chunk = Schema.Struct({
  coordinate: ChunkCoordinate,
  data: ChunkData,
  mesh: Schema.Optional(ChunkMesh),
  generationState: ChunkGenerationState,
  loadState: ChunkLoadState,
  neighbors: Schema.Struct({
    north: Schema.Optional(ChunkCoordinate),
    south: Schema.Optional(ChunkCoordinate),
    east: Schema.Optional(ChunkCoordinate),
    west: Schema.Optional(ChunkCoordinate)
  }),
  loadedAt: Schema.DateTimeUtc,
  lastAccessed: Schema.DateTimeUtc,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  memoryUsage: Schema.Number.pipe(Schema.nonNegative())
})

export type Chunk = Schema.Schema.Type<typeof Chunk>

// Constants
export const CHUNK_SIZE = 16
export const CHUNK_HEIGHT = 256
export const CHUNK_SECTION_HEIGHT = 16
export const CHUNK_SECTIONS = CHUNK_HEIGHT / CHUNK_SECTION_HEIGHT
export const BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE
```

## チャンク生成システム

### Advanced Chunk Generator

```typescript
// IMPORTANT: Context7でEffect-TSの最新パターンを確認して実装

// ChunkGeneratorサービスインターフェース
interface ChunkGeneratorInterface {
  readonly generateChunk: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly generateTerrain: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<ReadonlyArray<number>, never>
  readonly generateStructures: (chunkData: ChunkData, seed: number) => Effect.Effect<ChunkData, never>
  readonly generateOres: (chunkData: ChunkData, seed: number) => Effect.Effect<ChunkData, never>
  readonly generateCaves: (chunkData: ChunkData, seed: number) => Effect.Effect<ChunkData, never>
}

// Context Tag
export const ChunkGenerator = Context.GenericTag<ChunkGeneratorInterface>("@app/ChunkGenerator")

// Live実装の作成関数
const makeChunkGenerator = Effect.gen(function* () {
  const noiseService = yield* NoiseService
  const biomeService = yield* BiomeService
  const structureService = yield* StructureService

  const generateChunk = (coordinate: ChunkCoordinate, seed: number) =>
    Effect.gen(function* () {
      // 1. 基本地形の生成
      const blocks = new Uint16Array(BLOCKS_PER_CHUNK).fill(0) // Air
      const heightMap = yield* generateTerrain(coordinate, seed)
      const biomeMap = yield* generateBiomes(coordinate, seed)

      // 2. 地形ブロックの配置
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const biome = biomeMap[z * CHUNK_SIZE + x]
          const height = heightMap[z * CHUNK_SIZE + x]
          const worldX = coordinate.x * CHUNK_SIZE + x
          const worldZ = coordinate.z * CHUNK_SIZE + z

          yield* generateTerrainColumn(blocks, worldX, worldZ, height, biome, seed)
        }
      }

      let chunkData = {
        coordinate,
        blocks: Array.from(blocks),
        heightMap: Array.from(heightMap),
        biomeMap,
        lightMap: new Array(BLOCKS_PER_CHUNK).fill(0),
        blockLightMap: new Array(BLOCKS_PER_CHUNK).fill(0),
        skyLightMap: new Array(BLOCKS_PER_CHUNK).fill(15),
        entities: [],
        tileEntities: new Map(),
        lastModified: new Date(),
        isDirty: false,
        needsLighting: true,
        needsDecoration: true
      } as ChunkData

      // 3. 洞窟生成
      chunkData = yield* generateCaves(chunkData, seed)

      // 4. 鉱石生成
      chunkData = yield* generateOres(chunkData, seed)

      return chunkData
    })

  const generateTerrain = (coordinate: ChunkCoordinate, seed: number) =>
    Effect.gen(function* () {
      const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const worldX = coordinate.x * CHUNK_SIZE + x
          const worldZ = coordinate.z * CHUNK_SIZE + z

          // マルチオクターブノイズによる地形生成
          const continentalNoise = yield* noiseService.octaveNoise(
            worldX * 0.0005, worldZ * 0.0005, seed, 4, 0.5, 2.0
          )
          const erosionNoise = yield* noiseService.octaveNoise(
            worldX * 0.001, worldZ * 0.001, seed + 1000, 3, 0.4, 2.2
          )
          const peaksAndValleys = yield* noiseService.octaveNoise(
            worldX * 0.002, worldZ * 0.002, seed + 2000, 2, 0.3, 2.5
          )

          // 高度計算
          const baseHeight = 64
          const continentalHeight = continentalNoise * 60
          const erosionHeight = erosionNoise * 30
          const pvHeight = peaksAndValleys * 40

          const finalHeight = Math.floor(
            baseHeight + continentalHeight + erosionHeight + pvHeight
          )

          heights[z * CHUNK_SIZE + x] = Math.max(1, Math.min(255, finalHeight))
        }
      }

      return heights
    })

  const generateBiomes = (coordinate: ChunkCoordinate, seed: number) =>
    Effect.gen(function* () {
      const biomes: string[] = []

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const worldX = coordinate.x * CHUNK_SIZE + x
          const worldZ = coordinate.z * CHUNK_SIZE + z

          const temperature = yield* noiseService.noise2D(
            worldX * 0.01, worldZ * 0.01, seed + 5000
          )
          const humidity = yield* noiseService.noise2D(
            worldX * 0.01, worldZ * 0.01, seed + 6000
          )
          const weirdness = yield* noiseService.noise2D(
            worldX * 0.008, worldZ * 0.008, seed + 7000
          )

          const biome = yield* biomeService.determineBiome(temperature, humidity, weirdness)
          biomes.push(biome)
        }
      }

      return biomes
    })

  const generateTerrainColumn = (
    blocks: Uint16Array,
    worldX: number,
    worldZ: number,
    height: number,
    biome: string,
    seed: number
  ) =>
    Effect.gen(function* () {
      const biomeConfig = yield* biomeService.getBiomeConfig(biome)

      for (let y = 0; y < height && y < CHUNK_HEIGHT; y++) {
        const index = y * CHUNK_SIZE * CHUNK_SIZE + (worldZ % CHUNK_SIZE) * CHUNK_SIZE + (worldX % CHUNK_SIZE)

        const blockType = pipe(
          { y, height, biomeConfig },
          Match.value,
          Match.when({ y: 0 }, () => BlockType.Bedrock),
          Match.when(
            ({ y, height, biomeConfig }) => y < height - biomeConfig.soilDepth,
            ({ biomeConfig }) => biomeConfig.stoneType
          ),
          Match.when(
            ({ y, height }) => y < height - 1,
            ({ biomeConfig }) => biomeConfig.soilType
          ),
          Match.orElse(({ biomeConfig }) => biomeConfig.surfaceType)
        )

        blocks[index] = blockType
      }
    })

  const generateCaves = (chunkData: ChunkData, seed: number) =>
    Effect.gen(function* () {
      const blocks = new Uint16Array(chunkData.blocks)

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let y = 1; y < 60; y++) { // 洞窟は地下にのみ生成
            const worldX = chunkData.coordinate.x * CHUNK_SIZE + x
            const worldZ = chunkData.coordinate.z * CHUNK_SIZE + z

            // 3Dノイズによる洞窟生成
            const caveNoise = yield* noiseService.noise3D(
              worldX * 0.02, y * 0.03, worldZ * 0.02, seed + 10000
            )

            const caveThreshold = 0.6

            // 早期リターン: 洞窟生成条件をチェック
            if (caveNoise <= caveThreshold) continue

            const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
            const currentBlock = blocks[index]

            // 早期リターン: 岩盤は変更しない
            if (currentBlock === BlockType.Bedrock) continue

            // Match パターンで適切なブロックタイプを決定
            const newBlockType = pipe(
              { y, currentBlock },
              Match.value,
              Match.when(
                ({ y }) => y < 30,
                () => BlockType.Water
              ),
              Match.orElse(() => BlockType.Air)
            )

            blocks[index] = newBlockType
          }
        }
      }

      return { ...chunkData, blocks: Array.from(blocks) }
    })

  const generateOres = (chunkData: ChunkData, seed: number) =>
    Effect.gen(function* () {
      const blocks = new Uint16Array(chunkData.blocks)

      // 各鉱石の生成設定
      const oreConfigs = [
        { type: BlockType.CoalOre, minY: 5, maxY: 132, frequency: 0.02, veinSize: 8 },
        { type: BlockType.IronOre, minY: 5, maxY: 64, frequency: 0.015, veinSize: 6 },
        { type: BlockType.GoldOre, minY: 5, maxY: 32, frequency: 0.005, veinSize: 4 },
        { type: BlockType.DiamondOre, minY: 5, maxY: 16, frequency: 0.001, veinSize: 3 },
        { type: BlockType.RedstoneOre, minY: 5, maxY: 16, frequency: 0.008, veinSize: 5 },
        { type: BlockType.LapisOre, minY: 13, maxY: 17, frequency: 0.003, veinSize: 4 }
      ]

      for (const ore of oreConfigs) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let y = ore.minY; y <= ore.maxY; y++) {
              const worldX = chunkData.coordinate.x * CHUNK_SIZE + x
              const worldZ = chunkData.coordinate.z * CHUNK_SIZE + z

              const oreNoise = yield* noiseService.noise3D(
                worldX * 0.1, y * 0.1, worldZ * 0.1,
                seed + ore.type * 1000
              )

              // 早期リターン: 鉱石生成条件をチェック
              if (oreNoise <= (1 - ore.frequency)) continue

              const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x

              // 早期リターン: 石ブロック以外は鉱石に置換しない
              if (blocks[index] !== BlockType.Stone) continue

              blocks[index] = ore.type

              // 鉱脈の生成
              yield* generateOreVein(blocks, x, y, z, ore.type, ore.veinSize, seed)
            }
          }
        }
      }

      return { ...chunkData, blocks: Array.from(blocks) }
    })

  const generateOreVein = (
    blocks: Uint16Array,
    centerX: number,
    centerY: number,
    centerZ: number,
    oreType: BlockType,
    veinSize: number,
    seed: number
  ) =>
    Effect.gen(function* () {
      for (let i = 0; i < veinSize; i++) {
        const random = yield* noiseService.noise3D(
          centerX + i, centerY + i, centerZ + i, seed + i
        )

        const offsetX = Math.floor(random * 3 - 1) // -1 to 1
        const offsetY = Math.floor(random * 3 - 1)
        const offsetZ = Math.floor(random * 3 - 1)

        const x = centerX + offsetX
        const y = centerY + offsetY
        const z = centerZ + offsetZ

        // 早期リターン: 境界チェック
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
          continue
        }

        const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x

        // 早期リターン: 石ブロック以外は置換しない
        if (blocks[index] !== BlockType.Stone) continue

        blocks[index] = oreType
      }
    })

  const generateStructures = (chunkData: ChunkData, seed: number) =>
    Effect.gen(function* () {
      // 構造物生成は隣接チャンクの情報が必要なため、後処理で実行
      return yield* structureService.generateChunkStructures(chunkData, seed)
    })

  return ChunkGenerator.of({
    generateChunk,
    generateTerrain,
    generateStructures,
    generateOres,
    generateCaves
  })
})

// Live Layer
export const ChunkGeneratorLive = Layer.effect(
  ChunkGenerator,
  makeChunkGenerator
).pipe(
  Layer.provide(NoiseServiceLive),
  Layer.provide(BiomeServiceLive),
  Layer.provide(StructureServiceLive)
)
```

## チャンクロード/アンロードシステム

### Chunk Loading Manager

```typescript
// ChunkLoadingManagerサービスインターフェース
interface ChunkLoadingManagerInterface {
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, ChunkUnloadError>
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<Chunk>, never>
  readonly updateLoadedChunks: (playerPosition: Vector3D, viewDistance: number) => Effect.Effect<void, ChunkLoadError>
  readonly preloadChunks: (coordinates: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<void, ChunkLoadError>
}

// Context Tag
export const ChunkLoadingManager = Context.GenericTag<ChunkLoadingManagerInterface>("@app/ChunkLoadingManager")

// Live実装の作成関数
const makeChunkLoadingManager = Effect.gen(function* () {
  const generator = yield* ChunkGenerator
  const storage = yield* ChunkStorageService
  const meshGenerator = yield* ChunkMeshGenerator
  const lightingEngine = yield* LightingEngine

  // チャンクキャッシュ（LRU）
  const chunkCache = yield* Effect.sync(() => new Map<string, Chunk>())
  const loadQueue = yield* Effect.sync(() => new Set<string>())
  const unloadQueue = yield* Effect.sync(() => new Set<string>())

  const MAX_LOADED_CHUNKS = 1024 // メモリ制限
  const CHUNK_LOAD_PRIORITY_DISTANCE = 8 // 優先ロード距離

  const getChunkKey = (coordinate: ChunkCoordinate): string =>
    `${coordinate.x},${coordinate.z}`

  const loadChunk = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = getChunkKey(coordinate)

      // 早期リターン: キャッシュチェック
      const cached = chunkCache.get(key)
      if (cached && cached.loadState === "loaded") {
        // アクセス時刻を更新（LRU）
        const updated = { ...cached, lastAccessed: new Date() }
        chunkCache.set(key, updated)
        return updated
      }

      // 早期リターン: 重複ロード防止
      if (loadQueue.has(key)) {
        return yield* Effect.fail(new ChunkLoadError(`Chunk ${key} is already loading`))
      }

      loadQueue.add(key)

      try {
        // ストレージからの読み込み試行
        const stored = yield* storage.loadChunk(coordinate).pipe(
          Effect.catchTag("ChunkNotFoundError", () =>
            // 新規生成
            generator.generateChunk(coordinate, yield* getWorldSeed())
          )
        )

        let chunk = {
          coordinate,
          data: stored,
          generationState: "ready",
          loadState: "loading" as ChunkLoadState,
          neighbors: {
            north: { x: coordinate.x, z: coordinate.z - 1 },
            south: { x: coordinate.x, z: coordinate.z + 1 },
            east: { x: coordinate.x + 1, z: coordinate.z },
            west: { x: coordinate.x - 1, z: coordinate.z }
          },
          loadedAt: new Date(),
          lastAccessed: new Date(),
          priority: calculateChunkPriority(coordinate),
          memoryUsage: calculateMemoryUsage(stored)
        } as Chunk

        // ライティングが必要な場合
        if (stored.needsLighting) {
          const lightedData = yield* lightingEngine.calculateLighting(stored)
          chunk = { ...chunk, data: lightedData }
        }

        // メッシュ生成
        const mesh = yield* meshGenerator.generateChunkMesh(chunk.data)
        chunk = { ...chunk, mesh, loadState: "loaded" }

        // キャッシュ容量管理
        yield* manageChunkCache()

        chunkCache.set(key, chunk)
        return chunk

      } finally {
        loadQueue.delete(key)
      }
    })

  const unloadChunk = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = getChunkKey(coordinate)
      const chunk = chunkCache.get(key)

      // 早期リターン: チャンクが存在しない場合
      if (!chunk) return

      unloadQueue.add(key)

      try {
        // ダーティチャンクの保存
        if (chunk.data.isDirty) {
          yield* storage.saveChunk(chunk.data)
        }

        // メッシュリソースの解放
        if (chunk.mesh) {
          yield* meshGenerator.disposeMesh(chunk.mesh)
        }

        chunkCache.delete(key)

      } finally {
        unloadQueue.delete(key)
      }
    })

  const getLoadedChunks = () =>
    Effect.succeed(Array.from(chunkCache.values()))

  const updateLoadedChunks = (playerPosition: Vector3D, viewDistance: number) =>
    Effect.gen(function* () {
      const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE)
      const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE)

      // 必要なチャンクを計算
      const requiredChunks = new Set<string>()
      for (let dx = -viewDistance; dx <= viewDistance; dx++) {
        for (let dz = -viewDistance; dz <= viewDistance; dz++) {
          const distance = Math.sqrt(dx * dx + dz * dz)
          if (distance <= viewDistance) {
            const coord = { x: playerChunkX + dx, z: playerChunkZ + dz }
            requiredChunks.add(getChunkKey(coord))
          }
        }
      }

      // 不要なチャンクのアンロード
      const loadedKeys = new Set(chunkCache.keys())
      for (const key of loadedKeys) {
        if (!requiredChunks.has(key)) {
          const [x, z] = key.split(',').map(Number)
          const distance = Math.sqrt(
            Math.pow(x - playerChunkX, 2) + Math.pow(z - playerChunkZ, 2)
          )

          // アンロード距離の閾値
          if (distance > viewDistance + 2) {
            yield* unloadChunk({ x, z })
          }
        }
      }

      // 必要なチャンクのロード（優先度順）
      const chunksToLoad = Array.from(requiredChunks)
        .filter(key => !chunkCache.has(key) && !loadQueue.has(key))
        .map(key => {
          const [x, z] = key.split(',').map(Number)
          const distance = Math.sqrt(
            Math.pow(x - playerChunkX, 2) + Math.pow(z - playerChunkZ, 2)
          )
          return { coordinate: { x, z }, distance, priority: 100 - distance }
        })
        .sort((a, b) => b.priority - a.priority)

      // 並列ロード（制限あり）
      const CONCURRENT_LOADS = 4
      const loadBatches = []
      for (let i = 0; i < chunksToLoad.length; i += CONCURRENT_LOADS) {
        loadBatches.push(chunksToLoad.slice(i, i + CONCURRENT_LOADS))
      }

      for (const batch of loadBatches) {
        const loadEffects = batch.map(({ coordinate }) => loadChunk(coordinate))
        yield* Effect.all(loadEffects, { concurrency: CONCURRENT_LOADS })
      }
    })

  const preloadChunks = (coordinates: ReadonlyArray<ChunkCoordinate>) =>
    Effect.gen(function* () {
      const PRELOAD_CONCURRENCY = 8
      const loadEffects = coordinates.map(coord => loadChunk(coord))
      yield* Effect.all(loadEffects, { concurrency: PRELOAD_CONCURRENCY })
    })

  const manageChunkCache = () =>
    Effect.gen(function* () {
      if (chunkCache.size <= MAX_LOADED_CHUNKS) return

      // LRUによる古いチャンクの削除
      const chunks = Array.from(chunkCache.entries())
        .map(([key, chunk]) => ({ key, chunk }))
        .sort((a, b) => a.chunk.lastAccessed.getTime() - b.chunk.lastAccessed.getTime())

      const chunksToRemove = chunks.slice(0, chunkCache.size - MAX_LOADED_CHUNKS)

      for (const { key, chunk } of chunksToRemove) {
        yield* unloadChunk(chunk.coordinate)
      }
    })

  const calculateChunkPriority = (coordinate: ChunkCoordinate): number => {
    // プレイヤー位置からの距離に基づく優先度計算
    // 実装では現在のプレイヤー位置を取得
    return 50 // デフォルト優先度
  }

  const calculateMemoryUsage = (chunkData: ChunkData): number => {
    // チャンクデータのメモリ使用量を概算
    const blockArraySize = chunkData.blocks.length * 2 // Uint16Array
    const heightMapSize = chunkData.heightMap.length * 1 // Uint8Array
    const lightMapSize = chunkData.lightMap.length * 1 // Uint8Array
    const biomeMapSize = chunkData.biomeMap.length * 4 // 文字列参照

    return blockArraySize + heightMapSize + lightMapSize + biomeMapSize
  }

  return ChunkLoadingManager.of({
    loadChunk,
    unloadChunk,
    getLoadedChunks,
    updateLoadedChunks,
    preloadChunks
  })
})

// Live Layer
export const ChunkLoadingManagerLive = Layer.effect(
  ChunkLoadingManager,
  makeChunkLoadingManager
).pipe(
  Layer.provide(ChunkGeneratorLive),
  Layer.provide(ChunkStorageServiceLive),
  Layer.provide(ChunkMeshGeneratorLive),
  Layer.provide(LightingEngineLive)
)
```

## チャンクメッシングシステム

### Advanced Chunk Meshing

```typescript
// ChunkMeshGeneratorサービスインターフェース
interface ChunkMeshGeneratorInterface {
  readonly generateChunkMesh: (chunkData: ChunkData) => Effect.Effect<ChunkMesh, MeshGenerationError>
  readonly updateChunkMesh: (mesh: ChunkMesh, chunkData: ChunkData) => Effect.Effect<ChunkMesh, never>
  readonly generateLODMesh: (chunkData: ChunkData, lodLevel: number) => Effect.Effect<ChunkMesh, never>
  readonly disposeMesh: (mesh: ChunkMesh) => Effect.Effect<void, never>
  readonly optimizeMesh: (mesh: ChunkMesh) => Effect.Effect<ChunkMesh, never>
}

// Context Tag
export const ChunkMeshGenerator = Context.GenericTag<ChunkMeshGeneratorInterface>("@app/ChunkMeshGenerator")

// Live実装の作成関数
const makeChunkMeshGenerator = Effect.gen(function* () {
  const textureAtlas = yield* TextureAtlasService
  const blockRegistry = yield* BlockRegistry

  const generateChunkMesh = (chunkData: ChunkData) =>
    Effect.gen(function* () {
      // 分離されたジオメトリ（レンダリング最適化）
      const opaqueGeometry = {
        vertices: [] as number[],
        indices: [] as number[],
        uvs: [] as number[],
        normals: [] as number[],
        colors: [] as number[]
      }

      const transparentGeometry = {
        vertices: [] as number[],
        indices: [] as number[],
        uvs: [] as number[],
        normals: [] as number[],
        colors: [] as number[]
      }

      const waterGeometry = {
        vertices: [] as number[],
        indices: [] as number[],
        uvs: [] as number[],
        normals: [] as number[],
        colors: [] as number[]
      }

      let opaqueIndex = 0
      let transparentIndex = 0
      let waterIndex = 0

      // Greedy Meshingアルゴリズムの実装
      yield* performGreedyMeshing(
        chunkData,
        opaqueGeometry,
        transparentGeometry,
        waterGeometry,
        { opaque: opaqueIndex, transparent: transparentIndex, water: waterIndex }
      )

      // Three.jsジオメトリの作成
      const opaqueThreeGeometry = createThreeGeometry(opaqueGeometry)
      const transparentThreeGeometry = createThreeGeometry(transparentGeometry)
      const waterThreeGeometry = createThreeGeometry(waterGeometry)

      return {
        coordinate: chunkData.coordinate,
        opaqueGeometry: opaqueThreeGeometry,
        transparentGeometry: transparentThreeGeometry,
        waterGeometry: waterThreeGeometry,
        vertices: [...opaqueGeometry.vertices, ...transparentGeometry.vertices],
        indices: [...opaqueGeometry.indices, ...transparentGeometry.indices],
        uvs: [...opaqueGeometry.uvs, ...transparentGeometry.uvs],
        normals: [...opaqueGeometry.normals, ...transparentGeometry.normals],
        colors: [...opaqueGeometry.colors, ...transparentGeometry.colors],
        vertexCount: (opaqueGeometry.vertices.length + transparentGeometry.vertices.length) / 3,
        triangleCount: (opaqueGeometry.indices.length + transparentGeometry.indices.length) / 3,
        needsRebuild: false,
        lodLevel: 0,
        lastRebuild: new Date()
      } as ChunkMesh
    })

  const performGreedyMeshing = (
    chunkData: ChunkData,
    opaqueGeom: GeometryData,
    transparentGeom: GeometryData,
    waterGeom: GeometryData,
    indices: { opaque: number; transparent: number; water: number }
  ) =>
    Effect.gen(function* () {
      // 3軸でのGreedy Meshing
      for (let axis = 0; axis < 3; axis++) {
        const u = (axis + 1) % 3
        const v = (axis + 2) % 3
        const x = [0, 0, 0]
        const q = [0, 0, 0]

        q[axis] = 1

        const dims = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE]
        const mask: (BlockFaceData | null)[] = new Array(dims[u] * dims[v])

        for (x[axis] = -1; x[axis] < dims[axis];) {
          let n = 0

          // マスクの生成
          for (x[v] = 0; x[v] < dims[v]; x[v]++) {
            for (x[u] = 0; x[u] < dims[u]; x[u]++) {
              const currentBlock = getBlockAt(chunkData, x[0], x[1], x[2])
              const neighborBlock = getBlockAt(chunkData, x[0] + q[0], x[1] + q[1], x[2] + q[2])

              const currentBlockData = yield* blockRegistry.getBlockData(currentBlock)
              const neighborBlockData = yield* blockRegistry.getBlockData(neighborBlock)

              mask[n++] = shouldCreateFace(currentBlockData, neighborBlockData, axis)
                ? { blockType: currentBlock, blockData: currentBlockData, face: axis }
                : null
            }
          }

          x[axis]++
          n = 0

          // マスクからメッシュ生成
          for (let j = 0; j < dims[v]; j++) {
            let i = 0
            while (i < dims[u]) {
              if (mask[n] !== null) {
                const currentFace = mask[n]!
                let w = 1
                let h = 1

                // 幅の最適化
                while (i + w < dims[u] &&
                       mask[n + w] !== null &&
                       isSameFace(mask[n + w]!, currentFace)) {
                  w++
                }

                // 高さの最適化
                let done = false
                while (j + h < dims[v]) {
                  for (let k = 0; k < w; k++) {
                    if (mask[n + k + h * dims[u]] === null ||
                        !isSameFace(mask[n + k + h * dims[u]]!, currentFace)) {
                      done = true
                      break
                    }
                  }
                  if (done) break
                  h++
                }

                // クワッドの生成
                x[u] = i
                x[v] = j

                const quad = yield* createOptimizedQuad(
                  x, [w, h], axis, currentFace, chunkData.coordinate
                )

                // 適切なジオメトリに追加
                if (currentFace.blockData.isWater) {
                  addQuadToGeometry(quad, waterGeom, indices.water)
                  indices.water += 4
                } else if (currentFace.blockData.isTransparent) {
                  addQuadToGeometry(quad, transparentGeom, indices.transparent)
                  indices.transparent += 4
                } else {
                  addQuadToGeometry(quad, opaqueGeom, indices.opaque)
                  indices.opaque += 4
                }

                // マスクをクリア
                for (let l = 0; l < h; l++) {
                  for (let k = 0; k < w; k++) {
                    mask[n + k + l * dims[u]] = null
                  }
                }

                i += w
                n += w
              } else {
                i++
                n++
              }
            }
          }
        }
      }
    })

  const createOptimizedQuad = (
    position: number[],
    size: number[],
    axis: number,
    faceData: BlockFaceData,
    chunkCoordinate: ChunkCoordinate
  ) =>
    Effect.gen(function* () {
      const vertices: number[] = []
      const uvs: number[] = []
      const normals: number[] = []
      const colors: number[] = []

      // ワールド座標への変換
      const worldX = chunkCoordinate.x * CHUNK_SIZE + position[0]
      const worldY = position[1]
      const worldZ = chunkCoordinate.z * CHUNK_SIZE + position[2]

      // 面の向きに基づく頂点計算
      const faceVertices = calculateFaceVertices(worldX, worldY, worldZ, size, axis)
      const faceNormal = calculateFaceNormal(axis)

      // テクスチャUV座標
      const textureUVs = yield* textureAtlas.getBlockFaceUVs(
        faceData.blockType,
        getFaceName(axis),
        size[0],
        size[1]
      )

      // バイオームによる色調整
      const biomeColor = getBiomeColorMultiplier(faceData.blockType, chunkCoordinate)

      // クワッドデータの構築
      for (let i = 0; i < 4; i++) {
        vertices.push(...faceVertices[i])
        normals.push(...faceNormal)
        uvs.push(...textureUVs[i])
        colors.push(...biomeColor)
      }

      return {
        vertices,
        uvs,
        normals,
        colors,
        indices: [0, 1, 2, 0, 2, 3] // クワッドのインデックス
      }
    })

  const generateLODMesh = (chunkData: ChunkData, lodLevel: number) =>
    Effect.gen(function* () {
      // LODレベルに応じてブロックを間引き
      const decimationFactor = Math.pow(2, lodLevel)
      const lodChunkData = decimateChunkData(chunkData, decimationFactor)

      return yield* generateChunkMesh(lodChunkData)
    })

  const updateChunkMesh = (mesh: ChunkMesh, chunkData: ChunkData) =>
    Effect.gen(function* () {
      // チャンクデータが変更された場合のメッシュ更新
      if (!mesh.needsRebuild) return mesh

      return yield* generateChunkMesh(chunkData)
    })

  const optimizeMesh = (mesh: ChunkMesh) =>
    Effect.gen(function* () {
      // メッシュの最適化処理
      const optimizedVertices = removeDuplicateVertices(mesh.vertices, mesh.indices)
      const optimizedIndices = reindexVertices(optimizedVertices, mesh.indices)

      return {
        ...mesh,
        vertices: optimizedVertices,
        indices: optimizedIndices,
        vertexCount: optimizedVertices.length / 3,
        triangleCount: optimizedIndices.length / 3
      }
    })

  const disposeMesh = (mesh: ChunkMesh) =>
    Effect.gen(function* () {
      // Three.jsジオメトリのメモリ解放
      if (mesh.opaqueGeometry) {
        (mesh.opaqueGeometry as any).dispose()
      }
      if (mesh.transparentGeometry) {
        (mesh.transparentGeometry as any).dispose()
      }
      if (mesh.waterGeometry) {
        (mesh.waterGeometry as any).dispose()
      }
    })

  return ChunkMeshGenerator.of({
    generateChunkMesh,
    updateChunkMesh,
    generateLODMesh,
    disposeMesh,
    optimizeMesh
  })
})

// Live Layer
export const ChunkMeshGeneratorLive = Layer.effect(
  ChunkMeshGenerator,
  makeChunkMeshGenerator
).pipe(
  Layer.provide(TextureAtlasServiceLive),
  Layer.provide(BlockRegistryLive)
)

// ヘルパー関数と型定義
interface GeometryData {
  vertices: number[]
  indices: number[]
  uvs: number[]
  normals: number[]
  colors: number[]
}

interface BlockFaceData {
  blockType: BlockType
  blockData: BlockData
  face: number
}

const getBlockAt = (chunkData: ChunkData, x: number, y: number, z: number): BlockType => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return BlockType.Air
  }
  const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
  return chunkData.blocks[index] || BlockType.Air
}

const shouldCreateFace = (current: BlockData, neighbor: BlockData, axis: number): boolean => {
  if (current.blockType === BlockType.Air) return false
  if (neighbor.blockType === BlockType.Air) return true
  if (current.isTransparent && !neighbor.isTransparent) return true
  if (!current.isTransparent && neighbor.isTransparent) return true
  return false
}

const isSameFace = (a: BlockFaceData, b: BlockFaceData): boolean => {
  return a.blockType === b.blockType && a.face === b.face
}

const addQuadToGeometry = (quad: any, geometry: GeometryData, baseIndex: number) => {
  const indexOffset = baseIndex

  // 頂点データを追加
  geometry.vertices.push(...quad.vertices)
  geometry.uvs.push(...quad.uvs)
  geometry.normals.push(...quad.normals)
  geometry.colors.push(...quad.colors)

  // インデックスを調整して追加
  for (const index of quad.indices) {
    geometry.indices.push(index + indexOffset)
  }
}

const createThreeGeometry = (geometryData: GeometryData): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()

  if (geometryData.vertices.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryData.vertices, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometryData.uvs, 2))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(geometryData.colors, 3))
    geometry.setIndex(geometryData.indices)

    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()
  }

  return geometry
}
```

## チャンク更新システム

### Chunk Update Manager

```typescript
// ChunkUpdateManagerサービスインターフェース
interface ChunkUpdateManagerInterface {
  readonly updateBlock: (coordinate: ChunkCoordinate, position: LocalBlockPosition, blockType: BlockType) => Effect.Effect<void, ChunkUpdateError>
  readonly updateChunkSection: (coordinate: ChunkCoordinate, section: number, blocks: ReadonlyArray<number>) => Effect.Effect<void, never>
  readonly markChunkDirty: (coordinate: ChunkCoordinate) => Effect.Effect<void, never>
  readonly propagateBlockUpdate: (worldPosition: Vector3D, blockType: BlockType) => Effect.Effect<void, never>
  readonly scheduleLightingUpdate: (coordinate: ChunkCoordinate) => Effect.Effect<void, never>
}

// Context Tag
export const ChunkUpdateManager = Context.GenericTag<ChunkUpdateManagerInterface>("@app/ChunkUpdateManager")

// Live実装の作成関数
const makeChunkUpdateManager = Effect.gen(function* () {
  const chunkManager = yield* ChunkLoadingManager
  const meshGenerator = yield* ChunkMeshGenerator
  const lightingEngine = yield* LightingEngine
  const eventBus = yield* EventBus

  const updateQueue = yield* Effect.sync(() => new Map<string, ChunkUpdateTask>())
  const lightingQueue = yield* Effect.sync(() => new Set<string>())

  const updateBlock = (coordinate: ChunkCoordinate, position: LocalBlockPosition, blockType: BlockType) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const chunk = chunks.find(c =>
        c.coordinate.x === coordinate.x && c.coordinate.z === coordinate.z
      )

      if (!chunk) {
        return yield* Effect.fail(new ChunkUpdateError(`Chunk not loaded: ${coordinate.x},${coordinate.z}`))
      }

      // ブロックデータを更新
      const blockIndex = position.y * CHUNK_SIZE * CHUNK_SIZE + position.z * CHUNK_SIZE + position.x
      const newBlocks = [...chunk.data.blocks]
      const oldBlockType = newBlocks[blockIndex]
      newBlocks[blockIndex] = blockType

      const updatedData = {
        ...chunk.data,
        blocks: newBlocks,
        isDirty: true,
        needsLighting: true,
        lastModified: new Date()
      }

      // チャンク更新をキューに追加
      const updateTask = {
        coordinate,
        type: "block_update" as const,
        position,
        oldBlockType,
        newBlockType: blockType,
        priority: 100,
        timestamp: new Date()
      }

      const key = `${coordinate.x},${coordinate.z}`
      updateQueue.set(key, updateTask)

      // 隣接チャンクへの影響チェック
      yield* checkAdjacentChunkUpdates(coordinate, position, blockType)

      // ブロック更新イベント発行
      yield* eventBus.publish(new BlockUpdateEvent({
        worldPosition: {
          x: coordinate.x * CHUNK_SIZE + position.x,
          y: position.y,
          z: coordinate.z * CHUNK_SIZE + position.z
        },
        oldBlockType,
        newBlockType: blockType,
        timestamp: new Date()
      }))

      // ライティング更新をスケジュール
      yield* scheduleLightingUpdate(coordinate)
    })

  const updateChunkSection = (coordinate: ChunkCoordinate, section: number, blocks: ReadonlyArray<number>) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const chunk = chunks.find(c =>
        c.coordinate.x === coordinate.x && c.coordinate.z === coordinate.z
      )

      if (!chunk) return

      // セクション範囲のブロックを更新
      const sectionStart = section * CHUNK_SIZE * CHUNK_SIZE * CHUNK_SECTION_HEIGHT
      const newBlocks = [...chunk.data.blocks]

      for (let i = 0; i < blocks.length; i++) {
        newBlocks[sectionStart + i] = blocks[i]
      }

      const updatedData = {
        ...chunk.data,
        blocks: newBlocks,
        isDirty: true,
        needsLighting: true,
        lastModified: new Date()
      }

      // 更新をキューに追加
      const updateTask = {
        coordinate,
        type: "section_update" as const,
        section,
        blocks,
        priority: 80,
        timestamp: new Date()
      }

      const key = `${coordinate.x},${coordinate.z}`
      updateQueue.set(key, updateTask)
    })

  const markChunkDirty = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const chunk = chunks.find(c =>
        c.coordinate.x === coordinate.x && c.coordinate.z === coordinate.z
      )

      if (!chunk) return

      // ダーティフラグをセット
      chunk.data.isDirty = true
      chunk.data.lastModified = new Date()

      // メッシュ更新フラグをセット
      if (chunk.mesh) {
        chunk.mesh.needsRebuild = true
      }
    })

  const propagateBlockUpdate = (worldPosition: Vector3D, blockType: BlockType) =>
    Effect.gen(function* () {
      // 隣接ブロックへの更新伝播
      const directions = [
        { x: 1, y: 0, z: 0 },   // East
        { x: -1, y: 0, z: 0 },  // West
        { x: 0, y: 1, z: 0 },   // Up
        { x: 0, y: -1, z: 0 },  // Down
        { x: 0, y: 0, z: 1 },   // North
        { x: 0, y: 0, z: -1 }   // South
      ]

      for (const dir of directions) {
        const neighborPos = {
          x: worldPosition.x + dir.x,
          y: worldPosition.y + dir.y,
          z: worldPosition.z + dir.z
        }

        const neighborChunk = {
          x: Math.floor(neighborPos.x / CHUNK_SIZE),
          z: Math.floor(neighborPos.z / CHUNK_SIZE)
        }

        const localPos = {
          x: ((neighborPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
          y: neighborPos.y,
          z: ((neighborPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        } as LocalBlockPosition

        // 隣接ブロックの更新通知
        yield* eventBus.publish(new NeighborBlockUpdateEvent({
          position: neighborPos,
          chunkCoordinate: neighborChunk,
          localPosition: localPos,
          sourceBlockType: blockType,
          timestamp: new Date()
        }))
      }
    })

  const scheduleLightingUpdate = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const key = `${coordinate.x},${coordinate.z}`
      lightingQueue.add(key)

      // 隣接チャンクもライティング更新が必要
      const neighbors = [
        { x: coordinate.x + 1, z: coordinate.z },
        { x: coordinate.x - 1, z: coordinate.z },
        { x: coordinate.x, z: coordinate.z + 1 },
        { x: coordinate.x, z: coordinate.z - 1 }
      ]

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.z}`
        lightingQueue.add(neighborKey)
      }
    })

  const processUpdateQueue = () =>
    Effect.gen(function* () {
      if (updateQueue.size === 0) return

      // 優先度順にソート
      const tasks = Array.from(updateQueue.values())
        .sort((a, b) => b.priority - a.priority)

      const BATCH_SIZE = 16
      const batch = tasks.slice(0, BATCH_SIZE)

      for (const task of batch) {
        const key = `${task.coordinate.x},${task.coordinate.z}`

        try {
          yield* processUpdateTask(task)
          updateQueue.delete(key)
        } catch (error) {
          // エラーハンドリング
          console.error(`Failed to process chunk update: ${key}`, error)
        }
      }
    })

  const processLightingQueue = () =>
    Effect.gen(function* () {
      if (lightingQueue.size === 0) return

      const chunks = Array.from(lightingQueue).slice(0, 8) // 8チャンクまで並列処理

      const lightingTasks = chunks.map(key => {
        const [x, z] = key.split(',').map(Number)
        return processChunkLighting({ x, z })
      })

      yield* Effect.all(lightingTasks, { concurrency: 4 })

      // 処理済みチャンクを削除
      chunks.forEach(key => lightingQueue.delete(key))
    })

  const processUpdateTask = (task: ChunkUpdateTask) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const chunk = chunks.find(c =>
        c.coordinate.x === task.coordinate.x && c.coordinate.z === task.coordinate.z
      )

      if (!chunk) return

      // メッシュの更新
      if (chunk.mesh?.needsRebuild) {
        const newMesh = yield* meshGenerator.generateChunkMesh(chunk.data)
        chunk.mesh = newMesh
      }
    })

  const processChunkLighting = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const chunk = chunks.find(c =>
        c.coordinate.x === coordinate.x && c.coordinate.z === coordinate.z
      )

      if (!chunk || !chunk.data.needsLighting) return

      const lightedData = yield* lightingEngine.calculateLighting(chunk.data)
      chunk.data = { ...lightedData, needsLighting: false }

      // メッシュ更新もスケジュール
      if (chunk.mesh) {
        chunk.mesh.needsRebuild = true
      }
    })

  const checkAdjacentChunkUpdates = (coordinate: ChunkCoordinate, position: LocalBlockPosition, blockType: BlockType) =>
    Effect.gen(function* () {
      // チャンク境界のブロック更新の場合、隣接チャンクのメッシュ更新が必要
      const needsNeighborUpdate = (
        position.x === 0 || position.x === CHUNK_SIZE - 1 ||
        position.z === 0 || position.z === CHUNK_SIZE - 1
      )

      if (!needsNeighborUpdate) return

      const neighborCoords: ChunkCoordinate[] = []

      if (position.x === 0) neighborCoords.push({ x: coordinate.x - 1, z: coordinate.z })
      if (position.x === CHUNK_SIZE - 1) neighborCoords.push({ x: coordinate.x + 1, z: coordinate.z })
      if (position.z === 0) neighborCoords.push({ x: coordinate.x, z: coordinate.z - 1 })
      if (position.z === CHUNK_SIZE - 1) neighborCoords.push({ x: coordinate.x, z: coordinate.z + 1 })

      for (const neighborCoord of neighborCoords) {
        yield* markChunkDirty(neighborCoord)
      }
    })

  // 定期的な更新処理
  const startUpdateLoop = () =>
    Effect.gen(function* () {
      while (true) {
        yield* processUpdateQueue()
        yield* processLightingQueue()
        yield* Effect.sleep(50) // 50ms間隔
      }
    }).pipe(
      Effect.fork // バックグラウンドで実行
    )

  return ChunkUpdateManager.of({
    updateBlock,
    updateChunkSection,
    markChunkDirty,
    propagateBlockUpdate,
    scheduleLightingUpdate
  })
})

// Live Layer
export const ChunkUpdateManagerLive = Layer.effect(
  ChunkUpdateManager,
  makeChunkUpdateManager
).pipe(
  Layer.provide(ChunkLoadingManagerLive),
  Layer.provide(ChunkMeshGeneratorLive),
  Layer.provide(LightingEngineLive),
  Layer.provide(EventBusLive)
)

// 型定義
interface ChunkUpdateTask {
  readonly coordinate: ChunkCoordinate
  readonly type: "block_update" | "section_update" | "lighting_update"
  readonly priority: number
  readonly timestamp: Date
  readonly position?: LocalBlockPosition
  readonly section?: number
  readonly blocks?: ReadonlyArray<number>
  readonly oldBlockType?: BlockType
  readonly newBlockType?: BlockType
}

class BlockUpdateEvent {
  constructor(
    public readonly data: {
      worldPosition: Vector3D
      oldBlockType: BlockType
      newBlockType: BlockType
      timestamp: Date
    }
  ) {}
}

class NeighborBlockUpdateEvent {
  constructor(
    public readonly data: {
      position: Vector3D
      chunkCoordinate: ChunkCoordinate
      localPosition: LocalBlockPosition
      sourceBlockType: BlockType
      timestamp: Date
    }
  ) {}
}
```

## 隣接チャンク処理

### Neighbor Chunk System

```typescript
// NeighborChunkManagerサービスインターフェース
interface NeighborChunkManagerInterface {
  readonly updateNeighborReferences: (coordinate: ChunkCoordinate) => Effect.Effect<void, never>
  readonly getNeighborChunk: (coordinate: ChunkCoordinate, direction: Direction) => Effect.Effect<Chunk | null, never>
  readonly ensureNeighborsLoaded: (coordinate: ChunkCoordinate) => Effect.Effect<void, ChunkLoadError>
  readonly calculateChunkBoundary: (chunkA: ChunkCoordinate, chunkB: ChunkCoordinate) => Effect.Effect<ChunkBoundary, never>
}

// Context Tag
export const NeighborChunkManager = Context.GenericTag<NeighborChunkManagerInterface>("@app/NeighborChunkManager")

// Live実装の作成関数
const makeNeighborChunkManager = Effect.gen(function* () {
  const chunkManager = yield* ChunkLoadingManager

  const updateNeighborReferences = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const targetChunk = chunks.find(c =>
        c.coordinate.x === coordinate.x && c.coordinate.z === coordinate.z
      )

      if (!targetChunk) return

      // 隣接チャンクの座標計算
      const neighborCoords = {
        north: { x: coordinate.x, z: coordinate.z - 1 },
        south: { x: coordinate.x, z: coordinate.z + 1 },
        east: { x: coordinate.x + 1, z: coordinate.z },
        west: { x: coordinate.x - 1, z: coordinate.z }
      }

      // 隣接チャンクが存在する場合は相互参照を設定
      for (const [direction, neighborCoord] of Object.entries(neighborCoords)) {
        const neighborChunk = chunks.find(c =>
          c.coordinate.x === neighborCoord.x && c.coordinate.z === neighborCoord.z
        )

        if (neighborChunk) {
          // 双方向参照の設定
          targetChunk.neighbors[direction as keyof typeof neighborCoords] = neighborCoord

          const oppositeDirection = getOppositeDirection(direction as Direction)
          neighborChunk.neighbors[oppositeDirection] = coordinate
        }
      }
    })

  const getNeighborChunk = (coordinate: ChunkCoordinate, direction: Direction) =>
    Effect.gen(function* () {
      const chunks = yield* chunkManager.getLoadedChunks()
      const chunk = chunks.find(c =>
        c.coordinate.x === coordinate.x && c.coordinate.z === coordinate.z
      )

      if (!chunk) return null

      const neighborCoord = chunk.neighbors[direction]
      if (!neighborCoord) return null

      const neighborChunk = chunks.find(c =>
        c.coordinate.x === neighborCoord.x && c.coordinate.z === neighborCoord.z
      )

      return neighborChunk || null
    })

  const ensureNeighborsLoaded = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const neighborCoords = [
        { x: coordinate.x, z: coordinate.z - 1 }, // North
        { x: coordinate.x, z: coordinate.z + 1 }, // South
        { x: coordinate.x + 1, z: coordinate.z }, // East
        { x: coordinate.x - 1, z: coordinate.z }  // West
      ]

      // 隣接チャンクを並列でロード
      const loadTasks = neighborCoords.map(coord =>
        chunkManager.loadChunk(coord).pipe(
          Effect.catchAll(() => Effect.succeed(null)) // エラーは無視
        )
      )

      yield* Effect.all(loadTasks, { concurrency: 4 })
      yield* updateNeighborReferences(coordinate)
    })

  const calculateChunkBoundary = (chunkA: ChunkCoordinate, chunkB: ChunkCoordinate) =>
    Effect.gen(function* () {
      const isAdjacent = (
        (Math.abs(chunkA.x - chunkB.x) === 1 && chunkA.z === chunkB.z) ||
        (Math.abs(chunkA.z - chunkB.z) === 1 && chunkA.x === chunkB.x)
      )

      if (!isAdjacent) {
        return null
      }

      // 境界面の計算
      let direction: Direction
      let boundaryStart: Vector3D
      let boundaryEnd: Vector3D

      if (chunkB.x > chunkA.x) {
        // East boundary
        direction = "east"
        boundaryStart = {
          x: chunkA.x * CHUNK_SIZE + CHUNK_SIZE,
          y: 0,
          z: chunkA.z * CHUNK_SIZE
        }
        boundaryEnd = {
          x: chunkA.x * CHUNK_SIZE + CHUNK_SIZE,
          y: CHUNK_HEIGHT,
          z: chunkA.z * CHUNK_SIZE + CHUNK_SIZE
        }
      } else if (chunkB.x < chunkA.x) {
        // West boundary
        direction = "west"
        boundaryStart = {
          x: chunkA.x * CHUNK_SIZE,
          y: 0,
          z: chunkA.z * CHUNK_SIZE
        }
        boundaryEnd = {
          x: chunkA.x * CHUNK_SIZE,
          y: CHUNK_HEIGHT,
          z: chunkA.z * CHUNK_SIZE + CHUNK_SIZE
        }
      } else if (chunkB.z > chunkA.z) {
        // South boundary
        direction = "south"
        boundaryStart = {
          x: chunkA.x * CHUNK_SIZE,
          y: 0,
          z: chunkA.z * CHUNK_SIZE + CHUNK_SIZE
        }
        boundaryEnd = {
          x: chunkA.x * CHUNK_SIZE + CHUNK_SIZE,
          y: CHUNK_HEIGHT,
          z: chunkA.z * CHUNK_SIZE + CHUNK_SIZE
        }
      } else {
        // North boundary
        direction = "north"
        boundaryStart = {
          x: chunkA.x * CHUNK_SIZE,
          y: 0,
          z: chunkA.z * CHUNK_SIZE
        }
        boundaryEnd = {
          x: chunkA.x * CHUNK_SIZE + CHUNK_SIZE,
          y: CHUNK_HEIGHT,
          z: chunkA.z * CHUNK_SIZE
        }
      }

      return {
        chunkA,
        chunkB,
        direction,
        boundaryStart,
        boundaryEnd,
        length: CHUNK_SIZE,
        height: CHUNK_HEIGHT
      } as ChunkBoundary
    })

  return NeighborChunkManager.of({
    updateNeighborReferences,
    getNeighborChunk,
    ensureNeighborsLoaded,
    calculateChunkBoundary
  })
})

// Live Layer
export const NeighborChunkManagerLive = Layer.effect(
  NeighborChunkManager,
  makeNeighborChunkManager
).pipe(
  Layer.provide(ChunkLoadingManagerLive)
)

// ヘルパー関数
type Direction = "north" | "south" | "east" | "west"

const getOppositeDirection = (direction: Direction): Direction => {
  const opposites = {
    north: "south" as const,
    south: "north" as const,
    east: "west" as const,
    west: "east" as const
  }
  return opposites[direction]
}

// 型定義
interface ChunkBoundary {
  readonly chunkA: ChunkCoordinate
  readonly chunkB: ChunkCoordinate
  readonly direction: Direction
  readonly boundaryStart: Vector3D
  readonly boundaryEnd: Vector3D
  readonly length: number
  readonly height: number
}
```

## チャンク永続化

### Chunk Persistence System

```typescript
// ChunkStorageServiceサービスインターフェース
interface ChunkStorageServiceInterface {
  readonly saveChunk: (chunkData: ChunkData) => Effect.Effect<void, ChunkSaveError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkLoadError>
  readonly deleteChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, ChunkDeleteError>
  readonly chunkExists: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never>
  readonly getChunkMetadata: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkMetadata | null, never>
  readonly compactStorage: () => Effect.Effect<void, never>
}

// Context Tag
export const ChunkStorageService = Context.GenericTag<ChunkStorageServiceInterface>("@app/ChunkStorageService")

// Live実装の作成関数
const makeChunkStorageService = Effect.gen(function* () {
  const fileSystem = yield* FileSystemService
  const compression = yield* CompressionService
  const encryption = yield* EncryptionService

  const WORLD_DIRECTORY = "world"
  const CHUNK_DIRECTORY = "chunks"
  const METADATA_FILE = "metadata.json"

  const getChunkFilePath = (coordinate: ChunkCoordinate): string => {
    const regionX = Math.floor(coordinate.x / 32)
    const regionZ = Math.floor(coordinate.z / 32)
    const fileName = `chunk.${coordinate.x}.${coordinate.z}.dat`
    return `${WORLD_DIRECTORY}/${CHUNK_DIRECTORY}/r.${regionX}.${regionZ}/${fileName}`
  }

  const saveChunk = (chunkData: ChunkData) =>
    Effect.gen(function* () {
      const filePath = getChunkFilePath(chunkData.coordinate)

      // チャンクデータのシリアライゼーション
      const serializedData = yield* serializeChunkData(chunkData)

      // 圧縮
      const compressedData = yield* compression.compress(serializedData)

      // 暗号化（オプション）
      const finalData = yield* encryption.encrypt(compressedData)

      // ディレクトリの作成
      const directory = filePath.substring(0, filePath.lastIndexOf('/'))
      yield* fileSystem.ensureDirectory(directory)

      // ファイル書き込み
      yield* fileSystem.writeFile(filePath, finalData)

      // メタデータの更新
      yield* updateChunkMetadata(chunkData.coordinate, {
        lastSaved: new Date(),
        fileSize: finalData.length,
        version: CHUNK_DATA_VERSION,
        checksum: yield* calculateChecksum(finalData)
      })
    })

  const loadChunk = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const filePath = getChunkFilePath(coordinate)

      // ファイル存在チェック
      const exists = yield* fileSystem.fileExists(filePath)
      if (!exists) {
        return yield* Effect.fail(new ChunkNotFoundError(coordinate))
      }

      // ファイル読み込み
      const fileData = yield* fileSystem.readFile(filePath)

      // 復号化
      const decryptedData = yield* encryption.decrypt(fileData)

      // 展開
      const decompressedData = yield* compression.decompress(decryptedData)

      // デシリアライゼーション
      const chunkData = yield* deserializeChunkData(decompressedData, coordinate)

      // メタデータの更新
      yield* updateChunkMetadata(coordinate, {
        lastAccessed: new Date()
      })

      return chunkData
    })

  const deleteChunk = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const filePath = getChunkFilePath(coordinate)

      yield* fileSystem.deleteFile(filePath).pipe(
        Effect.catchTag("FileNotFoundError", () => Effect.unit)
      )

      yield* removeChunkMetadata(coordinate)
    })

  const chunkExists = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const filePath = getChunkFilePath(coordinate)
      return yield* fileSystem.fileExists(filePath)
    })

  const getChunkMetadata = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const metadataPath = `${WORLD_DIRECTORY}/${CHUNK_DIRECTORY}/${METADATA_FILE}`
      const exists = yield* fileSystem.fileExists(metadataPath)

      if (!exists) return null

      const metadataContent = yield* fileSystem.readFile(metadataPath)
      const metadata = JSON.parse(new TextDecoder().decode(metadataContent))

      const key = `${coordinate.x},${coordinate.z}`
      return metadata[key] || null
    })

  const compactStorage = () =>
    Effect.gen(function* () {
      // 未使用のチャンクファイルをクリーンアップ
      const chunkDirectory = `${WORLD_DIRECTORY}/${CHUNK_DIRECTORY}`
      const regions = yield* fileSystem.listDirectories(chunkDirectory)

      for (const region of regions) {
        const regionPath = `${chunkDirectory}/${region}`
        const files = yield* fileSystem.listFiles(regionPath)

        // 古いチャンクファイルの削除（30日以上アクセスなし）
        const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

        for (const file of files) {
          const filePath = `${regionPath}/${file}`
          const stats = yield* fileSystem.getFileStats(filePath)

          if (stats.lastAccessed < cutoffTime) {
            yield* fileSystem.deleteFile(filePath)
          }
        }

        // 空のディレクトリを削除
        const remainingFiles = yield* fileSystem.listFiles(regionPath)
        if (remainingFiles.length === 0) {
          yield* fileSystem.deleteDirectory(regionPath)
        }
      }
    })

  const serializeChunkData = (chunkData: ChunkData) =>
    Effect.gen(function* () {
      // バイナリシリアライゼーション（効率的なストレージ）
      const buffer = new ArrayBuffer(calculateChunkDataSize(chunkData))
      const view = new DataView(buffer)
      let offset = 0

      // ヘッダー
      view.setUint32(offset, CHUNK_DATA_VERSION)
      offset += 4

      view.setInt32(offset, chunkData.coordinate.x)
      offset += 4
      view.setInt32(offset, chunkData.coordinate.z)
      offset += 4

      // ブロックデータ（RLE圧縮）
      const compressedBlocks = yield* compressBlockData(chunkData.blocks)
      view.setUint32(offset, compressedBlocks.length)
      offset += 4

      new Uint8Array(buffer, offset, compressedBlocks.length).set(compressedBlocks)
      offset += compressedBlocks.length

      // 高度マップ
      const heightMapData = new Uint8Array(chunkData.heightMap)
      new Uint8Array(buffer, offset, heightMapData.length).set(heightMapData)
      offset += heightMapData.length

      // バイオームマップ
      const biomeData = yield* serializeBiomeMap(chunkData.biomeMap)
      view.setUint32(offset, biomeData.length)
      offset += 4
      new Uint8Array(buffer, offset, biomeData.length).set(biomeData)
      offset += biomeData.length

      // ライトマップ
      const lightData = packLightMaps(chunkData.lightMap, chunkData.blockLightMap, chunkData.skyLightMap)
      new Uint8Array(buffer, offset, lightData.length).set(lightData)
      offset += lightData.length

      // メタデータ
      view.setFloat64(offset, chunkData.lastModified.getTime())
      offset += 8
      view.setUint8(offset, chunkData.isDirty ? 1 : 0)
      offset += 1
      view.setUint8(offset, chunkData.needsLighting ? 1 : 0)
      offset += 1

      return new Uint8Array(buffer)
    })

  const deserializeChunkData = (data: Uint8Array, coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
      let offset = 0

      // ヘッダー
      const version = view.getUint32(offset)
      offset += 4

      if (version !== CHUNK_DATA_VERSION) {
        return yield* Effect.fail(new ChunkVersionMismatchError(version, CHUNK_DATA_VERSION))
      }

      const coordX = view.getInt32(offset)
      offset += 4
      const coordZ = view.getInt32(offset)
      offset += 4

      // ブロックデータ
      const blockDataLength = view.getUint32(offset)
      offset += 4
      const compressedBlocks = data.slice(offset, offset + blockDataLength)
      offset += blockDataLength

      const blocks = yield* decompressBlockData(compressedBlocks)

      // 高度マップ
      const heightMap = Array.from(data.slice(offset, offset + CHUNK_SIZE * CHUNK_SIZE))
      offset += CHUNK_SIZE * CHUNK_SIZE

      // バイオームマップ
      const biomeDataLength = view.getUint32(offset)
      offset += 4
      const biomeData = data.slice(offset, offset + biomeDataLength)
      offset += biomeDataLength

      const biomeMap = yield* deserializeBiomeMap(biomeData)

      // ライトマップ
      const lightDataSize = Math.ceil(BLOCKS_PER_CHUNK * 3 / 2) // 4ビット×3種類のライト
      const lightData = data.slice(offset, offset + lightDataSize)
      offset += lightDataSize

      const { lightMap, blockLightMap, skyLightMap } = unpackLightMaps(lightData)

      // メタデータ
      const lastModified = new Date(view.getFloat64(offset))
      offset += 8
      const isDirty = view.getUint8(offset) === 1
      offset += 1
      const needsLighting = view.getUint8(offset) === 1
      offset += 1

      return {
        coordinate: { x: coordX, z: coordZ },
        blocks: Array.from(blocks),
        heightMap,
        biomeMap,
        lightMap,
        blockLightMap,
        skyLightMap,
        entities: [], // エンティティは別途ロード
        tileEntities: new Map(),
        lastModified,
        isDirty,
        needsLighting,
        needsDecoration: false
      } as ChunkData
    })

  const updateChunkMetadata = (coordinate: ChunkCoordinate, update: Partial<ChunkMetadata>) =>
    Effect.gen(function* () {
      const metadataPath = `${WORLD_DIRECTORY}/${CHUNK_DIRECTORY}/${METADATA_FILE}`

      let metadata = {}
      const exists = yield* fileSystem.fileExists(metadataPath)

      if (exists) {
        const content = yield* fileSystem.readFile(metadataPath)
        metadata = JSON.parse(new TextDecoder().decode(content))
      }

      const key = `${coordinate.x},${coordinate.z}`
      metadata[key] = { ...metadata[key], ...update }

      const updatedContent = new TextEncoder().encode(JSON.stringify(metadata, null, 2))
      yield* fileSystem.writeFile(metadataPath, updatedContent)
    })

  const removeChunkMetadata = (coordinate: ChunkCoordinate) =>
    Effect.gen(function* () {
      const metadataPath = `${WORLD_DIRECTORY}/${CHUNK_DIRECTORY}/${METADATA_FILE}`
      const exists = yield* fileSystem.fileExists(metadataPath)

      if (!exists) return

      const content = yield* fileSystem.readFile(metadataPath)
      const metadata = JSON.parse(new TextDecoder().decode(content))

      const key = `${coordinate.x},${coordinate.z}`
      delete metadata[key]

      const updatedContent = new TextEncoder().encode(JSON.stringify(metadata, null, 2))
      yield* fileSystem.writeFile(metadataPath, updatedContent)
    })

  return ChunkStorageService.of({
    saveChunk,
    loadChunk,
    deleteChunk,
    chunkExists,
    getChunkMetadata,
    compactStorage
  })
})

// Live Layer
export const ChunkStorageServiceLive = Layer.effect(
  ChunkStorageService,
  makeChunkStorageService
).pipe(
  Layer.provide(FileSystemServiceLive),
  Layer.provide(CompressionServiceLive),
  Layer.provide(EncryptionServiceLive)
)

// ヘルパー関数とコンスタント
const CHUNK_DATA_VERSION = 1
const BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE

const calculateChunkDataSize = (chunkData: ChunkData): number => {
  // ヘッダー + 座標 + 圧縮ブロック + 高度マップ + バイオーム + ライト + メタデータ
  return 4 + 8 + (chunkData.blocks.length * 2) + (CHUNK_SIZE * CHUNK_SIZE) + 1024 + (BLOCKS_PER_CHUNK * 2) + 16
}

const compressBlockData = (blocks: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    // Run-Length Encoding
    const compressed: number[] = []
    let currentBlock = blocks[0]
    let count = 1

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i] === currentBlock && count < 255) {
        count++
      } else {
        compressed.push(currentBlock, count)
        currentBlock = blocks[i]
        count = 1
      }
    }

    compressed.push(currentBlock, count)
    return new Uint16Array(compressed)
  })

const decompressBlockData = (compressedData: Uint8Array) =>
  Effect.gen(function* () {
    const view = new DataView(compressedData.buffer, compressedData.byteOffset)
    const blocks = new Uint16Array(BLOCKS_PER_CHUNK)
    let blockIndex = 0
    let dataOffset = 0

    while (dataOffset < compressedData.length && blockIndex < BLOCKS_PER_CHUNK) {
      const blockType = view.getUint16(dataOffset)
      dataOffset += 2
      const count = view.getUint16(dataOffset)
      dataOffset += 2

      for (let i = 0; i < count && blockIndex < BLOCKS_PER_CHUNK; i++) {
        blocks[blockIndex++] = blockType
      }
    }

    return blocks
  })

// 型定義
interface ChunkMetadata {
  readonly lastSaved?: Date
  readonly lastAccessed?: Date
  readonly fileSize?: number
  readonly version?: number
  readonly checksum?: string
}

class ChunkNotFoundError {
  readonly _tag = "ChunkNotFoundError"
  constructor(public readonly coordinate: ChunkCoordinate) {}
}

class ChunkVersionMismatchError {
  readonly _tag = "ChunkVersionMismatchError"
  constructor(public readonly found: number, public readonly expected: number) {}
}
```

## 非同期チャンク生成 (WebWorker活用)

### WebWorker Chunk Generation

大規模な世界では、チャンク生成がメインスレッドをブロックすることを避けるため、WebWorkerを活用した非同期生成システムを実装します。

```typescript
// chunk-worker.ts - WebWorkerで実行されるチャンク生成
export const ChunkWorkerService = Context.GenericTag<{
  readonly generateChunk: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly generateMultipleChunks: (requests: ReadonlyArray<ChunkGenerationRequest>) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkGenerationError>
  readonly terminateWorker: () => Effect.Effect<void, never>
}>()("ChunkWorkerService")

interface ChunkGenerationRequest {
  readonly coordinate: ChunkCoordinate
  readonly seed: number
  readonly priority: number
  readonly biomeConfig?: BiomeConfiguration
}

// WebWorker内でのチャンク生成実装
const workerChunkGenerator = Effect.gen(function* () {
  const noiseGenerator = yield* NoiseGenerator

  return {
    generateChunk: (coordinate: ChunkCoordinate, seed: number) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 地形生成
        const heightMap = yield* generateHeightMap(coordinate, seed, noiseGenerator)
        const biomeMap = yield* generateBiomeMap(coordinate, seed, noiseGenerator)
        const blocks = yield* generateBlocks(coordinate, heightMap, biomeMap, noiseGenerator)

        // ライティング計算
        const { skyLightMap, blockLightMap } = yield* calculateLighting(blocks, heightMap)

        const generationTime = performance.now() - startTime

        return {
          coordinate,
          blocks,
          heightMap,
          biomeMap,
          lightMap: skyLightMap,
          blockLightMap,
          skyLightMap,
          entities: [],
          tileEntities: new Map(),
          lastModified: new Date(),
          isDirty: false,
          needsLighting: false,
          needsDecoration: true,
          generationTime
        } as ChunkData
      })
  }
})

// メインスレッド側のワーカー管理
export const ChunkWorkerManager = Context.GenericTag<{
  readonly initializeWorkerPool: (poolSize: number) => Effect.Effect<void, WorkerInitError>
  readonly generateChunkAsync: (coordinate: ChunkCoordinate, seed: number) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly generateChunkBatch: (requests: ReadonlyArray<ChunkGenerationRequest>) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkGenerationError>
  readonly getWorkerStats: () => Effect.Effect<WorkerPoolStats, never>
}>()("ChunkWorkerManager")

interface WorkerPoolStats {
  readonly totalWorkers: number
  readonly activeWorkers: number
  readonly queuedTasks: number
  readonly completedTasks: number
  readonly averageGenerationTime: number
  readonly errorRate: number
}

export const ChunkWorkerManagerLive = Layer.effect(
  ChunkWorkerManager,
  Effect.gen(function* () {
    const workers = new Array<Worker>()
    const taskQueue = new Array<ChunkGenerationTask>()
    const activeTasksMap = new Map<string, ChunkGenerationTask>()
    const statsRef = yield* Ref.make<WorkerPoolStats>({
      totalWorkers: 0,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      averageGenerationTime: 0,
      errorRate: 0
    })

    const initializeWorkerPool = (poolSize: number) =>
      Effect.gen(function* () {
        for (let i = 0; i < poolSize; i++) {
          const worker = new Worker(new URL('./chunk-worker.js', import.meta.url))

          worker.onmessage = (event) => {
            const { taskId, result, error } = event.data
            const task = activeTasksMap.get(taskId)

            if (task) {
              if (error) {
                task.deferred.reject(new ChunkGenerationError(error))
              } else {
                task.deferred.resolve(result)
              }
              activeTasksMap.delete(taskId)

              // 次のタスクを処理
              processNextTask(worker)
            }
          }

          worker.onerror = (error) => {
            console.error('Chunk worker error:', error)
          }

          workers.push(worker)
        }

        yield* Ref.update(statsRef, stats => ({ ...stats, totalWorkers: poolSize }))
      })

    const processNextTask = (worker: Worker) => {
      const nextTask = taskQueue.shift()
      if (nextTask) {
        activeTasksMap.set(nextTask.id, nextTask)
        worker.postMessage({
          taskId: nextTask.id,
          coordinate: nextTask.coordinate,
          seed: nextTask.seed,
          config: nextTask.config
        })
      }
    }

    const generateChunkAsync = (coordinate: ChunkCoordinate, seed: number) =>
      Effect.gen(function* () {
        const taskId = `${coordinate.x}_${coordinate.z}_${Date.now()}`
        const deferred = new Deferred<ChunkData>()

        const task: ChunkGenerationTask = {
          id: taskId,
          coordinate,
          seed,
          priority: 0,
          deferred,
          createdAt: new Date()
        }

        taskQueue.push(task)

        // 空いているワーカーがあればすぐに処理開始
        const availableWorker = workers.find(w => !activeTasksMap.has(w.toString()))
        if (availableWorker) {
          processNextTask(availableWorker)
        }

        return yield* Effect.promise(() => deferred.promise)
      })

    const generateChunkBatch = (requests: ReadonlyArray<ChunkGenerationRequest>) =>
      Effect.gen(function* () {
        // 優先度順にソート
        const sortedRequests = [...requests].sort((a, b) => b.priority - a.priority)

        const results = yield* Effect.all(
          sortedRequests.map(req =>
            generateChunkAsync(req.coordinate, req.seed)
          ),
          { concurrency: workers.length }
        )

        return results
      })

    const getWorkerStats = () =>
      Effect.gen(function* () {
        const stats = yield* Ref.get(statsRef)
        return {
          ...stats,
          activeWorkers: activeTasksMap.size,
          queuedTasks: taskQueue.length
        }
      })

    return {
      initializeWorkerPool,
      generateChunkAsync,
      generateChunkBatch,
      getWorkerStats
    }
  })
)

interface ChunkGenerationTask {
  readonly id: string
  readonly coordinate: ChunkCoordinate
  readonly seed: number
  readonly priority: number
  readonly deferred: Deferred<ChunkData>
  readonly createdAt: Date
  readonly config?: BiomeConfiguration
}

class Deferred<T> {
  public promise: Promise<T>
  public resolve!: (value: T) => void
  public reject!: (reason: any) => void

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}
```

### Predictive Chunk Loading - 予測ローディング

プレイヤーの移動パターンを分析し、必要になる前にチャンクを事前ロードします。

```typescript
export const PredictiveChunkLoader = Context.GenericTag<{
  readonly startPrediction: (playerId: string) => Effect.Effect<void, never>
  readonly updatePlayerPosition: (playerId: string, position: Vector3D, velocity: Vector3D) => Effect.Effect<void, never>
  readonly getPredictedChunks: (playerId: string) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>
  readonly optimizePrediction: () => Effect.Effect<void, never>
}>()("PredictiveChunkLoader")

interface PlayerMovementData {
  readonly playerId: string
  readonly currentPosition: Vector3D
  readonly velocity: Vector3D
  readonly direction: number  // 移動方向（ラジアン）
  readonly speed: number
  readonly lastPositions: ReadonlyArray<Vector3D>  // 過去の位置履歴
  readonly predictedPosition: Vector3D  // 予測位置
  readonly confidence: number  // 予測精度 (0-1)
}

export const PredictiveChunkLoaderLive = Layer.effect(
  PredictiveChunkLoader,
  Effect.gen(function* () {
    const playerDataRef = yield* Ref.make(new Map<string, PlayerMovementData>())
    const chunkLoader = yield* ChunkLoadingManager
    const workerManager = yield* ChunkWorkerManager

    // 移動パターン分析
    const analyzeMovementPattern = (positions: ReadonlyArray<Vector3D>) => {
      if (positions.length < 2) return { direction: 0, speed: 0, confidence: 0 }

      const recent = positions.slice(-5)  // 最新5ポイント
      let totalDistance = 0
      let directionSum = 0

      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1]
        const curr = recent[i]

        const dx = curr.x - prev.x
        const dz = curr.z - prev.z
        const distance = Math.sqrt(dx * dx + dz * dz)
        const direction = Math.atan2(dz, dx)

        totalDistance += distance
        directionSum += direction
      }

      const averageDirection = directionSum / (recent.length - 1)
      const averageSpeed = totalDistance / (recent.length - 1)
      const confidence = Math.min(recent.length / 10, 1)  // より多くのデータで信頼度向上

      return { direction: averageDirection, speed: averageSpeed, confidence }
    }

    // 予測位置の計算
    const predictFuturePosition = (
      currentPosition: Vector3D,
      velocity: Vector3D,
      lookAheadTime: number
    ): Vector3D => ({
      x: currentPosition.x + velocity.x * lookAheadTime,
      y: currentPosition.y + velocity.y * lookAheadTime,
      z: currentPosition.z + velocity.z * lookAheadTime
    })

    // 予測チャンクの算出
    const calculatePredictedChunks = (
      currentPosition: Vector3D,
      predictedPosition: Vector3D,
      confidence: number
    ): ReadonlyArray<ChunkCoordinate> => {
      const currentChunk = {
        x: Math.floor(currentPosition.x / CHUNK_SIZE),
        z: Math.floor(currentPosition.z / CHUNK_SIZE)
      }

      const predictedChunk = {
        x: Math.floor(predictedPosition.x / CHUNK_SIZE),
        z: Math.floor(predictedPosition.z / CHUNK_SIZE)
      }

      // 現在のチャンクから予測チャンクまでのパスを計算
      const chunks: ChunkCoordinate[] = []
      const dx = predictedChunk.x - currentChunk.x
      const dz = predictedChunk.z - currentChunk.z
      const steps = Math.max(Math.abs(dx), Math.abs(dz))

      for (let i = 0; i <= steps; i++) {
        const ratio = steps === 0 ? 0 : i / steps
        const chunkX = Math.floor(currentChunk.x + dx * ratio)
        const chunkZ = Math.floor(currentChunk.z + dz * ratio)

        // 信頼度に基づいて周囲チャンクも含める
        const radius = Math.floor(confidence * 2) + 1
        for (let ox = -radius; ox <= radius; ox++) {
          for (let oz = -radius; oz <= radius; oz++) {
            chunks.push({ x: chunkX + ox, z: chunkZ + oz })
          }
        }
      }

      // 重複除去
      const uniqueChunks = chunks.filter((chunk, index, self) =>
        index === self.findIndex(c => c.x === chunk.x && c.z === chunk.z)
      )

      return uniqueChunks
    }

    const updatePlayerPosition = (playerId: string, position: Vector3D, velocity: Vector3D) =>
      Effect.gen(function* () {
        const playerData = yield* Ref.get(playerDataRef)
        const currentData = playerData.get(playerId)

        const newPositions = currentData
          ? [...currentData.lastPositions.slice(-19), position]  // 最新20ポイント保持
          : [position]

        const pattern = analyzeMovementPattern(newPositions)
        const predictedPosition = predictFuturePosition(position, velocity, 5) // 5秒先を予測

        const updatedData: PlayerMovementData = {
          playerId,
          currentPosition: position,
          velocity,
          direction: pattern.direction,
          speed: pattern.speed,
          lastPositions: newPositions,
          predictedPosition,
          confidence: pattern.confidence
        }

        yield* Ref.update(playerDataRef, data =>
          new Map(data).set(playerId, updatedData)
        )

        // 高信頼度の予測の場合、事前ロードを開始
        if (pattern.confidence > 0.7) {
          const predictedChunks = calculatePredictedChunks(
            position,
            predictedPosition,
            pattern.confidence
          )

          // 既にロードされていないチャンクのみを事前ロード
          const unloadedChunks = predictedChunks.filter(coord => {
            // ここで既存のロード状況をチェック
            return true  // 簡略化
          })

          if (unloadedChunks.length > 0) {
            // バックグラウンドで低優先度ロード
            Effect.fork(
              workerManager.generateChunkBatch(
                unloadedChunks.map(coord => ({
                  coordinate: coord,
                  seed: 12345,  // 実際のワールドシードを使用
                  priority: Math.floor(pattern.confidence * 50)  // 信頼度ベースの優先度
                }))
              )
            )
          }
        }
      })

    const getPredictedChunks = (playerId: string) =>
      Effect.gen(function* () {
        const playerData = yield* Ref.get(playerDataRef)
        const data = playerData.get(playerId)

        if (!data || data.confidence < 0.3) {
          return []
        }

        return calculatePredictedChunks(
          data.currentPosition,
          data.predictedPosition,
          data.confidence
        )
      })

    const startPrediction = (playerId: string) =>
      Effect.gen(function* () {
        // 予測システムの初期化
        yield* Ref.update(playerDataRef, data =>
          new Map(data).set(playerId, {
            playerId,
            currentPosition: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            direction: 0,
            speed: 0,
            lastPositions: [],
            predictedPosition: { x: 0, y: 0, z: 0 },
            confidence: 0
          })
        )
      })

    const optimizePrediction = () =>
      Effect.gen(function* () {
        // 古い予測データのクリーンアップ
        // パフォーマンス統計の更新
        // 予測精度の調整
        const playerData = yield* Ref.get(playerDataRef)

        // 5分以上更新されていないプレイヤーデータを削除
        const cutoffTime = Date.now() - 5 * 60 * 1000
        const activeData = new Map()

        for (const [id, data] of playerData) {
          // データの最終更新時刻をチェック（簡略化）
          activeData.set(id, data)
        }

        yield* Ref.set(playerDataRef, activeData)
      })

    return {
      startPrediction,
      updatePlayerPosition,
      getPredictedChunks,
      optimizePrediction
    }
  })
)
```

## ネットワーク同期 (マルチプレイヤー対応)

### Network Chunk Synchronization

マルチプレイヤー環境でのチャンク同期を効率的に行うシステムです。

```typescript
export const NetworkChunkSyncService = Context.GenericTag<{
  readonly synchronizeChunk: (chunk: ChunkData, targetPlayers: ReadonlyArray<string>) => Effect.Effect<void, NetworkError>
  readonly handleChunkUpdate: (update: ChunkUpdateMessage) => Effect.Effect<void, ChunkSyncError>
  readonly requestChunkFromServer: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, NetworkError>
  readonly broadcastChunkChange: (change: ChunkChange) => Effect.Effect<void, NetworkError>
  readonly optimizeNetworkTraffic: () => Effect.Effect<NetworkOptimizationStats, never>
}>()("NetworkChunkSyncService")

interface ChunkUpdateMessage {
  readonly type: "chunk_data" | "chunk_update" | "chunk_unload"
  readonly coordinate: ChunkCoordinate
  readonly data?: ChunkData
  readonly changes?: ReadonlyArray<BlockChange>
  readonly timestamp: number
  readonly senderId: string
}

interface BlockChange {
  readonly position: LocalBlockPosition
  readonly oldBlockType: BlockType
  readonly newBlockType: BlockType
  readonly timestamp: number
  readonly playerId: string
}

interface ChunkChange {
  readonly coordinate: ChunkCoordinate
  readonly changes: ReadonlyArray<BlockChange>
  readonly affectedPlayers: ReadonlyArray<string>
}

interface NetworkOptimizationStats {
  readonly totalBytesSent: number
  readonly totalBytesReceived: number
  readonly compressionRatio: number
  readonly avgLatency: number
  readonly duplicateMessages: number
  readonly optimizationsSaved: number
}

export const NetworkChunkSyncServiceLive = Layer.effect(
  NetworkChunkSyncService,
  Effect.gen(function* () {
    const networkStatsRef = yield* Ref.make<NetworkOptimizationStats>({
      totalBytesSent: 0,
      totalBytesReceived: 0,
      compressionRatio: 0,
      avgLatency: 0,
      duplicateMessages: 0,
      optimizationsSaved: 0
    })

    const recentMessagesRef = yield* Ref.make(new Map<string, number>()) // メッセージ重複チェック
    const playerChunkSubscriptions = yield* Ref.make(new Map<string, Set<string>>()) // プレイヤーごとの購読チャンク

    // チャンクデータの差分圧縮
    const compressChunkData = (chunk: ChunkData, previousChunk?: ChunkData): Uint8Array => {
      if (!previousChunk) {
        // 初回送信時は全データを圧縮
        return new Uint8Array()  // 実装簡略化
      }

      // 差分のみを抽出して圧縮
      const changes: BlockChange[] = []
      for (let i = 0; i < chunk.blocks.length; i++) {
        if (chunk.blocks[i] !== previousChunk.blocks[i]) {
          const x = i % CHUNK_SIZE
          const z = Math.floor((i % (CHUNK_SIZE * CHUNK_SIZE)) / CHUNK_SIZE)
          const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE))

          changes.push({
            position: { x, y, z },
            oldBlockType: previousChunk.blocks[i] as BlockType,
            newBlockType: chunk.blocks[i] as BlockType,
            timestamp: Date.now(),
            playerId: "system"
          })
        }
      }

      return new Uint8Array()  // 実装簡略化
    }

    // ネットワーク帯域に基づく最適化
    const optimizeForBandwidth = (
      chunk: ChunkData,
      targetPlayers: ReadonlyArray<string>,
      bandwidthLimit: number
    ): Effect.Effect<ReadonlyArray<ChunkUpdateMessage>, never> =>
      Effect.gen(function* () {
        const messages: ChunkUpdateMessage[] = []

        // プレイヤーごとの距離と帯域制限を考慮
        for (const playerId of targetPlayers) {
          // 距離ベースのLOD調整
          const playerChunk = { x: 0, z: 0 } // プレイヤー位置から算出
          const distance = Math.sqrt(
            Math.pow(chunk.coordinate.x - playerChunk.x, 2) +
            Math.pow(chunk.coordinate.z - playerChunk.z, 2)
          )

          const lodLevel = distance > 8 ? 3 : distance > 4 ? 2 : distance > 2 ? 1 : 0
          const optimizedChunk = applyLOD(chunk, lodLevel)

          messages.push({
            type: "chunk_data",
            coordinate: chunk.coordinate,
            data: optimizedChunk,
            timestamp: Date.now(),
            senderId: "server"
          })
        }

        return messages
      })

    const applyLOD = (chunk: ChunkData, lodLevel: number): ChunkData => {
      // LODレベルに応じてデータを間引き
      if (lodLevel === 0) return chunk

      const stride = Math.pow(2, lodLevel)
      const reducedBlocks = new Array(Math.floor(chunk.blocks.length / (stride * stride * stride)))

      // 簡略化された間引き処理
      for (let i = 0; i < reducedBlocks.length; i++) {
        reducedBlocks[i] = chunk.blocks[i * stride * stride * stride] || 0
      }

      return {
        ...chunk,
        blocks: reducedBlocks
      }
    }

    const synchronizeChunk = (chunk: ChunkData, targetPlayers: ReadonlyArray<string>) =>
      Effect.gen(function* () {
        const messages = yield* optimizeForBandwidth(chunk, targetPlayers, 1024 * 1024) // 1MB制限

        for (const message of messages) {
          const compressed = compressChunkData(message.data!)
          const messageSize = compressed.length

          // 送信統計の更新
          yield* Ref.update(networkStatsRef, stats => ({
            ...stats,
            totalBytesSent: stats.totalBytesSent + messageSize
          }))

          // 実際の送信処理（WebSocketやWebRTC経由）
          // yield* sendToPlayer(message.senderId, message)
        }
      })

    const handleChunkUpdate = (update: ChunkUpdateMessage) =>
      Effect.gen(function* () {
        // 重複メッセージのチェック
        const messageId = `${update.coordinate.x}_${update.coordinate.z}_${update.timestamp}`
        const recentMessages = yield* Ref.get(recentMessagesRef)

        if (recentMessages.has(messageId)) {
          yield* Ref.update(networkStatsRef, stats => ({
            ...stats,
            duplicateMessages: stats.duplicateMessages + 1
          }))
          return
        }

        // メッセージIDを記録（5秒間保持）
        yield* Ref.update(recentMessagesRef, messages =>
          new Map(messages).set(messageId, Date.now() + 5000)
        )

        // チャンクデータの処理
        pipe(
          update.type,
          Match.value,
          Match.when("chunk_data", () =>
            Effect.gen(function* () {
              if (update.data) {
                const chunkManager = yield* ChunkLoadingManager
                yield* chunkManager.updateChunk(update.data)
              }
            })
          ),
          Match.when("chunk_update", () =>
            Effect.gen(function* () {
              if (update.changes) {
                // 個別ブロック変更の適用
                for (const change of update.changes) {
                  // yield* applyBlockChange(update.coordinate, change)
                }
              }
            })
          ),
          Match.when("chunk_unload", () =>
            Effect.gen(function* () {
              const chunkManager = yield* ChunkLoadingManager
              yield* chunkManager.unloadChunk(update.coordinate)
            })
          ),
          Match.exhaustive
        )
      })

    const requestChunkFromServer = (coordinate: ChunkCoordinate) =>
      Effect.gen(function* () {
        const request = {
          type: "chunk_request" as const,
          coordinate,
          timestamp: Date.now(),
          senderId: "client"
        }

        // サーバーにリクエスト送信
        // const response = yield* sendRequest(request)

        // 応答の解析とチャンクデータの復元
        return {
          coordinate,
          blocks: new Array(BLOCKS_PER_CHUNK).fill(0),
          heightMap: new Array(CHUNK_SIZE * CHUNK_SIZE).fill(64),
          biomeMap: new Array(CHUNK_SIZE * CHUNK_SIZE).fill("plains"),
          lightMap: new Array(BLOCKS_PER_CHUNK).fill(15),
          blockLightMap: new Array(BLOCKS_PER_CHUNK).fill(0),
          skyLightMap: new Array(BLOCKS_PER_CHUNK).fill(15),
          entities: [],
          tileEntities: new Map(),
          lastModified: new Date(),
          isDirty: false,
          needsLighting: false,
          needsDecoration: false
        } as ChunkData
      })

    const broadcastChunkChange = (change: ChunkChange) =>
      Effect.gen(function* () {
        const subscriptions = yield* Ref.get(playerChunkSubscriptions)
        const chunkKey = `${change.coordinate.x}_${change.coordinate.z}`

        // 該当チャンクを購読しているプレイヤーを特定
        const affectedPlayers = new Set<string>()
        for (const [playerId, subscribedChunks] of subscriptions) {
          if (subscribedChunks.has(chunkKey)) {
            affectedPlayers.add(playerId)
          }
        }

        // 変更メッセージの作成と送信
        const updateMessage: ChunkUpdateMessage = {
          type: "chunk_update",
          coordinate: change.coordinate,
          changes: change.changes,
          timestamp: Date.now(),
          senderId: "server"
        }

        for (const playerId of affectedPlayers) {
          // yield* sendToPlayer(playerId, updateMessage)
        }
      })

    const optimizeNetworkTraffic = () =>
      Effect.gen(function* () {
        const stats = yield* Ref.get(networkStatsRef)

        // 古いメッセージIDのクリーンアップ
        const now = Date.now()
        yield* Ref.update(recentMessagesRef, messages => {
          const cleaned = new Map()
          for (const [id, expiry] of messages) {
            if (expiry > now) {
              cleaned.set(id, expiry)
            }
          }
          return cleaned
        })

        return stats
      })

    return {
      synchronizeChunk,
      handleChunkUpdate,
      requestChunkFromServer,
      broadcastChunkChange,
      optimizeNetworkTraffic
    }
  })
)
```

## デバッグとモニタリング機能

### Advanced Chunk Debug System

開発とプロダクション環境でのチャンクシステムの詳細な監視とデバッグ機能を提供します。

```typescript
export const ChunkDebugService = Context.GenericTag<{
  readonly enableDebugMode: (level: DebugLevel) => Effect.Effect<void, never>
  readonly logChunkOperation: (operation: ChunkOperation) => Effect.Effect<void, never>
  readonly getChunkMetrics: () => Effect.Effect<ChunkSystemMetrics, never>
  readonly generateDebugReport: () => Effect.Effect<DebugReport, never>
  readonly visualizeChunkStates: () => Effect.Effect<ChunkVisualization, never>
  readonly detectAnomalies: () => Effect.Effect<ReadonlyArray<ChunkAnomaly>, never>
  readonly exportTelemetryData: (timeRange: TimeRange) => Effect.Effect<TelemetryData, never>
}>()("ChunkDebugService")

type DebugLevel = "off" | "basic" | "detailed" | "verbose"

interface ChunkOperation {
  readonly type: "generate" | "load" | "unload" | "mesh" | "update" | "save"
  readonly coordinate: ChunkCoordinate
  readonly timestamp: number
  readonly duration: number
  readonly memoryBefore: number
  readonly memoryAfter: number
  readonly error?: string
  readonly metadata?: Record<string, unknown>
}

interface ChunkSystemMetrics {
  readonly totalChunks: number
  readonly loadedChunks: number
  readonly activeChunks: number
  readonly generatingChunks: number
  readonly memoryUsageMB: number
  readonly diskUsageMB: number
  readonly averageLoadTime: number
  readonly averageGenerationTime: number
  readonly cacheHitRate: number
  readonly networkBandwidthUsage: number
  readonly errorRate: number
  readonly performanceScore: number
}

interface DebugReport {
  readonly timestamp: Date
  readonly systemMetrics: ChunkSystemMetrics
  readonly recentOperations: ReadonlyArray<ChunkOperation>
  readonly performanceBottlenecks: ReadonlyArray<PerformanceBottleneck>
  readonly memoryLeaks: ReadonlyArray<MemoryLeak>
  readonly optimizationSuggestions: ReadonlyArray<OptimizationSuggestion>
  readonly errorSummary: ErrorSummary
}

interface ChunkVisualization {
  readonly loadedChunksGrid: ReadonlyArray<ReadonlyArray<ChunkState>>
  readonly memoryHeatMap: ReadonlyArray<ReadonlyArray<number>>
  readonly performanceHeatMap: ReadonlyArray<ReadonlyArray<number>>
  readonly networkTrafficMap: ReadonlyArray<ReadonlyArray<number>>
}

type ChunkState = "unloaded" | "loading" | "loaded" | "active" | "generating" | "error"

interface ChunkAnomaly {
  readonly type: "memory_leak" | "performance_degradation" | "corruption" | "network_issue"
  readonly severity: "low" | "medium" | "high" | "critical"
  readonly coordinate?: ChunkCoordinate
  readonly description: string
  readonly detectedAt: Date
  readonly suggestedAction: string
}

export const ChunkDebugServiceLive = Layer.effect(
  ChunkDebugService,
  Effect.gen(function* () {
    const debugLevelRef = yield* Ref.make<DebugLevel>("off")
    const operationLogRef = yield* Ref.make<ReadonlyArray<ChunkOperation>>([])
    const metricsHistoryRef = yield* Ref.make<ReadonlyArray<ChunkSystemMetrics>>([])
    const anomalyDetectorRef = yield* Ref.make<Map<string, number>>(new Map())

    const enableDebugMode = (level: DebugLevel) =>
      Effect.gen(function* () {
        yield* Ref.set(debugLevelRef, level)

        if (level !== "off") {
          // デバッグモード開始時の初期設定
          console.log(`[ChunkDebug] Debug mode enabled: ${level}`)

          // パフォーマンス監視の開始
          yield* Effect.fork(startPerformanceMonitoring())
        }
      })

    const startPerformanceMonitoring = () =>
      Effect.gen(function* () {
        const interval = 5000 // 5秒間隔

        yield* Effect.forever(
          Effect.gen(function* () {
            const metrics = yield* collectSystemMetrics()

            yield* Ref.update(metricsHistoryRef, history => {
              const newHistory = [...history, metrics]
              return newHistory.slice(-1000) // 最新1000件を保持
            })

            // 異常検知
            yield* detectPerformanceAnomalies(metrics)

            yield* Effect.sleep(interval)
          })
        )
      })

    const collectSystemMetrics = (): Effect.Effect<ChunkSystemMetrics, never> =>
      Effect.gen(function* () {
        const chunkManager = yield* ChunkLoadingManager
        const loadedChunks = yield* chunkManager.getLoadedChunks()

        const memoryUsage = loadedChunks.reduce((sum, chunk) => sum + chunk.memoryUsage, 0)
        const activeChunks = loadedChunks.filter(chunk => chunk.loadState === "active").length
        const generatingChunks = loadedChunks.filter(chunk => chunk.generationState === "generating").length

        // パフォーマンス統計の算出
        const recentOps = yield* Ref.get(operationLogRef)
        const loadOps = recentOps.filter(op => op.type === "load" && op.timestamp > Date.now() - 60000)
        const genOps = recentOps.filter(op => op.type === "generate" && op.timestamp > Date.now() - 60000)

        const avgLoadTime = loadOps.length > 0
          ? loadOps.reduce((sum, op) => sum + op.duration, 0) / loadOps.length
          : 0

        const avgGenTime = genOps.length > 0
          ? genOps.reduce((sum, op) => sum + op.duration, 0) / genOps.length
          : 0

        const errorCount = recentOps.filter(op => op.error && op.timestamp > Date.now() - 60000).length
        const errorRate = recentOps.length > 0 ? errorCount / recentOps.length : 0

        return {
          totalChunks: loadedChunks.length,
          loadedChunks: loadedChunks.filter(chunk => chunk.loadState === "loaded").length,
          activeChunks,
          generatingChunks,
          memoryUsageMB: memoryUsage / (1024 * 1024),
          diskUsageMB: 0, // 実装簡略化
          averageLoadTime: avgLoadTime,
          averageGenerationTime: avgGenTime,
          cacheHitRate: 0, // 実装簡略化
          networkBandwidthUsage: 0, // 実装簡略化
          errorRate,
          performanceScore: calculatePerformanceScore(avgLoadTime, avgGenTime, errorRate)
        }
      })

    const calculatePerformanceScore = (
      avgLoadTime: number,
      avgGenTime: number,
      errorRate: number
    ): number => {
      let score = 100

      // ロード時間によるペナルティ
      if (avgLoadTime > 100) score -= 20
      if (avgLoadTime > 200) score -= 30

      // 生成時間によるペナルティ
      if (avgGenTime > 50) score -= 15
      if (avgGenTime > 100) score -= 25

      // エラー率によるペナルティ
      score -= errorRate * 50

      return Math.max(0, score)
    }

    const detectPerformanceAnomalies = (metrics: ChunkSystemMetrics) =>
      Effect.gen(function* () {
        const anomalies: ChunkAnomaly[] = []

        // メモリ使用量の異常検知
        if (metrics.memoryUsageMB > 1000) {
          anomalies.push({
            type: "memory_leak",
            severity: "high",
            description: `メモリ使用量が異常に高い: ${metrics.memoryUsageMB.toFixed(1)}MB`,
            detectedAt: new Date(),
            suggestedAction: "不要なチャンクのアンロードまたはガベージコレクションの実行"
          })
        }

        // パフォーマンス劣化の検知
        if (metrics.averageLoadTime > 200) {
          anomalies.push({
            type: "performance_degradation",
            severity: "medium",
            description: `チャンクロード時間が遅い: ${metrics.averageLoadTime.toFixed(1)}ms`,
            detectedAt: new Date(),
            suggestedAction: "ロード処理の最適化またはキャッシュサイズの調整"
          })
        }

        // エラー率の異常検知
        if (metrics.errorRate > 0.1) {
          anomalies.push({
            type: "corruption",
            severity: "critical",
            description: `エラー率が高い: ${(metrics.errorRate * 100).toFixed(1)}%`,
            detectedAt: new Date(),
            suggestedAction: "チャンクデータの整合性チェックとエラーログの詳細調査"
          })
        }

        // 異常をログに記録
        for (const anomaly of anomalies) {
          console.warn(`[ChunkDebug] Anomaly detected:`, anomaly)
        }
      })

    const logChunkOperation = (operation: ChunkOperation) =>
      Effect.gen(function* () {
        const debugLevel = yield* Ref.get(debugLevelRef)

        if (debugLevel === "off") return

        yield* Ref.update(operationLogRef, log => {
          const newLog = [...log, operation]
          return newLog.slice(-10000) // 最新10000件を保持
        })

        // 詳細ログ出力
        if (debugLevel === "verbose") {
          console.log(`[ChunkDebug] ${operation.type}:`, {
            coordinate: operation.coordinate,
            duration: `${operation.duration}ms`,
            memory: `${operation.memoryBefore} -> ${operation.memoryAfter}`,
            error: operation.error || "none"
          })
        }
      })

    const generateDebugReport = (): Effect.Effect<DebugReport, never> =>
      Effect.gen(function* () {
        const metrics = yield* collectSystemMetrics()
        const recentOps = yield* Ref.get(operationLogRef)
        const last1000Ops = recentOps.slice(-1000)

        // パフォーマンスボトルネックの分析
        const bottlenecks = analyzePerformanceBottlenecks(last1000Ops)

        // メモリリークの検出
        const memoryLeaks = detectMemoryLeaks(last1000Ops)

        // 最適化提案の生成
        const suggestions = generateOptimizationSuggestions(metrics, last1000Ops)

        // エラーサマリーの作成
        const errorSummary = createErrorSummary(last1000Ops)

        return {
          timestamp: new Date(),
          systemMetrics: metrics,
          recentOperations: last1000Ops,
          performanceBottlenecks: bottlenecks,
          memoryLeaks,
          optimizationSuggestions: suggestions,
          errorSummary
        }
      })

    const analyzePerformanceBottlenecks = (operations: ReadonlyArray<ChunkOperation>) => {
      const bottlenecks: PerformanceBottleneck[] = []

      // 操作タイプ別の平均時間
      const opsByType = operations.reduce((acc, op) => {
        if (!acc[op.type]) acc[op.type] = []
        acc[op.type].push(op.duration)
        return acc
      }, {} as Record<string, number[]>)

      for (const [type, durations] of Object.entries(opsByType)) {
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
        const maxDuration = Math.max(...durations)

        if (avgDuration > getExpectedDuration(type)) {
          bottlenecks.push({
            operation: type as ChunkOperation["type"],
            avgDuration,
            maxDuration,
            occurrences: durations.length,
            severity: avgDuration > getExpectedDuration(type) * 2 ? "high" : "medium"
          })
        }
      }

      return bottlenecks
    }

    const getExpectedDuration = (operationType: string): number => {
      const expectations = {
        generate: 100,
        load: 50,
        unload: 10,
        mesh: 20,
        update: 5,
        save: 30
      }
      return expectations[operationType as keyof typeof expectations] || 50
    }

    const detectMemoryLeaks = (operations: ReadonlyArray<ChunkOperation>) => {
      const leaks: MemoryLeak[] = []

      // メモリ使用量の増加傾向を分析
      for (let i = 100; i < operations.length; i++) {
        const recentOps = operations.slice(i - 100, i)
        const memoryIncreases = recentOps.filter(op => op.memoryAfter > op.memoryBefore)

        if (memoryIncreases.length > 80) { // 80%以上でメモリ増加
          const avgIncrease = memoryIncreases.reduce((sum, op) =>
            sum + (op.memoryAfter - op.memoryBefore), 0) / memoryIncreases.length

          if (avgIncrease > 1024 * 1024) { // 1MB以上の平均増加
            leaks.push({
              detectedAt: new Date(operations[i].timestamp),
              averageIncrease: avgIncrease,
              affectedOperations: memoryIncreases.length,
              severity: "high"
            })
          }
        }
      }

      return leaks
    }

    const generateOptimizationSuggestions = (
      metrics: ChunkSystemMetrics,
      operations: ReadonlyArray<ChunkOperation>
    ) => {
      const suggestions: OptimizationSuggestion[] = []

      if (metrics.averageLoadTime > 100) {
        suggestions.push({
          type: "cache_optimization",
          priority: "high",
          description: "チャンクキャッシュサイズの増加を検討",
          estimatedImprovement: "ロード時間30%短縮"
        })
      }

      if (metrics.memoryUsageMB > 500) {
        suggestions.push({
          type: "memory_optimization",
          priority: "medium",
          description: "未使用チャンクの積極的なアンロード",
          estimatedImprovement: "メモリ使用量50%削減"
        })
      }

      const failedGens = operations.filter(op => op.type === "generate" && op.error).length
      if (failedGens > 10) {
        suggestions.push({
          type: "reliability_improvement",
          priority: "high",
          description: "チャンク生成エラーの調査と対策",
          estimatedImprovement: "エラー率90%削減"
        })
      }

      return suggestions
    }

    const createErrorSummary = (operations: ReadonlyArray<ChunkOperation>) => {
      const errors = operations.filter(op => op.error)
      const errorsByType = errors.reduce((acc, op) => {
        const errorType = op.error || "unknown"
        acc[errorType] = (acc[errorType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        totalErrors: errors.length,
        errorRate: operations.length > 0 ? errors.length / operations.length : 0,
        errorsByType,
        mostFrequentError: Object.keys(errorsByType).reduce((a, b) =>
          errorsByType[a] > errorsByType[b] ? a : b, "none"
        ),
        recentErrors: errors.slice(-10)
      }
    }

    const getChunkMetrics = () => collectSystemMetrics()

    const visualizeChunkStates = (): Effect.Effect<ChunkVisualization, never> =>
      Effect.gen(function* () {
        const chunkManager = yield* ChunkLoadingManager
        const loadedChunks = yield* chunkManager.getLoadedChunks()

        // グリッド範囲の決定（ロードされたチャンクを基準）
        const minX = Math.min(...loadedChunks.map(c => c.coordinate.x))
        const maxX = Math.max(...loadedChunks.map(c => c.coordinate.x))
        const minZ = Math.min(...loadedChunks.map(c => c.coordinate.z))
        const maxZ = Math.max(...loadedChunks.map(c => c.coordinate.z))

        const width = maxX - minX + 1
        const height = maxZ - minZ + 1

        // チャンク状態グリッドの構築
        const grid: ChunkState[][] = Array(height).fill(null).map(() =>
          Array(width).fill("unloaded" as ChunkState)
        )

        const memoryHeatMap: number[][] = Array(height).fill(null).map(() =>
          Array(width).fill(0)
        )

        for (const chunk of loadedChunks) {
          const x = chunk.coordinate.x - minX
          const z = chunk.coordinate.z - minZ

          if (x >= 0 && x < width && z >= 0 && z < height) {
            grid[z][x] = chunk.loadState as ChunkState
            memoryHeatMap[z][x] = chunk.memoryUsage / (1024 * 1024) // MB単位
          }
        }

        return {
          loadedChunksGrid: grid,
          memoryHeatMap,
          performanceHeatMap: memoryHeatMap, // 簡略化
          networkTrafficMap: memoryHeatMap   // 簡略化
        }
      })

    const detectAnomalies = (): Effect.Effect<ReadonlyArray<ChunkAnomaly>, never> =>
      Effect.gen(function* () {
        const metrics = yield* collectSystemMetrics()
        const anomalies: ChunkAnomaly[] = []

        // 各種異常の検知ロジック
        yield* detectPerformanceAnomalies(metrics)

        return anomalies
      })

    const exportTelemetryData = (timeRange: TimeRange) =>
      Effect.gen(function* () {
        const operations = yield* Ref.get(operationLogRef)
        const metricsHistory = yield* Ref.get(metricsHistoryRef)

        const filteredOps = operations.filter(op =>
          op.timestamp >= timeRange.start && op.timestamp <= timeRange.end
        )

        return {
          timeRange,
          operations: filteredOps,
          metrics: metricsHistory,
          summary: {
            totalOperations: filteredOps.length,
            averagePerformance: calculateAveragePerformance(filteredOps),
            errorRate: filteredOps.filter(op => op.error).length / filteredOps.length
          }
        }
      })

    const calculateAveragePerformance = (operations: ReadonlyArray<ChunkOperation>) => {
      if (operations.length === 0) return 0

      const totalDuration = operations.reduce((sum, op) => sum + op.duration, 0)
      return totalDuration / operations.length
    }

    return {
      enableDebugMode,
      logChunkOperation,
      getChunkMetrics,
      generateDebugReport,
      visualizeChunkStates,
      detectAnomalies,
      exportTelemetryData
    }
  })
)

// 型定義の追加
interface PerformanceBottleneck {
  readonly operation: ChunkOperation["type"]
  readonly avgDuration: number
  readonly maxDuration: number
  readonly occurrences: number
  readonly severity: "low" | "medium" | "high"
}

interface MemoryLeak {
  readonly detectedAt: Date
  readonly averageIncrease: number
  readonly affectedOperations: number
  readonly severity: "low" | "medium" | "high"
}

interface OptimizationSuggestion {
  readonly type: "cache_optimization" | "memory_optimization" | "network_optimization" | "reliability_improvement"
  readonly priority: "low" | "medium" | "high"
  readonly description: string
  readonly estimatedImprovement: string
}

interface ErrorSummary {
  readonly totalErrors: number
  readonly errorRate: number
  readonly errorsByType: Record<string, number>
  readonly mostFrequentError: string
  readonly recentErrors: ReadonlyArray<ChunkOperation>
}

interface TimeRange {
  readonly start: number
  readonly end: number
}

interface TelemetryData {
  readonly timeRange: TimeRange
  readonly operations: ReadonlyArray<ChunkOperation>
  readonly metrics: ReadonlyArray<ChunkSystemMetrics>
  readonly summary: {
    readonly totalOperations: number
    readonly averagePerformance: number
    readonly errorRate: number
  }
}
```

## パフォーマンス最適化

### Chunk Performance Monitor

```typescript
export const ChunkPerformanceMonitor = {
  // メモリ使用量の監視
  monitorMemoryUsage: () =>
    Effect.gen(function* () {
      const chunkManager = yield* ChunkLoadingManager
      const chunks = yield* chunkManager.getLoadedChunks()

      const memoryStats = {
        totalChunks: chunks.length,
        totalMemoryMB: chunks.reduce((sum, chunk) => sum + chunk.memoryUsage, 0) / (1024 * 1024),
        averageChunkSizeMB: 0,
        largestChunkMB: 0,
        meshMemoryMB: 0
      }

      memoryStats.averageChunkSizeMB = memoryStats.totalMemoryMB / chunks.length
      memoryStats.largestChunkMB = Math.max(...chunks.map(c => c.memoryUsage)) / (1024 * 1024)
      memoryStats.meshMemoryMB = chunks
        .filter(c => c.mesh)
        .reduce((sum, chunk) => sum + (chunk.mesh!.vertexCount * 12), 0) / (1024 * 1024) // 12 bytes per vertex

      return memoryStats
    }),

  // チャンクロード性能の監視
  benchmarkChunkGeneration: (iterations: number) =>
    Effect.gen(function* () {
      const generator = yield* ChunkGenerator
      const coordinates = Array.from({ length: iterations }, (_, i) => ({
        x: Math.floor(i / 16),
        z: i % 16
      }))

      const startTime = performance.now()

      for (const coord of coordinates) {
        yield* generator.generateChunk(coord, 12345)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averageTime = totalTime / iterations

      return {
        totalTime,
        averageTime,
        chunksPerSecond: (iterations * 1000) / totalTime,
        performance: averageTime < 50 ? 'excellent' :
                    averageTime < 100 ? 'good' :
                    averageTime < 200 ? 'acceptable' : 'poor'
      }
    }),

  // メッシング性能の監視
  benchmarkMeshGeneration: (chunks: ReadonlyArray<ChunkData>) =>
    Effect.gen(function* () {
      const meshGenerator = yield* ChunkMeshGenerator
      const startTime = performance.now()

      for (const chunkData of chunks) {
        yield* meshGenerator.generateChunkMesh(chunkData)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averageTime = totalTime / chunks.length

      return {
        totalTime,
        averageTime,
        meshesPerSecond: (chunks.length * 1000) / totalTime,
        performance: averageTime < 10 ? 'excellent' :
                    averageTime < 20 ? 'good' :
                    averageTime < 50 ? 'acceptable' : 'poor'
      }
    }),

  // 最適化提案
  suggestOptimizations: () =>
    Effect.gen(function* () {
      const memoryStats = yield* ChunkPerformanceMonitor.monitorMemoryUsage()
      const suggestions: string[] = []

      if (memoryStats.totalMemoryMB > 512) {
        suggestions.push("チャンクロード数を減らすことを推奨")
      }

      if (memoryStats.averageChunkSizeMB > 2) {
        suggestions.push("チャンクデータの圧縮を検討")
      }

      if (memoryStats.meshMemoryMB > 100) {
        suggestions.push("LODメッシングの積極的活用を推奨")
      }

      return suggestions
    })
}
```

## インテグレーション

### World Chunk System Integration

```typescript
export class WorldChunkSystem extends Context.Tag("WorldChunkSystem")<
  WorldChunkSystem,
  {
    readonly initializeWorld: (worldConfig: WorldConfig) => Effect.Effect<ChunkWorld, WorldInitError>
    readonly updateWorld: (world: ChunkWorld, playerPosition: Vector3D) => Effect.Effect<ChunkWorld, ChunkSystemError>
    readonly getBlockAt: (world: ChunkWorld, position: Vector3D) => Effect.Effect<BlockType | null, never>
    readonly setBlockAt: (world: ChunkWorld, position: Vector3D, blockType: BlockType) => Effect.Effect<ChunkWorld, ChunkUpdateError>
  }
>() {}

export const WorldChunkSystemLive = Layer.effect(
  WorldChunkSystem,
  Effect.gen(function* () {
    const chunkManager = yield* ChunkLoadingManager
    const updateManager = yield* ChunkUpdateManager
    const neighborManager = yield* NeighborChunkManager

    const initializeWorld = (worldConfig: WorldConfig) =>
      Effect.gen(function* () {
        return {
          config: worldConfig,
          seed: worldConfig.seed,
          spawnPoint: worldConfig.spawnPoint,
          loadedChunks: new Map(),
          activeRegion: null,
          lastUpdate: new Date()
        } as ChunkWorld
      })

    const updateWorld = (world: ChunkWorld, playerPosition: Vector3D) =>
      Effect.gen(function* () {
        // プレイヤー周辺のチャンクロード/アンロード
        yield* chunkManager.updateLoadedChunks(playerPosition, world.config.viewDistance)

        // 隣接チャンク参照の更新
        const playerChunk = {
          x: Math.floor(playerPosition.x / CHUNK_SIZE),
          z: Math.floor(playerPosition.z / CHUNK_SIZE)
        }
        yield* neighborManager.updateNeighborReferences(playerChunk)

        const loadedChunks = yield* chunkManager.getLoadedChunks()
        const chunkMap = new Map(loadedChunks.map(chunk => [
          `${chunk.coordinate.x},${chunk.coordinate.z}`,
          chunk
        ]))

        return {
          ...world,
          loadedChunks: chunkMap,
          lastUpdate: new Date()
        }
      })

    const getBlockAt = (world: ChunkWorld, position: Vector3D) =>
      Effect.gen(function* () {
        const chunkCoord = {
          x: Math.floor(position.x / CHUNK_SIZE),
          z: Math.floor(position.z / CHUNK_SIZE)
        }

        const chunkKey = `${chunkCoord.x},${chunkCoord.z}`
        const chunk = world.loadedChunks.get(chunkKey)

        if (!chunk) return null

        const localPos = {
          x: ((position.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
          y: Math.floor(position.y),
          z: ((position.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        } as LocalBlockPosition

        const blockIndex = localPos.y * CHUNK_SIZE * CHUNK_SIZE + localPos.z * CHUNK_SIZE + localPos.x
        return chunk.data.blocks[blockIndex] || BlockType.Air
      })

    const setBlockAt = (world: ChunkWorld, position: Vector3D, blockType: BlockType) =>
      Effect.gen(function* () {
        const chunkCoord = {
          x: Math.floor(position.x / CHUNK_SIZE),
          z: Math.floor(position.z / CHUNK_SIZE)
        }

        const localPos = {
          x: ((position.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
          y: Math.floor(position.y),
          z: ((position.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        } as LocalBlockPosition

        yield* updateManager.updateBlock(chunkCoord, localPos, blockType)
        yield* updateManager.propagateBlockUpdate(position, blockType)

        return world
      })

    return WorldChunkSystem.of({
      initializeWorld,
      updateWorld,
      getBlockAt,
      setBlockAt
    })
  })
).pipe(
  Layer.provide(ChunkLoadingManagerLive),
  Layer.provide(ChunkUpdateManagerLive),
  Layer.provide(NeighborChunkManagerLive)
)

// 型定義
interface ChunkWorld {
  readonly config: WorldConfig
  readonly seed: number
  readonly spawnPoint: Vector3D
  readonly loadedChunks: Map<string, Chunk>
  readonly activeRegion: ChunkRegion | null
  readonly lastUpdate: Date
}

interface WorldConfig {
  readonly seed: number
  readonly spawnPoint: Vector3D
  readonly viewDistance: number
  readonly simulationDistance: number
  readonly worldBorder: number
}

interface ChunkRegion {
  readonly x: number
  readonly z: number
  readonly chunks: Map<string, Chunk>
}
```

## テスト

```typescript
import { Effect, TestContext, TestClock } from "effect"

describe("Chunk Management System", () => {
  const TestChunkLayer = Layer.mergeAll(
    ChunkGeneratorLive,
    ChunkLoadingManagerLive,
    ChunkMeshGeneratorLive,
    ChunkUpdateManagerLive,
    NeighborChunkManagerLive,
    ChunkStorageServiceLive,
    WorldChunkSystemLive
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  it("should generate chunk with correct data", () =>
    Effect.gen(function* () {
      const generator = yield* ChunkGenerator
      const chunk = yield* generator.generateChunk({ x: 0, z: 0 }, 12345)

      expect(chunk.blocks.length).toBe(BLOCKS_PER_CHUNK)
      expect(chunk.heightMap.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
      expect(chunk.biomeMap.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
    }).pipe(
      Effect.provide(TestChunkLayer),
      Effect.runPromise
    ))

  it("should load and cache chunks efficiently", () =>
    Effect.gen(function* () {
      const manager = yield* ChunkLoadingManager

      const coord = { x: 1, z: 1 }
      const startTime = performance.now()

      const chunk1 = yield* manager.loadChunk(coord)
      const firstLoadTime = performance.now() - startTime

      const cacheStartTime = performance.now()
      const chunk2 = yield* manager.loadChunk(coord)
      const cacheLoadTime = performance.now() - cacheStartTime

      expect(chunk1.coordinate).toEqual(coord)
      expect(chunk2.coordinate).toEqual(coord)
      expect(cacheLoadTime).toBeLessThan(firstLoadTime) // キャッシュが速い
    }).pipe(
      Effect.provide(TestChunkLayer),
      Effect.runPromise
    ))

  it("should generate optimized mesh", () =>
    Effect.gen(function* () {
      const generator = yield* ChunkGenerator
      const meshGenerator = yield* ChunkMeshGenerator

      const chunkData = yield* generator.generateChunk({ x: 0, z: 0 }, 12345)
      const mesh = yield* meshGenerator.generateChunkMesh(chunkData)

      expect(mesh.vertexCount).toBeGreaterThan(0)
      expect(mesh.triangleCount).toBeGreaterThan(0)
      expect(mesh.vertices.length).toBe(mesh.vertexCount * 3)
    }).pipe(
      Effect.provide(TestChunkLayer),
      Effect.runPromise
    ))

  it("should update neighbors correctly", () =>
    Effect.gen(function* () {
      const manager = yield* ChunkLoadingManager
      const neighborManager = yield* NeighborChunkManager

      const centerCoord = { x: 5, z: 5 }
      await manager.loadChunk(centerCoord)

      yield* neighborManager.ensureNeighborsLoaded(centerCoord)
      yield* neighborManager.updateNeighborReferences(centerCoord)

      const northChunk = yield* neighborManager.getNeighborChunk(centerCoord, "north")
      const eastChunk = yield* neighborManager.getNeighborChunk(centerCoord, "east")

      expect(northChunk?.coordinate).toEqual({ x: 5, z: 4 })
      expect(eastChunk?.coordinate).toEqual({ x: 6, z: 5 })
    }).pipe(
      Effect.provide(TestChunkLayer),
      Effect.runPromise
    ))

  it("should persist and restore chunk data", () =>
    Effect.gen(function* () {
      const generator = yield* ChunkGenerator
      const storage = yield* ChunkStorageService

      const originalData = yield* generator.generateChunk({ x: 10, z: 10 }, 54321)
      yield* storage.saveChunk(originalData)

      const restoredData = yield* storage.loadChunk({ x: 10, z: 10 })

      expect(restoredData.coordinate).toEqual(originalData.coordinate)
      expect(restoredData.blocks).toEqual(originalData.blocks)
      expect(restoredData.heightMap).toEqual(originalData.heightMap)
    }).pipe(
      Effect.provide(TestChunkLayer),
      Effect.runPromise
    ))
})
```

## まとめ

Chunk Management Systemは、大規模なMinecraft世界の効率的な管理を実現する sophisticated なシステムです。Effect-TSのLayerパターンを活用し、各チャンクコンポーネントが独立して機能しながら、統合されたチャンク管理体験を提供します。

### 主要な特徴

1. **高度な地形生成**: マルチオクターブノイズによるリアルな地形
2. **効率的なメモリ管理**: LRUキャッシュとスマートな負荷分散
3. **最適化されたメッシング**: グリーディメッシングによる高速描画
4. **リアルタイム更新**: 非同期更新システムと隣接チャンク処理
5. **永続化システム**: 圧縮・暗号化対応の効率的ストレージ
6. **パフォーマンス監視**: リアルタイムな最適化提案

このシステムにより、無限に広がるMinecraft世界を滑らかに探索でき、大規模な建築プロジェクトも快適に実現できます。