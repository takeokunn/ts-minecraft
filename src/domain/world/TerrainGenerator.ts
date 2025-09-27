import type { WorldCoordinate } from '@domain/core/types/brands'
import { BrandedTypes, Height } from '@domain/core/types/brands'
import { Schema } from '@effect/schema'
import { Context, Effect, Layer, Match, Option, pipe } from 'effect'
import type { ChunkData } from '../chunk/ChunkData'
import { getBlockIndex as getChunkBlockIndex } from '../chunk/ChunkData'
import type { ChunkPosition } from '../chunk/ChunkPosition'
import type { NoiseGenerator } from './NoiseGenerator'
import { NoiseGeneratorTag } from './NoiseGenerator'

/**
 * 地形生成の設定
 */
export const TerrainConfigSchema = Schema.Struct({
  seaLevel: pipe(Schema.Number, Schema.int(), Schema.between(0, 256)),
  maxHeight: pipe(Schema.Number, Schema.int(), Schema.between(64, 320)),
  minHeight: pipe(Schema.Number, Schema.int(), Schema.between(-64, 0)),
  surfaceVariation: pipe(Schema.Number, Schema.int(), Schema.between(8, 64)),
  caveThreshold: pipe(Schema.Number, Schema.between(0.1, 1.0)),
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
  readonly generateHeightMap: (position: ChunkPosition) => Effect.Effect<HeightMap, never, NoiseGenerator>

  /**
   * 指定座標の地形高度を取得
   */
  readonly getTerrainHeight: (x: WorldCoordinate, z: WorldCoordinate) => Effect.Effect<Height, never, NoiseGenerator>

  /**
   * チャンクに基本地形ブロックを配置
   */
  readonly generateBaseTerrain: (
    chunkData: ChunkData,
    heightMap: HeightMap
  ) => Effect.Effect<ChunkData, never, NoiseGenerator>

  /**
   * 指定高度でのブロックタイプを決定
   */
  readonly getBlockTypeAtHeight: (
    worldX: WorldCoordinate,
    worldZ: WorldCoordinate,
    y: Height,
    surfaceHeight: Height
  ) => string

  /**
   * 設定を取得
   */
  readonly getConfig: () => TerrainConfig
}

export const TerrainGeneratorTag = Context.GenericTag<TerrainGenerator>('@minecraft/domain/TerrainGenerator')

/**
 * TerrainGeneratorの実装
 */
const createTerrainGenerator = (config: TerrainConfig): TerrainGenerator => {
  return {
    generateHeightMap: (position: ChunkPosition) =>
      Effect.gen(function* () {
        const heightMap: Height[][] = []

        for (let x = 0; x < 16; x++) {
          heightMap[x] = []
          for (let z = 0; z < 16; z++) {
            const worldX = position.x * 16 + x
            const worldZ = position.z * 16 + z

            const noiseGenerator = yield* NoiseGeneratorTag

            // 基本地形高度（大きなスケールのノイズ）
            const baseHeight = yield* noiseGenerator.octaveNoise2D(
              BrandedTypes.createNoiseCoordinate(worldX * 0.005), // 低周波数で大きな地形
              BrandedTypes.createNoiseCoordinate(worldZ * 0.005),
              4, // オクターブ数
              0.6 // 持続性
            )

            // 詳細地形（小さなスケールのノイズ）
            const detailHeight = yield* noiseGenerator.octaveNoise2D(
              BrandedTypes.createNoiseCoordinate(worldX * 0.02), // 高周波数で細かい起伏
              BrandedTypes.createNoiseCoordinate(worldZ * 0.02),
              3,
              0.4
            )

            // 山岳地帯用の高周波ノイズ
            const mountainHeight = yield* noiseGenerator.octaveNoise2D(
              BrandedTypes.createNoiseCoordinate(worldX * 0.001),
              BrandedTypes.createNoiseCoordinate(worldZ * 0.001),
              6,
              0.5
            )

            // 高度計算（海面レベルを基準に調整）
            let finalHeight = config.seaLevel
            finalHeight += baseHeight * 32 // ±32ブロックの基本変動
            finalHeight += detailHeight * 8 // ±8ブロックの詳細変動
            finalHeight += Math.max(0, mountainHeight * 64) // 0-64ブロックの山岳変動

            // 高度制限とHeight型へ変換
            finalHeight = Math.max(config.minHeight, Math.min(config.maxHeight, Math.floor(finalHeight)))
            // Height型は0-256の範囲のみ許可するため、さらにクランプ
            const clampedHeight = Math.max(0, Math.min(256, finalHeight))
            const heightValue = BrandedTypes.createHeight(clampedHeight)

            // 配列アクセスをOptionパターンで安全化
            pipe(
              Option.fromNullable(heightMap[x]),
              Option.map((row) => {
                row[z] = heightValue
              })
            )
          }
        }

        return heightMap
      }),

    getTerrainHeight: (x: WorldCoordinate, z: WorldCoordinate) =>
      Effect.gen(function* () {
        const noiseGenerator = yield* NoiseGeneratorTag

        // 基本地形高度
        const baseHeight = yield* noiseGenerator.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(x * 0.005),
          BrandedTypes.createNoiseCoordinate(z * 0.005),
          4,
          0.6
        )

        // 詳細地形
        const detailHeight = yield* noiseGenerator.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(x * 0.02),
          BrandedTypes.createNoiseCoordinate(z * 0.02),
          3,
          0.4
        )

        // 山岳地帯
        const mountainHeight = yield* noiseGenerator.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(x * 0.001),
          BrandedTypes.createNoiseCoordinate(z * 0.001),
          6,
          0.5
        )

        let finalHeight = config.seaLevel
        finalHeight += baseHeight * 32
        finalHeight += detailHeight * 8
        finalHeight += Math.max(0, mountainHeight * 64)

        const heightValue = Math.max(config.minHeight, Math.min(config.maxHeight, Math.floor(finalHeight)))
        return BrandedTypes.createHeight(heightValue)
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
            const surfaceHeight = heightMap[x]?.[z] ?? BrandedTypes.createHeight(config.seaLevel)
            const worldX = BrandedTypes.createWorldCoordinate(chunkData.position.x * 16 + x)
            const worldZ = BrandedTypes.createWorldCoordinate(chunkData.position.z * 16 + z)

            for (let y = -64; y < 320; y++) {
              const index = getChunkBlockIndex(
                BrandedTypes.createWorldCoordinate(x),
                BrandedTypes.createWorldCoordinate(y),
                BrandedTypes.createWorldCoordinate(z)
              )
              let blockId = blockIds.air

              blockId = pipe(
                Match.value({ y, surfaceHeight, seaLevel: config.seaLevel }),
                // 最下層は岩盤
                Match.when(
                  ({ y }) => y === -64,
                  () => blockIds.bedrock
                ),
                // 地下4ブロック以下は石
                Match.when(
                  ({ y, surfaceHeight }) => y < surfaceHeight - 3,
                  () => blockIds.stone
                ),
                // 表面の1-3ブロック下は土
                Match.when(
                  ({ y, surfaceHeight }) => y < surfaceHeight,
                  () => blockIds.dirt
                ),
                // 表面ブロック
                Match.when(
                  ({ y, surfaceHeight }) => y === surfaceHeight,
                  ({ surfaceHeight }) => {
                    const surfaceBlock = getSurfaceBlockType(worldX, worldZ, surfaceHeight, config.seaLevel)
                    return pipe(
                      Match.value(surfaceBlock),
                      Match.when('grass_block', () => blockIds.grass_block),
                      Match.when('sand', () => blockIds.sand),
                      Match.when('dirt', () => blockIds.dirt),
                      Match.when('stone', () => blockIds.stone),
                      Match.orElse(() => blockIds.grass_block)
                    )
                  }
                ),
                // 海面以下で地形より上の部分は水
                Match.when(
                  ({ y, surfaceHeight, seaLevel }) => y <= seaLevel && y > surfaceHeight,
                  () => blockIds.water
                ),
                // その他は空気
                Match.orElse(() => blockIds.air)
              )

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

    getBlockTypeAtHeight: (worldX: WorldCoordinate, worldZ: WorldCoordinate, y: Height, surfaceHeight: Height) => {
      // 高度と位置に基づいてブロックタイプを決定
      return pipe(
        Match.value(surfaceHeight),
        Match.when(
          (h) => h <= config.seaLevel + 2,
          () => 'sand'
        ),
        Match.when(
          (h) => h > config.seaLevel + 50,
          () => 'stone'
        ),
        Match.orElse(() => 'grass_block')
      )
    },

    getConfig: () => config,
  }
}

/**
 * ローカルのブロックインデックス計算ヘルパー
 * chunk/ChunkData.tsのgetBlockIndexとは別の実装
 */
const calculateBlockIndex = (x: number, y: number, z: number): number => {
  const normalizedY = y + 64 // -64～319 → 0～383
  return normalizedY + z * 384 + x * 384 * 16
}

/**
 * 高度と位置に基づいて表面ブロックタイプを決定
 */
const getSurfaceBlockType = (worldX: number, worldZ: number, surfaceHeight: number, seaLevel: number): string =>
  pipe(
    Match.value(surfaceHeight),
    Match.when(
      (h) => h <= seaLevel + 2,
      () => 'sand'
    ),
    Match.when(
      (h) => h > seaLevel + 50,
      () => 'stone'
    ),
    Match.orElse(() => 'grass_block')
  )

/**
 * TerrainGeneratorのLayer
 */
export const TerrainGeneratorLive = (config: TerrainConfig): Layer.Layer<TerrainGenerator, never, NoiseGenerator> =>
  Layer.effect(
    TerrainGeneratorTag,
    Effect.gen(function* () {
      return createTerrainGenerator(config)
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
