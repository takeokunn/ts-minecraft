import { Context, Effect, Layer, Match, Option, pipe } from 'effect'
import { Schema } from '@effect/schema'
import type { NoiseGenerator } from './NoiseGenerator'
import { NoiseGeneratorTag } from './NoiseGenerator'
import type { BiomeType } from './types'
import type { Vector3 } from './types'
import { BrandedTypes } from '../../shared/types/branded'

/**
 * バイオーム生成の設定
 */
export const BiomeConfigSchema = Schema.Struct({
  temperatureScale: Schema.Number,
  humidityScale: Schema.Number,
  mountainThreshold: Schema.Number,
  oceanDepth: Schema.Number,
  riverWidth: Schema.Number,
})

export type BiomeConfig = Schema.Schema.Type<typeof BiomeConfigSchema>

/**
 * 気候データ
 */
export const ClimateDataSchema = Schema.Struct({
  temperature: Schema.Number, // -1.0 to 1.0 (寒い←→暑い)
  humidity: Schema.Number, // -1.0 to 1.0 (乾燥←→湿潤)
  elevation: Schema.Number, // 海面からの相対高度
})

export type ClimateData = Schema.Schema.Type<typeof ClimateDataSchema>

/**
 * バイオーム生成のためのService
 */
export interface BiomeGenerator {
  /**
   * 指定座標のバイオームを取得
   */
  readonly getBiome: (position: Vector3) => Effect.Effect<BiomeType, never, NoiseGenerator>

  /**
   * 指定座標の気候データを取得
   */
  readonly getClimateData: (x: number, z: number) => Effect.Effect<ClimateData, never, NoiseGenerator>

  /**
   * 温度と湿度からバイオームを決定
   */
  readonly determineBiome: (climate: ClimateData) => BiomeType

  /**
   * 地域のバイオーム分布マップを生成（16x16チャンク用）
   */
  readonly generateBiomeMap: (chunkX: number, chunkZ: number) => Effect.Effect<BiomeType[][], never, NoiseGenerator>

  /**
   * 設定を取得
   */
  readonly getConfig: () => BiomeConfig
}

export const BiomeGeneratorTag = Context.GenericTag<BiomeGenerator>('domain/world/BiomeGenerator')

/**
 * BiomeGeneratorの実装
 */
const createBiomeGenerator = (config: BiomeConfig): BiomeGenerator => {
  const biomeGenerator: BiomeGenerator = {
    getBiome: (position: Vector3) =>
      Effect.gen(function* () {
        const climate = yield* biomeGenerator.getClimateData(position.x, position.z)
        return biomeGenerator.determineBiome({
          ...climate,
          elevation: position.y,
        })
      }),

    getClimateData: (x: number, z: number) =>
      Effect.gen(function* () {
        const noiseGenerator = yield* NoiseGeneratorTag

        // 温度ノイズ（大きなスケール）
        const temperatureNoise = yield* noiseGenerator.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(x * config.temperatureScale),
          BrandedTypes.createNoiseCoordinate(z * config.temperatureScale),
          4,
          0.6
        )

        // 湿度ノイズ（中程度のスケール）
        const humidityNoise = yield* noiseGenerator.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(x * config.humidityScale),
          BrandedTypes.createNoiseCoordinate(z * config.humidityScale),
          3,
          0.5
        )

        // 地形変動ノイズ（高度補正用）
        const elevationNoise = yield* noiseGenerator.octaveNoise2D(
          BrandedTypes.createNoiseCoordinate(x * 0.001),
          BrandedTypes.createNoiseCoordinate(z * 0.001),
          6,
          0.5
        )

        return {
          temperature: temperatureNoise,
          humidity: humidityNoise,
          elevation: elevationNoise * 100, // 高度補正値
        }
      }),

    determineBiome: (climate: ClimateData) => {
      const { temperature, humidity, elevation } = climate

      // 特殊バイオーム判定（高度ベース）
      return pipe(
        Match.value({ elevation, temperature, humidity }),
        // 高山地帯
        Match.when(
          ({ elevation }) => elevation > config.mountainThreshold,
          ({ temperature }) =>
            pipe(
              Match.value(temperature < -0.5),
              Match.when(true, () => 'snowy_tundra' as BiomeType),
              Match.orElse(() => 'mountains' as BiomeType)
            )
        ),
        // 海洋
        Match.when(
          ({ elevation }) => elevation < -config.oceanDepth,
          () => 'ocean' as BiomeType
        ),
        // 極寒地帯
        Match.when(
          ({ temperature }) => temperature < -0.6,
          ({ humidity }) =>
            pipe(
              Match.value(humidity > 0.2),
              Match.when(true, () => 'snowy_tundra' as BiomeType),
              Match.orElse(() => 'snowy_tundra' as BiomeType)
            )
        ),
        // 寒冷地帯
        Match.when(
          ({ temperature }) => temperature < -0.2,
          ({ humidity }) =>
            pipe(
              Match.value(humidity > 0.3),
              Match.when(true, () => 'taiga' as BiomeType),
              Match.orElse(() => 'taiga' as BiomeType)
            )
        ),
        // 暑い地帯
        Match.when(
          ({ temperature }) => temperature > 0.6,
          ({ humidity }) =>
            pipe(
              Match.value(humidity),
              Match.when(
                (h) => h < -0.4,
                () => 'desert' as BiomeType
              ),
              Match.when(
                (h) => h > 0.4,
                () => 'jungle' as BiomeType
              ),
              Match.orElse(() => 'savanna' as BiomeType)
            )
        ),
        // 暖かい地帯
        Match.when(
          ({ temperature }) => temperature > 0.2,
          ({ humidity }) =>
            pipe(
              Match.value(humidity),
              Match.when(
                (h) => h < -0.2,
                () => 'savanna' as BiomeType
              ),
              Match.when(
                (h) => h > 0.5,
                () => 'jungle' as BiomeType
              ),
              Match.orElse(() => 'forest' as BiomeType)
            )
        ),
        // 温帯（デフォルト）
        Match.orElse(({ humidity }) =>
          pipe(
            Match.value(humidity),
            Match.when(
              (h) => h < -0.3,
              () => 'plains' as BiomeType
            ),
            Match.when(
              (h) => h > 0.6,
              () => 'swamp' as BiomeType
            ),
            Match.when(
              (h) => h > 0.2,
              () => 'forest' as BiomeType
            ),
            Match.orElse(() => 'plains' as BiomeType)
          )
        )
      )
    },

    generateBiomeMap: (chunkX: number, chunkZ: number) =>
      Effect.gen(function* () {
        const biomeMap: BiomeType[][] = []

        for (let x = 0; x < 16; x++) {
          biomeMap[x] = []
          for (let z = 0; z < 16; z++) {
            const worldX = chunkX * 16 + x
            const worldZ = chunkZ * 16 + z

            const climate = yield* biomeGenerator.getClimateData(worldX, worldZ)
            const biome = biomeGenerator.determineBiome(climate)

            // 配列アクセスをOptionパターンで安全化
            pipe(
              Option.fromNullable(biomeMap[x]),
              Option.map((row) => {
                row[z] = biome
              })
            )
          }
        }

        return biomeMap
      }),

    getConfig: () => config,
  }

  return biomeGenerator
}

/**
 * BiomeGeneratorのLayer
 */
export const BiomeGeneratorLive = (config: BiomeConfig): Layer.Layer<BiomeGenerator, never, NoiseGenerator> =>
  Layer.effect(
    BiomeGeneratorTag,
    Effect.gen(function* () {
      return createBiomeGenerator(config)
    })
  )

/**
 * デフォルト設定でのLayer
 */
export const BiomeGeneratorLiveDefault = BiomeGeneratorLive({
  temperatureScale: 0.002, // 温度変化のスケール
  humidityScale: 0.003, // 湿度変化のスケール
  mountainThreshold: 80, // 山岳バイオームになる高度閾値
  oceanDepth: 10, // 海洋バイオームになる深度閾値
  riverWidth: 8, // 河川の幅
})
