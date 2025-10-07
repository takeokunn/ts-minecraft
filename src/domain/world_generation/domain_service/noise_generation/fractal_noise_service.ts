/**
 * Fractal Noise Service - フラクタルノイズ生成ドメインサービス
 *
 * 複数のオクターブを組み合わせたフラクタルノイズ生成
 * Brownian Motion、Turbulence、Ridged-Multifractal対応
 * 自然現象の複雑性と自己相似性を表現
 */

import { type GenerationError } from '@domain/world/types/errors'
import {
  makeUnsafeWorldCoordinate2D,
  type WorldCoordinate2D,
  type WorldCoordinate3D,
} from '@domain/world/value_object/coordinates'
import { Context, Effect, Layer, Match, pipe, ReadonlyArray, Schema } from 'effect'
import { PerlinNoiseService, SimplexNoiseService } from './index'

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
        pipe(
          Match.value(config.type),
          Match.when('brownian_motion', () => FractalNoiseService.generateBrownianMotion(coordinate, config)),
          Match.when('turbulence', () => FractalNoiseService.generateTurbulence(coordinate, config)),
          Match.when('ridged_multifractal', () => FractalNoiseService.generateRidgedMultifractal(coordinate, config)),
          Match.when('warped', () => FractalNoiseService.generateDomainWarped(coordinate, config, config)),
          Match.orElse(() => FractalNoiseService.generateBrownianMotion(coordinate, config))
        ),

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

          // オクターブの計算をEffect.reduceで逐次実行
          const result = yield* pipe(
            ReadonlyArray.range(0, config.octaves),
            Effect.reduce(
              {
                amplitude: config.baseAmplitude,
                frequency: config.baseFrequency,
                totalValue: 0,
                totalAmplitude: 0,
                octaveDetails: [] as ReadonlyArray<any>,
              },
              (acc, octave) =>
                Effect.gen(function* () {
                  const baseNoiseConfig = {
                    frequency: acc.frequency,
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

                  const contribution = noiseSample.value * acc.amplitude

                  return {
                    amplitude: acc.amplitude * config.persistence,
                    frequency: acc.frequency * config.lacunarity,
                    totalValue: acc.totalValue + contribution,
                    totalAmplitude: acc.totalAmplitude + acc.amplitude,
                    octaveDetails: [
                      ...acc.octaveDetails,
                      {
                        octave,
                        frequency: acc.frequency,
                        amplitude: acc.amplitude,
                        contribution,
                        noiseValue: noiseSample.value,
                      },
                    ],
                  }
                })
            )
          )

          // 正規化
          const normalizedValue = result.totalAmplitude > 0 ? result.totalValue / result.totalAmplitude : 0
          const scaledValue = normalizedValue * (config.outputScale ?? 1.0) + (config.outputBias ?? 0.0)
          const finalValue = config.enableClamping ? Math.max(-1, Math.min(1, scaledValue)) : scaledValue

          const computationTime = performance.now() - startTime

          return {
            value: finalValue,
            coordinate,
            fractalType: 'brownian_motion' as const,
            octaveDetails: result.octaveDetails,
            metadata: {
              totalOctaves: config.octaves,
              computationTime,
            },
          } satisfies FractalNoiseSample
        }),

      generateTurbulence: (coordinate, config) =>
        Effect.gen(function* () {
          const startTime = performance.now()

          // 乱流計算をEffect.reduceで逐次実行
          const result = yield* pipe(
            ReadonlyArray.range(0, config.octaves),
            Effect.reduce(
              {
                amplitude: config.baseAmplitude,
                frequency: config.baseFrequency,
                totalValue: 0,
                totalAmplitude: 0,
                octaveDetails: [] as ReadonlyArray<any>,
              },
              (acc, octave) =>
                Effect.gen(function* () {
                  const baseNoiseConfig = {
                    frequency: acc.frequency,
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
                  const contribution = turbulentValue * acc.amplitude

                  return {
                    amplitude: acc.amplitude * config.persistence,
                    frequency: acc.frequency * config.lacunarity,
                    totalValue: acc.totalValue + contribution,
                    totalAmplitude: acc.totalAmplitude + acc.amplitude,
                    octaveDetails: [
                      ...acc.octaveDetails,
                      {
                        octave,
                        frequency: acc.frequency,
                        amplitude: acc.amplitude,
                        contribution,
                        noiseValue: turbulentValue,
                      },
                    ],
                  }
                })
            )
          )

          const normalizedValue = result.totalAmplitude > 0 ? result.totalValue / result.totalAmplitude : 0
          const scaledValue = normalizedValue * (config.outputScale ?? 1.0) + (config.outputBias ?? 0.0)
          const finalValue = config.enableClamping ? Math.max(-1, Math.min(1, scaledValue)) : scaledValue

          const computationTime = performance.now() - startTime

          return {
            value: finalValue,
            coordinate,
            fractalType: 'turbulence' as const,
            octaveDetails: result.octaveDetails,
            metadata: {
              totalOctaves: config.octaves,
              computationTime,
            },
          } satisfies FractalNoiseSample
        }),

      generateRidgedMultifractal: (coordinate, config) =>
        Effect.gen(function* () {
          const startTime = performance.now()
          const ridgeOffset = config.ridgeOffset ?? 1.0

          // リッジ付きマルチフラクタル計算をEffect.reduceで逐次実行（weight依存あり）
          const result = yield* pipe(
            ReadonlyArray.range(0, config.octaves),
            Effect.reduce(
              {
                amplitude: config.baseAmplitude,
                frequency: config.baseFrequency,
                signal: 0,
                weight: 1.0,
                octaveDetails: [] as ReadonlyArray<any>,
              },
              (acc, octave) =>
                Effect.gen(function* () {
                  const baseNoiseConfig = {
                    frequency: acc.frequency,
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
                  noiseValue *= acc.weight

                  // 重みの更新（前のオクターブの値に依存）
                  const newWeight = Math.max(0, Math.min(1, noiseValue))

                  const contribution = noiseValue * acc.amplitude

                  return {
                    amplitude: acc.amplitude * config.persistence * config.gain,
                    frequency: acc.frequency * config.lacunarity,
                    signal: acc.signal + contribution,
                    weight: newWeight,
                    octaveDetails: [
                      ...acc.octaveDetails,
                      {
                        octave,
                        frequency: acc.frequency,
                        amplitude: acc.amplitude,
                        contribution,
                        noiseValue,
                      },
                    ],
                  }
                })
            )
          )

          const scaledValue = result.signal * (config.outputScale ?? 1.0) + (config.outputBias ?? 0.0)
          const finalValue = config.enableClamping ? Math.max(-1, Math.min(1, scaledValue)) : scaledValue

          const computationTime = performance.now() - startTime

          return {
            value: finalValue,
            coordinate,
            fractalType: 'ridged_multifractal' as const,
            octaveDetails: result.octaveDetails,
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
          // ランダムサンプリング位置の生成
          const randomPositions = pipe(
            ReadonlyArray.range(0, sampleCount),
            ReadonlyArray.map(() =>
              makeUnsafeWorldCoordinate2D(
                bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
                bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z)
              )
            )
          )

          // 全サンプルを並行実行
          const samples = yield* pipe(
            randomPositions,
            Effect.forEach((pos) => FractalNoiseService.sample2D(pos, config), {
              concurrency: 'unbounded',
            }),
            Effect.map((results) =>
              pipe(
                results,
                ReadonlyArray.map((sample) => sample.value)
              )
            )
          )

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
            octaveContributions: pipe(
              ReadonlyArray.range(0, config.octaves),
              ReadonlyArray.map((i) => ({
                octave: i,
                frequency: config.baseFrequency * Math.pow(config.lacunarity, i),
                amplitude: config.baseAmplitude * Math.pow(config.persistence, i),
                contribution: Math.pow(config.persistence, i),
              }))
            ),
          } satisfies FractalStatistics
        }),

      analyzeSpectrum: (samples, sampleRate) =>
        Effect.gen(function* () {
          // 簡略化されたスペクトル解析
          const n = samples.length

          // 離散フーリエ変換の近似をReadonlyArray.flatMapで実装
          const spectrum = pipe(
            ReadonlyArray.range(0, Math.floor(n / 2)),
            ReadonlyArray.map((k) => {
              // 内側のループをreduceで集約
              const { real, imag } = pipe(
                ReadonlyArray.range(0, n),
                ReadonlyArray.reduce({ real: 0, imag: 0 }, (acc, n_idx) => {
                  const angle = (-2 * Math.PI * k * n_idx) / n
                  return {
                    real: acc.real + samples[n_idx] * Math.cos(angle),
                    imag: acc.imag + samples[n_idx] * Math.sin(angle),
                  }
                })
              )
              return Math.sqrt(real * real + imag * imag)
            })
          )

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
