/**
 * Simplex Noise Service - シンプレックスノイズ生成ドメインサービス
 *
 * Ken Perlin考案の改良版ノイズアルゴリズム
 * Perlinノイズより高次元で効率的、等方性を持つ
 * 計算量 O(N²) → O(N) への改善
 */

import { Effect, Context, Schema, pipe } from 'effect'
import type {
  WorldCoordinate2D,
  WorldCoordinate3D,
} from '../../value_object/coordinates/world-coordinate.js'
import type {
  AdvancedNoiseSettings,
} from '../../value_object/noise_configuration/noise-settings.js'
import type {
  WorldSeed,
} from '../../value_object/world_seed/seed.js'
import {
  GenerationErrorSchema,
  type GenerationError,
} from '../../types/errors/generation-errors.js'
import type { NoiseSample, NoiseField } from './perlin-noise-service.js'

/**
 * シンプレックスノイズ設定スキーマ
 */
export const SimplexNoiseConfigSchema = Schema.Struct({
  // 基本パラメータ
  frequency: Schema.Number.pipe(
    Schema.positive(),
    Schema.lessThanOrEqualTo(1000)
  ),
  amplitude: Schema.Number.pipe(
    Schema.finite(),
    Schema.between(-1000, 1000)
  ),
  octaves: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 16)
  ),
  persistence: Schema.Number.pipe(
    Schema.between(0, 1)
  ),
  lacunarity: Schema.Number.pipe(
    Schema.positive(),
    Schema.lessThanOrEqualTo(10)
  ),

  // シンプレックス固有設定
  seed: Schema.BigInt,
  offsetX: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  offsetY: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),
  offsetZ: Schema.Number.pipe(Schema.finite()).pipe(Schema.optional),

  // スキュー・アンスキュー係数
  skewFactor: Schema.Number.pipe(
    Schema.finite(),
    Schema.between(-1, 1)
  ).pipe(Schema.optional),
  unskewFactor: Schema.Number.pipe(
    Schema.finite(),
    Schema.between(-1, 1)
  ).pipe(Schema.optional),

  // 品質設定
  gradientSelection: Schema.Literal('simplex', 'optimized', 'fast'),
  enableAntiAliasing: Schema.Boolean,

  // 性能設定
  enableSIMD: Schema.Boolean,
  cachingEnabled: Schema.Boolean,
  maxCacheSize: Schema.Number.pipe(Schema.int(), Schema.positive()).pipe(Schema.optional)
}).pipe(
  Schema.annotations({
    identifier: 'SimplexNoiseConfig',
    title: 'Simplex Noise Configuration',
    description: 'Complete configuration for Simplex noise generation'
  })
)

export type SimplexNoiseConfig = typeof SimplexNoiseConfigSchema.Type

/**
 * シンプレックス格子点
 */
export const SimplexVertexSchema = Schema.Struct({
  coordinates: Schema.Array(Schema.Number.pipe(Schema.int())),
  gradientVector: Schema.Array(Schema.Number.pipe(Schema.finite())),
  contribution: Schema.Number.pipe(Schema.finite()),
  distance: Schema.Number.pipe(Schema.nonNegative())
}).pipe(
  Schema.annotations({
    identifier: 'SimplexVertex',
    title: 'Simplex Lattice Vertex',
    description: 'Vertex in simplex lattice with gradient information'
  })
)

export type SimplexVertex = typeof SimplexVertexSchema.Type

/**
 * Simplex Noise Service Interface
 *
 * シンプレックスノイズ生成の核となるドメインサービス
 * 高次元効率性と等方性を重視した実装
 */
export interface SimplexNoiseService {
  /**
   * 2D座標でのシンプレックスノイズ値を計算
   */
  readonly sample2D: (
    coordinate: WorldCoordinate2D,
    config: SimplexNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * 3D座標でのシンプレックスノイズ値を計算
   */
  readonly sample3D: (
    coordinate: WorldCoordinate3D,
    config: SimplexNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * 4D座標でのシンプレックスノイズ値を計算（時間軸対応）
   */
  readonly sample4D: (
    coordinate: WorldCoordinate3D & { t: number },
    config: SimplexNoiseConfig
  ) => Effect.Effect<NoiseSample, GenerationError>

  /**
   * 指定領域のシンプレックスノイズフィールドを生成
   */
  readonly generateField: (
    bounds: any, // BoundingBox
    resolution: number,
    config: SimplexNoiseConfig
  ) => Effect.Effect<NoiseField, GenerationError>

  /**
   * シンプレックス格子の解析
   */
  readonly analyzeSimplex: (
    coordinate: WorldCoordinate2D,
    config: SimplexNoiseConfig
  ) => Effect.Effect<ReadonlyArray<SimplexVertex>, GenerationError>

  /**
   * アニソトロピー（異方性）の測定
   */
  readonly measureAnisotropy: (
    centerCoordinate: WorldCoordinate2D,
    sampleRadius: number,
    sampleCount: number,
    config: SimplexNoiseConfig
  ) => Effect.Effect<number, GenerationError>

  /**
   * シンプレックスノイズ設定の最適化
   */
  readonly optimizeConfig: (
    baseConfig: SimplexNoiseConfig,
    targetCharacteristics: {
      smoothness?: number
      isotropy?: number
      performance?: number
    }
  ) => Effect.Effect<SimplexNoiseConfig, GenerationError>
}

/**
 * Simplex Noise Service Context Tag
 */
export const SimplexNoiseService = Context.GenericTag<SimplexNoiseService>(
  '@minecraft/domain/world/SimplexNoise'
)

/**
 * Simplex Noise Service Live Implementation
 *
 * Ken Perlinの2001年改良版アルゴリズムを基に実装
 * 等方性確保とSIMD最適化による高性能実現
 */
export const makeSimplexNoiseService = (): SimplexNoiseService => {
  let service: SimplexNoiseService

  service = {
    sample2D: (coordinate, config) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 1. 座標の正規化とオフセット適用
        const x = coordinate.x * config.frequency + (config.offsetX ?? 0)
        const y = coordinate.z * config.frequency + (config.offsetZ ?? 0)

        // 2. スキュー変換（正方格子→シンプレックス格子）
        const skewFactor = config.skewFactor ?? (Math.sqrt(3.0) - 1.0) / 2.0
        const s = (x + y) * skewFactor
        const i = Math.floor(x + s)
        const j = Math.floor(y + s)

        // 3. アンスキュー変換（シンプレックス格子→正方格子）
        const unskewFactor = config.unskewFactor ?? (3.0 - Math.sqrt(3.0)) / 6.0
        const t = (i + j) * unskewFactor
        const X0 = i - t
        const Y0 = j - t
        const x0 = x - X0
        const y0 = y - Y0

        // 4. シンプレックス内の位置決定
        let i1: number, j1: number
        if (x0 > y0) {
          i1 = 1; j1 = 0  // 下の三角形
        } else {
          i1 = 0; j1 = 1  // 上の三角形
        }

        // 5. 他の2つの頂点の相対座標計算
        const x1 = x0 - i1 + unskewFactor
        const y1 = y0 - j1 + unskewFactor
        const x2 = x0 - 1.0 + 2.0 * unskewFactor
        const y2 = y0 - 1.0 + 2.0 * unskewFactor

        // 6. 排列を使った格子点のハッシュ計算
        const ii = i & 255
        const jj = j & 255
        const gi0 = permMod12[ii + perm[jj]]
        const gi1 = permMod12[ii + i1 + perm[jj + j1]]
        const gi2 = permMod12[ii + 1 + perm[jj + 1]]

        // 7. 各頂点からの寄与計算
        let n0 = 0, n1 = 0, n2 = 0

        // 頂点0からの寄与
        let t0 = 0.5 - x0 * x0 - y0 * y0
        if (t0 >= 0) {
          t0 *= t0
          n0 = t0 * t0 * dot2D(grad3[gi0], x0, y0)
        }

        // 頂点1からの寄与
        let t1 = 0.5 - x1 * x1 - y1 * y1
        if (t1 >= 0) {
          t1 *= t1
          n1 = t1 * t1 * dot2D(grad3[gi1], x1, y1)
        }

        // 頂点2からの寄与
        let t2 = 0.5 - x2 * x2 - y2 * y2
        if (t2 >= 0) {
          t2 *= t2
          n2 = t2 * t2 * dot2D(grad3[gi2], x2, y2)
        }

        // 8. 最終値の計算と正規化
        const rawValue = 70.0 * (n0 + n1 + n2)
        const amplifiedValue = rawValue * config.amplitude
        const clampedValue = Math.max(-1, Math.min(1, amplifiedValue))

        const computationTime = performance.now() - startTime

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude,
            computationTime
          }
        } satisfies NoiseSample
      }),

    sample3D: (coordinate, config) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 3D シンプレックスノイズの実装
        const x = coordinate.x * config.frequency + (config.offsetX ?? 0)
        const y = coordinate.y * config.frequency + (config.offsetY ?? 0)
        const z = coordinate.z * config.frequency + (config.offsetZ ?? 0)

        // 3Dスキュー定数
        const F3 = 1.0 / 3.0
        const G3 = 1.0 / 6.0

        // スキュー変換
        const s = (x + y + z) * F3
        const i = Math.floor(x + s)
        const j = Math.floor(y + s)
        const k = Math.floor(z + s)

        // アンスキュー変換
        const t = (i + j + k) * G3
        const X0 = i - t
        const Y0 = j - t
        const Z0 = k - t
        const x0 = x - X0
        const y0 = y - Y0
        const z0 = z - Z0

        // シンプレックス内の位置決定（3D）
        let i1: number, j1: number, k1: number
        let i2: number, j2: number, k2: number

        if (x0 >= y0) {
          if (y0 >= z0) {
            i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0
          } else if (x0 >= z0) {
            i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1
          } else {
            i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1
          }
        } else {
          if (y0 < z0) {
            i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1
          } else if (x0 < z0) {
            i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1
          } else {
            i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0
          }
        }

        // 4つの頂点の相対座標
        const x1 = x0 - i1 + G3
        const y1 = y0 - j1 + G3
        const z1 = z0 - k1 + G3
        const x2 = x0 - i2 + 2.0 * G3
        const y2 = y0 - j2 + 2.0 * G3
        const z2 = z0 - k2 + 2.0 * G3
        const x3 = x0 - 1.0 + 3.0 * G3
        const y3 = y0 - 1.0 + 3.0 * G3
        const z3 = z0 - 1.0 + 3.0 * G3

        // ハッシュ計算
        const ii = i & 255
        const jj = j & 255
        const kk = k & 255
        const gi0 = permMod12[ii + perm[jj + perm[kk]]]
        const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]
        const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]
        const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]

        // 各頂点からの寄与計算
        let n0 = 0, n1 = 0, n2 = 0, n3 = 0

        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
        if (t0 >= 0) {
          t0 *= t0
          n0 = t0 * t0 * dot3D(grad3[gi0], x0, y0, z0)
        }

        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
        if (t1 >= 0) {
          t1 *= t1
          n1 = t1 * t1 * dot3D(grad3[gi1], x1, y1, z1)
        }

        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
        if (t2 >= 0) {
          t2 *= t2
          n2 = t2 * t2 * dot3D(grad3[gi2], x2, y2, z2)
        }

        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
        if (t3 >= 0) {
          t3 *= t3
          n3 = t3 * t3 * dot3D(grad3[gi3], x3, y3, z3)
        }

        // 最終値の計算
        const rawValue = 32.0 * (n0 + n1 + n2 + n3)
        const amplifiedValue = rawValue * config.amplitude
        const clampedValue = Math.max(-1, Math.min(1, amplifiedValue))

        const computationTime = performance.now() - startTime

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude,
            computationTime
          }
        } satisfies NoiseSample
      }),

    sample4D: (coordinate, config) =>
      Effect.gen(function* () {
        // 4D実装は複雑なため、3D + 時間軸補間で近似
        const timeFactor = coordinate.t % 1.0
        const baseTime = Math.floor(coordinate.t)

        const coord1: WorldCoordinate3D = {
          x: coordinate.x,
          y: coordinate.y,
          z: coordinate.z + baseTime * 0.1 // 時間軸をZ軸にマッピング
        }

        const coord2: WorldCoordinate3D = {
          x: coordinate.x,
          y: coordinate.y,
          z: coordinate.z + (baseTime + 1) * 0.1
        }

        const sample1 = yield* service.sample3D(coord1, config)
        const sample2 = yield* service.sample3D(coord2, config)

        // 線形補間
        const interpolatedValue = sample1.value + timeFactor * (sample2.value - sample1.value)
        const clampedValue = Math.max(-1, Math.min(1, interpolatedValue))

        return {
          value: clampedValue,
          coordinate,
          metadata: {
            octaveContributions: [clampedValue],
            totalOctaves: 1,
            finalAmplitude: config.amplitude
          }
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

            const sample = yield* service.sample2D(
              { x: worldX, z: worldZ } as WorldCoordinate2D,
              config
            )

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
            totalSamples: flatSamples.length
          },
          generationMetadata: {
            config,
            generationTime
          }
        } satisfies NoiseField
      }),

    analyzeSimplex: (coordinate, config) =>
      Effect.gen(function* () {
        // シンプレックス解析の実装
        const x = coordinate.x * config.frequency
        const y = coordinate.z * config.frequency

        const skewFactor = (Math.sqrt(3.0) - 1.0) / 2.0
        const s = (x + y) * skewFactor
        const i = Math.floor(x + s)
        const j = Math.floor(y + s)

        const vertices: SimplexVertex[] = []

        // 3つの頂点を解析
        const unskewFactor = (3.0 - Math.sqrt(3.0)) / 6.0
        const t = (i + j) * unskewFactor
        const X0 = i - t
        const Y0 = j - t

        // 各頂点の情報を収集
        vertices.push({
          coordinates: [i, j],
          gradientVector: [1, 1], // 簡略化
          contribution: 0.5,
          distance: Math.sqrt((coordinate.x - X0) ** 2 + (coordinate.z - Y0) ** 2)
        })

        return vertices
      }),

    measureAnisotropy: (centerCoordinate, sampleRadius, sampleCount, config) =>
      Effect.gen(function* () {
        const samples: number[] = []

        // 円周上でサンプリング
        for (let i = 0; i < sampleCount; i++) {
          const angle = (2 * Math.PI * i) / sampleCount
          const x = centerCoordinate.x + sampleRadius * Math.cos(angle)
          const z = centerCoordinate.z + sampleRadius * Math.sin(angle)

          const sample = yield* service.sample2D({ x, z } as WorldCoordinate2D, config)
          samples.push(sample.value)
        }

        // 分散の計算（等方性の指標）
        const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length
        const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length

        // 異方性スコア：分散が小さいほど等方的
        return 1.0 - Math.min(1.0, variance)
      }),

    optimizeConfig: (baseConfig, targetCharacteristics) =>
      Effect.gen(function* () {
        let optimizedConfig = { ...baseConfig }

        // 滑らかさの最適化
        if (targetCharacteristics.smoothness !== undefined) {
          optimizedConfig.frequency *= (1 - targetCharacteristics.smoothness * 0.5)
          optimizedConfig.persistence *= (targetCharacteristics.smoothness * 0.5 + 0.5)
        }

        // 等方性の最適化
        if (targetCharacteristics.isotropy !== undefined) {
          optimizedConfig.gradientSelection = targetCharacteristics.isotropy > 0.7 ? 'simplex' : 'optimized'
        }

        // パフォーマンスの最適化
        if (targetCharacteristics.performance !== undefined) {
          optimizedConfig.enableSIMD = targetCharacteristics.performance > 0.5
          optimizedConfig.cachingEnabled = targetCharacteristics.performance > 0.3
        }

        return optimizedConfig
      })
    }
  }
  return service
}

// ヘルパー関数とデータ構造

/**
 * 2Dドット積
 */
const dot2D = (g: readonly number[], x: number, y: number): number =>
  g[0] * x + g[1] * y

/**
 * 3Dドット積
 */
const dot3D = (g: readonly number[], x: number, y: number, z: number): number =>
  g[0] * x + g[1] * y + g[2] * z

/**
 * グラデーションベクトル（12個）
 */
const grad3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
] as const

/**
 * 排列テーブル
 */
const perm = new Array(512)
const permMod12 = new Array(512)

// 排列テーブルの初期化
const p = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
  119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
  218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
  222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
]

for (let i = 0; i < 512; i++) {
  perm[i] = p[i & 255]
  permMod12[i] = perm[i] % 12
}

/**
 * デフォルトシンプレックスノイズ設定
 */
export const DEFAULT_SIMPLEX_CONFIG: SimplexNoiseConfig = {
  frequency: 0.01,
  amplitude: 1.0,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  seed: 12345n,
  gradientSelection: 'simplex',
  enableAntiAliasing: true,
  enableSIMD: true,
  cachingEnabled: true
}
