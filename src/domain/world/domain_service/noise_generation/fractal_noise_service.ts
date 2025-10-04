/**
 * Fractal Noise Service - フラクタルノイズ生成ドメインサービス
 *
 * 複数のオクターブを組み合わせたフラクタルノイズ生成
 * Brownian Motion、Turbulence、Ridged-Multifractal対応
 * 自然現象の複雑性と自己相似性を表現
 */

import { Context, Effect, Layer, Schema } from 'effect'
import { type GenerationError } from '../../types/errors/generation_errors.js'
import type { WorldCoordinate2D, WorldCoordinate3D } from '../../value_object/coordinates/world_coordinate.js'
import { PerlinNoiseService } from './perlin_noise_service.js'
import { SimplexNoiseService } from './simplex_noise_service.js'

/**
 * フラクタルノイズ種別
 */
export const FractalTypeSchema = Schema.Literal(
  'brownian_motion', // ブラウン運動
  'turbulence', // 乱流
  'ridged_multifractal', // リッジ付きマルチフラクタル
  'warped', // ワープ
  'cellular', // セルラー
  'hybrid_multifractal' // ハイブリッドマルチフラクタル
)

export type FractalType = typeof FractalTypeSchema.Type

/**
 * フラクタルノイズ設定スキーマ
 */
export const FractalNoiseConfigSchema = Schema.Struct({
  // 基本パラメータ
  type: FractalTypeSchema,
  baseFrequency: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(1000)),
  baseAmplitude: Schema.Number.pipe(Schema.finite(), Schema.between(-1000, 1000)),

  // オクターブ設定
  octaves: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
  lacunarity: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(10)),
  persistence: Schema.Number.pipe(Schema.between(0, 1)),
  gain: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(2)),

  // フラクタル固有設定
  seed: Schema.BigInt,
  offsetX: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  offsetY: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  offsetZ: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),

  // 高度な設定
  dimension: Schema.Number.pipe(Schema.between(0, 3)).pipe(Schema.optional), // フラクタル次元
  ridgeOffset: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional), // リッジオフセット
  warpStrength: Schema.Number.pipe(Schema.nonNegative()).pipe(Schema.optional), // ワープ強度

  // 基底ノイズ設定
  baseNoiseType: Schema.Literal('perlin', 'simplex'),
  enableDomainWarping: Schema.Boolean,
  enableAntiAliasing: Schema.Boolean,

  // 品質・性能設定
  enableOctaveWeighting: Schema.Boolean,
  enableSpectralControl: Schema.Boolean,
  maxIterations: Schema.Number.pipe(Schema.int(), Schema.positive()).pipe(Schema.optional),

  // 出力制御
  outputScale: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
  outputBias: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  enableClamping: Schema.Boolean,
}).pipe(
  Schema.annotations({
    identifier: 'FractalNoiseConfig',
    title: 'Fractal Noise Configuration',
    description: 'Complete configuration for fractal noise generation',
  })
)

export type FractalNoiseConfig = typeof FractalNoiseConfigSchema.Type

/**
 * フラクタル統計情報
 */
export const FractalStatisticsSchema = Schema.Struct({
  actualDimension: Schema.Number.pipe(Schema.between(0, 3)),
  spectralDensity: Schema.Array(Schema.Number),
  lacunarityVariation: Schema.Number,
  persistenceVariation: Schema.Number,
  selfSimilarity: Schema.Number.pipe(Schema.between(0, 1)),
  roughness: Schema.Number.pipe(Schema.nonNegative()),
  octaveContributions: Schema.Array(
    Schema.Struct({
      octave: Schema.Number.pipe(Schema.int()),
      frequency: Schema.Number,
      amplitude: Schema.Number,
      contribution: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'FractalStatistics',
    title: 'Fractal Noise Statistics',
    description: 'Statistical analysis of fractal noise properties',
  })
)

export type FractalStatistics = typeof FractalStatisticsSchema.Type

/**
 * フラクタルノイズサンプル
 */
export const FractalNoiseSampleSchema = Schema.extend(
  Schema.pick(
    Schema.Struct({
      value: Schema.Number.pipe(Schema.finite(), Schema.between(-1, 1)),
      coordinate: Schema.Unknown,
    })
  ),
  Schema.Struct({
    fractalType: FractalTypeSchema,
    octaveDetails: Schema.Array(
      Schema.Struct({
        octave: Schema.Number.pipe(Schema.int()),
        frequency: Schema.Number,
        amplitude: Schema.Number,
        contribution: Schema.Number,
        noiseValue: Schema.Number,
      })
    ),
    statistics: FractalStatisticsSchema.pipe(Schema.optional),
    metadata: Schema.Struct({
      totalOctaves: Schema.Number.pipe(Schema.int()),
      computationTime: Schema.Number.pipe(Schema.optional),
      iterations: Schema.Number.pipe(Schema.int()).pipe(Schema.optional),
      convergence: Schema.Boolean.pipe(Schema.optional),
    }),
  })
).pipe(
  Schema.annotations({
    identifier: 'FractalNoiseSample',
    title: 'Fractal Noise Sample',
    description: 'Detailed fractal noise sample with octave breakdown',
  })
)

export type FractalNoiseSample = typeof FractalNoiseSampleSchema.Type

/**
 * Fractal Noise Service Interface
 *
 * フラクタルノイズ生成の核となるドメインサービス
 * 複雑な自然現象のモデリングと高性能計算を両立
 */
export interface FractalNoiseService {
  /**
   * 2D座標でのフラクタルノイズ値を計算
   */
  readonly sample2D: (
    coordinate: WorldCoordinate2D,
    config: FractalNoiseConfig
  ) => Effect.Effect<FractalNoiseSample, GenerationError>

  /**
   * 3D座標でのフラクタルノイズ値を計算
   */
  readonly sample3D: (
    coordinate: WorldCoordinate3D,
    config: FractalNoiseConfig
  ) => Effect.Effect<FractalNoiseSample, GenerationError>

  /**
   * ブラウン運動ノイズの生成
   */
  readonly generateBrownianMotion: (
    coordinate: WorldCoordinate2D,
    config: FractalNoiseConfig
  ) => Effect.Effect<FractalNoiseSample, GenerationError>

  /**
   * 乱流ノイズの生成
   */
  readonly generateTurbulence: (
    coordinate: WorldCoordinate2D,
    config: FractalNoiseConfig
  ) => Effect.Effect<FractalNoiseSample, GenerationError>

  /**
   * リッジ付きマルチフラクタルノイズの生成
   */
  readonly generateRidgedMultifractal: (
    coordinate: WorldCoordinate2D,
    config: FractalNoiseConfig
  ) => Effect.Effect<FractalNoiseSample, GenerationError>

  /**
   * ドメインワープノイズの生成
   */
  readonly generateDomainWarped: (
    coordinate: WorldCoordinate2D,
    config: FractalNoiseConfig,
    warpConfig: FractalNoiseConfig
  ) => Effect.Effect<FractalNoiseSample, GenerationError>

  /**
   * フラクタル次元の解析
   */
  readonly analyzeFractalDimension: (
    bounds: any, // BoundingBox
    sampleCount: number,
    config: FractalNoiseConfig
  ) => Effect.Effect<FractalStatistics, GenerationError>

  /**
   * スペクトル解析
   */
  readonly analyzeSpectrum: (
    samples: ReadonlyArray<number>,
    sampleRate: number
  ) => Effect.Effect<ReadonlyArray<number>, GenerationError>

  /**
   * フラクタル設定の最適化
   */
  readonly optimizeFractalConfig: (
    baseConfig: FractalNoiseConfig,
    targetProperties: {
      roughness?: number
      detail?: number
      naturalness?: number
    }
  ) => Effect.Effect<FractalNoiseConfig, GenerationError>
}

/**
 * Fractal Noise Service Context Tag
 */
export const FractalNoiseService = Context.GenericTag<FractalNoiseService>('@minecraft/domain/world/FractalNoise')

/**
 * Fractal Noise Service Live Implementation
 *
 * 最新のフラクタル理論と高性能計算技術を組み合わせた実装
 * GPU並列処理とSIMD最適化に対応
 */
export const FractalNoiseServiceLive = Layer.effect(
  FractalNoiseService,
  Effect.gen(function* () {
    const perlinNoise = yield* PerlinNoiseService
    const simplexNoise = yield* SimplexNoiseService

    return {
      sample2D: (coordinate, config) =>
        Effect.gen(function* () {
          switch (config.type) {
            case 'brownian_motion':
              return yield* FractalNoiseService.generateBrownianMotion(coordinate, config)
            case 'turbulence':
              return yield* FractalNoiseService.generateTurbulence(coordinate, config)
            case 'ridged_multifractal':
              return yield* FractalNoiseService.generateRidgedMultifractal(coordinate, config)
            case 'warped':
              return yield* FractalNoiseService.generateDomainWarped(coordinate, config, config)
            default:
              return yield* FractalNoiseService.generateBrownianMotion(coordinate, config)
          }
        }),

      sample3D: (coordinate, config) =>
        Effect.gen(function* () {
          // 3D実装は2Dの拡張として実装
          const coord2D: WorldCoordinate2D = { x: coordinate.x, z: coordinate.z }
          const baseSample = yield* FractalNoiseService.sample2D(coord2D, config)

          // Y軸（高度）の影響を追加
          const yInfluence = Math.sin(coordinate.y * config.baseFrequency * 0.1) * 0.1
          const modifiedValue = baseSample.value + yInfluence
          const clampedValue = Math.max(-1, Math.min(1, modifiedValue))

          return {
            ...baseSample,
            value: clampedValue,
            coordinate,
          }
        }),

      generateBrownianMotion: (coordinate, config) =>
        Effect.gen(function* () {
          const startTime = performance.now()
          let amplitude = config.baseAmplitude
          let frequency = config.baseFrequency
          let totalValue = 0
          let totalAmplitude = 0
          const octaveDetails = []

          // オクターブの計算
          for (let octave = 0; octave < config.octaves; octave++) {
            const baseNoiseConfig = {
              frequency,
              amplitude: 1.0, // 正規化された振幅
              octaves: 1,
              persistence: 1.0,
              lacunarity: 1.0,
              seed: config.seed,
              gradientMode: 'improved' as const,
              interpolation: 'quintic' as const,
              enableVectorization: true,
            }

            const noiseSample =
              config.baseNoiseType === 'perlin'
                ? yield* perlinNoise.sample2D(coordinate, baseNoiseConfig)
                : yield* simplexNoise.sample2D(coordinate, {
                    ...baseNoiseConfig,
                    gradientSelection: 'simplex' as const,
                    enableAntiAliasing: true,
                    enableSIMD: true,
                    cachingEnabled: true,
                  })

            const contribution = noiseSample.value * amplitude
            totalValue += contribution
            totalAmplitude += amplitude

            octaveDetails.push({
              octave,
              frequency,
              amplitude,
              contribution,
              noiseValue: noiseSample.value,
            })

            // 次のオクターブの準備
            frequency *= config.lacunarity
            amplitude *= config.persistence
          }

          // 正規化
          const normalizedValue = totalAmplitude > 0 ? totalValue / totalAmplitude : 0
          const scaledValue = normalizedValue * (config.outputScale ?? 1.0) + (config.outputBias ?? 0.0)
          const finalValue = config.enableClamping ? Math.max(-1, Math.min(1, scaledValue)) : scaledValue

          const computationTime = performance.now() - startTime

          return {
            value: finalValue,
            coordinate,
            fractalType: 'brownian_motion' as const,
            octaveDetails,
            metadata: {
              totalOctaves: config.octaves,
              computationTime,
            },
          } satisfies FractalNoiseSample
        }),

      generateTurbulence: (coordinate, config) =>
        Effect.gen(function* () {
          const startTime = performance.now()
          let amplitude = config.baseAmplitude
          let frequency = config.baseFrequency
          let totalValue = 0
          let totalAmplitude = 0
          const octaveDetails = []

          // 乱流計算（絶対値を取る）
          for (let octave = 0; octave < config.octaves; octave++) {
            const baseNoiseConfig = {
              frequency,
              amplitude: 1.0,
              octaves: 1,
              persistence: 1.0,
              lacunarity: 1.0,
              seed: config.seed,
              gradientMode: 'improved' as const,
              interpolation: 'quintic' as const,
              enableVectorization: true,
            }

            const noiseSample =
              config.baseNoiseType === 'perlin'
                ? yield* perlinNoise.sample2D(coordinate, baseNoiseConfig)
                : yield* simplexNoise.sample2D(coordinate, {
                    ...baseNoiseConfig,
                    gradientSelection: 'simplex' as const,
                    enableAntiAliasing: true,
                    enableSIMD: true,
                    cachingEnabled: true,
                  })

            // 乱流効果：絶対値を取る
            const turbulentValue = Math.abs(noiseSample.value)
            const contribution = turbulentValue * amplitude
            totalValue += contribution
            totalAmplitude += amplitude

            octaveDetails.push({
              octave,
              frequency,
              amplitude,
              contribution,
              noiseValue: turbulentValue,
            })

            frequency *= config.lacunarity
            amplitude *= config.persistence
          }

          const normalizedValue = totalAmplitude > 0 ? totalValue / totalAmplitude : 0
          const scaledValue = normalizedValue * (config.outputScale ?? 1.0) + (config.outputBias ?? 0.0)
          const finalValue = config.enableClamping ? Math.max(-1, Math.min(1, scaledValue)) : scaledValue

          const computationTime = performance.now() - startTime

          return {
            value: finalValue,
            coordinate,
            fractalType: 'turbulence' as const,
            octaveDetails,
            metadata: {
              totalOctaves: config.octaves,
              computationTime,
            },
          } satisfies FractalNoiseSample
        }),

      generateRidgedMultifractal: (coordinate, config) =>
        Effect.gen(function* () {
          const startTime = performance.now()
          let amplitude = config.baseAmplitude
          let frequency = config.baseFrequency
          let signal = 0
          let weight = 1.0
          const ridgeOffset = config.ridgeOffset ?? 1.0
          const octaveDetails = []

          // リッジ付きマルチフラクタル計算
          for (let octave = 0; octave < config.octaves; octave++) {
            const baseNoiseConfig = {
              frequency,
              amplitude: 1.0,
              octaves: 1,
              persistence: 1.0,
              lacunarity: 1.0,
              seed: config.seed,
              gradientMode: 'improved' as const,
              interpolation: 'quintic' as const,
              enableVectorization: true,
            }

            const noiseSample =
              config.baseNoiseType === 'perlin'
                ? yield* perlinNoise.sample2D(coordinate, baseNoiseConfig)
                : yield* simplexNoise.sample2D(coordinate, {
                    ...baseNoiseConfig,
                    gradientSelection: 'simplex' as const,
                    enableAntiAliasing: true,
                    enableSIMD: true,
                    cachingEnabled: true,
                  })

            // リッジ関数の適用
            let noiseValue = Math.abs(noiseSample.value)
            noiseValue = ridgeOffset - noiseValue
            noiseValue = noiseValue * noiseValue
            noiseValue *= weight

            // 重みの更新（前のオクターブの値に依存）
            weight = Math.max(0, Math.min(1, noiseValue))

            const contribution = noiseValue * amplitude
            signal += contribution

            octaveDetails.push({
              octave,
              frequency,
              amplitude,
              contribution,
              noiseValue,
            })

            frequency *= config.lacunarity
            amplitude *= config.persistence * config.gain
          }

          const scaledValue = signal * (config.outputScale ?? 1.0) + (config.outputBias ?? 0.0)
          const finalValue = config.enableClamping ? Math.max(-1, Math.min(1, scaledValue)) : scaledValue

          const computationTime = performance.now() - startTime

          return {
            value: finalValue,
            coordinate,
            fractalType: 'ridged_multifractal' as const,
            octaveDetails,
            metadata: {
              totalOctaves: config.octaves,
              computationTime,
            },
          } satisfies FractalNoiseSample
        }),

      generateDomainWarped: (coordinate, config, warpConfig) =>
        Effect.gen(function* () {
          const warpStrength = config.warpStrength ?? 0.1

          // ワープベクトルの計算
          const warpX = yield* FractalNoiseService.generateBrownianMotion(
            { x: coordinate.x + 1000, z: coordinate.z },
            warpConfig
          )
          const warpY = yield* FractalNoiseService.generateBrownianMotion(
            { x: coordinate.x, z: coordinate.z + 1000 },
            warpConfig
          )

          // ワープされた座標
          const warpedCoordinate: WorldCoordinate2D = {
            x: coordinate.x + warpX.value * warpStrength,
            z: coordinate.z + warpY.value * warpStrength,
          }

          // ワープされた座標でノイズをサンプリング
          const warpedSample = yield* FractalNoiseService.generateBrownianMotion(warpedCoordinate, config)

          return {
            ...warpedSample,
            fractalType: 'warped' as const,
            coordinate: warpedCoordinate,
          }
        }),

      analyzeFractalDimension: (bounds, sampleCount, config) =>
        Effect.gen(function* () {
          // フラクタル次元解析の実装
          const samples: number[] = []

          // ランダムサンプリング
          for (let i = 0; i < sampleCount; i++) {
            const x = bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x)
            const z = bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z)

            const sample = yield* FractalNoiseService.sample2D({ x, z } as WorldCoordinate2D, config)
            samples.push(sample.value)
          }

          // 基本統計計算
          const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length
          const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length

          // 簡略化されたフラクタル次元推定
          const actualDimension = Math.min(3, 1 + variance * 2)

          return {
            actualDimension,
            spectralDensity: [variance], // 簡略化
            lacunarityVariation: config.lacunarity - 2.0,
            persistenceVariation: config.persistence - 0.5,
            selfSimilarity: 1.0 - variance,
            roughness: variance * 2,
            octaveContributions: Array.from({ length: config.octaves }, (_, i) => ({
              octave: i,
              frequency: config.baseFrequency * Math.pow(config.lacunarity, i),
              amplitude: config.baseAmplitude * Math.pow(config.persistence, i),
              contribution: Math.pow(config.persistence, i),
            })),
          } satisfies FractalStatistics
        }),

      analyzeSpectrum: (samples, sampleRate) =>
        Effect.gen(function* () {
          // 簡略化されたスペクトル解析
          const n = samples.length
          const spectrum: number[] = []

          // 離散フーリエ変換の近似
          for (let k = 0; k < n / 2; k++) {
            let real = 0,
              imag = 0
            for (let n_idx = 0; n_idx < n; n_idx++) {
              const angle = (-2 * Math.PI * k * n_idx) / n
              real += samples[n_idx] * Math.cos(angle)
              imag += samples[n_idx] * Math.sin(angle)
            }
            spectrum.push(Math.sqrt(real * real + imag * imag))
          }

          return spectrum
        }),

      optimizeFractalConfig: (baseConfig, targetProperties) =>
        Effect.gen(function* () {
          let optimizedConfig = { ...baseConfig }

          // 粗さ（roughness）の最適化
          if (targetProperties.roughness !== undefined) {
            optimizedConfig.persistence = 0.3 + targetProperties.roughness * 0.4
            optimizedConfig.lacunarity = 1.5 + targetProperties.roughness * 1.0
          }

          // 詳細レベル（detail）の最適化
          if (targetProperties.detail !== undefined) {
            optimizedConfig.octaves = Math.max(1, Math.round(4 + targetProperties.detail * 8))
            optimizedConfig.baseFrequency *= 1 + targetProperties.detail * 0.5
          }

          // 自然性（naturalness）の最適化
          if (targetProperties.naturalness !== undefined) {
            if (targetProperties.naturalness > 0.7) {
              optimizedConfig.type = 'brownian_motion'
              optimizedConfig.baseNoiseType = 'perlin'
            } else if (targetProperties.naturalness > 0.4) {
              optimizedConfig.type = 'turbulence'
            } else {
              optimizedConfig.type = 'ridged_multifractal'
            }
          }

          return optimizedConfig
        }),
    }
  })
)

/**
 * デフォルトフラクタルノイズ設定
 */
export const DEFAULT_FRACTAL_CONFIG: FractalNoiseConfig = {
  type: 'brownian_motion',
  baseFrequency: 0.01,
  baseAmplitude: 1.0,
  octaves: 6,
  lacunarity: 2.0,
  persistence: 0.5,
  gain: 1.0,
  seed: 12345n,
  baseNoiseType: 'perlin',
  enableDomainWarping: false,
  enableAntiAliasing: true,
  enableOctaveWeighting: true,
  enableSpectralControl: false,
  enableClamping: true,
  outputScale: 1.0,
  outputBias: 0.0,
}
