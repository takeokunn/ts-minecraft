/**
 * @fileoverview WorldGeneratorFactory Validation - 生成時検証システム
 *
 * WorldGenerator生成時の包括的な検証システムです。
 * ビジネスルール、技術制約、パフォーマンス要件を統合的に検証し、
 * 高品質で安全なWorldGenerator生成を保証します。
 *
 * ## 検証レベル
 * - Basic: 必須パラメータと基本制約の検証
 * - Standard: 推奨設定とパフォーマンス検証
 * - Strict: 詳細なビジネスルールと最適化検証
 *
 * ## 検証カテゴリ
 * - Parameter Validation: パラメータ妥当性
 * - Business Rules: ビジネスルール適合性
 * - Performance Constraints: パフォーマンス制約
 * - Resource Limits: リソース制限
 * - Configuration Conflicts: 設定競合
 */

import * as WorldSeed from '@domain/world/value_object/world_seed/index'
import { JsonValueSchema } from '@shared/schema/json'
import { Effect, Function, Match, Schema, Either } from 'effect'
import type { CreateWorldGeneratorParams, FactoryError } from './factory'
import { CreateWorldGeneratorParamsSchema } from './factory'

// ================================
// Validation Result Types
// ================================

/**
 * 検証結果の重要度レベル
 */
export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical'

/**
 * 検証問題の種類
 */
export type ValidationCategory =
  | 'parameter_missing'
  | 'parameter_invalid'
  | 'constraint_violation'
  | 'performance_concern'
  | 'resource_limit'
  | 'configuration_conflict'
  | 'business_rule_violation'
  | 'compatibility_issue'

/**
 * 検証問題
 */
export const ValidationIssueSchema = Schema.Struct({
  severity: Schema.Literal('info', 'warning', 'error', 'critical'),
  category: Schema.Literal(
    'parameter_missing',
    'parameter_invalid',
    'constraint_violation',
    'performance_concern',
    'resource_limit',
    'configuration_conflict',
    'business_rule_violation',
    'compatibility_issue'
  ),
  message: Schema.String,
  field: Schema.optional(Schema.String),
  expectedValue: Schema.optional(JsonValueSchema),
  actualValue: Schema.optional(JsonValueSchema),
  suggestion: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
})

export type ValidationIssue = typeof ValidationIssueSchema.Type

/**
 * 検証結果
 */
export const ValidationResultSchema = Schema.Struct({
  isValid: Schema.Boolean,
  level: Schema.Literal('basic', 'standard', 'strict'),
  issues: Schema.Array(ValidationIssueSchema),
  score: Schema.Number.pipe(Schema.between(0, 100)),
  summary: Schema.Struct({
    errors: Schema.Number,
    warnings: Schema.Number,
    infos: Schema.Number,
    criticals: Schema.Number,
  }),
  recommendations: Schema.Array(Schema.String),
  estimatedPerformance: Schema.Struct({
    cpuUsage: Schema.Literal('low', 'medium', 'high'),
    memoryUsage: Schema.Literal('low', 'medium', 'high'),
    generationSpeed: Schema.Literal('slow', 'normal', 'fast'),
  }),
})

export type ValidationResult = typeof ValidationResultSchema.Type

/**
 * 検証レベル
 */
export type ValidationLevel = 'basic' | 'standard' | 'strict'

// ================================
// Validation Rules
// ================================

/**
 * 基本検証ルール
 */
const basicValidationRules = [
  // 必須パラメータ検証
  validateRequiredParameters,
  validateParameterTypes,
  validateBasicConstraints,
] as const

/**
 * 標準検証ルール
 */
const standardValidationRules = [
  ...basicValidationRules,
  validatePerformanceSettings,
  validateResourceLimits,
  validateFeatureCompatibility,
] as const

/**
 * 厳密検証ルール
 */
const strictValidationRules = [
  ...standardValidationRules,
  validateBusinessRules,
  validateOptimizationRules,
  validateAdvancedConstraints,
  validateConfigurationConsistency,
] as const

// ================================
// Main Validation Functions
// ================================

/**
 * メイン検証関数
 */
export const validateParams = (
  params: CreateWorldGeneratorParams,
  level: ValidationLevel = 'standard'
): Effect.Effect<ValidationResult, FactoryError> =>
  Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // レベルに応じた検証ルール選択
    const rules = Function.pipe(
      Match.value(level),
      Match.when('basic', () => basicValidationRules),
      Match.when('standard', () => standardValidationRules),
      Match.when('strict', () => strictValidationRules),
      Match.orElse(() => standardValidationRules)
    )

    // 並列検証実行
    const ruleResults = yield* Effect.all(
      rules.map((rule) => rule(params)),
      { concurrency: 4 }
    )

    // 結果統合
    const allIssues = ruleResults.flat()
    issues.push(...allIssues)

    // 検証結果構築
    const result = buildValidationResult(issues, level)

    return result
  })

/**
 * 高速検証（基本チェックのみ）
 */
export const validateParamsQuick = (params: CreateWorldGeneratorParams): Effect.Effect<boolean, FactoryError> =>
  Effect.gen(function* () {
    const result = yield* validateParams(params, 'basic')
    return result.isValid
  })

/**
 * パフォーマンス影響分析付き検証
 */
export const validateWithPerformanceAnalysis = (
  params: CreateWorldGeneratorParams
): Effect.Effect<ValidationResult & { performanceReport: PerformanceReport }, FactoryError> =>
  Effect.gen(function* () {
    const validation = yield* validateParams(params, 'strict')
    const performanceReport = yield* analyzePerformanceImpact(params)

    return {
      ...validation,
      performanceReport,
    }
  })

// ================================
// Individual Validation Rules
// ================================

/**
 * 必須パラメータ検証
 */
function validateRequiredParameters(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // seedは必須ではないが、指定された場合は有効である必要がある
    yield* Effect.when(params.seed && !isValidSeed(params.seed), () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'error',
            category: 'parameter_invalid',
            message: 'Invalid seed value provided',
            field: 'seed',
            actualValue: params.seed,
            suggestion: 'Provide a valid WorldSeed or omit to generate random seed',
          })
        )
      })
    )

    return issues
  })
}

/**
 * パラメータ型検証
 */
function validateParameterTypes(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.succeed(
    pipe(
      Schema.decodeEither(CreateWorldGeneratorParamsSchema)(params),
      Either.match({
        onLeft: () => [
          createIssue({
            severity: 'error',
            category: 'parameter_invalid',
            message: 'Parameter type validation failed',
            suggestion: 'Check parameter types match expected schema',
          }),
        ],
        onRight: () => [],
      })
    )
  )
}

/**
 * 基本制約検証
 */
function validateBasicConstraints(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // 並行生成数制約
    yield* Effect.when(
      params.maxConcurrentGenerations !== undefined &&
        (params.maxConcurrentGenerations < 1 || params.maxConcurrentGenerations > 16),
      () =>
        Effect.sync(() => {
          issues.push(
            createIssue({
              severity: 'error',
              category: 'constraint_violation',
              message: 'Maximum concurrent generations must be between 1 and 16',
              field: 'maxConcurrentGenerations',
              actualValue: params.maxConcurrentGenerations,
              expectedValue: '1-16',
              suggestion: 'Set value between 1 and 16 based on system capabilities',
            })
          )
        })
    )

    // キャッシュサイズ制約
    yield* Effect.when(params.cacheSize !== undefined && (params.cacheSize < 100 || params.cacheSize > 10000), () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'error',
            category: 'constraint_violation',
            message: 'Cache size must be between 100 and 10000',
            field: 'cacheSize',
            actualValue: params.cacheSize,
            expectedValue: '100-10000',
            suggestion: 'Adjust cache size based on available memory',
          })
        )
      })
    )

    return issues
  })
}

/**
 * パフォーマンス設定検証
 */
function validatePerformanceSettings(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // 品質レベルと並行数の整合性
    yield* Effect.when(
      params.qualityLevel === 'quality' && params.maxConcurrentGenerations && params.maxConcurrentGenerations > 4,
      () =>
        Effect.sync(() => {
          issues.push(
            createIssue({
              severity: 'warning',
              category: 'performance_concern',
              message: 'High quality level with many concurrent generations may impact performance',
              suggestion: 'Consider reducing concurrent generations for quality mode',
            })
          )
        })
    )

    // 高速モードと機能有効化の整合性
    yield* Effect.when(
      params.qualityLevel === 'fast' && (params.enableStructures || params.enableCaves || params.enableOres),
      () =>
        Effect.sync(() => {
          issues.push(
            createIssue({
              severity: 'info',
              category: 'performance_concern',
              message: 'Fast quality mode with complex features enabled',
              suggestion: 'Disable complex features for maximum performance in fast mode',
            })
          )
        })
    )

    return issues
  })
}

/**
 * リソース制限検証
 */
function validateResourceLimits(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // メモリ使用量推定
    const estimatedMemory = estimateMemoryUsage(params)
    yield* Effect.when(estimatedMemory > 1024, () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'warning',
            category: 'resource_limit',
            message: `High estimated memory usage: ${estimatedMemory}MB`,
            suggestion: 'Consider reducing cache size or concurrent generations',
          })
        )
      })
    )

    return issues
  })
}

/**
 * 機能互換性検証
 */
function validateFeatureCompatibility(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // デバッグモードと品質レベルの整合性
    yield* Effect.when(params.enableDebugMode && params.qualityLevel === 'quality', () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'info',
            category: 'configuration_conflict',
            message: 'Debug mode enabled with quality level - may impact performance',
            suggestion: 'Use fast or balanced quality for debugging',
          })
        )
      })
    )

    return issues
  })
}

/**
 * ビジネスルール検証
 */
function validateBusinessRules(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // 構造物なしでも洞窟・鉱石は有効化推奨
    yield* Effect.when(!params.enableStructures && !params.enableCaves && !params.enableOres, () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'warning',
            category: 'business_rule_violation',
            message: 'All generation features disabled - world may be too simple',
            suggestion: 'Enable at least caves or ores for interesting terrain',
          })
        )
      })
    )

    return issues
  })
}

/**
 * 最適化ルール検証
 */
function validateOptimizationRules(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // CPU使用率最適化チェック
    const cpuScore = calculateCpuUsageScore(params)
    yield* Effect.when(cpuScore > 80, () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'warning',
            category: 'performance_concern',
            message: 'High CPU usage configuration detected',
            suggestion: 'Reduce quality level or concurrent generations for better performance',
          })
        )
      })
    )

    return issues
  })
}

/**
 * 高度制約検証
 */
function validateAdvancedConstraints(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // 複雑な制約チェック
    yield* Effect.when(
      params.qualityLevel === 'quality' &&
        params.maxConcurrentGenerations &&
        params.maxConcurrentGenerations > 1 &&
        params.cacheSize &&
        params.cacheSize > 3000,
      () =>
        Effect.sync(() => {
          issues.push(
            createIssue({
              severity: 'info',
              category: 'performance_concern',
              message: 'Resource-intensive configuration may require high-end hardware',
              suggestion: 'Monitor system performance and adjust if needed',
            })
          )
        })
    )

    return issues
  })
}

/**
 * 設定一貫性検証
 */
function validateConfigurationConsistency(params: CreateWorldGeneratorParams): Effect.Effect<ValidationIssue[], never> {
  return Effect.gen(function* () {
    const issues: ValidationIssue[] = []

    // ログレベルとデバッグモードの整合性
    yield* Effect.when(!params.enableDebugMode && params.logLevel === 'debug', () =>
      Effect.sync(() => {
        issues.push(
          createIssue({
            severity: 'info',
            category: 'configuration_conflict',
            message: 'Debug log level without debug mode',
            suggestion: 'Enable debug mode or use info log level',
          })
        )
      })
    )

    return issues
  })
}

// ================================
// Helper Functions
// ================================

/**
 * 検証問題作成ヘルパー
 */
function createIssue(
  issue: Partial<ValidationIssue> & Pick<ValidationIssue, 'severity' | 'category' | 'message'>
): ValidationIssue {
  return {
    severity: issue.severity,
    category: issue.category,
    message: issue.message,
    field: issue.field,
    expectedValue: issue.expectedValue,
    actualValue: issue.actualValue,
    suggestion: issue.suggestion,
    code: issue.code,
  }
}

/**
 * 検証結果構築
 */
function buildValidationResult(issues: ValidationIssue[], level: ValidationLevel): ValidationResult {
  const summary = {
    criticals: issues.filter((i) => i.severity === 'critical').length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
  }

  const isValid = summary.criticals === 0 && summary.errors === 0

  // スコア計算（criticals: -50, errors: -20, warnings: -5, infos: -1）
  const score = Math.max(
    0,
    100 - summary.criticals * 50 - summary.errors * 20 - summary.warnings * 5 - summary.infos * 1
  )

  const recommendations = generateRecommendations(issues)

  return {
    isValid,
    level,
    issues,
    score,
    summary,
    recommendations,
    estimatedPerformance: {
      cpuUsage: 'medium',
      memoryUsage: 'medium',
      generationSpeed: 'normal',
    },
  }
}

/**
 * 推奨事項生成
 */
function generateRecommendations(issues: ValidationIssue[]): string[] {
  return issues
    .filter((issue) => issue.suggestion)
    .map((issue) => issue.suggestion!)
    .filter((suggestion, index, array) => array.indexOf(suggestion) === index) // 重複削除
}

/**
 * シード有効性チェック
 */
function isValidSeed(seed: unknown): boolean {
  return pipe(
    Schema.decodeEither(WorldSeed.WorldSeedValueObjectSchema)(seed),
    Either.match({ onLeft: () => false, onRight: () => true })
  )
}

/**
 * メモリ使用量推定
 */
function estimateMemoryUsage(params: CreateWorldGeneratorParams): number {
  const baseMemory = 100 // MB

  const cacheMemory = params.cacheSize ? params.cacheSize * 0.1 : 0
  const concurrencyMemory = params.maxConcurrentGenerations ? params.maxConcurrentGenerations * 50 : 0

  const qualityMultiplier = params.qualityLevel === 'quality' ? 1.5 : 1.0

  return Math.round((baseMemory + cacheMemory + concurrencyMemory) * qualityMultiplier)
}

/**
 * CPU使用率スコア計算
 */
function calculateCpuUsageScore(params: CreateWorldGeneratorParams): number {
  const baseScore = 20

  const qualityScore = Function.pipe(
    Match.value(params.qualityLevel),
    Match.when('quality', () => 30),
    Match.when('balanced', () => 15),
    Match.orElse(() => 0)
  )

  const concurrencyScore = params.maxConcurrentGenerations ? params.maxConcurrentGenerations * 5 : 0

  const featureScore = [
    params.enableStructures ? 10 : 0,
    params.enableCaves ? 15 : 0,
    params.enableOres ? 10 : 0,
  ].reduce((sum, score) => sum + score, 0)

  return Math.min(100, baseScore + qualityScore + concurrencyScore + featureScore)
}

// ================================
// Performance Analysis
// ================================

/**
 * パフォーマンス分析レポート
 */
interface PerformanceReport {
  estimatedMemory: number
  estimatedCpuUsage: number
  recommendedThreads: number
  bottlenecks: string[]
  optimizations: string[]
}

/**
 * パフォーマンス影響分析
 */
function analyzePerformanceImpact(params: CreateWorldGeneratorParams): Effect.Effect<PerformanceReport, never> {
  return Effect.gen(function* () {
    const estimatedMemory = estimateMemoryUsage(params)
    const estimatedCpuUsage = calculateCpuUsageScore(params)
    const recommendedThreads = calculateRecommendedThreads(params)

    const bottlenecks: string[] = []
    const optimizations: string[] = []

    // ボトルネック分析
    yield* Effect.when(estimatedMemory > 512, () =>
      Effect.sync(() => {
        bottlenecks.push('High memory usage')
        optimizations.push('Reduce cache size')
      })
    )

    yield* Effect.when(estimatedCpuUsage > 70, () =>
      Effect.sync(() => {
        bottlenecks.push('High CPU usage')
        optimizations.push('Use fast quality mode or reduce concurrent generations')
      })
    )

    yield* Effect.when(params.maxConcurrentGenerations && params.maxConcurrentGenerations > 8, () =>
      Effect.sync(() => {
        bottlenecks.push('Thread contention')
        optimizations.push('Reduce concurrent generation count')
      })
    )

    return {
      estimatedMemory,
      estimatedCpuUsage,
      recommendedThreads,
      bottlenecks,
      optimizations,
    }
  })
}

/**
 * 推奨スレッド数計算
 */
function calculateRecommendedThreads(params: CreateWorldGeneratorParams): number {
  return Function.pipe(
    Match.value(params.qualityLevel),
    Match.when('quality', () => 2),
    Match.when('fast', () => 8),
    Match.orElse(() => 4) // balanced
  )
}

// ================================
// Exports
// ================================

export {
  type ValidationCategory,
  type ValidationIssue,
  type ValidationLevel,
  type ValidationResult,
  type ValidationSeverity,
}
