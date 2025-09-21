/**
 * ワールドジェネレータのファクトリ関数
 *
 * @module domain/world/createWorldGenerator
 */

import { Effect } from 'effect'
import { createChunkData } from '../chunk/ChunkData.js'
import type { ChunkData } from '../chunk/ChunkData.js'
import type { ChunkPosition } from '../chunk/ChunkPosition.js'
import type { BiomeInfo, BiomeType, Structure, Vector3 } from './types.js'
import type { ChunkGenerationResult, GenerationError, GeneratorState, WorldGenerator } from './WorldGenerator.js'
import { StructureGenerationError } from './WorldGenerator.js'
import type { GeneratorOptions, StructureType } from './GeneratorOptions.js'
import { createGeneratorOptions } from './GeneratorOptions.js'

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

  const generator: WorldGenerator = {
    generateChunk: (position: ChunkPosition) =>
      Effect.gen(function* () {
        // TODO: 実際のチャンク生成ロジックを実装
        // 現在は仮実装として空のチャンクを返す
        const result = createEmptyChunk(position)

        // チャンクをキャッシュに追加
        const chunkKey = `${position.x}_${position.z}`
        state.generatedChunks.set(chunkKey, result.chunk)

        return result
      }),

    generateStructure: (type: StructureType, position: Vector3) =>
      Effect.gen(function* () {
        // TODO: 実際の構造物生成ロジックを実装
        // 現在は仮実装として簡単な構造物を返す
        if (!generatorOptions.generateStructures) {
          return yield* Effect.fail(
            new StructureGenerationError({
              structureType: type,
              position,
              reason: 'Structure generation is disabled',
            })
          )
        }

        const structure = createStructure(type, position)
        state.structures.push(structure)
        return structure
      }),

    getSpawnPoint: () => Effect.succeed(state.spawnPoint),

    getBiome: (position: Vector3) =>
      Effect.gen(function* () {
        // TODO: 実際のバイオーム判定ロジックを実装
        // 現在は仮実装として平原を返す
        return getDefaultBiomeInfo('plains')
      }),

    getTerrainHeight: (x: number, z: number) =>
      Effect.gen(function* () {
        // TODO: 実際の地形高さ計算を実装
        // 現在は仮実装として海面レベルを返す
        return generatorOptions.seaLevel
      }),

    getSeed: () => state.seed,

    getOptions: () => state.options,

    canGenerateStructure: (type: StructureType, position: Vector3) =>
      Effect.gen(function* () {
        // TODO: 構造物生成可能性の判定ロジックを実装
        if (!generatorOptions.generateStructures) {
          return false
        }

        // 構造物タイプごとの生成条件をチェック
        switch (type) {
          case 'village':
            return generatorOptions.features.villages
          case 'mineshaft':
            return generatorOptions.features.mineshafts
          case 'stronghold':
            return generatorOptions.features.strongholds
          case 'temple':
            return generatorOptions.features.temples
          case 'dungeon':
            return generatorOptions.features.dungeons
          default:
            return true
        }
      }),

    findNearestStructure: (type: StructureType, position: Vector3, searchRadius: number) =>
      Effect.gen(function* () {
        // TODO: 実際の構造物検索ロジックを実装
        // 現在は仮実装としてnullを返す
        const nearbyStructures = state.structures.filter((s) => {
          if (s.type !== type) return false

          const dx = s.position.x - position.x
          const dz = s.position.z - position.z
          const distance = Math.sqrt(dx * dx + dz * dz)

          return distance <= searchRadius
        })

        if (nearbyStructures.length === 0) {
          return null
        }

        // 最も近い構造物を返す
        return nearbyStructures.reduce((nearest, current) => {
          const currentDist = Math.sqrt(
            Math.pow(current.position.x - position.x, 2) + Math.pow(current.position.z - position.z, 2)
          )
          const nearestDist = Math.sqrt(
            Math.pow(nearest.position.x - position.x, 2) + Math.pow(nearest.position.z - position.z, 2)
          )
          return currentDist < nearestDist ? current : nearest
        })
      }),
  }

  return Effect.succeed(generator)
}
