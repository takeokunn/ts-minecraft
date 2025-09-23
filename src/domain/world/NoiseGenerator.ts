import { Context, Effect, Layer, Match, pipe } from 'effect'
import { Schema } from '@effect/schema'

/**
 * ノイズ生成の設定オプション
 */
export const NoiseConfigSchema = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  octaves: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  persistence: Schema.Number.pipe(Schema.between(0.1, 1.0)),
  lacunarity: Schema.Number.pipe(Schema.between(1.5, 3.0)),
})

export type NoiseConfig = Schema.Schema.Type<typeof NoiseConfigSchema>

/**
 * Perlin Noise生成のためのService
 */
export interface NoiseGenerator {
  /**
   * 2D Perlin Noise生成
   */
  readonly noise2D: (x: number, y: number) => Effect.Effect<number, never>

  /**
   * 3D Perlin Noise生成
   */
  readonly noise3D: (x: number, y: number, z: number) => Effect.Effect<number, never>

  /**
   * オクターブノイズ生成（複数レイヤーのノイズを重ね合わせ）
   */
  readonly octaveNoise2D: (x: number, y: number, octaves: number, persistence: number) => Effect.Effect<number, never>

  /**
   * オクターブノイズ生成（3D版）
   */
  readonly octaveNoise3D: (
    x: number,
    y: number,
    z: number,
    octaves: number,
    persistence: number
  ) => Effect.Effect<number, never>

  /**
   * シード値を取得
   */
  readonly getSeed: () => number

  /**
   * 設定を取得
   */
  readonly getConfig: () => NoiseConfig
}

export const NoiseGeneratorTag = Context.GenericTag<NoiseGenerator>('domain/world/NoiseGenerator')

/**
 * Perlin Noise用の順列テーブル生成
 */
const generatePermutation = (seed: number): number[] => {
  const perm = Array.from({ length: 256 }, (_, i) => i)

  // シード値に基づくLCG（Linear Congruential Generator）
  let rng = seed
  const next = () => {
    rng = (rng * 1664525 + 1013904223) % Math.pow(2, 32)
    return rng / Math.pow(2, 32)
  }

  // Fisher-Yatesシャッフル
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const temp = perm[i] ?? 0
    perm[i] = perm[j] ?? 0
    perm[j] = temp
  }

  // 512個に拡張（境界処理を簡単にするため）
  return [...perm, ...perm]
}

/**
 * フェード関数（補間のスムージング）
 */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * 線形補間
 */
const lerp = (a: number, b: number, t: number): number => a + t * (b - a)

/**
 * グラデーションベクトル（2D）
 */
const grad2D = (hash: number, x: number, y: number): number => {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

/**
 * グラデーションベクトル（3D）
 */
const grad3D = (hash: number, x: number, y: number, z: number): number => {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

/**
 * NoiseGeneratorの実装
 */
const createNoiseGenerator = (config: NoiseConfig): NoiseGenerator => {
  const permutation = generatePermutation(config.seed)

  const noiseGenerator: NoiseGenerator = {
    noise2D: (x: number, y: number) =>
      Effect.sync(() => {
        // グリッド座標
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255

        // 相対座標
        const xf = x - Math.floor(x)
        const yf = y - Math.floor(y)

        // フェード値
        const u = fade(xf)
        const v = fade(yf)

        // グリッド角のハッシュ値
        const A = (permutation[X] ?? 0) + Y
        const B = (permutation[X + 1] ?? 0) + Y

        // グラデーション計算と補間
        const x1 = lerp(grad2D(permutation[A] ?? 0, xf, yf), grad2D(permutation[B] ?? 0, xf - 1, yf), u)
        const x2 = lerp(grad2D(permutation[A + 1] ?? 0, xf, yf - 1), grad2D(permutation[B + 1] ?? 0, xf - 1, yf - 1), u)

        return lerp(x1, x2, v)
      }),

    noise3D: (x: number, y: number, z: number) =>
      Effect.sync(() => {
        // グリッド座標
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255
        const Z = Math.floor(z) & 255

        // 相対座標
        const xf = x - Math.floor(x)
        const yf = y - Math.floor(y)
        const zf = z - Math.floor(z)

        // フェード値
        const u = fade(xf)
        const v = fade(yf)
        const w = fade(zf)

        // グリッド角のハッシュ値
        const A = (permutation[X] ?? 0) + Y
        const AA = (permutation[A] ?? 0) + Z
        const AB = (permutation[A + 1] ?? 0) + Z
        const B = (permutation[X + 1] ?? 0) + Y
        const BA = (permutation[B] ?? 0) + Z
        const BB = (permutation[B + 1] ?? 0) + Z

        // グラデーション計算と補間
        const x1 = lerp(grad3D(permutation[AA] ?? 0, xf, yf, zf), grad3D(permutation[BA] ?? 0, xf - 1, yf, zf), u)
        const x2 = lerp(
          grad3D(permutation[AB] ?? 0, xf, yf - 1, zf),
          grad3D(permutation[BB] ?? 0, xf - 1, yf - 1, zf),
          u
        )
        const y1 = lerp(x1, x2, v)

        const x3 = lerp(
          grad3D(permutation[AA + 1] ?? 0, xf, yf, zf - 1),
          grad3D(permutation[BA + 1] ?? 0, xf - 1, yf, zf - 1),
          u
        )
        const x4 = lerp(
          grad3D(permutation[AB + 1] ?? 0, xf, yf - 1, zf - 1),
          grad3D(permutation[BB + 1] ?? 0, xf - 1, yf - 1, zf - 1),
          u
        )
        const y2 = lerp(x3, x4, v)

        return lerp(y1, y2, w)
      }),

    octaveNoise2D: (x: number, y: number, octaves: number, persistence: number) =>
      Effect.gen(function* () {
        return yield* Effect.if(octaves <= 0, {
          onTrue: () => Effect.succeed(0),
          onFalse: () =>
            Effect.gen(function* () {
              let total = 0
              let frequency = 1
              let amplitude = 1
              let maxValue = 0

              for (let i = 0; i < octaves; i++) {
                const noise = yield* noiseGenerator.noise2D(x * frequency, y * frequency)
                total += noise * amplitude
                maxValue += amplitude
                amplitude *= persistence
                frequency *= 2
              }

              return yield* pipe(
                Match.value(maxValue),
                Match.when(
                  (n) => n > 0,
                  () => Effect.succeed(total / maxValue)
                ),
                Match.orElse(() => Effect.succeed(0))
              )
            }),
        })
      }),

    octaveNoise3D: (x: number, y: number, z: number, octaves: number, persistence: number) =>
      Effect.gen(function* () {
        return yield* Effect.if(octaves <= 0, {
          onTrue: () => Effect.succeed(0),
          onFalse: () =>
            Effect.gen(function* () {
              let total = 0
              let frequency = 1
              let amplitude = 1
              let maxValue = 0

              for (let i = 0; i < octaves; i++) {
                const noise = yield* noiseGenerator.noise3D(x * frequency, y * frequency, z * frequency)
                total += noise * amplitude
                maxValue += amplitude
                amplitude *= persistence
                frequency *= 2
              }

              return yield* pipe(
                Match.value(maxValue),
                Match.when(
                  (n) => n > 0,
                  () => Effect.succeed(total / maxValue)
                ),
                Match.orElse(() => Effect.succeed(0))
              )
            }),
        })
      }),

    getSeed: () => config.seed,
    getConfig: () => config,
  }

  return noiseGenerator
}

/**
 * NoiseGeneratorのLayer
 */
export const NoiseGeneratorLive = (config: NoiseConfig): Layer.Layer<NoiseGenerator, never, never> =>
  Layer.succeed(NoiseGeneratorTag, createNoiseGenerator(config))

/**
 * デフォルト設定でのLayer
 */
export const NoiseGeneratorLiveDefault = NoiseGeneratorLive({
  seed: Date.now(),
  octaves: 6,
  persistence: 0.5,
  lacunarity: 2.0,
})
