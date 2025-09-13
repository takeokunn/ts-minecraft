# ワールド生成システム
## 1. 概要

TypeScript Minecraft Cloneのワールド生成システムは、プロシージャル生成技術を用いて無限に広がる多様な地形を作り出します。Effect-TSによる純粋関数型アプローチにより、決定論的で再現可能な世界生成を実現します。

## 2. ワールド生成アーキテクチャ

### 2.1 生成パイプライン

```typescript
// ワールド生成パイプライン
export const generateWorld = (seed: WorldSeed): Effect.Effect<World, GenerationError> =>
  Effect.gen(function* () {
    // 1. シード初期化
    const rng = yield* initializeRNG(seed)

    // 2. バイオームマップ生成
    const biomeMap = yield* generateBiomeMap(rng)

    // 3. 高度マップ生成
    const heightMap = yield* generateHeightMap(rng, biomeMap)

    // 4. 地形特徴生成
    const features = yield* generateTerrainFeatures(rng, heightMap, biomeMap)

    // 5. 構造物配置
    const structures = yield* placeStructures(rng, features)

    // 6. 初期エンティティ配置
    const entities = yield* spawnInitialEntities(rng, biomeMap)

    return createWorld({
      seed,
      biomeMap,
      heightMap,
      features,
      structures,
      entities
    })
  })
```

### 2.2 チャンクベース生成

```typescript
export interface ChunkGenerator {
  generate: (
    coordinate: ChunkCoordinate,
    seed: WorldSeed
  ) => Effect.Effect<Chunk, ChunkGenerationError>
}

export const ChunkGeneratorLive: ChunkGenerator = {
  generate: (coordinate, seed) =>
    Effect.gen(function* () {
      // チャンク固有のシード生成
      const chunkSeed = combineSeeds(seed, coordinate)
      const rng = yield* ChunkRNG.create(chunkSeed)

      // チャンクの基本地形生成
      const terrain = yield* generateChunkTerrain(rng, coordinate)

      // バイオーム固有の特徴追加
      const biome = yield* determineBiome(coordinate, seed)
      const biomeFeatures = yield* applyBiomeFeatures(terrain, biome, rng)

      // ブロック配列の生成
      const blocks = yield* generateBlockArray(biomeFeatures)

      // 照明の初期計算
      const lighting = yield* calculateInitialLighting(blocks)

      return Chunk.create({
        coordinate,
        blocks,
        biome,
        lighting,
        metadata: {
          generatedAt: yield* Clock.currentTime,
          version: CHUNK_FORMAT_VERSION
        }
      })
    })
}
```

## 3. ノイズ関数による地形生成

### 3.1 Simplex Noiseの活用

```typescript
// ノイズ生成システム

// 多層ノイズによる地形生成
export interface NoiseConfig {
  readonly octaves: number
  readonly persistence: number
  readonly lacunarity: number
  readonly scale: number
  readonly offset: Position
}

export const generateHeightNoise = (
  position: Position,
  config: NoiseConfig,
  simplexNoise2D: (x: number, y: number) => number
): number => {
  let amplitude = 1.0
  let frequency = 1.0
  let noiseValue = 0.0
  let maxValue = 0.0

  for (let i = 0; i < config.octaves; i++) {
    const sampleX = (position.x / config.scale) * frequency + config.offset.x
    const sampleZ = (position.z / config.scale) * frequency + config.offset.z

    noiseValue += simplexNoise2D(sampleX, sampleZ) * amplitude

    maxValue += amplitude
    amplitude *= config.persistence
    frequency *= config.lacunarity
  }

  return noiseValue / maxValue
}

// 3Dノイズによる洞窟生成
export const generateCaveNoise = (
  position: Position,
  config: NoiseConfig,
  simplexNoise3D: (x: number, y: number, z: number) => number
): number => {
  const scale = config.scale * 0.5
  return simplexNoise3D(
    position.x / scale,
    position.y / scale,
    position.z / scale
  )
}
```

### 3.2 複合ノイズパターン

```typescript
export const TerrainPatterns = {
  // 山岳地形
  mountains: {
    heightNoise: {
      octaves: 6,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 200,
      offset: { x: 0, y: 0, z: 0 }
    },
    modifier: (noise: number) => Math.pow(noise, 2.0) * 128 + 64
  },

  // 平原
  plains: {
    heightNoise: {
      octaves: 4,
      persistence: 0.3,
      lacunarity: 2.0,
      scale: 100,
      offset: { x: 1000, y: 0, z: 0 }
    },
    modifier: (noise: number) => noise * 10 + 64
  },

  // 海洋
  ocean: {
    heightNoise: {
      octaves: 3,
      persistence: 0.2,
      lacunarity: 2.0,
      scale: 150,
      offset: { x: 2000, y: 0, z: 0 }
    },
    modifier: (noise: number) => noise * 5 + 30
  }
}
```

## 4. バイオームシステム

### 4.1 バイオーム定義

```typescript
export interface Biome {
  readonly id: BiomeId
  readonly name: string
  readonly temperature: number  // -1.0 to 1.0
  readonly humidity: number     // 0.0 to 1.0
  readonly elevation: number    // 0.0 to 1.0
  readonly colors: BiomeColors
  readonly blocks: BiomeBlocks
  readonly features: ReadonlyArray<BiomeFeature>
  readonly spawnRules: SpawnRules
}

export const Biomes = {
  Plains: {
    id: "plains" as BiomeId,
    name: "Plains",
    temperature: 0.3,
    humidity: 0.4,
    elevation: 0.2,
    colors: {
      grass: 0x91bd59,
      foliage: 0x77ab2f,
      water: 0x3f76e4
    },
    blocks: {
      surface: BlockType.GrassBlock,
      subsurface: BlockType.Dirt,
      stone: BlockType.Stone
    },
    features: ["tallGrass", "flowers", "trees_sparse"],
    spawnRules: {
      passive: ["sheep", "cow", "pig", "chicken"],
      hostile: ["zombie", "skeleton", "creeper"],
      spawnRate: 0.7
    }
  },

  Desert: {
    id: "desert" as BiomeId,
    name: "Desert",
    temperature: 0.95,
    humidity: 0.0,
    elevation: 0.25,
    colors: {
      grass: 0xbfb755,
      foliage: 0xaea42a,
      water: 0x3f76e4
    },
    blocks: {
      surface: BlockType.Sand,
      subsurface: BlockType.Sand,
      stone: BlockType.Sandstone
    },
    features: ["cactus", "deadBush", "desertWell"],
    spawnRules: {
      passive: ["rabbit"],
      hostile: ["husk", "spider"],
      spawnRate: 0.5
    }
  },

  // ... 他のバイオーム定義
}
```

### 4.2 バイオーム決定アルゴリズム

```typescript
export const BiomeSelector = {
  // ボロノイ図ベースのバイオーム分布
  selectBiome: (
    position: Position,
    seed: WorldSeed
  ): Effect.Effect<Biome> =>
    Effect.gen(function* () {
      // 温度・湿度マップの生成
      const temperature = yield* getTemperatureAt(position, seed)
      const humidity = yield* getHumidityAt(position, seed)
      const elevation = yield* getElevationAt(position, seed)

      // バイオーム決定
      return determineeBiomeFromClimate(temperature, humidity, elevation)
    }),

  // 気候パラメータからバイオーム決定
  determineBiomeFromClimate: (
    temperature: number,
    humidity: number,
    elevation: number
  ): Biome => {
    // 高度による分類
    if (elevation > 0.8) {
      return temperature < 0.2 ? Biomes.SnowyPeaks : Biomes.Mountains
    }

    if (elevation < 0.3) {
      return Biomes.Ocean
    }

    // 温度と湿度による分類
    if (temperature > 0.7) {
      return humidity > 0.5 ? Biomes.Jungle : Biomes.Desert
    }

    if (temperature < 0.2) {
      return humidity > 0.5 ? Biomes.Taiga : Biomes.Tundra
    }

    // デフォルト
    return humidity > 0.6 ? Biomes.Forest : Biomes.Plains
  }
}
```

## 5. 構造物生成

### 5.1 構造物定義

```typescript
export interface Structure {
  readonly id: StructureId
  readonly name: string
  readonly size: BoundingBox
  readonly rarity: number  // 0.0 to 1.0
  readonly validBiomes: ReadonlySet<BiomeId>
  readonly minSpacing: number
  readonly maxSpacing: number
  readonly blocks: StructureBlocks
}

export const Structures = {
  Village: {
    id: "village" as StructureId,
    name: "Village",
    size: { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 30, z: 50 } },
    rarity: 0.1,
    validBiomes: new Set(["plains", "desert", "savanna", "taiga"]),
    minSpacing: 500,
    maxSpacing: 1000,
    blocks: generateVillageBlocks()
  },

  Dungeon: {
    id: "dungeon" as StructureId,
    name: "Dungeon",
    size: { min: { x: -10, y: -5, z: -10 }, max: { x: 10, y: 5, z: 10 } },
    rarity: 0.3,
    validBiomes: new Set(["all"]),
    minSpacing: 100,
    maxSpacing: 300,
    blocks: generateDungeonBlocks()
  },

  // ... 他の構造物
}
```

### 5.2 構造物配置アルゴリズム

```typescript
export const StructurePlacer = {
  placeStructures: (
    region: Region,
    seed: WorldSeed
  ): Effect.Effect<ReadonlyArray<PlacedStructure>, PlacementError> =>
    Effect.gen(function* () {
      const rng = yield* RegionRNG.create(seed, region.id)
      const structures: PlacedStructure[] = []

      // 各構造物タイプについて配置を試みる
      for (const structureType of Object.values(Structures)) {
        const positions = yield* generateStructurePositions(
          region,
          structureType,
          rng
        )

        for (const position of positions) {
          // 配置可能性チェック
          if (yield* canPlaceStructure(position, structureType, region)) {
            const rotation = yield* rng.nextInt(0, 3)
            const variant = yield* selectVariant(structureType, rng)

            structures.push({
              type: structureType.id,
              position,
              rotation,
              variant,
              boundingBox: calculateBoundingBox(position, structureType, rotation)
            })
          }
        }
      }

      return structures
    }),

  // ジッタードグリッド配置
  generateStructurePositions: (
    region: Region,
    structure: Structure,
    rng: RNG
  ): Effect.Effect<ReadonlyArray<Position>> =>
    Effect.gen(function* () {
      const positions: Position[] = []
      const gridSize = (structure.minSpacing + structure.maxSpacing) / 2

      for (let x = region.minX; x < region.maxX; x += gridSize) {
        for (let z = region.minZ; z < region.maxZ; z += gridSize) {
          if (yield* rng.nextFloat() < structure.rarity) {
            const jitterX = yield* rng.nextInt(-gridSize / 4, gridSize / 4)
            const jitterZ = yield* rng.nextInt(-gridSize / 4, gridSize / 4)

            positions.push({
              x: x + jitterX,
              y: 0,  // 後で地形に合わせて調整
              z: z + jitterZ
            })
          }
        }
      }

      return positions
    })
}
```

## 6. 洞窟・鉱脈生成

### 6.1 洞窟システム

```typescript
export const CaveGenerator = {
  generateCaves: (
    chunk: Chunk,
    seed: WorldSeed
  ): Effect.Effect<Chunk, CaveGenerationError> =>
    Effect.gen(function* () {
      const modifiedBlocks = [...chunk.blocks]

      // Worley Noiseによる大規模洞窟
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            const worldPos = chunkToWorld(chunk.coordinate, { x, y, z })
            const caveNoise = worleyNoise3D(
              worldPos.x * 0.02,
              worldPos.y * 0.02,
              worldPos.z * 0.02
            )

            if (caveNoise > 0.7) {
              modifiedBlocks[getBlockIndex(x, y, z)] = BlockType.Air
            }
          }
        }
      }

      // Perlin Wormによる通路
      const worms = yield* generateCaveWorms(chunk.coordinate, seed)
      for (const worm of worms) {
        yield* carveWorm(modifiedBlocks, worm)
      }

      return { ...chunk, blocks: modifiedBlocks }
    })
}
```

### 6.2 鉱脈生成

```typescript
export interface OreConfig {
  readonly block: BlockType
  readonly size: number
  readonly count: number
  readonly minHeight: number
  readonly maxHeight: number
  readonly rarity: number
}

export const OreConfigs: Record<string, OreConfig> = {
  Coal: {
    block: BlockType.CoalOre,
    size: 17,
    count: 20,
    minHeight: 0,
    maxHeight: 128,
    rarity: 1.0
  },
  Iron: {
    block: BlockType.IronOre,
    size: 9,
    count: 20,
    minHeight: 0,
    maxHeight: 64,
    rarity: 0.8
  },
  Gold: {
    block: BlockType.GoldOre,
    size: 9,
    count: 2,
    minHeight: 0,
    maxHeight: 32,
    rarity: 0.3
  },
  Diamond: {
    block: BlockType.DiamondOre,
    size: 8,
    count: 1,
    minHeight: 0,
    maxHeight: 16,
    rarity: 0.1
  }
}

export const OreGenerator = {
  generateOres: (
    chunk: Chunk,
    seed: WorldSeed
  ): Effect.Effect<Chunk, OreGenerationError> =>
    Effect.gen(function* () {
      const rng = yield* ChunkRNG.create(seed, chunk.coordinate)
      let modifiedBlocks = [...chunk.blocks]

      for (const [name, config] of Object.entries(OreConfigs)) {
        if (yield* rng.nextFloat() > config.rarity) continue

        for (let i = 0; i < config.count; i++) {
          const position = yield* selectOrePosition(chunk, config, rng)
          modifiedBlocks = yield* placeOreVein(
            modifiedBlocks,
            position,
            config,
            rng
          )
        }
      }

      return { ...chunk, blocks: modifiedBlocks }
    })
}
```

## 7. パフォーマンス最適化

### 7.1 LOD (Level of Detail) システム

```typescript
export const LODSystem = {
  // 距離に応じた詳細度の調整
  selectLOD: (distance: number): LODLevel => {
    if (distance < 50) return LODLevel.Full
    if (distance < 100) return LODLevel.High
    if (distance < 200) return LODLevel.Medium
    if (distance < 400) return LODLevel.Low
    return LODLevel.Minimal
  },

  // LODに応じた生成
  generateWithLOD: (
    coordinate: ChunkCoordinate,
    lod: LODLevel,
    seed: WorldSeed
  ): Effect.Effect<Chunk> =>
    Effect.gen(function* () {
      switch (lod) {
        case LODLevel.Full:
          return yield* generateFullDetail(coordinate, seed)
        case LODLevel.High:
          return yield* generateHighDetail(coordinate, seed)
        case LODLevel.Medium:
          return yield* generateMediumDetail(coordinate, seed)
        case LODLevel.Low:
          return yield* generateLowDetail(coordinate, seed)
        case LODLevel.Minimal:
          return yield* generateMinimalDetail(coordinate, seed)
      }
    })
}
```

### 7.2 非同期生成とキャッシュ

```typescript
export const AsyncWorldGeneration = {
  // 優先度付きキューによる生成
  generationQueue: Queue.unbounded<GenerationRequest>(),

  // ワーカープールによる並列生成
  processGenerationQueue: Effect.gen(function* () {
    const workers = yield* WorkerPool.create(4, "chunk-generator.worker.js")

    yield* Effect.forever(
      Effect.gen(function* () {
        const request = yield* Queue.take(generationQueue)
        const worker = yield* workers.acquire()

        yield* Effect.fork(
          Effect.gen(function* () {
            try {
              const chunk = yield* worker.generate(request)
              yield* ChunkCache.set(request.coordinate, chunk)
              yield* notifyChunkReady(request.coordinate)
            } finally {
              yield* workers.release(worker)
            }
          })
        )
      })
    )
  }),

  // 生成結果のキャッシュ
  ChunkCache: {
    cache: new LRUCache<ChunkCoordinate, Chunk>(1000),

    get: (coord: ChunkCoordinate): Option.Option<Chunk> =>
      Option.fromNullable(cache.get(coord)),

    set: (coord: ChunkCoordinate, chunk: Chunk): Effect.Effect<void> =>
      Effect.sync(() => cache.set(coord, chunk))
  }
}
```

## 8. まとめ

ワールド生成システムにより：
- **無限の多様性**: プロシージャル生成による無限のバリエーション
- **決定論的**: シードによる再現可能な世界
- **パフォーマンス**: LODと非同期生成による最適化
- **拡張性**: 新しいバイオームや構造物の追加が容易

次のドキュメント：
- [01-chunk-system.md](./01-chunk-system.md) - チャンクシステムの詳細
- [02-block-system.md](./02-block-system.md) - ブロックシステム
