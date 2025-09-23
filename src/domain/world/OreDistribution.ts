import { Context, Effect, Layer, Match, pipe, Option } from 'effect'
import { Schema } from '@effect/schema'
import type { NoiseGenerator } from './NoiseGenerator'
import { NoiseGeneratorTag } from './NoiseGenerator'
import type { ChunkData } from '../chunk/ChunkData'
import type { Vector3 } from './types'
import { BrandedTypes } from '../../shared/types/branded'

/**
 * 鉱石の種類
 */
export const OreTypeSchema = Schema.Literal(
  'coal_ore',
  'iron_ore',
  'copper_ore',
  'gold_ore',
  'redstone_ore',
  'lapis_ore',
  'diamond_ore',
  'emerald_ore'
)

export type OreType = Schema.Schema.Type<typeof OreTypeSchema>

/**
 * 鉱石生成の設定
 */
export const OreConfigSchema = Schema.Struct({
  type: OreTypeSchema,
  blockId: Schema.Number,
  minY: Schema.Number,
  maxY: Schema.Number,
  density: Schema.Number, // 0.0-1.0の生成密度
  clusterSize: Schema.Number, // クラスターサイズ
  rarity: Schema.Number, // 希少性（低いほど稀）
  noiseScale: Schema.Number, // ノイズスケール
})

export type OreConfig = Schema.Schema.Type<typeof OreConfigSchema>

/**
 * 鉱石分布設定
 */
export const OreDistributionConfigSchema = Schema.Struct({
  ores: Schema.Array(OreConfigSchema),
  noiseScale: Schema.Number,
  clusterThreshold: Schema.Number,
})

export type OreDistributionConfig = Schema.Schema.Type<typeof OreDistributionConfigSchema>

/**
 * 鉱石分布のためのService
 */
export interface OreDistribution {
  /**
   * チャンクに鉱石を配置
   */
  readonly placeOres: (chunkData: ChunkData) => Effect.Effect<ChunkData, never, NoiseGenerator>

  /**
   * 指定座標で生成可能な鉱石を取得
   */
  readonly getOreAtPosition: (position: Vector3) => Effect.Effect<OreType | null, never, NoiseGenerator>

  /**
   * 指定鉱石の生成密度を計算
   */
  readonly calculateOreDensity: (oreType: OreType, position: Vector3) => Effect.Effect<number, never, NoiseGenerator>

  /**
   * 設定を取得
   */
  readonly getConfig: () => OreDistributionConfig
}

export const OreDistributionTag = Context.GenericTag<OreDistribution>('domain/world/OreDistribution')

/**
 * 鉱石密度を計算する内部関数
 */
const calculateOreDensityInternal = (
  config: OreDistributionConfig,
  oreType: OreType,
  position: Vector3
): Effect.Effect<number, never, NoiseGenerator> =>
  Effect.gen(function* () {
    const oreConfig = config.ores.find((ore) => ore.type === oreType)

    return yield* pipe(
      Option.fromNullable(oreConfig),
      Option.match({
        onNone: () => Effect.succeed(0),
        onSome: (config) =>
          Effect.gen(function* () {
            const noiseGenerator = yield* NoiseGeneratorTag

            // 基本ノイズ
            const baseNoise = yield* noiseGenerator.noise3D(
              BrandedTypes.createNoiseCoordinate(position.x * config.noiseScale),
              BrandedTypes.createNoiseCoordinate(position.y * config.noiseScale),
              BrandedTypes.createNoiseCoordinate(position.z * config.noiseScale)
            )

            // クラスターノイズ（より細かいスケール）
            const clusterNoise = yield* noiseGenerator.noise3D(
              BrandedTypes.createNoiseCoordinate(position.x * config.noiseScale * 3),
              BrandedTypes.createNoiseCoordinate(position.y * config.noiseScale * 3),
              BrandedTypes.createNoiseCoordinate(position.z * config.noiseScale * 3)
            )

            // 高度補正（深いほど希少鉱石が生成されやすい）
            const depthFactor = Math.max(0, (64 - position.y) / 64)

            // 鉱石タイプ別の調整
            const typeMultiplier = pipe(
              Match.value(oreType),
              Match.when('coal_ore', () => 1.5), // 石炭は豊富
              Match.when('iron_ore', () => 1.2),
              Match.when('copper_ore', () => 1.0),
              Match.when('gold_ore', () => 0.6 * depthFactor),
              Match.when('redstone_ore', () => 0.8 * depthFactor),
              Match.when('lapis_ore', () => 0.4 * depthFactor
    }),
    Match.when('diamond_ore', () => 0.2 * depthFactor * depthFactor), // 非常に稀
              Match.when('emerald_ore', () => 0.1 * depthFactor * depthFactor), // 最も稀
              Match.exhaustive
            )

            // 最終密度計算
            const finalDensity = (baseNoise + clusterNoise * 0.5) * config.density * typeMultiplier

            return Math.abs(finalDensity)
          }),
      })
    )
  })

/**
 * OreDistributionの実装
 */
const createOreDistribution = (config: OreDistributionConfig): OreDistribution => {
  const oreDistribution: OreDistribution = {
    placeOres: (chunkData: ChunkData) =>
      Effect.gen(function* () {
        const newBlocks = new Uint16Array(chunkData.blocks)
        const STONE_ID = 2 // 石ブロックID

        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = -64; y < 320; y++) {
              const worldX = chunkData.position.x * 16 + x
              const worldZ = chunkData.position.z * 16 + z
              const index = getBlockIndex(x, y, z)
              const currentBlock = newBlocks[index] ?? 0

              // 石ブロックの場合のみ鉱石生成を検討
              yield* pipe(
                Match.value(currentBlock
    }),
    Match.when(STONE_ID, () => Effect.gen(function* () {
                    const position = { x: worldX, y, z: worldZ }

                    // 各鉱石タイプをチェック
                    for (const oreConfig of config.ores) {
                      // 高度範囲チェック
                      const isInRange = y >= oreConfig.minY && y <= oreConfig.maxY

                      yield* pipe(
                        Match.value(isInRange),
                        Match.when(true, () => Effect.gen(function* () {
                            // 鉱石密度計算（内部関数を使用）
                            const density = yield* calculateOreDensityInternal(config, oreConfig.type, position)

                            // 生成判定
                            yield* pipe(
                              Match.value(density > oreConfig.rarity
    }),
    Match.when(true, () => {
                                newBlocks[index] = oreConfig.blockId
                                return Effect.succeed(true) // 配置完了
                              }),
                              Match.orElse(() => Effect.succeed(false))
                            )
                          })
                        ),
                        Match.orElse(() => Effect.succeed(false))
                      )
                    }
                  })
                ),
                Match.orElse(() => Effect.succeed(undefined))
              )
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

    getOreAtPosition: (position: Vector3) =>
      Effect.gen(function* () {
        for (const oreConfig of config.ores) {
          // 高度範囲チェックと鉱石生成判定
          const result = yield* pipe(
            Match.value(position.y >= oreConfig.minY && position.y <= oreConfig.maxY),
            Match.when(true, () => Effect.gen(function* () {
                // 鉱石密度計算（内部関数を使用）
                const density = yield* calculateOreDensityInternal(config, oreConfig.type, position)

                // 生成判定
                return pipe(
                  Match.value(density > oreConfig.rarity),
                  Match.when(true, () => Option.some(oreConfig.type)
    }),
    Match.orElse(() => Option.none())
                )
              })
            ),
            Match.orElse(() => Effect.succeed(Option.none()))
          )

          const oreResult = yield* pipe(
            result,
            Option.match({
              onNone: () => Effect.succeed(null),
              onSome: (oreType) => Effect.succeed(oreType),
            })
          )

          if (oreResult) {
            return oreResult
          }
        }

        return null
      }),

    calculateOreDensity: (oreType: OreType, position: Vector3) =>
      calculateOreDensityInternal(config, oreType, position),

    getConfig: () => config,
  }

  return oreDistribution
}

/**
 * ブロックインデックス計算（chunk/ChunkData.tsと同じロジック）
 */
const getBlockIndex = (x: number, y: number, z: number): number => {
  const normalizedY = y + 64 // -64～319 → 0～383
  return normalizedY + (z << 9) + (x << 13)
}

/**
 * デフォルトの鉱石設定
 */
export const defaultOreConfigs: OreConfig[] = [
  {
    type: 'coal_ore',
    blockId: 16,
    minY: 0,
    maxY: 256,
    density: 0.8,
    clusterSize: 8,
    rarity: 0.3,
    noiseScale: 0.05,
  },
  {
    type: 'iron_ore',
    blockId: 17,
    minY: -64,
    maxY: 256,
    density: 0.6,
    clusterSize: 6,
    rarity: 0.4,
    noiseScale: 0.04,
  },
  {
    type: 'copper_ore',
    blockId: 18,
    minY: -16,
    maxY: 112,
    density: 0.5,
    clusterSize: 5,
    rarity: 0.45,
    noiseScale: 0.04,
  },
  {
    type: 'gold_ore',
    blockId: 19,
    minY: -64,
    maxY: 32,
    density: 0.3,
    clusterSize: 4,
    rarity: 0.6,
    noiseScale: 0.03,
  },
  {
    type: 'redstone_ore',
    blockId: 20,
    minY: -64,
    maxY: 16,
    density: 0.4,
    clusterSize: 5,
    rarity: 0.5,
    noiseScale: 0.04,
  },
  {
    type: 'lapis_ore',
    blockId: 21,
    minY: -64,
    maxY: 64,
    density: 0.2,
    clusterSize: 3,
    rarity: 0.7,
    noiseScale: 0.03,
  },
  {
    type: 'diamond_ore',
    blockId: 22,
    minY: -64,
    maxY: 16,
    density: 0.1,
    clusterSize: 2,
    rarity: 0.85,
    noiseScale: 0.02,
  },
  {
    type: 'emerald_ore',
    blockId: 23,
    minY: -16,
    maxY: 256,
    density: 0.05,
    clusterSize: 1,
    rarity: 0.9,
    noiseScale: 0.02,
  },
]

/**
 * OreDistributionのLayer
 */
export const OreDistributionLive = (
  config: OreDistributionConfig
): Layer.Layer<OreDistribution, never, NoiseGenerator> =>
  Layer.effect(
    OreDistributionTag,
    Effect.gen(function* () {
      return createOreDistribution(config)
    })
  )

/**
 * デフォルト設定でのLayer
 */
export const OreDistributionLiveDefault = OreDistributionLive({
  ores: defaultOreConfigs,
  noiseScale: 0.05,
  clusterThreshold: 0.6,
})
