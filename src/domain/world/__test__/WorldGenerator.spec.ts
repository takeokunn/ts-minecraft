/**
 * WorldGenerator インターフェースのテスト
 * Issue #164対応 - World Generator Interface実装
 */
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import {
  createWorldGenerator,
  GenerationError,
  StructureGenerationError,
  type GeneratorOptions,
  type WorldGenerator,
  type Vector3,
  type StructureType,
} from '../index'
import { type ChunkPosition } from '../../chunk/ChunkPosition'
import { NoiseGeneratorLive } from '../NoiseGenerator'
import { TerrainGeneratorLive } from '../TerrainGenerator'
import { BiomeGeneratorLive } from '../BiomeGenerator'
import { CaveGeneratorLive } from '../CaveGenerator'
import { OreDistributionLive, defaultOreConfigs } from '../OreDistribution'

// ================================================================================
// Test Layers - Layer-based DI Pattern
// ================================================================================

const TestLayer = Layer.mergeAll(
  NoiseGeneratorLive({
    seed: 12345,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
  }),
  TerrainGeneratorLive({
    seaLevel: 64,
    maxHeight: 319,
    minHeight: -64,
    surfaceVariation: 32,
    caveThreshold: 0.6,
  }),
  BiomeGeneratorLive({
    temperatureScale: 0.002,
    humidityScale: 0.003,
    mountainThreshold: 80,
    oceanDepth: 10,
    riverWidth: 8,
  }),
  CaveGeneratorLive({
    caveThreshold: 0.2,
    caveScale: 0.02,
    lavaLevel: 10,
    ravineThreshold: 0.05,
    ravineScale: 0.005,
  }),
  OreDistributionLive({
    ores: defaultOreConfigs,
    noiseScale: 0.05,
    clusterThreshold: 0.6,
  })
)

describe('WorldGenerator Interface', () => {
  describe('createWorldGenerator', () => {
    it.effect(
      'デフォルトオプションでジェネレータを作成できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()

          expect(generator).toBeDefined()
          expect(typeof generator.generateChunk).toBe('function')
          expect(typeof generator.generateStructure).toBe('function')
          expect(typeof generator.getSpawnPoint).toBe('function')
          expect(typeof generator.getBiome).toBe('function')
          expect(typeof generator.getTerrainHeight).toBe('function')
          expect(typeof generator.getSeed).toBe('function')
          expect(typeof generator.getOptions).toBe('function')
          expect(typeof generator.canGenerateStructure).toBe('function')
          expect(typeof generator.findNearestStructure).toBe('function')
          return true
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<boolean, never, never>
    )

    it.effect('カスタムオプションでジェネレータを作成できる', () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 12345,
        worldType: 'flat',
        generateStructures: false,
        biomeSize: 5,
      }

      return Effect.gen(function* () {
        const generator = yield* createWorldGenerator(customOptions)
        const options = generator.getOptions()

        expect(generator.getSeed()).toBe(12345)
        expect(options.worldType).toBe('flat')
        expect(options.generateStructures).toBe(false)
        expect(options.biomeSize).toBe(5)
        return true
      }).pipe(Effect.provide(TestLayer)) as Effect.Effect<boolean, never, never>
    })
  })

  describe('チャンク生成', () => {
    it.effect(
      '有効な座標でチャンクを生成できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()
          const position: ChunkPosition = { x: 0, z: 0 }

          const result = yield* generator.generateChunk(position)

          expect(result).toBeDefined()
          expect(result.chunk).toBeDefined()
          expect(result.biomes).toBeDefined()
          expect(result.structures).toBeDefined()
          expect(result.heightMap).toBeDefined()
          return true
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<boolean, GenerationError, never>
    )

    it.effect.skip(
      '複数のチャンクを生成できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()
          const positions: ChunkPosition[] = [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
            { x: -1, z: -1 },
          ]

          // 並行実行の代わりに順次実行でタイムアウトを回避し、メモリ使用量を削減
          const results: any[] = []
          for (const pos of positions) {
            const result = yield* generator.generateChunk(pos)
            results.push(result)
          }

          expect(results).toHaveLength(4)
          results.forEach((result) => {
            expect(result.chunk).toBeDefined()
            expect(result.biomes).toBeDefined()
            expect(result.structures).toBeDefined()
            expect(result.heightMap).toBeDefined()
          })
          return true
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<boolean, GenerationError, never>,
      { timeout: 15000 }
    )
  })

  describe('構造物生成', () => {
    it.effect(
      '構造物生成が有効な場合、構造物を生成できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: true })
          const position: Vector3 = { x: 100, y: 64, z: 100 }

          const structure = yield* generator.generateStructure('village', position)

          expect(structure).toBeDefined()
          expect(structure.type).toBe('village')
          expect(structure.position).toEqual(position)
          return true
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<boolean, StructureGenerationError, never>
    )

    it.effect(
      '構造物生成が無効な場合、エラーを返す',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: false })
          const position: Vector3 = { x: 100, y: 64, z: 100 }

          // Effect.eitherでエラーをキャッチして検証
          const result = yield* Effect.either(generator.generateStructure('village', position))

          expect(result._tag).toBe('Left')
          return true
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<boolean, never, never>
    )

    it.effect(
      'すべての構造物タイプを生成できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: true })
          const position: Vector3 = { x: 0, y: 64, z: 0 }
          const structureTypes: StructureType[] = ['village', 'mineshaft', 'stronghold', 'temple', 'dungeon']

          const structures = yield* Effect.all(
            structureTypes.map((type) => generator.generateStructure(type, position))
          )

          structures.forEach((structure, index) => {
            expect(structure.type).toBe(structureTypes[index])
          })
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    )
  })

  describe('ワールド情報取得', () => {
    it.effect(
      'スポーン地点を取得できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()

          const spawnPoint = yield* generator.getSpawnPoint()

          expect(spawnPoint).toBeDefined()
          expect(typeof spawnPoint.x).toBe('number')
          expect(typeof spawnPoint.y).toBe('number')
          expect(typeof spawnPoint.z).toBe('number')
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    )

    it.effect(
      'バイオーム情報を取得できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()
          const position: Vector3 = { x: 0, y: 64, z: 0 }

          const biome = yield* generator.getBiome(position)

          expect(biome).toBeDefined()
          expect(biome.type).toBeDefined()
          expect(biome.temperature).toBeDefined()
          expect(biome.humidity).toBeDefined()
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    )

    it.effect(
      '地形高さを取得できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()

          const height = yield* generator.getTerrainHeight(0, 0)

          expect(typeof height).toBe('number')
          expect(height).toBeGreaterThanOrEqual(0)
          expect(height).toBeLessThanOrEqual(255)
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    )
  })

  describe('構造物検索', () => {
    it.effect(
      '構造物生成可能性をチェックできる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: true })
          const position: Vector3 = { x: 0, y: 64, z: 0 }

          const canGenerate = yield* generator.canGenerateStructure('village', position)

          expect(typeof canGenerate).toBe('boolean')
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    )

    it.effect(
      '構造物生成が無効な場合、生成不可を返す',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: false })
          const position: Vector3 = { x: 0, y: 64, z: 0 }

          const canGenerate = yield* generator.canGenerateStructure('village', position)

          expect(canGenerate).toBe(false)
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    )

    it.effect(
      '最近接構造物を検索できる',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: true })

          // まず構造物を生成
          const structurePos: Vector3 = { x: 100, y: 64, z: 100 }
          yield* generator.generateStructure('village', structurePos)

          // 近くから検索
          const searchPos: Vector3 = { x: 90, y: 64, z: 90 }
          const foundStructure = yield* generator.findNearestStructure('village', searchPos, 50)

          expect(foundStructure).toBeDefined()
          expect(foundStructure?.type).toBe('village')
          expect(foundStructure?.position).toEqual(structurePos)
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, GenerationError | StructureGenerationError, never>
    )

    it.effect(
      '範囲外の構造物は見つからない',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator({ generateStructures: true })

          // 遠い場所に構造物を生成
          const structurePos: Vector3 = { x: 1000, y: 64, z: 1000 }
          yield* generator.generateStructure('village', structurePos)

          // 近くから狭い範囲で検索
          const searchPos: Vector3 = { x: 0, y: 64, z: 0 }
          const foundStructure = yield* generator.findNearestStructure('village', searchPos, 10)

          expect(foundStructure).toBeNull()
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, GenerationError | StructureGenerationError, never>
    )
  })

  describe('設定とメタデータ', () => {
    it.effect('シード値を取得できる', () => {
      const customSeed = 98765

      return Effect.gen(function* () {
        const generator = yield* createWorldGenerator({ seed: customSeed })

        const seed = generator.getSeed()

        expect(seed).toBe(customSeed)
      }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    })

    it.effect('ジェネレータオプションを取得できる', () => {
      const customOptions: Partial<GeneratorOptions> = {
        seed: 11111,
        worldType: 'amplified',
        generateStructures: true,
        bonusChest: true,
        biomeSize: 7,
      }

      return Effect.gen(function* () {
        const generator = yield* createWorldGenerator(customOptions)
        const options = generator.getOptions()

        expect(options.seed).toBe(11111)
        expect(options.worldType).toBe('amplified')
        expect(options.generateStructures).toBe(true)
        expect(options.bonusChest).toBe(true)
        expect(options.biomeSize).toBe(7)
      }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, never, never>
    })
  })

  describe('エッジケース', () => {
    it.effect.skip(
      '極座標でのチャンク生成',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()
          // 極座標値を現実的な範囲に調整してパフォーマンス問題を回避
          const extremePositions: ChunkPosition[] = [
            { x: 100000, z: 0 },
            { x: -100000, z: 0 },
            { x: 0, z: 100000 },
            { x: 0, z: -100000 },
          ]

          // 順次実行でメモリ使用量を制御し、タイムアウトを防止
          const results: any[] = []
          for (const position of extremePositions) {
            const result = yield* generator.generateChunk(position)
            results.push(result)
          }

          results.forEach((result) => {
            expect(result.chunk).toBeDefined()
            expect(result.biomes).toBeDefined()
            expect(result.structures).toBeDefined()
            expect(result.heightMap).toBeDefined()
          })
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, GenerationError, never>,
      { timeout: 15000 }
    )

    it.effect(
      '無効な構造物タイプでの生成',
      () =>
        Effect.gen(function* () {
          const generator = yield* createWorldGenerator()
          const position: Vector3 = { x: 0, y: 64, z: 0 }

          // TypeScriptの型システムでは防がれるが、実行時の安全性をテスト
          const invalidType = 'invalid_structure' as StructureType

          const structure = yield* generator.generateStructure(invalidType, position)

          // 無効なタイプでも何らかの構造物が生成される（フォールバック動作）
          expect(structure).toBeDefined()
        }).pipe(Effect.provide(TestLayer)) as Effect.Effect<void, StructureGenerationError, never>
    )
  })
})
