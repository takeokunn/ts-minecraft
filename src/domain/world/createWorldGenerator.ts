/**
 * ワールドジェネレータのファクトリ関数
 *
 * @module domain/world/createWorldGenerator
 */

import { Effect, Layer, Match, Option, pipe } from 'effect'
import { createChunkData } from '../chunk/ChunkData'
import type { ChunkData } from '../chunk/ChunkData'
import type { ChunkPosition } from '../chunk/ChunkPosition'
import { BrandedTypes } from '@domain/core/types/brands'
import type { BiomeInfo, BiomeType, Structure, Vector3 } from './types'
import type { ChunkGenerationResult, GenerationError, GeneratorState, WorldGenerator } from './WorldGenerator'
import { StructureGenerationError } from './WorldGenerator'
import type { GeneratorOptions, StructureType } from './GeneratorOptions'
import { createGeneratorOptions } from './GeneratorOptions'
import { NoiseGeneratorTag, NoiseGeneratorLive } from './NoiseGenerator'
import { TerrainGeneratorTag, TerrainGeneratorLive } from './TerrainGenerator'
import { BiomeGeneratorTag, BiomeGeneratorLive } from './BiomeGenerator'
import { CaveGeneratorTag, CaveGeneratorLive } from './CaveGenerator'
import { OreDistributionTag, OreDistributionLive, defaultOreConfigs } from './OreDistribution'

/**
 * 空のチャンクを生成（仮実装）
 */
const createEmptyChunk = (position: ChunkPosition): ChunkGenerationResult => {
  const chunk = createChunkData(position)
  const biomes: BiomeType[] = ['plains']
  const structures: Structure[] = []
  const heightMap: number[] = new Array(256).fill(64) // 16x16 = 256

  return {
    chunk,
    biomes,
    structures,
    heightMap,
  }
}

/**
 * 構造物を生成（仮実装）
 */
const createStructure = (type: StructureType, position: Vector3): Structure => ({
  type,
  position,
  boundingBox: {
    min: { x: position.x - 10, y: position.y - 5, z: position.z - 10 },
    max: { x: position.x + 10, y: position.y + 5, z: position.z + 10 },
  },
  metadata: {
    generated: Date.now(),
    type,
  },
})

/**
 * デフォルトバイオーム情報
 */
const getDefaultBiomeInfo = (type: BiomeType): BiomeInfo => {
  const biomeData: Record<BiomeType, { temperature: number; humidity: number; elevation: number }> = {
    plains: { temperature: 0.8, humidity: 0.4, elevation: 0.1 },
    desert: { temperature: 2.0, humidity: 0.0, elevation: 0.125 },
    forest: { temperature: 0.7, humidity: 0.8, elevation: 0.2 },
    jungle: { temperature: 1.2, humidity: 0.9, elevation: 0.2 },
    swamp: { temperature: 0.8, humidity: 0.9, elevation: -0.1 },
    taiga: { temperature: 0.3, humidity: 0.8, elevation: 0.2 },
    snowy_tundra: { temperature: 0.0, humidity: 0.5, elevation: 0.125 },
    mountains: { temperature: 0.2, humidity: 0.3, elevation: 0.8 },
    ocean: { temperature: 0.5, humidity: 0.5, elevation: -0.5 },
    river: { temperature: 0.5, humidity: 0.5, elevation: -0.3 },
    beach: { temperature: 0.8, humidity: 0.4, elevation: 0.0 },
    mushroom_fields: { temperature: 0.9, humidity: 1.0, elevation: 0.1 },
    savanna: { temperature: 1.2, humidity: 0.0, elevation: 0.125 },
    badlands: { temperature: 2.0, humidity: 0.0, elevation: 0.3 },
    nether: { temperature: 2.0, humidity: 0.0, elevation: 0.0 },
    end: { temperature: 0.5, humidity: 0.5, elevation: 0.0 },
    void: { temperature: 0.5, humidity: 0.5, elevation: -1.0 },
  }

  const data = biomeData[type]
  return {
    type,
    temperature: data.temperature,
    humidity: data.humidity,
    elevation: data.elevation,
  }
}

/**
 * ワールドジェネレータを作成
 */
export const createWorldGenerator = (options: Partial<GeneratorOptions> = {}): Effect.Effect<WorldGenerator, never> => {
  const generatorOptions = createGeneratorOptions(options)

  // ジェネレータの状態を初期化（mutable内部状態）
  const state = {
    seed: generatorOptions.seed,
    options: generatorOptions,
    generatedChunks: new Map<string, ChunkData>(),
    structures: [] as Structure[],
    spawnPoint: { x: 0, y: 64, z: 0 } as Vector3,
  }

  // 地形生成サービスのLayerを構築
  const noiseLayer = NoiseGeneratorLive({
    seed: generatorOptions.seed,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
  })

  const terrainLayer = Layer.merge(
    noiseLayer,
    TerrainGeneratorLive({
      seaLevel: generatorOptions.seaLevel,
      maxHeight: 319,
      minHeight: -64,
      surfaceVariation: 32,
      caveThreshold: 0.6,
    })
  )

  const biomeLayer = Layer.merge(
    noiseLayer,
    BiomeGeneratorLive({
      temperatureScale: 0.002,
      humidityScale: 0.003,
      mountainThreshold: 80,
      oceanDepth: 10,
      riverWidth: 8,
    })
  )

  const caveLayer = Layer.merge(
    noiseLayer,
    CaveGeneratorLive({
      caveThreshold: 0.2,
      caveScale: 0.02,
      lavaLevel: 10,
      ravineThreshold: 0.05,
      ravineScale: 0.005,
    })
  )

  const oreLayer = Layer.merge(
    noiseLayer,
    OreDistributionLive({
      ores: defaultOreConfigs,
      noiseScale: 0.05,
      clusterThreshold: 0.6,
    })
  )

  const fullLayer = Layer.mergeAll(terrainLayer, biomeLayer, caveLayer, oreLayer)

  const generator: WorldGenerator = {
    generateChunk: (position: ChunkPosition) =>
      Effect.gen(function* () {
        // 地形生成サービスを取得
        const terrainGenerator = yield* TerrainGeneratorTag
        const biomeGenerator = yield* BiomeGeneratorTag
        const caveGenerator = yield* CaveGeneratorTag
        const oreDistribution = yield* OreDistributionTag

        // 1. 空のチャンクデータを作成
        let chunkData = createChunkData(position)

        // 2. 高度マップを生成
        const heightMap = yield* terrainGenerator.generateHeightMap(position)

        // 3. 基本地形を生成
        chunkData = yield* terrainGenerator.generateBaseTerrain(chunkData, heightMap)

        // 4. バイオームマップを生成
        const biomeMap = yield* biomeGenerator.generateBiomeMap(position.x, position.z)

        // 5. 洞窟を彫り込み
        chunkData = yield* caveGenerator.carveChunk(chunkData)

        // 6. 鉱石を配置
        chunkData = yield* oreDistribution.placeOres(chunkData)

        // 7. 結果をキャッシュに保存
        const chunkKey = `${position.x}_${position.z}`
        state.generatedChunks.set(chunkKey, chunkData)

        // 8. 結果を構築
        const biomes = biomeMap.flat()
        const heightMapFlat = heightMap.flat()
        const structures: Structure[] = []

        return {
          chunk: chunkData,
          biomes,
          structures,
          heightMap: heightMapFlat,
        }
      }).pipe(Effect.provide(fullLayer)) as unknown as Effect.Effect<ChunkGenerationResult, GenerationError, never>,

    generateStructure: (type: StructureType, position: Vector3) =>
      Effect.gen(function* () {
        // Match.valueパターンを使用して構造物生成の有効性をチェック
        const structure = yield* pipe(
          Match.value(!generatorOptions.generateStructures),
          Match.when(true, () =>
            Effect.fail(StructureGenerationError(type, position, 'Structure generation is disabled'))
          ),
          Match.orElse(() =>
            Effect.gen(function* () {
              const structure = createStructure(type, position)
              state.structures.push(structure)
              return structure
            })
          )
        )

        return structure
      }),

    getSpawnPoint: () => Effect.succeed(state.spawnPoint),

    getBiome: (position: Vector3) =>
      Effect.gen(function* () {
        const biomeGenerator = yield* BiomeGeneratorTag
        const biomeType = yield* biomeGenerator.getBiome(position)
        const climateData = yield* biomeGenerator.getClimateData(position.x, position.z)

        return {
          type: biomeType,
          temperature: climateData.temperature,
          humidity: climateData.humidity,
          elevation: climateData.elevation + position.y,
        }
      }).pipe(Effect.provide(Layer.mergeAll(biomeLayer, noiseLayer))) as unknown as Effect.Effect<
        BiomeInfo,
        never,
        never
      >,

    getTerrainHeight: (x: number, z: number) =>
      Effect.gen(function* () {
        const terrainGenerator = yield* TerrainGeneratorTag
        return yield* terrainGenerator.getTerrainHeight(
          BrandedTypes.createWorldCoordinate(x),
          BrandedTypes.createWorldCoordinate(z)
        )
      }).pipe(Effect.provide(Layer.mergeAll(terrainLayer, noiseLayer))) as unknown as Effect.Effect<
        number,
        never,
        never
      >,

    getSeed: () => state.seed,

    getOptions: () => state.options,

    canGenerateStructure: (type: StructureType, position: Vector3) =>
      Effect.gen(function* () {
        const structuresEnabled = yield* pipe(
          Match.value(generatorOptions.generateStructures),
          Match.when(false, () => Effect.succeed(false)),
          Match.orElse(() => Effect.succeed(true))
        )

        return yield* pipe(
          structuresEnabled,
          Match.value,
          Match.when(false, () => Effect.succeed(false)),
          Match.orElse(() =>
            // 構造物タイプごとの生成条件をチェック
            Effect.succeed(
              pipe(
                Match.value(type),
                Match.when('village', () => generatorOptions.features.villages),
                Match.when('mineshaft', () => generatorOptions.features.mineshafts),
                Match.when('stronghold', () => generatorOptions.features.strongholds),
                Match.when('temple', () => generatorOptions.features.temples),
                Match.when('dungeon', () => generatorOptions.features.dungeons),
                Match.orElse(() => true)
              )
            )
          )
        )
      }),

    findNearestStructure: (type: StructureType, position: Vector3, searchRadius: number) =>
      Effect.gen(function* () {
        const nearbyStructures = state.structures.filter((s) => {
          return pipe(
            s.type !== type,
            Match.value,
            Match.when(true, () => false),
            Match.when(false, () => {
              const dx = s.position.x - position.x
              const dz = s.position.z - position.z
              const distance = Math.sqrt(dx * dx + dz * dz)

              return distance <= searchRadius
            }),
            Match.exhaustive
          )
        })

        return Option.match(Option.fromNullable(nearbyStructures.length > 0 ? nearbyStructures : null), {
          onNone: () => null,
          onSome: (structures) => {
            // 最も近い構造物を返す
            return structures.reduce((nearest, current) => {
              const currentDist = Math.sqrt(
                Math.pow(current.position.x - position.x, 2) + Math.pow(current.position.z - position.z, 2)
              )
              const nearestDist = Math.sqrt(
                Math.pow(nearest.position.x - position.x, 2) + Math.pow(nearest.position.z - position.z, 2)
              )
              return currentDist < nearestDist ? current : nearest
            })
          },
        })
      }),
  }

  return Effect.succeed(generator)
}
