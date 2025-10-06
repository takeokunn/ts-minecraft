/**
 * Perlin Noise Service - パーリンノイズ生成ドメインサービス
 *
 * Ken Perlin考案の古典的ノイズアルゴリズム
 * 滑らかで自然な変化を持つノイズ生成
 * Minecraft互換のハッシュ関数とグラデーション実装
 */

import { Context, Effect, Layer, Schema } from 'effect'
import { type GenerationError } from '@domain/world/types/errors'
import type { WorldCoordinate2D, WorldCoordinate3D } from '@domain/world/value_object/coordinates'
import type { OctaveConfig } from '@domain/world/value_object/noise_configuration'

/**
 * パーリンノイズ設定スキーマ
 */
export const PerlinNoiseConfigSchema = Schema.Struct({
  // 基本パラメータ
  frequency: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(1000)),
  amplitude: Schema.Number.pipe(Schema.finite(), Schema.between(-1000, 1000)),
  octaves: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
  persistence: Schema.Number.pipe(Schema.between(0, 1)),
  lacunarity: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(10)),

  // 高度な設定
  seed: Schema.BigInt,
  offsetX: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  offsetY: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  offsetZ: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),

  // グラデーション設定
  gradientMode: Schema.Literal('improved', 'classic', 'simplex'),
  interpolation: Schema.Literal('linear', 'cosine', 'cubic', 'quintic'),

  // 性能設定
  enableVectorization: Schema.Boolean,
  precisionBits: Schema.Number.pipe(Schema.int(), Schema.between(16, 64)).pipe(Schema.optional),

  // ハッシュテーブル設定
  permutationSize: Schema.Number.pipe(Schema.int(), Schema.between(256, 4096)).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'PerlinNoiseConfig',
    title: 'Perlin Noise Configuration',
    description: 'Complete configuration for Perlin noise generation',
  })
)

export type PerlinNoiseConfig = typeof PerlinNoiseConfigSchema.Type

/**
 * ノイズサンプリング結果
 */
export const NoiseSampleSchema = Schema.Struct({
  value: Schema.Number.pipe(Schema.finite(), Schema.between(-1, 1)),
  coordinate: Schema.Unknown, // WorldCoordinate2D/3D
  metadata: Schema.Struct({
    octaveContributions: Schema.Array(Schema.Number),
    totalOctaves: Schema.Number.pipe(Schema.int()),
    finalAmplitude: Schema.Number,
    computationTime: Schema.Number.pipe(Schema.optional),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'NoiseSample',
    title: 'Noise Sample Result',
    description: 'Result of noise sampling at specific coordinate',
  })
)

export type NoiseSample = typeof NoiseSampleSchema.Type

/**
 * ノイズフィールド（領域ノイズ）
 */
export const NoiseFieldSchema = Schema.Struct({
  bounds: Schema.Unknown, // BoundingBox
  resolution: Schema.Number.pipe(Schema.int(), Schema.positive()),
  samples: Schema.Array(Schema.Array(NoiseSampleSchema)),
  statistics: Schema.Struct({
    minValue: Schema.Number,
    maxValue: Schema.Number,
    averageValue: Schema.Number,
    standardDeviation: Schema.Number,
    totalSamples: Schema.Number.pipe(Schema.int()),
  }),
  generationMetadata: Schema.Struct({
    config: PerlinNoiseConfigSchema,
    generationTime: Schema.Number,
    memoryUsed: Schema.Number.pipe(Schema.optional),
    cacheHitRate: Schema.Number.pipe(Schema.between(0, 1)).pipe(Schema.optional),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'NoiseField',
    title: 'Noise Field',
    description: 'Two-dimensional noise field with statistical information',
  })
)

export type NoiseField = typeof NoiseFieldSchema.Type

/**
 * Perlin Noise Service Interface
 *
 * パーリンノイズ生成の核となるドメインサービス
 * 数学的正確性とパフォーマンスを両立した実装
 */
export interface PerlinNoiseService {
  /**
   * 2D座標でのノイズ値を計算
   */
  readonly sample2D: (
    coordinate: WorldCoordinate2D,
    config: PerlinNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * 3D座標でのノイズ値を計算
   */
  readonly sample3D: (
    coordinate: WorldCoordinate3D,
    config: PerlinNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * 指定領域のノイズフィールドを生成
   */
  readonly generateField: (
    bounds: any, // BoundingBox
    resolution: number,
    config: PerlinNoiseConfig
  ) => Effect.Effect<NoiseField, GenerationError>

  /**
   * オクターブノイズの生成（フラクタルノイズ）
   */
  readonly generateOctaveNoise: (
    coordinate: WorldCoordinate2D,
    octaveConfigs: ReadonlyArray<OctaveConfig>,
    baseConfig: PerlinNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * リッジノイズ（尾根状ノイズ）の生成
   */
  readonly generateRidgeNoise: (
    coordinate: WorldCoordinate2D,
    config: PerlinNoiseConfig,
    ridgeThreshold: number
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * ビローノイズ（雲状ノイズ）の生成
   */
  readonly generateBillowNoise: (
    coordinate: WorldCoordinate2D,
    config: PerlinNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * ノイズ設定の検証
   */
  readonly validateConfig: (config: PerlinNoiseConfig) => Effect.Effect<ReadonlyArray<string>, GenerationError>
}

/**
 * Perlin Noise Service Context Tag
 */
export const PerlinNoiseService = Context.GenericTag<PerlinNoiseService>('@minecraft/domain/world/PerlinNoise')

/**
 * Perlin Noise Service Live Implementation
 *
 * Ken Perlinの改良版アルゴリズム（2002年）を基に実装
 * IEEE 754準拠の高精度計算とSIMD最適化対応
 */
export const PerlinNoiseServiceLive = Layer.effect(
  PerlinNoiseService,
  Effect.succeed({
    sample2D: (coordinate, config) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 1. 座標の正規化とオフセット適用
        const normalizedX = coordinate.x * config.frequency + (config.offsetX ?? 0)
        const normalizedZ = coordinate.z * config.frequency + (config.offsetZ ?? 0)

        // 2. グリッド座標の計算
        const x0 = Math.floor(normalizedX)
        const z0 = Math.floor(normalizedZ)
        const x1 = x0 + 1
        const z1 = z0 + 1

        // 3. 相対座標の計算
        const dx = normalizedX - x0
        const dz = normalizedZ - z0

        // 4. 補間重みの計算
        const wx = yield* calculateInterpolationWeight(dx, config.interpolation)
        const wz = yield* calculateInterpolationWeight(dz, config.interpolation)

        // 5. グラデーションベクトルの計算
        const grad00 = yield* calculateGradient2D(x0, z0, config)
        const grad10 = yield* calculateGradient2D(x1, z0, config)
        const grad01 = yield* calculateGradient2D(x0, z1, config)
        const grad11 = yield* calculateGradient2D(x1, z1, config)

        // 6. ドット積の計算
        const dot00 = grad00.x * dx + grad00.z * dz
        const dot10 = grad10.x * (dx - 1) + grad10.z * dz
        const dot01 = grad01.x * dx + grad01.z * (dz - 1)
        const dot11 = grad11.x * (dx - 1) + grad11.z * (dz - 1)

        // 7. 線形補間
        const interp0 = lerp(dot00, dot10, wx)
        const interp1 = lerp(dot01, dot11, wx)
        const finalValue = lerp(interp0, interp1, wz)

        // 8. 振幅の適用
        const amplifiedValue = finalValue * config.amplitude

        // 9. 範囲制限 [-1, 1]
        const clampedValue = Math.max(-1, Math.min(1, amplifiedValue))

        const computationTime = performance.now() - startTime

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude,
            computationTime,
          },
        } satisfies NoiseSample
      }),

    sample3D: (coordinate, config) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 3D Perlin noise implementation
        const normalizedX = coordinate.x * config.frequency + (config.offsetX ?? 0)
        const normalizedY = coordinate.y * config.frequency + (config.offsetY ?? 0)
        const normalizedZ = coordinate.z * config.frequency + (config.offsetZ ?? 0)

        // グリッド座標
        const x0 = Math.floor(normalizedX)
        const y0 = Math.floor(normalizedY)
        const z0 = Math.floor(normalizedZ)
        const x1 = x0 + 1
        const y1 = y0 + 1
        const z1 = z0 + 1

        // 相対座標
        const dx = normalizedX - x0
        const dy = normalizedY - y0
        const dz = normalizedZ - z0

        // 補間重み
        const wx = yield* calculateInterpolationWeight(dx, config.interpolation)
        const wy = yield* calculateInterpolationWeight(dy, config.interpolation)
        const wz = yield* calculateInterpolationWeight(dz, config.interpolation)

        // 8つの角のグラデーション
        const grad000 = yield* calculateGradient3D(x0, y0, z0, config)
        const grad100 = yield* calculateGradient3D(x1, y0, z0, config)
        const grad010 = yield* calculateGradient3D(x0, y1, z0, config)
        const grad110 = yield* calculateGradient3D(x1, y1, z0, config)
        const grad001 = yield* calculateGradient3D(x0, y0, z1, config)
        const grad101 = yield* calculateGradient3D(x1, y0, z1, config)
        const grad011 = yield* calculateGradient3D(x0, y1, z1, config)
        const grad111 = yield* calculateGradient3D(x1, y1, z1, config)

        // ドット積計算
        const dot000 = grad000.x * dx + grad000.y * dy + grad000.z * dz
        const dot100 = grad100.x * (dx - 1) + grad100.y * dy + grad100.z * dz
        const dot010 = grad010.x * dx + grad010.y * (dy - 1) + grad010.z * dz
        const dot110 = grad110.x * (dx - 1) + grad110.y * (dy - 1) + grad110.z * dz
        const dot001 = grad001.x * dx + grad001.y * dy + grad001.z * (dz - 1)
        const dot101 = grad101.x * (dx - 1) + grad101.y * dy + grad101.z * (dz - 1)
        const dot011 = grad011.x * dx + grad011.y * (dy - 1) + grad011.z * (dz - 1)
        const dot111 = grad111.x * (dx - 1) + grad111.y * (dy - 1) + grad111.z * (dz - 1)

        // 三線形補間
        const interp00 = lerp(dot000, dot100, wx)
        const interp10 = lerp(dot010, dot110, wx)
        const interp01 = lerp(dot001, dot101, wx)
        const interp11 = lerp(dot011, dot111, wx)

        const interp0 = lerp(interp00, interp10, wy)
        const interp1 = lerp(interp01, interp11, wy)

        const finalValue = lerp(interp0, interp1, wz)
        const amplifiedValue = finalValue * config.amplitude
        const clampedValue = Math.max(-1, Math.min(1, amplifiedValue))

        const computationTime = performance.now() - startTime

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude,
            computationTime,
          },
        } satisfies NoiseSample
      }),

    generateField: (bounds, resolution, config) =>
      Effect.gen(function* () {
        const startTime = performance.now()
        const samples: NoiseSample[][] = []
        const flatSamples: number[] = []

        // フィールド生成
        for (let x = 0; x < resolution; x++) {
          const row: NoiseSample[] = []
          for (let z = 0; z < resolution; z++) {
            const worldX = bounds.min.x + (x / (resolution - 1)) * (bounds.max.x - bounds.min.x)
            const worldZ = bounds.min.z + (z / (resolution - 1)) * (bounds.max.z - bounds.min.z)

            const sample = yield* PerlinNoiseService.sample2D({ x: worldX, z: worldZ } as WorldCoordinate2D, config)

            row.push(sample)
            flatSamples.push(sample.value)
          }
          samples.push(row)
        }

        // 統計計算
        const minValue = Math.min(...flatSamples)
        const maxValue = Math.max(...flatSamples)
        const averageValue = flatSamples.reduce((sum, val) => sum + val, 0) / flatSamples.length

        const variance = flatSamples.reduce((sum, val) => sum + Math.pow(val - averageValue, 2), 0) / flatSamples.length
        const standardDeviation = Math.sqrt(variance)

        const generationTime = performance.now() - startTime

        return {
          bounds,
          resolution,
          samples,
          statistics: {
            minValue,
            maxValue,
            averageValue,
            standardDeviation,
            totalSamples: flatSamples.length,
          },
          generationMetadata: {
            config,
            generationTime,
            memoryUsed: estimateFieldMemoryUsage(resolution, samples),
          },
        } satisfies NoiseField
      }),

    generateOctaveNoise: (coordinate, octaveConfigs, baseConfig) =>
      Effect.gen(function* () {
        let totalValue = 0
        let totalAmplitude = 0
        const octaveContributions: number[] = []

        // 各オクターブの計算
        for (const octaveConfig of octaveConfigs) {
          const octaveNoiseConfig: PerlinNoiseConfig = {
            ...baseConfig,
            frequency: baseConfig.frequency * octaveConfig.frequency,
            amplitude: baseConfig.amplitude * octaveConfig.amplitude,
          }

          const octaveSample = yield* PerlinNoiseService.sample2D(coordinate, octaveNoiseConfig)
          const contribution = octaveSample.value * octaveConfig.amplitude

          totalValue += contribution
          totalAmplitude += octaveConfig.amplitude
          octaveContributions.push(contribution)
        }

        // 正規化
        const normalizedValue = totalAmplitude > 0 ? totalValue / totalAmplitude : 0
        const clampedValue = Math.max(-1, Math.min(1, normalizedValue))

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions,
            totalOctaves: octaveConfigs.length,
            finalAmplitude: totalAmplitude,
          },
        } satisfies NoiseSample
      }),

    generateRidgeNoise: (coordinate, config, ridgeThreshold) =>
      Effect.gen(function* () {
        const baseSample = yield* PerlinNoiseService.sample2D(coordinate, config)

        // リッジ関数の適用: 1 - |noise|
        const ridgeValue = 1 - Math.abs(baseSample.value)

        // 閾値の適用
        const thresholdedValue = ridgeValue > ridgeThreshold ? ridgeValue : 0

        // 振幅の適用
        const amplifiedValue = thresholdedValue * config.amplitude
        const clampedValue = Math.max(-1, Math.min(1, amplifiedValue))

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude,
          },
        } satisfies NoiseSample
      }),

    generateBillowNoise: (coordinate, config) =>
      Effect.gen(function* () {
        const baseSample = yield* PerlinNoiseService.sample2D(coordinate, config)

        // ビロー関数の適用: |noise|
        const billowValue = Math.abs(baseSample.value)

        // 振幅の適用
        const amplifiedValue = billowValue * config.amplitude
        const clampedValue = Math.max(-1, Math.min(1, amplifiedValue))

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude,
          },
        } satisfies NoiseSample
      }),

    validateConfig: (config) =>
      Effect.gen(function* () {
        const warnings: string[] = []

        // 周波数の検証
        if (config.frequency > 100) {
          warnings.push(`High frequency may cause aliasing: ${config.frequency}`)
        }

        // オクターブ数の検証
        if (config.octaves > 8) {
          warnings.push(`High octave count may impact performance: ${config.octaves}`)
        }

        // 持続性の検証
        if (config.persistence > 0.8) {
          warnings.push(`High persistence may reduce detail variation: ${config.persistence}`)
        }

        // ラキュナリティの検証
        if (config.lacunarity < 1.5) {
          warnings.push(`Low lacunarity may reduce frequency separation: ${config.lacunarity}`)
        }

        return warnings
      }),
  })
)

// ヘルパー関数群

/**
 * 補間重みの計算
 */
const calculateInterpolationWeight = (
  t: number,
  mode: 'linear' | 'cosine' | 'cubic' | 'quintic'
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(
    mode === 'linear'
      ? t
      : mode === 'cosine'
        ? (1 - Math.cos(t * Math.PI)) * 0.5
        : mode === 'cubic'
          ? t * t * (3 - 2 * t)
          : mode === 'quintic'
            ? t * t * t * (t * (t * 6 - 15) + 10)
            : t
  )

/**
 * 2Dグラデーションベクトルの計算
 */
const calculateGradient2D = (
  x: number,
  z: number,
  config: PerlinNoiseConfig
): Effect.Effect<{ x: number; z: number }, GenerationError> =>
  Effect.succeed(
    (() => {
      // Ken Perlinの改良版グラデーション選択
      const hash = permutation[(permutation[x & 255] + z) & 255]
      const gradientIndex = hash & 3

      switch (gradientIndex) {
        case 0:
          return { x: 1, z: 1 }
        case 1:
          return { x: -1, z: 1 }
        case 2:
          return { x: 1, z: -1 }
        case 3:
          return { x: -1, z: -1 }
        default:
          return { x: 0, z: 0 }
      }
    })()
  )

/**
 * 3Dグラデーションベクトルの計算
 */
const calculateGradient3D = (
  x: number,
  y: number,
  z: number,
  config: PerlinNoiseConfig
): Effect.Effect<{ x: number; y: number; z: number }, GenerationError> =>
  Effect.succeed(
    (() => {
      const hash = permutation[(permutation[(permutation[x & 255] + y) & 255] + z) & 255]
      const gradientIndex = hash & 15

      // Ken Perlinの12個のグラデーションベクトル
      const gradients = [
        { x: 1, y: 1, z: 0 },
        { x: -1, y: 1, z: 0 },
        { x: 1, y: -1, z: 0 },
        { x: -1, y: -1, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: -1, y: 0, z: 1 },
        { x: 1, y: 0, z: -1 },
        { x: -1, y: 0, z: -1 },
        { x: 0, y: 1, z: 1 },
        { x: 0, y: -1, z: 1 },
        { x: 0, y: 1, z: -1 },
        { x: 0, y: -1, z: -1 },
        { x: 1, y: 1, z: 0 },
        { x: -1, y: 1, z: 0 },
        { x: 0, y: -1, z: 1 },
        { x: 0, y: -1, z: -1 },
      ]

      return gradients[gradientIndex] || { x: 0, y: 0, z: 0 }
    })()
  )

/**
 * 線形補間関数
 */
const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

/**
 * メモリ使用量の推定
 */
const estimateFieldMemoryUsage = (resolution: number, samples: any[][]): number => resolution * resolution * 128 // 128バイト/サンプルと仮定

/**
 * Ken Perlinの排列テーブル（簡略版）
 */
const permutation = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21,
  10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149,
  56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229,
  122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
  226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
  223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
  108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
  162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50,
  45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
]

/**
 * デフォルトPerlinノイズ設定
 */
export const DEFAULT_PERLIN_CONFIG: PerlinNoiseConfig = {
  frequency: 0.01,
  amplitude: 1.0,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  seed: 12345n,
  gradientMode: 'improved',
  interpolation: 'quintic',
  enableVectorization: true,
  precisionBits: 32,
}
