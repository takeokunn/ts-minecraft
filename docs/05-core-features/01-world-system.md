# World System - 世界管理システム

## 概要

World Systemは、TypeScript Minecraft cloneの世界を構成する基盤システムです。Effect-TS 3.17+の最新パターン（Schema.Struct、@app/ServiceNameネームスペース）とDDDの原則に従い、純粋関数型プログラミングでMinecraftの世界システムを実装します。

本システムは以下の機能を提供します：
- **チャンク生成・管理**: 16x16x384サイズのチャンク単位での世界分割
- **地形生成**: パーリンノイズによる自然な地形・洞窟システム
- **バイオーム管理**: 温度・湿度・高度による多様な生態系
- **ブロック操作**: 高速なブロック配置・破壊・更新システム
- **光源処理**: リアルタイムな光の伝播・影計算
- **世界永続化**: NBT形式による効率的なセーブ・ロード

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

export const BlockPosition = Schema.Struct({
  x: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
  y: pipe(Schema.Number, Schema.int(), Schema.between(0, 255)),
  z: pipe(Schema.Number, Schema.int(), Schema.between(0, 15))
})

// Entities
export const Chunk = Schema.Struct({
  coordinate: ChunkCoordinate,
  blocks: Schema.Array(
    Schema.Number.pipe(Schema.int(), Schema.between(0, 65535))
  ),
  biome: Schema.Literal("plains", "forest", "desert", "ocean", "mountains"),
  heightMap: Schema.Array(Schema.Number),
  lightMap: Schema.Array(Schema.Number),
  isDirty: Schema.Boolean,
  lastModified: Schema.DateTimeUtc
})

export type Chunk = Schema.Schema.Type<typeof Chunk>

// Aggregate Root
export const World = Schema.Struct({
  id: Schema.UUID,
  seed: Schema.Number.pipe(Schema.brand("WorldSeed")),
  chunks: Schema.Map(Schema.String, Chunk),
  spawnPoint: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  worldBorder: Schema.Struct({
    center: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
    radius: Schema.Number.pipe(Schema.positive())
  }),
  gameRules: Schema.Struct({
    doDaylightCycle: Schema.Boolean,
    doWeatherCycle: Schema.Boolean,
    keepInventory: Schema.Boolean,
    mobGriefing: Schema.Boolean,
    naturalRegeneration: Schema.Boolean
  })
})

export type World = Schema.Schema.Type<typeof World>
```

## チャンク生成システム

### Terrain Generation Service

```typescript
// IMPORTANT: Context7で最新のEffect-TSパターンを確認して実装

// サービスインターフェースの定義
interface TerrainGenerationServiceInterface {
  readonly generateChunk: (
    coordinate: ChunkCoordinate,
    seed: number
  ) => Effect.Effect<Chunk, never>

  readonly generateHeightMap: (
    coordinate: ChunkCoordinate,
    seed: number
  ) => Effect.Effect<ReadonlyArray<number>, never>

  readonly determineBiome: (
    coordinate: ChunkCoordinate,
    seed: number
  ) => Effect.Effect<Biome, never>
}

// Context Tagの定義
export const TerrainGenerationService = Context.GenericTag<TerrainGenerationServiceInterface>("@app/TerrainGenerationService")

// Live実装の作成関数
const makeTerrainGenerationService = Effect.gen(function* () {
  const noiseGenerator = yield* NoiseGeneratorService

    const generateHeightMap = (coordinate: ChunkCoordinate, seed: number) =>
      Effect.gen(function* () {
        const heights: number[] = []

        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = coordinate.x * CHUNK_SIZE + x
            const worldZ = coordinate.z * CHUNK_SIZE + z

            // Perlin Noiseを使用した地形生成
            const elevation = yield* noiseGenerator.octaveNoise(
              worldX * 0.01,
              worldZ * 0.01,
              seed,
              4, // octaves
              0.5, // persistence
              2.0 // lacunarity
            )

            heights.push(Math.floor(elevation * 64 + 64))
          }
        }

        return heights
      })

    const determineBiome = (coordinate: ChunkCoordinate, seed: number) =>
      Effect.gen(function* () {
        const temperature = yield* noiseGenerator.noise2D(
          coordinate.x * 0.05,
          coordinate.z * 0.05,
          seed + 1000
        )

        const humidity = yield* noiseGenerator.noise2D(
          coordinate.x * 0.05,
          coordinate.z * 0.05,
          seed + 2000
        )

        // Match パターンによるバイオーム決定
        return pipe(
          { temperature, humidity },
          Match.value,
          Match.when(
            ({ temperature }) => temperature < -0.5,
            () => "tundra" as Biome
          ),
          Match.when(
            ({ temperature, humidity }) => temperature > 0.5 && humidity < -0.3,
            () => "desert" as Biome
          ),
          Match.when(
            ({ humidity }) => humidity > 0.3,
            () => "jungle" as Biome
          ),
          Match.when(
            ({ temperature, humidity }) => temperature > 0 && humidity > 0,
            () => "forest" as Biome
          ),
          Match.orElse(() => "plains" as Biome)
        )
      })

    const generateChunk = (coordinate: ChunkCoordinate, seed: number) =>
      Effect.gen(function* () {
        const heightMap = yield* generateHeightMap(coordinate, seed)
        const biome = yield* determineBiome(coordinate, seed)
        const blocks = yield* generateBlocks(heightMap, biome)

        return {
          coordinate,
          blocks,
          biome,
          heightMap,
          lightMap: new Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE).fill(15),
          isDirty: false,
          lastModified: new Date()
        }
      })

    return TerrainGenerationService.of({ generateChunk, generateHeightMap, determineBiome })
  })

// Live Layer
export const TerrainGenerationServiceLive = Layer.effect(
  TerrainGenerationService,
  makeTerrainGenerationService
)
```

## チャンク管理システム

### Chunk Manager

```typescript
// ChunkManagerサービスインターフェース
interface ChunkManagerInterface {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, never>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<Chunk>, never>
  readonly updateChunk: (
    coord: ChunkCoordinate,
    update: (chunk: Chunk) => Chunk
  ) => Effect.Effect<void, ChunkNotLoadedError>
}

// Context Tag
export const ChunkManager = Context.GenericTag<ChunkManagerInterface>("@app/ChunkManager")

// Live実装の作成関数
const makeChunkManager = Effect.gen(function* () {
  const storage = yield* ChunkStorageService
  const generator = yield* TerrainGenerationService
  const cache = yield* Effect.sync(() => new Map<string, Chunk>())

    const chunkKey = (coord: ChunkCoordinate) => `${coord.x},${coord.z}`

    const loadChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const key = chunkKey(coord)

        // 早期リターン: キャッシュチェック
        const cached = cache.get(key)
        if (cached) return cached

        // ストレージから読み込み
        const stored = yield* storage.load(coord).pipe(
          Effect.catchTag("ChunkNotFoundError", () =>
            // 新規生成
            generator.generateChunk(coord, yield* WorldSeed)
          )
        )

        cache.set(key, stored)
        return stored
      })

    const unloadChunk = (coord: ChunkCoordinate) =>
      Effect.gen(function* () {
        const key = chunkKey(coord)
        const chunk = cache.get(key)

        // ダーティチャンクの保存
        if (chunk?.isDirty) {
          yield* storage.save(chunk)
        }

        cache.delete(key)
      })

    return ChunkManager.of({
      loadChunk,
      unloadChunk,
      saveChunk: storage.save,
      getLoadedChunks: () => Effect.succeed(Array.from(cache.values())),
      updateChunk: (coord, update) =>
        Effect.gen(function* () {
          const key = chunkKey(coord)
          const chunk = cache.get(key)

          // 早期リターン: チャンクが存在しない場合はエラー
          if (!chunk) {
            return yield* Effect.fail(new ChunkNotLoadedError(coord))
          }

          const updated = update(chunk)
          cache.set(key, { ...updated, isDirty: true })
        })
    })
  })

// Live Layer
export const ChunkManagerLive = Layer.effect(
  ChunkManager,
  makeChunkManager
).pipe(
  Layer.provide(ChunkStorageServiceLive),
  Layer.provide(TerrainGenerationServiceLive)
)
```

## ブロック操作システム

### Block Operations

```typescript
// BlockOperationsサービスインターフェース
interface BlockOperationsInterface {
  readonly getBlock: (
    world: World,
    position: WorldPosition
  ) => Effect.Effect<BlockType, BlockNotFoundError>

  readonly setBlock: (
    world: World,
    position: WorldPosition,
    block: BlockType
  ) => Effect.Effect<World, BlockPlaceError>

  readonly breakBlock: (
    world: World,
    position: WorldPosition
  ) => Effect.Effect<World, BlockBreakError>

  readonly getAdjacentBlocks: (
    world: World,
    position: WorldPosition
  ) => Effect.Effect<ReadonlyArray<BlockType>, never>
}

// Context Tag
export const BlockOperations = Context.GenericTag<BlockOperationsInterface>("@app/BlockOperations")

// Live実装の作成関数
const makeBlockOperations = Effect.gen(function* () {
  const chunkManager = yield* ChunkManager

    const worldToChunkCoord = (pos: WorldPosition): ChunkCoordinate => ({
      x: Math.floor(pos.x / CHUNK_SIZE),
      z: Math.floor(pos.z / CHUNK_SIZE)
    })

    const worldToLocalCoord = (pos: WorldPosition): BlockPosition => ({
      x: ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
      y: pos.y,
      z: ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    })

    const getBlockIndex = (local: BlockPosition): number =>
      local.y * CHUNK_SIZE * CHUNK_SIZE + local.z * CHUNK_SIZE + local.x

    const getBlock = (world: World, position: WorldPosition) =>
      Effect.gen(function* () {
        const chunkCoord = worldToChunkCoord(position)
        const chunk = yield* chunkManager.loadChunk(chunkCoord)
        const localCoord = worldToLocalCoord(position)
        const index = getBlockIndex(localCoord)

        return chunk.blocks[index] ?? BlockType.Air
      })

    const setBlock = (world: World, position: WorldPosition, block: BlockType) =>
      Effect.gen(function* () {
        const chunkCoord = worldToChunkCoord(position)
        const localCoord = worldToLocalCoord(position)
        const index = getBlockIndex(localCoord)

        yield* chunkManager.updateChunk(chunkCoord, (chunk) => ({
          ...chunk,
          blocks: chunk.blocks.map((b, i) => i === index ? block : b),
          isDirty: true,
          lastModified: new Date()
        }))

        // 隣接チャンクの更新通知
        yield* notifyAdjacentChunks(position)

        // ブロック更新イベント発行
        yield* publishBlockChangeEvent(position, block)

        return world
      })

    return BlockOperations.of({ getBlock, setBlock, breakBlock, getAdjacentBlocks })
  })

// Live Layer
export const BlockOperationsLive = Layer.effect(
  BlockOperations,
  makeBlockOperations
)
```

## 光源処理システム

### Lighting System

```typescript
// LightingSystemサービスインターフェース
interface LightingSystemInterface {
  readonly calculateSkyLight: (chunk: Chunk) => Effect.Effect<Chunk, never>
  readonly calculateBlockLight: (chunk: Chunk) => Effect.Effect<Chunk, never>
  readonly propagateLight: (
    chunk: Chunk,
    position: BlockPosition
  ) => Effect.Effect<Chunk, never>
}

// Context Tag
export const LightingSystem = Context.GenericTag<LightingSystemInterface>("@app/LightingSystem")

// Live実装
export const LightingSystemLive = Layer.succeed(
  LightingSystem,
  LightingSystem.of({
    calculateSkyLight: (chunk) =>
      Effect.gen(function* () {
        const lightMap = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)

        // 天空光の計算
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            let skyLight = 15

            for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
              const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
              const block = chunk.blocks[index]

              if (isTransparent(block)) {
                lightMap[index] = skyLight
              } else {
                skyLight = Math.max(0, skyLight - getOpacity(block))
                lightMap[index] = skyLight
              }
            }
          }
        }

        return { ...chunk, lightMap: Array.from(lightMap) }
      }),

    calculateBlockLight: (chunk) =>
      Effect.gen(function* () {
        // ブロック光源の計算
        const lightSources = findLightSources(chunk)

        for (const source of lightSources) {
          yield* propagateLightFrom(chunk, source)
        }

        return chunk
      }),

    propagateLight: (chunk, position) =>
      Effect.gen(function* () {
        // BFSを使用した光の伝播
        const queue = [position]
        const visited = new Set<string>()

        while (queue.length > 0) {
          const current = queue.shift()!
          const key = `${current.x},${current.y},${current.z}`

          if (visited.has(key)) continue
          visited.add(key)

          const neighbors = getNeighbors(current)
          for (const neighbor of neighbors) {
            if (shouldPropagate(chunk, current, neighbor)) {
              queue.push(neighbor)
            }
          }
        }

        return chunk
      })
  })
)
```

## パフォーマンス最適化

### Chunk Loading Strategy

```typescript
export const ChunkLoadingStrategy = {
  // 視野に基づくチャンクロード
  loadVisibleChunks: (playerPosition: WorldPosition, viewDistance: number) =>
    Effect.gen(function* () {
      const centerChunk = worldToChunkCoord(playerPosition)
      const chunks: ChunkCoordinate[] = []

      for (let dx = -viewDistance; dx <= viewDistance; dx++) {
        for (let dz = -viewDistance; dz <= viewDistance; dz++) {
          const distance = Math.sqrt(dx * dx + dz * dz)
          if (distance <= viewDistance) {
            chunks.push({
              x: centerChunk.x + dx,
              z: centerChunk.z + dz
            })
          }
        }
      }

      // 距離順にソート
      chunks.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.x - centerChunk.x, 2) +
          Math.pow(a.z - centerChunk.z, 2)
        )
        const distB = Math.sqrt(
          Math.pow(b.x - centerChunk.x, 2) +
          Math.pow(b.z - centerChunk.z, 2)
        )
        return distA - distB
      })

      return chunks
    }),

  // 段階的アンロード
  unloadDistantChunks: (playerPosition: WorldPosition, maxDistance: number) =>
    Effect.gen(function* () {
      const chunkManager = yield* ChunkManager
      const loadedChunks = yield* chunkManager.getLoadedChunks()
      const centerChunk = worldToChunkCoord(playerPosition)

      for (const chunk of loadedChunks) {
        const distance = Math.sqrt(
          Math.pow(chunk.coordinate.x - centerChunk.x, 2) +
          Math.pow(chunk.coordinate.z - centerChunk.z, 2)
        )

        if (distance > maxDistance) {
          yield* chunkManager.unloadChunk(chunk.coordinate)
        }
      }
    })
}
```

## テスト

```typescript
import { Effect, TestContext, TestClock } from "effect"

describe("World System", () => {
  const TestWorldLayer = Layer.mergeAll(
    ChunkManagerLive,
    TerrainGenerationServiceLive,
    BlockOperationsLive,
    LightingSystemLive
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  it("should generate chunk with correct dimensions", () =>
    Effect.gen(function* () {
      const generator = yield* TerrainGenerationService
      const chunk = yield* generator.generateChunk({ x: 0, z: 0 }, 12345)

      expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
      expect(chunk.heightMap.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
    }).pipe(
      Effect.provide(TestWorldLayer),
      Effect.runPromise
    ))

  it("should manage chunk loading and unloading", () =>
    Effect.gen(function* () {
      const manager = yield* ChunkManager

      const coord = { x: 0, z: 0 }
      const chunk1 = yield* manager.loadChunk(coord)
      const chunk2 = yield* manager.loadChunk(coord)

      // Same reference due to caching
      expect(chunk1).toBe(chunk2)

      yield* manager.unloadChunk(coord)
      const loaded = yield* manager.getLoadedChunks()

      expect(loaded.find(c => c.coordinate.x === 0 && c.coordinate.z === 0))
        .toBeUndefined()
    }).pipe(
      Effect.provide(TestWorldLayer),
      Effect.runPromise
    ))
})
```

## ワールド生成アルゴリズム

### ノイズ生成システム

```typescript
// Noise Generator Service
interface NoiseGeneratorServiceInterface {
  readonly noise2D: (
    x: number,
    y: number,
    seed: number
  ) => Effect.Effect<number, never>

  readonly noise3D: (
    x: number,
    y: number,
    z: number,
    seed: number
  ) => Effect.Effect<number, never>

  readonly octaveNoise: (
    x: number,
    y: number,
    seed: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ) => Effect.Effect<number, never>

  readonly ridgedNoise: (
    x: number,
    y: number,
    seed: number,
    octaves: number
  ) => Effect.Effect<number, never>
}

export const NoiseGeneratorService = Context.GenericTag<NoiseGeneratorServiceInterface>("@app/NoiseGeneratorService")

// Perlin Noise実装
const makeNoiseGeneratorService = Effect.gen(function* () {
  const permutation = generatePermutationTable()

  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number): number => a + t * (b - a)
  const grad = (hash: number, x: number, y: number): number => {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  const noise2D = (x: number, y: number, seed: number) =>
    Effect.sync(() => {
      const X = Math.floor(x) & 255
      const Y = Math.floor(y) & 255

      x -= Math.floor(x)
      y -= Math.floor(y)

      const u = fade(x)
      const v = fade(y)

      const A = permutation[X] + Y
      const AA = permutation[A]
      const AB = permutation[A + 1]
      const B = permutation[X + 1] + Y
      const BA = permutation[B]
      const BB = permutation[B + 1]

      return lerp(
        lerp(grad(permutation[AA], x, y),
             grad(permutation[BA], x - 1, y), u),
        lerp(grad(permutation[AB], x, y - 1),
             grad(permutation[BB], x - 1, y - 1), u), v)
    })

  const octaveNoise = (x: number, y: number, seed: number, octaves: number, persistence: number, lacunarity: number) =>
    Effect.gen(function* () {
      let total = 0
      let frequency = 1
      let amplitude = 1
      let maxValue = 0

      for (let i = 0; i < octaves; i++) {
        const noiseValue = yield* noise2D(x * frequency, y * frequency, seed + i)
        total += noiseValue * amplitude
        maxValue += amplitude
        amplitude *= persistence
        frequency *= lacunarity
      }

      return total / maxValue
    })

  const ridgedNoise = (x: number, y: number, seed: number, octaves: number) =>
    Effect.gen(function* () {
      let total = 0
      let frequency = 1
      let amplitude = 1
      let weight = 1

      for (let i = 0; i < octaves; i++) {
        let noiseValue = yield* noise2D(x * frequency, y * frequency, seed + i)
        noiseValue = 1.0 - Math.abs(noiseValue)
        noiseValue *= noiseValue
        noiseValue *= weight
        weight = Math.max(0, Math.min(1, noiseValue * 2))

        total += noiseValue * amplitude
        amplitude *= 0.5
        frequency *= 2
      }

      return total
    })

  return NoiseGeneratorService.of({
    noise2D,
    noise3D: (x, y, z, seed) => noise2D(x + z * 0.1, y, seed), // 簡易3D実装
    octaveNoise,
    ridgedNoise
  })
})

export const NoiseGeneratorServiceLive = Layer.effect(
  NoiseGeneratorService,
  makeNoiseGeneratorService
)

// 順列テーブル生成
const generatePermutationTable = (): ReadonlyArray<number> => {
  const perm = Array.from({ length: 256 }, (_, i) => i)

  // Fisher-Yates shuffle
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }

  // Duplicate for optimization
  return [...perm, ...perm]
}
```

### バイオーム生成システム

```typescript
// バイオーム定義の拡張
export const BiomeType = Schema.Union(
  Schema.Literal("plains"),
  Schema.Literal("forest"),
  Schema.Literal("desert"),
  Schema.Literal("ocean"),
  Schema.Literal("mountains"),
  Schema.Literal("tundra"),
  Schema.Literal("jungle"),
  Schema.Literal("swamp"),
  Schema.Literal("taiga")
)

export type BiomeType = Schema.Schema.Type<typeof BiomeType>

export const BiomeDefinition = Schema.Struct({
  id: BiomeType,
  temperature: Schema.Number.pipe(Schema.between(-1, 1)),
  humidity: Schema.Number.pipe(Schema.between(-1, 1)),
  elevation: Schema.Number.pipe(Schema.between(-1, 1)),
  surfaceBlock: BlockType,
  subSurfaceBlock: BlockType,
  decorations: Schema.Array(BlockType),
  treeType: Schema.optional(Schema.Literal("oak", "birch", "pine", "jungle")),
  grassDensity: Schema.Number.pipe(Schema.between(0, 1)),
  oreGeneration: Schema.Struct({
    coal: Schema.Number.pipe(Schema.between(0, 1)),
    iron: Schema.Number.pipe(Schema.between(0, 1)),
    gold: Schema.Number.pipe(Schema.between(0, 1)),
    diamond: Schema.Number.pipe(Schema.between(0, 1))
  })
})

export type BiomeDefinition = Schema.Schema.Type<typeof BiomeDefinition>

// バイオーム定義マップ
const biomeDefinitions: ReadonlyMap<BiomeType, BiomeDefinition> = new Map([
  ["plains", {
    id: "plains",
    temperature: 0.2,
    humidity: 0.3,
    elevation: 0.0,
    surfaceBlock: "grass",
    subSurfaceBlock: "dirt",
    decorations: ["grass"],
    treeType: "oak",
    grassDensity: 0.8,
    oreGeneration: { coal: 0.6, iron: 0.4, gold: 0.2, diamond: 0.1 }
  }],
  ["desert", {
    id: "desert",
    temperature: 0.8,
    humidity: -0.6,
    elevation: 0.1,
    surfaceBlock: "sand",
    subSurfaceBlock: "sand",
    decorations: [],
    grassDensity: 0.1,
    oreGeneration: { coal: 0.3, iron: 0.2, gold: 0.3, diamond: 0.05 }
  }],
  ["mountains", {
    id: "mountains",
    temperature: -0.3,
    humidity: 0.2,
    elevation: 0.7,
    surfaceBlock: "stone",
    subSurfaceBlock: "stone",
    decorations: [],
    treeType: "pine",
    grassDensity: 0.3,
    oreGeneration: { coal: 0.8, iron: 0.7, gold: 0.4, diamond: 0.2 }
  }]
  // 他のバイオーム定義...
])
```

### 洞窟生成システム

```typescript
// 洞窟生成サービス
interface CaveGeneratorInterface {
  readonly generateCaves: (
    chunk: Chunk,
    seed: number
  ) => Effect.Effect<Chunk, never>

  readonly generateTunnels: (
    chunk: Chunk,
    tunnelCount: number,
    seed: number
  ) => Effect.Effect<Chunk, never>
}

export const CaveGenerator = Context.GenericTag<CaveGeneratorInterface>("@app/CaveGenerator")

const makeCaveGenerator = Effect.gen(function* () {
  const noiseGen = yield* NoiseGeneratorService

  const generateCaves = (chunk: Chunk, seed: number) =>
    Effect.gen(function* () {
      const newBlocks = [...chunk.blocks]

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let y = 1; y < chunk.heightMap[z * CHUNK_SIZE + x]; y++) {
            const worldX = chunk.coordinate.x * CHUNK_SIZE + x
            const worldZ = chunk.coordinate.z * CHUNK_SIZE + z

            // 3D洞窟ノイズ生成
            const caveNoise1 = yield* noiseGen.octaveNoise(
              worldX * 0.05,
              y * 0.1,
              seed + 5000,
              3, 0.6, 2.0
            )

            const caveNoise2 = yield* noiseGen.octaveNoise(
              worldZ * 0.05,
              y * 0.1,
              seed + 6000,
              3, 0.6, 2.0
            )

            const combinedNoise = Math.abs(caveNoise1) + Math.abs(caveNoise2)

            // 洞窟生成判定
            if (combinedNoise < 0.15 && y > 5) {
              const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
              newBlocks[index] = getBlockId("air")
            }
          }
        }
      }

      return { ...chunk, blocks: newBlocks, isDirty: true }
    })

  const generateTunnels = (chunk: Chunk, tunnelCount: number, seed: number) =>
    Effect.gen(function* () {
      // トンネル生成ロジック（より詳細な実装）
      return chunk
    })

  return CaveGenerator.of({
    generateCaves,
    generateTunnels
  })
})

export const CaveGeneratorLive = Layer.effect(
  CaveGenerator,
  makeCaveGenerator
).pipe(
  Layer.provide(NoiseGeneratorServiceLive)
)
```

## パフォーマンス最適化

### Structure of Arrays (SoA) 実装

```typescript
// SoAによるチャンクデータ構造
export const ChunkSoA = Schema.Struct({
  coordinate: ChunkCoordinate,
  // ブロックIDの配列（TypedArrayによる最適化）
  blockIds: Schema.instanceOf(Uint16Array),
  // メタデータの配列
  blockMetadata: Schema.instanceOf(Uint8Array),
  // 光レベルの配列
  skyLight: Schema.instanceOf(Uint8Array),
  blockLight: Schema.instanceOf(Uint8Array),
  // バイオームIDの配列
  biomeIds: Schema.instanceOf(Uint8Array),
  // 高度マップ
  heightMap: Schema.instanceOf(Uint16Array),
  // 更新フラグ
  isDirty: Schema.Boolean,
  lastModified: Schema.DateTimeUtc
})

export type ChunkSoA = Schema.Schema.Type<typeof ChunkSoA>

// SIMD対応のバッチ処理
interface SIMDProcessorInterface {
  readonly processBlocksBatch: (
    blockIds: Uint16Array,
    operation: BlockOperation
  ) => Effect.Effect<Uint16Array, never>

  readonly updateLightingBatch: (
    lightLevels: Uint8Array,
    blockOpacity: Uint8Array
  ) => Effect.Effect<Uint8Array, never>
}

export const SIMDProcessor = Context.GenericTag<SIMDProcessorInterface>("@app/SIMDProcessor")

// SIMD最適化された処理
const makeSIMDProcessor = Effect.gen(function* () {
  const processBlocksBatch = (blockIds: Uint16Array, operation: BlockOperation) =>
    Effect.sync(() => {
      // WebAssembly SIMD命令を使用した高速処理
      const result = new Uint16Array(blockIds.length)

      // 16要素ずつバッチ処理
      for (let i = 0; i < blockIds.length; i += 16) {
        const batch = blockIds.subarray(i, Math.min(i + 16, blockIds.length))

        // SIMD処理（WebAssembly実装想定）
        for (let j = 0; j < batch.length; j++) {
          result[i + j] = applyOperation(batch[j], operation)
        }
      }

      return result
    })

  const updateLightingBatch = (lightLevels: Uint8Array, blockOpacity: Uint8Array) =>
    Effect.sync(() => {
      const result = new Uint8Array(lightLevels.length)

      // 並列光伝播計算
      for (let i = 0; i < lightLevels.length; i += 8) {
        const lightBatch = lightLevels.subarray(i, Math.min(i + 8, lightLevels.length))
        const opacityBatch = blockOpacity.subarray(i, Math.min(i + 8, blockOpacity.length))

        for (let j = 0; j < lightBatch.length; j++) {
          result[i + j] = Math.max(0, lightBatch[j] - opacityBatch[j])
        }
      }

      return result
    })

  return SIMDProcessor.of({
    processBlocksBatch,
    updateLightingBatch
  })
})

export const SIMDProcessorLive = Layer.succeed(
  SIMDProcessor,
  SIMDProcessor.of({
    processBlocksBatch: (blockIds, operation) => Effect.succeed(blockIds), // フォールバック実装
    updateLightingBatch: (lightLevels, blockOpacity) => Effect.succeed(lightLevels)
  })
)
```

### チャンクローディング/アンローディング戦略

```typescript
// 高度なチャンクロード戦略
interface ChunkLoadingStrategyInterface {
  readonly predictiveLoading: (
    playerPosition: WorldPosition,
    velocity: Vector3D,
    viewDistance: number
  ) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>

  readonly priorityBasedLoading: (
    requests: ReadonlyArray<ChunkLoadRequest>
  ) => Effect.Effect<ReadonlyArray<Chunk>, ChunkLoadError>

  readonly adaptiveUnloading: (
    memoryPressure: number,
    playerPositions: ReadonlyArray<WorldPosition>
  ) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>
}

export const ChunkLoadingStrategy = Context.GenericTag<ChunkLoadingStrategyInterface>("@app/ChunkLoadingStrategy")

const makeChunkLoadingStrategy = Effect.gen(function* () {
  const manager = yield* ChunkManager

  const predictiveLoading = (playerPosition: WorldPosition, velocity: Vector3D, viewDistance: number) =>
    Effect.gen(function* () {
      const currentChunk = worldToChunkCoord(playerPosition)

      // プレイヤーの移動予測
      const predictedPosition = {
        x: playerPosition.x + velocity.x * PREDICTION_TIME_SECONDS,
        y: playerPosition.y + velocity.y * PREDICTION_TIME_SECONDS,
        z: playerPosition.z + velocity.z * PREDICTION_TIME_SECONDS
      }

      const predictedChunk = worldToChunkCoord(predictedPosition)

      // 予測位置周辺のチャンクを優先ロード対象に
      const chunks: ChunkCoordinate[] = []

      for (let dx = -viewDistance; dx <= viewDistance; dx++) {
        for (let dz = -viewDistance; dz <= viewDistance; dz++) {
          chunks.push({
            x: predictedChunk.x + dx,
            z: predictedChunk.z + dz
          })
        }
      }

      // 距離と移動方向による優先度付け
      return chunks.sort((a, b) => {
        const distA = Math.abs(a.x - currentChunk.x) + Math.abs(a.z - currentChunk.z)
        const distB = Math.abs(b.x - currentChunk.x) + Math.abs(b.z - currentChunk.z)

        // 移動方向により近いチャンクを優先
        const dirA = Math.sign((a.x - currentChunk.x) * velocity.x + (a.z - currentChunk.z) * velocity.z)
        const dirB = Math.sign((b.x - currentChunk.x) * velocity.x + (b.z - currentChunk.z) * velocity.z)

        if (dirA !== dirB) return dirB - dirA // 移動方向優先
        return distA - distB // 距離順
      })
    })

  const adaptiveUnloading = (memoryPressure: number, playerPositions: ReadonlyArray<WorldPosition>) =>
    Effect.gen(function* () {
      const loadedChunks = yield* manager.getLoadedChunks()

      // メモリ圧迫度に応じてアンロード基準を調整
      const baseUnloadDistance = 10
      const pressureMultiplier = Math.max(0.5, 1 - memoryPressure)
      const unloadDistance = baseUnloadDistance * pressureMultiplier

      const chunksToUnload: ChunkCoordinate[] = []

      for (const chunk of loadedChunks) {
        let shouldUnload = true

        // 全プレイヤーから十分離れているかチェック
        for (const playerPos of playerPositions) {
          const playerChunk = worldToChunkCoord(playerPos)
          const distance = Math.sqrt(
            Math.pow(chunk.coordinate.x - playerChunk.x, 2) +
            Math.pow(chunk.coordinate.z - playerChunk.z, 2)
          )

          if (distance < unloadDistance) {
            shouldUnload = false
            break
          }
        }

        if (shouldUnload) {
          chunksToUnload.push(chunk.coordinate)
        }
      }

      return chunksToUnload
    })

  return ChunkLoadingStrategy.of({
    predictiveLoading,
    priorityBasedLoading: (requests) => Effect.succeed([]), // 実装省略
    adaptiveUnloading
  })
})
```

## テスト戦略

### プロパティベーステスト (PBT)

```typescript
import * as fc from "fast-check"
import { Effect, TestContext, TestClock } from "effect"

// テスト用のアービトラリ生成
const chunkCoordinateArb = fc.record({
  x: fc.integer({ min: -1000, max: 1000 }),
  z: fc.integer({ min: -1000, max: 1000 })
})

const worldPositionArb = fc.record({
  x: fc.integer({ min: -16000, max: 16000 }),
  y: fc.integer({ min: 0, max: 383 }),
  z: fc.integer({ min: -16000, max: 16000 })
})

const blockTypeArb = fc.constantFrom(
  "air", "stone", "dirt", "grass", "sand", "water",
  "lava", "wood", "leaves", "ore_coal", "ore_iron", "ore_gold", "ore_diamond"
)

// プロパティベーステスト
describe("World System Property Tests", () => {
  const TestLayer = Layer.mergeAll(
    TerrainGenerationServiceLive,
    ChunkManagerLive,
    BlockOperationsLive,
    NoiseGeneratorServiceLive,
    CaveGeneratorLive
  ).pipe(
    Layer.provide(TestContext.TestContext)
  )

  it("chunk generation should be deterministic with same seed", () =>
    fc.assert(
      fc.asyncProperty(
        chunkCoordinateArb,
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        async (coord, seed) => {
          const program = Effect.gen(function* () {
            const generator = yield* TerrainGenerationService

            const chunk1 = yield* generator.generateChunk(coord, seed)
            const chunk2 = yield* generator.generateChunk(coord, seed)

            // 同じシードでは同じチャンクが生成される
            expect(chunk1.blocks).toEqual(chunk2.blocks)
            expect(chunk1.heightMap).toEqual(chunk2.heightMap)
            expect(chunk1.biome).toBe(chunk2.biome)
          })

          await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
        }
      ),
      { numRuns: 50 }
    )
  )

  it("world-to-chunk coordinate conversion should be consistent", () =>
    fc.assert(
      fc.property(
        worldPositionArb,
        (worldPos) => {
          const chunkCoord = worldToChunkCoord(worldPos)
          const localCoord = worldToLocalCoord(worldPos)

          // ローカル座標は常にチャンクサイズ未満である
          expect(localCoord.x).toBeGreaterThanOrEqual(0)
          expect(localCoord.x).toBeLessThan(CHUNK_SIZE)
          expect(localCoord.z).toBeGreaterThanOrEqual(0)
          expect(localCoord.z).toBeLessThan(CHUNK_SIZE)

          // 逆変換で元の座標に戻る
          const reconstructed = {
            x: chunkCoord.x * CHUNK_SIZE + localCoord.x,
            y: localCoord.y,
            z: chunkCoord.z * CHUNK_SIZE + localCoord.z
          }

          expect(reconstructed.x).toBe(worldPos.x)
          expect(reconstructed.y).toBe(worldPos.y)
          expect(reconstructed.z).toBe(worldPos.z)
        }
      ),
      { numRuns: 100 }
    )
  )
})
```

## トラブルシューティング

### 一般的な問題と解決方法

#### 1. チャンク生成の遅延

**症状**: チャンクの生成や読み込みが遅い

**原因**:
- ノイズ生成の計算量が多い
- メモリ不足
- I/O処理のボトルネック

**解決方法**:
```typescript
// パフォーマンス監視の追加
const monitoredGenerateChunk = (coord: ChunkCoordinate, seed: number) =>
  Effect.gen(function* () {
    const startTime = Date.now()

    const chunk = yield* generator.generateChunk(coord, seed).pipe(
      Effect.timeout("5 seconds"), // タイムアウト設定
      Effect.retry(Schedule.exponential("100 millis").pipe(
        Schedule.intersect(Schedule.recurs(3))
      ))
    )

    const duration = Date.now() - startTime
    if (duration > 1000) {
      yield* Effect.log(`Slow chunk generation: ${duration}ms for ${coord.x},${coord.z}`)
    }

    return chunk
  })
```

#### 2. メモリリークの問題

**症状**: 長時間実行後にメモリ使用量が増加し続ける

**解決方法**:
```typescript
// メモリ使用量監視
const monitorMemoryUsage = Effect.gen(function* () {
  const memUsage = process.memoryUsage()

  if (memUsage.heapUsed > MEMORY_LIMIT) {
    yield* Effect.log(`High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`)

    // 強制的な古いチャンクのアンロード
    const manager = yield* ChunkManager
    yield* manager.forceUnloadOldChunks()

    // ガベージコレクションの提案
    if (global.gc) {
      global.gc()
    }
  }
})
```

### デバッグツールとモニタリング

```typescript
// ワールドビューア用のデバッグ情報
interface WorldDebugInfoInterface {
  readonly getChunkInfo: (coord: ChunkCoordinate) => Effect.Effect<ChunkDebugInfo, never>
  readonly getBlockInfo: (position: WorldPosition) => Effect.Effect<BlockDebugInfo, never>
  readonly getPerformanceMetrics: () => Effect.Effect<PerformanceMetrics, never>
}

export const WorldDebugInfo = Context.GenericTag<WorldDebugInfoInterface>("@app/WorldDebugInfo")

const makeWorldDebugInfo = Effect.gen(function* () {
  const manager = yield* ChunkManager
  const operations = yield* BlockOperations

  const getChunkInfo = (coord: ChunkCoordinate) =>
    Effect.gen(function* () {
      const chunk = yield* manager.loadChunk(coord)

      return {
        coordinate: coord,
        biome: chunk.biome,
        blockCount: chunk.blocks.filter(id => id !== 0).length,
        averageHeight: chunk.heightMap.reduce((a, b) => a + b, 0) / chunk.heightMap.length,
        lastModified: chunk.lastModified,
        isDirty: chunk.isDirty,
        memoryUsage: estimateChunkMemoryUsage(chunk)
      }
    })

  return WorldDebugInfo.of({
    getChunkInfo,
    getBlockInfo: (position) => Effect.succeed({
      position,
      blockType: "unknown", // 実際の実装では適切に取得
      lightLevel: 0,
      chunkCoordinate: worldToChunkCoord(position)
    }),
    getPerformanceMetrics: () => Effect.succeed({
      chunksLoaded: 0,
      averageGenerationTime: 0,
      memoryUsage: process.memoryUsage().heapUsed
    })
  })
})

// 構造化ログ出力
const structuredLog = (level: string, message: string, metadata?: Record<string, unknown>) =>
  Effect.sync(() => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      system: "world-system",
      ...metadata
    }

    console.log(JSON.stringify(logEntry))
  })
```

本ドキュメントでは、TypeScript MinecraftクローンのWorld Systemを、Effect-TS 3.17+の最新パターンとDDDの原則に従って設計・実装する方法を詳述しました。純粋関数型プログラミング、Structure of Arrays最適化、包括的なテスト戦略により、スケーラブルで保守性の高いシステムを実現できます。