import { Context, Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import { NoiseGenerator } from './NoiseGenerator'
import type { ChunkPosition } from '../chunk/ChunkPosition'
import type { ChunkData } from '../chunk/ChunkData'

/**
 * 地形生成の設定
 */
export const TerrainConfigSchema = Schema.Struct({
  seaLevel: Schema.Number,
  maxHeight: Schema.Number,
  minHeight: Schema.Number,
  surfaceVariation: Schema.Number,
  caveThreshold: Schema.Number,
})

export type TerrainConfig = Schema.Schema.Type<typeof TerrainConfigSchema>

/**
 * 高度マップ（16x16のチャンク用）
 */
export const HeightMapSchema = Schema.Array(Schema.Array(Schema.Number))
export type HeightMap = Schema.Schema.Type<typeof HeightMapSchema>

/**
 * 地形生成のためのService
 */
export interface TerrainGenerator {
  /**
   * チャンクの高度マップを生成
   */
  readonly generateHeightMap: (position: ChunkPosition) => Effect.Effect<HeightMap, never>

  /**
   * 指定座標の地形高度を取得
   */
  readonly getTerrainHeight: (x: number, z: number) => Effect.Effect<number, never>

  /**
   * チャンクに基本地形ブロックを配置
   */
  readonly generateBaseTerrain: (chunkData: ChunkData, heightMap: HeightMap) => Effect.Effect<ChunkData, never>

  /**
   * 指定高度でのブロックタイプを決定
   */
  readonly getBlockTypeAtHeight: (worldX: number, worldZ: number, y: number, surfaceHeight: number) => string

  /**
   * 設定を取得
   */
  readonly getConfig: () => TerrainConfig
}

export const TerrainGenerator = Context.GenericTag<TerrainGenerator>('domain/world/TerrainGenerator')

/**
 * TerrainGeneratorの実装
 */
const createTerrainGenerator = (config: TerrainConfig, noiseGenerator: NoiseGenerator): TerrainGenerator => {
  return {
    generateHeightMap: (position: ChunkPosition) =>
      Effect.gen(function* () {
        const heightMap: number[][] = []

        for (let x = 0; x < 16; x++) {
          heightMap[x] = []
          for (let z = 0; z < 16; z++) {
            const worldX = position.x * 16 + x
            const worldZ = position.z * 16 + z

            // 基本地形高度（大きなスケールのノイズ）
            const baseHeight = yield* noiseGenerator.octaveNoise2D(
              worldX * 0.005, // 低周波数で大きな地形
              worldZ * 0.005,
              4, // オクターブ数
              0.6 // 持続性
            )

            // 詳細地形（小さなスケールのノイズ）
            const detailHeight = yield* noiseGenerator.octaveNoise2D(
              worldX * 0.02, // 高周波数で細かい起伏
              worldZ * 0.02,
              3,
              0.4
            )

            // 山岳地帯用の高周波ノイズ
            const mountainHeight = yield* noiseGenerator.octaveNoise2D(
              worldX * 0.001,
              worldZ * 0.001,
              6,
              0.5
            )

            // 高度計算（海面レベルを基準に調整）
            let finalHeight = config.seaLevel
            finalHeight += baseHeight * 32 // ±32ブロックの基本変動
            finalHeight += detailHeight * 8 // ±8ブロックの詳細変動
            finalHeight += Math.max(0, mountainHeight * 64) // 0-64ブロックの山岳変動

            // 高度制限
            finalHeight = Math.max(config.minHeight, Math.min(config.maxHeight, Math.floor(finalHeight)))

            heightMap[x][z] = finalHeight
          }
        }

        return heightMap
      }),

    getTerrainHeight: (x: number, z: number) =>
      Effect.gen(function* () {
        // 基本地形高度
        const baseHeight = yield* noiseGenerator.octaveNoise2D(x * 0.005, z * 0.005, 4, 0.6)

        // 詳細地形
        const detailHeight = yield* noiseGenerator.octaveNoise2D(x * 0.02, z * 0.02, 3, 0.4)

        // 山岳地帯
        const mountainHeight = yield* noiseGenerator.octaveNoise2D(x * 0.001, z * 0.001, 6, 0.5)

        let finalHeight = config.seaLevel
        finalHeight += baseHeight * 32
        finalHeight += detailHeight * 8
        finalHeight += Math.max(0, mountainHeight * 64)

        return Math.max(config.minHeight, Math.min(config.maxHeight, Math.floor(finalHeight)))
      }),

    generateBaseTerrain: (chunkData: ChunkData, heightMap: HeightMap) =>
      Effect.gen(function* () {
        const newBlocks = new Uint16Array(chunkData.blocks)

        // ブロックIDのマッピング（文字列ID → 数値ID）
        const blockIds = {
          air: 0,
          bedrock: 1,
          stone: 2,
          dirt: 3,
          grass_block: 4,
          sand: 5,
          gravel: 6,
          water: 7,
        }

        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            const surfaceHeight = heightMap[x]?.[z] ?? config.seaLevel
            const worldX = chunkData.position.x * 16 + x
            const worldZ = chunkData.position.z * 16 + z

            for (let y = -64; y < 320; y++) {
              const index = getBlockIndex(x, y, z)
              let blockId = blockIds.air

              if (y === -64) {
                // 最下層は岩盤
                blockId = blockIds.bedrock
              } else if (y < surfaceHeight - 3) {
                // 地下4ブロック以下は石
                blockId = blockIds.stone
              } else if (y < surfaceHeight) {
                // 表面の1-3ブロック下は土
                blockId = blockIds.dirt
              } else if (y === surfaceHeight) {
                // 表面ブロック
                const surfaceBlock = getSurfaceBlockType(worldX, worldZ, surfaceHeight, config.seaLevel)
                switch (surfaceBlock) {
                  case 'grass_block':
                    blockId = blockIds.grass_block
                    break
                  case 'sand':
                    blockId = blockIds.sand
                    break
                  case 'dirt':
                    blockId = blockIds.dirt
                    break
                  default:
                    blockId = blockIds.grass_block
                }
              } else if (y <= config.seaLevel && y > surfaceHeight) {
                // 海面以下で地形より上の部分は水
                blockId = blockIds.water
              }

              newBlocks[index] = blockId
            }
          }
        }

        return {
          ...chunkData,
          blocks: newBlocks,
          isDirty: true,
          metadata: {
            ...chunkData.metadata,
            isModified: true,
            lastUpdate: Date.now(),
          },
        }
      }),

    getBlockTypeAtHeight: (worldX: number, worldZ: number, y: number, surfaceHeight: number) => {
      // 高度と位置に基づいてブロックタイプを決定
      if (surfaceHeight <= config.seaLevel + 2) {
        // 海面近くは砂
        return 'sand'
      } else if (surfaceHeight > config.seaLevel + 50) {
        // 高山地帯は石
        return 'stone'
      } else {
        // 通常の平原は草ブロック
        return 'grass_block'
      }
    },

    getConfig: () => config,
  }
}

/**
 * ブロックインデックス計算（chunk/ChunkData.tsと同じロジック）
 */
const getBlockIndex = (x: number, y: number, z: number): number => {
  const normalizedY = y + 64 // -64～319 → 0～383
  return normalizedY + (z << 9) + (x << 13)
}

/**
 * 高度と位置に基づいて表面ブロックタイプを決定
 */
const getSurfaceBlockType = (worldX: number, worldZ: number, surfaceHeight: number, seaLevel: number): string => {
  if (surfaceHeight <= seaLevel + 2) {
    // 海面近くは砂
    return 'sand'
  } else if (surfaceHeight > seaLevel + 50) {
    // 高山地帯は石
    return 'stone'
  } else {
    // 通常の平原は草ブロック
    return 'grass_block'
  }
}

/**
 * TerrainGeneratorのLayer
 */
export const TerrainGeneratorLive = (config: TerrainConfig): Layer.Layer<TerrainGenerator, never, NoiseGenerator> =>
  Layer.effect(
    TerrainGenerator,
    Effect.gen(function* () {
      const noiseGenerator = yield* NoiseGenerator
      return createTerrainGenerator(config, noiseGenerator)
    })
  )

/**
 * デフォルト設定でのLayer
 */
export const TerrainGeneratorLiveDefault = TerrainGeneratorLive({
  seaLevel: 64,
  maxHeight: 319,
  minHeight: -64,
  surfaceVariation: 32,
  caveThreshold: 0.6,
})