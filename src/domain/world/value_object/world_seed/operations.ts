/**
 * WorldSeed Operations - 純粋関数による操作群
 *
 * 全ての操作はEffect型による安全なエラーハンドリングと
 * 不変性を保証する関数型プログラミングパターンを採用
 */

import { Clock, Effect, Equal, Hash, Random, ReadonlyArray, Schema } from 'effect'
import {
  CreateWorldSeedParams,
  CreateWorldSeedParamsSchema,
  EntropyLevel,
  SeedQuality,
  SeedQualitySchema,
  TimestampSchema,
  WorldSeed,
  WorldSeedError,
  WorldSeedSchema,
  WorldSeedValueObjectSchema,
  type WorldSeedBrand,
} from './index'

/**
 * WorldSeed操作群 - 関数型パターンによる完全実装
 */
export const WorldSeedOps = {
  /**
   * WorldSeed作成 - 安全な作成プロセス
   */
  create: (params: CreateWorldSeedParams = {}): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      // パラメータ検証
      const validatedParams = yield* Schema.decodeUnknown(CreateWorldSeedParamsSchema)(params)

      // シード値生成
      const seedValue = yield* generateSeedValue(validatedParams)

      // エントロピー計算
      const entropy = calculateEntropy(seedValue)

      // タイムスタンプ取得
      const timestampMs = yield* Clock.currentTimeMillis
      const timestamp = Schema.decodeSync(TimestampSchema)(timestampMs)

      // WorldSeed構築
      const worldSeed: WorldSeed = {
        value: seedValue,
        timestamp,
        entropy,
        humanReadable: validatedParams.humanReadable,
        context: validatedParams.generator
          ? {
              generator: validatedParams.generator,
              source: validatedParams.source,
            }
          : undefined,
      }

      // 最終検証
      return yield* Schema.decodeUnknown(WorldSeedValueObjectSchema)(worldSeed)
    }),

  /**
   * 数値からWorldSeed作成
   */
  fromNumber: (value: number): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      const seedValue = yield* Effect.try({
        try: () => Schema.decodeSync(WorldSeedSchema)(value),
        catch: (error) => ({
          _tag: 'InvalidSeedValue' as const,
          value,
          message: `Invalid seed number: ${error}`,
        }),
      })

      return yield* WorldSeedOps.create({ value: seedValue })
    }),

  /**
   * 文字列からWorldSeed作成 - ハッシュ化による変換
   */
  fromString: (input: string): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      if (!input || input.trim().length === 0) {
        return yield* Effect.fail({
          _tag: 'InvalidSeedValue' as const,
          value: input,
          message: 'Seed string cannot be empty',
        })
      }

      // 文字列をハッシュ化して32bit整数に変換
      const hash = stringToSeed(input.trim())

      return yield* WorldSeedOps.create({
        value: hash,
        humanReadable: input.trim(),
        generator: 'string',
        source: input,
      })
    }),

  /**
   * ランダムシード生成
   */
  random: (): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      const randomValue = yield* Random.nextIntBetween(-2147483648, 2147483647)

      return yield* WorldSeedOps.create({
        value: randomValue,
        generator: 'random',
      })
    }),

  /**
   * タイムスタンプベースシード生成
   */
  fromTimestamp: (): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const seedValue = (timestamp % 4294967296) - 2147483648

      return yield* WorldSeedOps.create({
        value: seedValue,
        generator: 'timestamp',
        source: timestamp.toString(),
      })
    }),

  /**
   * 等価性判定 - 値による比較
   */
  equals: (a: WorldSeed, b: WorldSeed): boolean => Equal.equals(a.value, b.value),

  /**
   * ハッシュ値計算
   */
  hash: (seed: WorldSeed): number => Hash.hash(seed.value),

  /**
   * 文字列表現
   */
  toString: (seed: WorldSeed): string => seed.humanReadable ?? seed.value.toString(),

  /**
   * JSON形式変換
   */
  toJSON: (seed: WorldSeed): string =>
    JSON.stringify({
      value: seed.value,
      timestamp: seed.timestamp,
      entropy: seed.entropy,
      humanReadable: seed.humanReadable,
      context: seed.context,
    }),

  /**
   * JSONからの復元
   */
  fromJSON: (json: string): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      const parsed = yield* Effect.try({
        try: () => JSON.parse(json),
        catch: (error) => ({
          _tag: 'ValidationError' as const,
          field: 'json',
          value: json,
          message: `Invalid JSON: ${error}`,
        }),
      })

      return yield* Schema.decodeUnknown(WorldSeedValueObjectSchema)(parsed)
    }),

  /**
   * シード品質評価
   */
  evaluateQuality: (seed: WorldSeed): Effect.Effect<SeedQuality, WorldSeedError> =>
    Effect.gen(function* () {
      const value = seed.value

      // 分布均一性計算
      const uniformity = calculateUniformity(value)

      // 複雑性計算
      const complexity = calculateComplexity(value)

      // 総合スコア計算
      const score = Math.round((uniformity + complexity) * 50)

      // 推奨事項生成
      const recommendations = generateRecommendations(score, uniformity, complexity)

      const quality: SeedQuality = {
        score,
        entropy: seed.entropy,
        distribution: {
          uniformity,
          complexity,
        },
        recommendations,
      }

      return yield* Schema.decodeUnknown(SeedQualitySchema)(quality)
    }),

  /**
   * シードの派生生成 - 元シードから新しいシードを生成
   */
  derive: (seed: WorldSeed, offset: number): Effect.Effect<WorldSeed, WorldSeedError> =>
    Effect.gen(function* () {
      // 安全な加算（オーバーフロー対応）
      const newValue = ((((seed.value + offset) % 4294967296) + 4294967296) % 4294967296) - 2147483648

      return yield* WorldSeedOps.create({
        value: newValue,
        humanReadable: `${WorldSeedOps.toString(seed)}+${offset}`,
        generator: 'custom',
        source: `derived from ${seed.value} + ${offset}`,
      })
    }),

  /**
   * シード範囲生成 - 連続したシード値を生成
   */
  range: (start: WorldSeed, count: number): Effect.Effect<readonly WorldSeed[], WorldSeedError> =>
    Effect.gen(function* () {
      if (count <= 0 || count > 1000) {
        return yield* Effect.fail({
          _tag: 'ValidationError' as const,
          field: 'count',
          value: count,
          message: 'Count must be between 1 and 1000',
        })
      }

      return yield* Effect.forEach(ReadonlyArray.range(0, count), (i) => WorldSeedOps.derive(start, i))
    }),
}

/**
 * 内部ヘルパー関数群
 */

/**
 * シード値生成ロジック
 */
const generateSeedValue = (params: CreateWorldSeedParams): Effect.Effect<WorldSeedBrand, WorldSeedError> =>
  Effect.gen(function* () {
    if (params.value !== undefined) {
      if (typeof params.value === 'number') {
        return yield* Schema.decodeUnknown(WorldSeedSchema)(params.value)
      } else if (typeof params.value === 'string') {
        const hash = stringToSeed(params.value)
        return yield* Schema.decodeUnknown(WorldSeedSchema)(hash)
      }
    }

    // デフォルト: ランダム生成
    const randomValue = yield* Random.nextIntBetween(-2147483648, 2147483647)
    return yield* Schema.decodeUnknown(WorldSeedSchema)(randomValue)
  })

/**
 * 文字列からシード値への変換（Java互換ハッシュ）
 */
const stringToSeed = (str: string): number => {
  const hash = ReadonlyArray.reduce(
    ReadonlyArray.fromIterable(str),
    0,
    (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff
  )
  // 32bit符号付き整数に変換
  return hash | 0
}

/**
 * エントロピーレベル計算
 */
const calculateEntropy = (value: WorldSeedBrand): EntropyLevel => {
  const absValue = Math.abs(value)
  const bitCount = absValue.toString(2).split('1').length - 1

  if (bitCount <= 8) return 'low'
  if (bitCount <= 16) return 'medium'
  return 'high'
}

/**
 * 分布均一性計算
 */
const calculateUniformity = (value: number): number => {
  const binary = Math.abs(value).toString(2).padStart(32, '0')
  const ones = binary.split('1').length - 1
  const zeros = binary.length - ones

  // 均一性 = 1 - |0と1の数の差| / 総ビット数
  return 1 - Math.abs(ones - zeros) / 32
}

/**
 * 複雑性計算
 */
const calculateComplexity = (value: number): number => {
  const binary = Math.abs(value).toString(2)

  const transitions = ReadonlyArray.reduce(ReadonlyArray.range(1, binary.length), 0, (count, i) =>
    binary[i] !== binary[i - 1] ? count + 1 : count
  )

  // 複雑性 = 遷移数 / 最大可能遷移数
  return transitions / (binary.length - 1)
}

/**
 * 推奨事項生成
 */
const generateRecommendations = (score: number, uniformity: number, complexity: number): string[] => {
  const recommendations: string[] = []

  if (score < 30) {
    recommendations.push('Low quality seed - consider using a different value')
  }

  if (uniformity < 0.3) {
    recommendations.push('Poor bit distribution - seed may produce biased results')
  }

  if (complexity < 0.3) {
    recommendations.push('Low complexity - seed may produce predictable patterns')
  }

  if (score >= 80) {
    recommendations.push('Excellent seed quality - suitable for production use')
  }

  return recommendations
}
