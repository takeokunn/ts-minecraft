import { Context, Effect, Layer, Match, pipe } from 'effect'
import { Schema } from '@effect/schema'
import type { NoiseGenerator } from './NoiseGenerator'
import { NoiseGeneratorTag } from './NoiseGenerator'
import type { ChunkData } from '../chunk/ChunkData'
import type { Vector3 } from './types'
import { BrandedTypes } from '../../shared/types/branded'

/**
 * 洞窟生成の設定
 */
export const CaveConfigSchema = Schema.Struct({
  caveThreshold: Schema.Number, // 洞窟生成の閾値 (-1.0 to 1.0)
  caveScale: Schema.Number, // 洞窟のスケール
  lavaLevel: Schema.Number, // 溶岩生成レベル
  ravineThreshold: Schema.Number, // 峡谷生成の閾値
  ravineScale: Schema.Number, // 峡谷のスケール
})

export type CaveConfig = Schema.Schema.Type<typeof CaveConfigSchema>

/**
 * 洞窟データ
 */
export const CaveDataSchema = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  size: Schema.Number,
  type: Schema.Literal('cave', 'ravine', 'cavern'),
})

export type CaveData = Schema.Schema.Type<typeof CaveDataSchema>

/**
 * 洞窟生成のためのService
 */
export interface CaveGenerator {
  /**
   * チャンクに洞窟を彫り込む
   */
  readonly carveChunk: (chunkData: ChunkData) => Effect.Effect<ChunkData, never, NoiseGenerator>

  /**
   * 指定座標が洞窟内かどうかを判定
   */
  readonly isCave: (position: Vector3) => Effect.Effect<boolean, never, NoiseGenerator>

  /**
   * 峡谷を生成
   */
  readonly generateRavine: (chunkData: ChunkData) => Effect.Effect<ChunkData, never, NoiseGenerator>

  /**
   * 溶岩湖を生成
   */
  readonly generateLavaLakes: (chunkData: ChunkData) => Effect.Effect<ChunkData, never, NoiseGenerator>

  /**
   * 設定を取得
   */
  readonly getConfig: () => CaveConfig
}

export const CaveGeneratorTag = Context.GenericTag<CaveGenerator>('domain/world/CaveGenerator')

/**
 * CaveGeneratorの実装
 */
const createCaveGenerator = (config: CaveConfig): CaveGenerator => {
  const caveGenerator: CaveGenerator = {
    carveChunk: (chunkData: ChunkData) =>
      Effect.gen(function* () {
        const newBlocks = new Uint16Array(chunkData.blocks)

        // ブロックIDの定義
        const AIR_ID = 0
        const LAVA_ID = 7
        const WATER_ID = 7 // 簡略化のため溶岩と同じIDを使用

        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = -64; y < 320; y++) {
              const worldX = chunkData.position.x * 16 + x
              const worldZ = chunkData.position.z * 16 + z

              const noiseGenerator = yield* NoiseGeneratorTag

              // 3D洞窟ノイズ
              const caveNoise = yield* noiseGenerator.noise3D(
                BrandedTypes.createNoiseCoordinate(worldX * config.caveScale),
                BrandedTypes.createNoiseCoordinate(y * config.caveScale * 2), // Y軸は少し圧縮
                BrandedTypes.createNoiseCoordinate(worldZ * config.caveScale)
              )

              // 洞窟生成判定
              const isCaveBlock = Math.abs(caveNoise) < config.caveThreshold

              if (isCaveBlock) {
                const index = getBlockIndex(x, y, z)
                const currentBlock = newBlocks[index] ?? 0

                // 既に空気でない場合のみ処理
                if (currentBlock !== AIR_ID) {
                  // Match.valueパターンを使用してy座標に基づく分岐
                  pipe(
                    y,
                    Match.value,
                    Match.when(
                      (y) => y <= config.lavaLevel,
                      () => {
                        newBlocks[index] = LAVA_ID
                      }
                    ),
                    Match.orElse(() => {
                      newBlocks[index] = AIR_ID
                    })
                  )
                }
              }
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

    isCave: (position: Vector3) =>
      Effect.gen(function* () {
        const noiseGenerator = yield* NoiseGeneratorTag
        const caveNoise = yield* noiseGenerator.noise3D(
          BrandedTypes.createNoiseCoordinate(position.x * config.caveScale),
          BrandedTypes.createNoiseCoordinate(position.y * config.caveScale * 2),
          BrandedTypes.createNoiseCoordinate(position.z * config.caveScale)
        )

        return Math.abs(caveNoise) < config.caveThreshold
      }),

    generateRavine: (chunkData: ChunkData) =>
      Effect.gen(function* () {
        const newBlocks = new Uint16Array(chunkData.blocks)
        const AIR_ID = 0

        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            const worldX = chunkData.position.x * 16 + x
            const worldZ = chunkData.position.z * 16 + z

            const noiseGenerator = yield* NoiseGeneratorTag
            // 峡谷ノイズ（2Dで地表から切り込む）
            const ravineNoise = yield* noiseGenerator.noise2D(
              BrandedTypes.createNoiseCoordinate(worldX * config.ravineScale),
              BrandedTypes.createNoiseCoordinate(worldZ * config.ravineScale)
            )

            // 峡谷の深さを決定
            const isRavine = Math.abs(ravineNoise) < config.ravineThreshold

            if (isRavine) {
              // 峡谷の深さを計算（地表から下に向かって彫る）
              const ravineDepth = Math.floor(Math.abs(ravineNoise) * 60) + 20
              const surfaceY = 64 // 仮の地表レベル

              for (let y = surfaceY; y > surfaceY - ravineDepth && y > -64; y--) {
                const index = getBlockIndex(x, y, z)
                newBlocks[index] = AIR_ID
              }
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

    generateLavaLakes: (chunkData: ChunkData) =>
      Effect.gen(function* () {
        const newBlocks = new Uint16Array(chunkData.blocks)
        const LAVA_ID = 7

        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            const worldX = chunkData.position.x * 16 + x
            const worldZ = chunkData.position.z * 16 + z

            const noiseGenerator = yield* NoiseGeneratorTag
            // 溶岩湖ノイズ
            const lakeNoise = yield* noiseGenerator.noise2D(
              BrandedTypes.createNoiseCoordinate(worldX * 0.02),
              BrandedTypes.createNoiseCoordinate(worldZ * 0.02)
            )

            // 溶岩湖生成判定
            const isLavaLake = lakeNoise > 0.7

            if (isLavaLake) {
              // 溶岩レベル周辺に溶岩湖を生成
              for (let y = config.lavaLevel - 3; y <= config.lavaLevel + 1; y++) {
                if (y >= -64 && y < 320) {
                  const index = getBlockIndex(x, y, z)
                  const currentBlock = newBlocks[index] ?? 0

                  // Match.valueパターンを使用してブロック種別による分岐
                  pipe(
                    currentBlock,
                    Match.value,
                    Match.when(
                      (block) => block === 0 || block === 2,
                      () => {
                        newBlocks[index] = LAVA_ID
                      }
                    ),
                    Match.orElse(() => {
                      // その他のブロックは変更しない
                    })
                  )
                }
              }
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

    getConfig: () => config,
  }

  return caveGenerator
}

/**
 * ブロックインデックス計算（chunk/ChunkData.tsと同じロジック）
 */
const getBlockIndex = (x: number, y: number, z: number): number => {
  const normalizedY = y + 64 // -64～319 → 0～383
  return normalizedY + (z << 9) + (x << 13)
}

/**
 * CaveGeneratorのLayer
 */
export const CaveGeneratorLive = (config: CaveConfig): Layer.Layer<CaveGenerator, never, NoiseGenerator> =>
  Layer.effect(
    CaveGeneratorTag,
    Effect.gen(function* () {
      return createCaveGenerator(config)
    })
  )

/**
 * デフォルト設定でのLayer
 */
export const CaveGeneratorLiveDefault = CaveGeneratorLive({
  caveThreshold: 0.2, // 洞窟生成の閾値
  caveScale: 0.02, // 洞窟のスケール
  lavaLevel: 10, // 溶岩生成レベル
  ravineThreshold: 0.05, // 峡谷生成の閾値（稀）
  ravineScale: 0.005, // 峡谷のスケール（大きな地形）
})
