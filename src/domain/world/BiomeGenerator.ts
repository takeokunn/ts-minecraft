import { Context, Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import { NoiseGenerator } from './NoiseGenerator'
import type { BiomeType } from './types'
import type { Vector3 } from './types'

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
  humidity: Schema.Number,    // -1.0 to 1.0 (乾燥←→湿潤)
  elevation: Schema.Number,   // 海面からの相対高度
})

export type ClimateData = Schema.Schema.Type<typeof ClimateDataSchema>

/**
 * バイオーム生成のためのService
 */
export interface BiomeGenerator {
  /**
   * 指定座標のバイオームを取得
   */
  readonly getBiome: (position: Vector3) => Effect.Effect<BiomeType, never>

  /**
   * 指定座標の気候データを取得
   */
  readonly getClimateData: (x: number, z: number) => Effect.Effect<ClimateData, never>

  /**
   * 温度と湿度からバイオームを決定
   */
  readonly determineBiome: (climate: ClimateData) => BiomeType

  /**
   * 地域のバイオーム分布マップを生成（16x16チャンク用）
   */
  readonly generateBiomeMap: (chunkX: number, chunkZ: number) => Effect.Effect<BiomeType[][], never>

  /**
   * 設定を取得
   */
  readonly getConfig: () => BiomeConfig
}

export const BiomeGenerator = Context.GenericTag<BiomeGenerator>('domain/world/BiomeGenerator')

/**
 * BiomeGeneratorの実装
 */
const createBiomeGenerator = (config: BiomeConfig, noiseGenerator: NoiseGenerator): BiomeGenerator => {
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
        // 温度ノイズ（大きなスケール）
        const temperatureNoise = yield* noiseGenerator.octaveNoise2D(
          x * config.temperatureScale,
          z * config.temperatureScale,
          4,
          0.6
        )

        // 湿度ノイズ（中程度のスケール）
        const humidityNoise = yield* noiseGenerator.octaveNoise2D(
          x * config.humidityScale,
          z * config.humidityScale,
          3,
          0.5
        )

        // 地形変動ノイズ（高度補正用）
        const elevationNoise = yield* noiseGenerator.octaveNoise2D(
          x * 0.001,
          z * 0.001,
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
      if (elevation > config.mountainThreshold) {
        return temperature < -0.5 ? 'snowy_tundra' : 'mountains'
      }

      if (elevation < -config.oceanDepth) {
        return 'ocean'
      }

      // 基本バイオーム判定（温度・湿度マトリクス）
      if (temperature < -0.6) {
        // 極寒地帯
        return humidity > 0.2 ? 'snowy_tundra' : 'snowy_tundra'
      } else if (temperature < -0.2) {
        // 寒冷地帯
        return humidity > 0.3 ? 'taiga' : 'taiga'
      } else if (temperature > 0.6) {
        // 暑い地帯
        if (humidity < -0.4) {
          return 'desert'
        } else if (humidity > 0.4) {
          return 'jungle'
        } else {
          return 'savanna'
        }
      } else if (temperature > 0.2) {
        // 暖かい地帯
        if (humidity < -0.2) {
          return 'savanna'
        } else if (humidity > 0.5) {
          return 'jungle'
        } else {
          return 'forest'
        }
      } else {
        // 温帯
        if (humidity < -0.3) {
          return 'plains'
        } else if (humidity > 0.6) {
          return 'swamp'
        } else if (humidity > 0.2) {
          return 'forest'
        } else {
          return 'plains'
        }
      }
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

            const row = biomeMap[x]
            if (row) {
              row[z] = biome
            }
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
    BiomeGenerator,
    Effect.gen(function* () {
      const noiseGenerator = yield* NoiseGenerator
      return createBiomeGenerator(config, noiseGenerator)
    })
  )

/**
 * デフォルト設定でのLayer
 */
export const BiomeGeneratorLiveDefault = BiomeGeneratorLive({
  temperatureScale: 0.002,  // 温度変化のスケール
  humidityScale: 0.003,     // 湿度変化のスケール
  mountainThreshold: 80,    // 山岳バイオームになる高度閾値
  oceanDepth: 10,           // 海洋バイオームになる深度閾値
  riverWidth: 8,            // 河川の幅
})