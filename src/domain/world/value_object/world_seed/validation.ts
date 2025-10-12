/**
 * WorldSeed Validation - 高度な検証ロジックとビジネスルール
 *
 * DDD原則に基づく自己検証機能とドメイン固有の制約実装
 */

import { Clock, Effect, Match, Option, ReadonlyArray, Schema, pipe } from 'effect'
import { EntropyLevel, WorldSeed, WorldSeedError, WorldSeedErrorSchema, WorldSeedOps } from './index'

/**
 * 検証結果型
 */
export const ValidationResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  errors: Schema.Array(WorldSeedErrorSchema),
  warnings: Schema.Array(Schema.String),
  suggestions: Schema.Array(Schema.String),
})

export type ValidationResult = typeof ValidationResultSchema.Type

/**
 * 検証オプション
 */
export const ValidationOptionsSchema = Schema.Struct({
  strictMode: Schema.Boolean.pipe(Schema.optional),
  checkQuality: Schema.Boolean.pipe(Schema.optional),
  allowLowEntropy: Schema.Boolean.pipe(Schema.optional),
  customRules: Schema.Array(Schema.String).pipe(Schema.optional),
})

export type ValidationOptions = typeof ValidationOptionsSchema.Type

/**
 * 禁止されたシード値パターン
 */
const FORBIDDEN_SEEDS = new Set([
  0, // 潜在的な初期化問題
  -1, // 一般的なエラー値
  2147483647, // MAX_INT
  -2147483648, // MIN_INT
  1,
  2,
  3,
  4,
  5, // 単純すぎる値
])

/**
 * 品質しきい値
 */
const QUALITY_THRESHOLDS = {
  MINIMUM_SCORE: 20,
  RECOMMENDED_SCORE: 50,
  EXCELLENT_SCORE: 80,
  MINIMUM_UNIFORMITY: 0.2,
  MINIMUM_COMPLEXITY: 0.2,
} as const

/**
 * WorldSeed検証操作群
 */
export const WorldSeedValidation = {
  /**
   * 包括的検証 - 全ての検証ルールを適用
   */
  validate: (seed: WorldSeed, options: ValidationOptions = {}): Effect.Effect<ValidationResult, never> =>
    Effect.gen(function* () {
      const errors: WorldSeedError[] = []
      const warnings: string[] = []
      const suggestions: string[] = []

      // 基本構造検証
      const structureValidation = yield* validateStructure(seed)
      const structureErrors = pipe(
        Match.value(structureValidation),
        Match.when(({ isValid }) => !isValid, ({ errors }) => errors),
        Match.orElse(() => [] as WorldSeedError[])
      )
      errors.push(...structureErrors)

      // ビジネスルール検証
      const businessValidation = yield* validateBusinessRules(seed, options)
      errors.push(...businessValidation.errors)
      warnings.push(...businessValidation.warnings)

      // 品質検証（オプション）
      const qualityValidation = yield* pipe(
        Match.value(options.checkQuality ?? true),
        Match.when(true, () => validateQuality(seed, options)),
        Match.orElse(() => Effect.succeed({ warnings: [] as string[], suggestions: [] as string[] }))
      )
      warnings.push(...qualityValidation.warnings)
      suggestions.push(...qualityValidation.suggestions)

      // カスタムルール検証
      const customValidation = yield* pipe(
        Option.fromNullable(options.customRules),
        Option.filter((rules) => rules.length > 0),
        Option.match({
          onNone: () => Effect.succeed({ errors: [] as WorldSeedError[], warnings: [] as string[] }),
          onSome: (rules) => validateCustomRules(seed, rules),
        })
      )
      errors.push(...customValidation.errors)
      warnings.push(...customValidation.warnings)

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      }

      return result
    }),

  /**
   * 高速検証 - 基本的なチェックのみ
   */
  quickValidate: (seed: WorldSeed): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const validation = yield* validateStructure(seed)
      return validation.isValid && !FORBIDDEN_SEEDS.has(seed.value)
    }),

  /**
   * 品質スコア検証
   */
  validateQuality: (
    seed: WorldSeed,
    minScore: number = QUALITY_THRESHOLDS.MINIMUM_SCORE
  ): Effect.Effect<boolean, WorldSeedError> =>
    Effect.gen(function* () {
      const quality = yield* WorldSeedOps.evaluateQuality(seed)
      return quality.score >= minScore
    }),

  /**
   * エントロピー検証
   */
  validateEntropy: (seed: WorldSeed, minLevel: EntropyLevel = 'low'): Effect.Effect<boolean, never> =>
    Effect.succeed(compareEntropyLevel(seed.entropy, minLevel) >= 0),

  /**
   * 範囲検証
   */
  validateRange: (
    seed: WorldSeed,
    min: number = -2147483648,
    max: number = 2147483647
  ): Effect.Effect<boolean, never> => Effect.succeed(seed.value >= min && seed.value <= max),

  /**
   * 重複検証 - 既存シードとの重複チェック
   */
  validateUniqueness: (seed: WorldSeed, existingSeeds: readonly WorldSeed[]): Effect.Effect<boolean, never> =>
    Effect.succeed(!existingSeeds.some((existing) => WorldSeedOps.equals(seed, existing))),

  /**
   * 本番環境適合性検証
   */
  validateForProduction: (seed: WorldSeed): Effect.Effect<ValidationResult, never> =>
    WorldSeedValidation.validate(seed, {
      strictMode: true,
      checkQuality: true,
      allowLowEntropy: false,
    }),

  /**
   * 開発環境適合性検証
   */
  validateForDevelopment: (seed: WorldSeed): Effect.Effect<ValidationResult, never> =>
    WorldSeedValidation.validate(seed, {
      strictMode: false,
      checkQuality: false,
      allowLowEntropy: true,
    }),
}

/**
 * 内部検証関数群
 */

/**
 * 構造検証
 */
const validateStructure = (seed: WorldSeed): Effect.Effect<ValidationResult, never> =>
  Effect.gen(function* () {
    const errors: WorldSeedError[] = []

    // Schemaによる基本検証
    const schemaValidation = yield* Effect.either(
      Schema.decodeUnknown(
        Schema.Struct({
          value: Schema.Number,
          timestamp: Schema.Number,
          entropy: Schema.Literal('low', 'medium', 'high'),
        })
      )(seed)
    )

    const structuralErrors = pipe(
      Match.value(schemaValidation),
      Match.when(
        (result): result is { _tag: 'Left' } => result._tag === 'Left',
        () =>
          [
            {
              _tag: 'ValidationError' as const,
              field: 'structure',
              value: seed,
              message: 'Invalid seed structure',
            },
          ]
      ),
      Match.orElse(() => [] as WorldSeedError[])
    )
    errors.push(...structuralErrors)

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      suggestions: [],
    }
  })

/**
 * ビジネスルール検証
 */
const validateBusinessRules = (
  seed: WorldSeed,
  options: ValidationOptions
): Effect.Effect<{
  errors: WorldSeedError[]
  warnings: string[]
}> =>
  Effect.gen(function* () {
    const forbiddenOutcome = pipe(
      Match.value(FORBIDDEN_SEEDS.has(seed.value)),
      Match.when(true, () =>
        pipe(
          Match.value(options.strictMode ?? false),
          Match.when(true, () => ({
            errors: [
              {
                _tag: 'InvalidSeedValue' as const,
                value: seed.value,
                message: `Forbidden seed value: ${seed.value}`,
              },
            ],
            warnings: [] as string[],
          })),
          Match.orElse(() => ({
            errors: [] as WorldSeedError[],
            warnings: [`Warning: Using potentially problematic seed value: ${seed.value}`],
          }))
        )
      ),
      Match.orElse(() => ({ errors: [] as WorldSeedError[], warnings: [] as string[] }))
    )

    const now = yield* Clock.currentTimeMillis

    const futureWarnings = pipe(
      Match.value(seed.timestamp > now),
      Match.when(true, () => ['Seed timestamp is in the future']),
      Match.orElse(() => [] as string[])
    )

    const staleWarnings = pipe(
      Match.value(seed.timestamp < now - 365 * 24 * 60 * 60 * 1000),
      Match.when(true, () => ['Seed is very old (over 1 year)']),
      Match.orElse(() => [] as string[])
    )

    const lowEntropyOutcome = pipe(
      Match.value(seed.entropy === 'low' && !(options.allowLowEntropy ?? false)),
      Match.when(true, () =>
        pipe(
          Match.value(options.strictMode ?? false),
          Match.when(true, () => ({
            errors: [
              {
                _tag: 'InvalidSeedValue' as const,
                value: seed.value,
                message: 'Low entropy seeds not allowed in strict mode',
              },
            ],
            warnings: [] as string[],
          })),
          Match.orElse(() => ({
            errors: [] as WorldSeedError[],
            warnings: ['Low entropy seed may produce predictable results'],
          }))
        )
      ),
      Match.orElse(() => ({ errors: [] as WorldSeedError[], warnings: [] as string[] }))
    )

    const errors = [...forbiddenOutcome.errors, ...lowEntropyOutcome.errors]
    const warnings = [
      ...forbiddenOutcome.warnings,
      ...futureWarnings,
      ...staleWarnings,
      ...lowEntropyOutcome.warnings,
    ]

    return { errors, warnings }
  })

/**
 * 品質検証
 */
const validateQuality = (
  seed: WorldSeed,
  options: ValidationOptions
): Effect.Effect<{
  warnings: string[]
  suggestions: string[]
}> =>
  Effect.gen(function* () {
    const warnings: string[] = []
    const suggestions: string[] = []

    const quality = yield* WorldSeedOps.evaluateQuality(seed)

    const scoreOutcome = pipe(
      Match.value(quality.score),
      Match.when(
        (score) => score < QUALITY_THRESHOLDS.MINIMUM_SCORE,
        (score) => ({
          warnings: [`Very low quality seed (score: ${score})`],
          suggestions: ['Consider generating a new random seed'],
        })
      ),
      Match.when(
        (score) =>
          score >= QUALITY_THRESHOLDS.MINIMUM_SCORE && score < QUALITY_THRESHOLDS.RECOMMENDED_SCORE,
        (score) => ({
          warnings: [`Low quality seed (score: ${score})`],
          suggestions: ['Seed may work but better alternatives are available'],
        })
      ),
      Match.orElse(() => ({ warnings: [] as string[], suggestions: [] as string[] }))
    )

    const uniformityOutcome = pipe(
      Match.value(quality.distribution.uniformity),
      Match.when(
        (uniformity) => uniformity < QUALITY_THRESHOLDS.MINIMUM_UNIFORMITY,
        () => ({
          warnings: ['Poor bit distribution detected'],
          suggestions: ['Try a seed with more varied bit patterns'],
        })
      ),
      Match.orElse(() => ({ warnings: [] as string[], suggestions: [] as string[] }))
    )

    const complexityOutcome = pipe(
      Match.value(quality.distribution.complexity),
      Match.when(
        (complexity) => complexity < QUALITY_THRESHOLDS.MINIMUM_COMPLEXITY,
        () => ({
          warnings: ['Low complexity pattern detected'],
          suggestions: ['Use a seed with more complex bit transitions'],
        })
      ),
      Match.orElse(() => ({ warnings: [] as string[], suggestions: [] as string[] }))
    )

    const excellenceSuggestions = pipe(
      Match.value(quality.score),
      Match.when(
        (score) => score >= QUALITY_THRESHOLDS.EXCELLENT_SCORE,
        () => ['Excellent seed quality - perfect for production use']
      ),
      Match.orElse(() => [] as string[])
    )

    warnings.push(
      ...scoreOutcome.warnings,
      ...uniformityOutcome.warnings,
      ...complexityOutcome.warnings
    )

    suggestions.push(
      ...scoreOutcome.suggestions,
      ...uniformityOutcome.suggestions,
      ...complexityOutcome.suggestions,
      ...excellenceSuggestions
    )

    return { warnings, suggestions }
  })

/**
 * カスタムルール検証
 */
const validateCustomRules = (
  seed: WorldSeed,
  rules: readonly string[]
): Effect.Effect<{
  errors: WorldSeedError[]
  warnings: string[]
}> =>
  Effect.gen(function* () {
    const ruleResults = yield* Effect.forEach(rules, (rule) => applyCustomRule(seed, rule))

    return ReadonlyArray.reduce(
      ruleResults,
      { errors: [] as WorldSeedError[], warnings: [] as string[] },
      (acc, result) => ({
        errors: result.error ? [...acc.errors, result.error] : acc.errors,
        warnings: result.warning ? [...acc.warnings, result.warning] : acc.warnings,
      })
    )
  })

/**
 * カスタムルール適用
 */
const applyCustomRule = (
  seed: WorldSeed,
  rule: string
): Effect.Effect<{
  error?: WorldSeedError
  warning?: string
}> =>
  Effect.gen(function* () {
    return Match.value(rule).pipe(
      Match.when('no-even', () =>
        seed.value % 2 === 0
          ? {
              error: {
                _tag: 'ValidationError' as const,
                field: 'value',
                value: seed.value,
                message: 'Even numbers not allowed',
              },
            }
          : {}
      ),
      Match.when('no-negative', () =>
        seed.value < 0
          ? {
              error: {
                _tag: 'ValidationError' as const,
                field: 'value',
                value: seed.value,
                message: 'Negative values not allowed',
              },
            }
          : {}
      ),
      Match.when('warn-common', () =>
        isCommonSeed(seed.value) ? { warning: 'This is a commonly used seed value' } : {}
      ),
      Match.orElse(() => ({
        warning: `Unknown validation rule: ${rule}`,
      }))
    )
  })

/**
 * エントロピーレベル比較
 */
const compareEntropyLevel = (level1: EntropyLevel, level2: EntropyLevel): number => {
  const levels = { low: 0, medium: 1, high: 2 }
  return levels[level1] - levels[level2]
}

/**
 * 一般的なシード値判定
 */
const isCommonSeed = (value: number): boolean => {
  const commonSeeds = [123, 456, 789, 1234, 5678, 9999, 12345, 54321, 11111, 22222, 33333]
  return commonSeeds.includes(value)
}
