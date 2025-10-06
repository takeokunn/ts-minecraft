/**
 * @fileoverview GenerationSession Template Resolver
 *
 * セッションテンプレートの解決と管理システムです。
 * 複雑なセッション設定パターンを事前定義済みテンプレートとして提供し、
 * 使用ケースに最適化された設定を簡単に適用できます。
 *
 * ## 主要機能
 * - テンプレートレジストリ管理
 * - 動的テンプレート解決
 * - カスタムテンプレート作成
 * - テンプレート継承と合成
 * - 設定バリデーション
 */

import type * as GenerationSession from '@domain/world/aggregate/generation_session'
import { Clock, Effect, Function, Match, Option, Schema } from 'effect'
import type { ConfigurationProfile, SessionFactoryError, SessionTemplateType } from './index'
import { SessionTemplateRegistryService } from './template_registry_service'

// ================================
// Template Definition Types
// ================================

/**
 * セッションテンプレート定義
 */
export const SessionTemplateDefinitionSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  category: Schema.Literal('basic', 'optimization', 'specialized', 'experimental'),
  version: Schema.String,

  // 設定詳細
  configuration: GenerationSession.SessionConfigurationSchema,
  executionMode: Schema.Literal('sync', 'async', 'streaming'),

  // デフォルトオプション
  defaultOptions: Schema.optional(
    Schema.Struct({
      includeStructures: Schema.Boolean,
      includeCaves: Schema.Boolean,
      includeOres: Schema.Boolean,
      generateVegetation: Schema.Boolean,
      applyPostProcessing: Schema.Boolean,
    })
  ),

  // 推奨使用ケース
  useCases: Schema.Array(Schema.String),

  // パフォーマンス特性
  performance: Schema.Struct({
    expectedCpuUsage: Schema.Literal('low', 'medium', 'high'),
    expectedMemoryUsage: Schema.Literal('low', 'medium', 'high'),
    expectedDuration: Schema.Literal('fast', 'normal', 'slow'),
    scalability: Schema.Literal('poor', 'fair', 'good', 'excellent'),
  }),

  // 制約と要件
  requirements: Schema.Struct({
    minCpuCores: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    minMemoryMB: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    supportedProfiles: Schema.Array(Schema.String),
    dependencies: Schema.Array(Schema.String),
  }),

  // メタデータ
  metadata: Schema.Struct({
    author: Schema.String,
    tags: Schema.Array(Schema.String),
    stability: Schema.Literal('experimental', 'beta', 'stable', 'deprecated'),
    lastModified: Schema.DateTimeUtc,
    compatibilityVersion: Schema.String,
  }),
})

export type SessionTemplateDefinition = typeof SessionTemplateDefinitionSchema.Type

/**
 * テンプレート解決結果
 */
export const TemplateResolutionResultSchema = Schema.Struct({
  template: SessionTemplateDefinitionSchema,
  resolvedConfiguration: GenerationSession.SessionConfigurationSchema,
  appliedCustomizations: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),
  warnings: Schema.Array(Schema.String),
  recommendations: Schema.Array(Schema.String),
})

export type TemplateResolutionResult = typeof TemplateResolutionResultSchema.Type

// ================================
// Template Resolver
// ================================

export interface SessionTemplateResolver {
  /**
   * テンプレート解決
   */
  readonly resolve: (
    type: SessionTemplateType,
    customizations?: Record<string, unknown>
  ) => Effect.Effect<TemplateResolutionResult, SessionFactoryError>

  /**
   * カスタムテンプレート解決
   */
  readonly resolveCustom: (
    name: string,
    customizations?: Record<string, unknown>
  ) => Effect.Effect<TemplateResolutionResult, SessionFactoryError>

  /**
   * 推奨テンプレート取得
   */
  readonly recommend: (criteria: {
    chunkCount?: number
    useCases?: string[]
    performance?: 'speed' | 'quality' | 'memory'
    profile?: ConfigurationProfile
  }) => Effect.Effect<readonly SessionTemplateType[], SessionFactoryError>

  /**
   * テンプレート検索
   */
  readonly search: (query: {
    readonly useCases?: ReadonlyArray<string>
    readonly performance?: Partial<SessionTemplateDefinition['performance']>
    readonly requirements?: Partial<SessionTemplateDefinition['requirements']>
    readonly tags?: ReadonlyArray<string>
  }) => Effect.Effect<readonly SessionTemplateType[], SessionFactoryError>

  /**
   * テンプレート作成
   */
  readonly create: (name: string, definition: SessionTemplateDefinition) => Effect.Effect<void, SessionFactoryError>

  /**
   * テンプレート合成
   */
  readonly compose: (
    baseType: SessionTemplateType,
    modifications: Partial<SessionTemplateDefinition>
  ) => Effect.Effect<SessionTemplateDefinition, SessionFactoryError>
}

// ================================
// Template Resolver Implementation
// ================================

const createSessionTemplateResolver = (): SessionTemplateResolver => ({
  resolve: (type: SessionTemplateType, customizations?: Record<string, unknown>) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const template = yield* registry.get(type)

      if (Option.isNone(template)) {
        return yield* Effect.fail(
          new SessionFactoryError({
            category: 'configuration_invalid',
            message: `Unknown template type: ${type}`,
          })
        )
      }

      const templateDef = template.value
      let resolvedConfiguration = templateDef.configuration

      // カスタマイゼーション適用
      if (customizations) {
        resolvedConfiguration = yield* applyCustomizations(resolvedConfiguration, customizations)
      }

      const warnings: string[] = []
      const recommendations: string[] = []

      // 推奨事項生成
      if (templateDef.performance.expectedCpuUsage === 'high') {
        recommendations.push('Consider monitoring CPU usage during execution')
      }

      if (templateDef.performance.expectedMemoryUsage === 'high') {
        recommendations.push('Ensure sufficient memory is available')
      }

      return {
        template: templateDef,
        resolvedConfiguration,
        appliedCustomizations: customizations ?? {},
        warnings,
        recommendations,
      }
    }),

  resolveCustom: (name: string, customizations?: Record<string, unknown>) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const template = yield* registry.getCustom(name)

      if (Option.isNone(template)) {
        return yield* Effect.fail(
          new SessionFactoryError({
            category: 'configuration_invalid',
            message: `Unknown custom template: ${name}`,
          })
        )
      }

      const templateDef = template.value
      let resolvedConfiguration = templateDef.configuration

      if (customizations) {
        resolvedConfiguration = yield* applyCustomizations(resolvedConfiguration, customizations)
      }

      return {
        template: templateDef,
        resolvedConfiguration,
        appliedCustomizations: customizations ?? {},
        warnings: [],
        recommendations: [],
      }
    }),

  recommend: (criteria) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const allTemplates = yield* registry.list
      const scores = new Map<SessionTemplateType, number>()

      for (const templateType of allTemplates) {
        const template = yield* registry.get(templateType)
        if (Option.isNone(template)) continue

        let score = 0
        const templateDef = template.value

        // チャンク数に基づくスコアリング
        if (criteria.chunkCount) {
          const optimalConcurrency = templateDef.configuration.maxConcurrentChunks
          const efficiencyScore = Math.min(
            criteria.chunkCount / optimalConcurrency,
            optimalConcurrency / criteria.chunkCount
          )
          score += efficiencyScore * 30
        }

        // ユースケース一致度
        if (criteria.useCases) {
          const matchingUseCases = criteria.useCases.filter((useCase) =>
            templateDef.useCases.some((templateUseCase) =>
              templateUseCase.toLowerCase().includes(useCase.toLowerCase())
            )
          )
          score += (matchingUseCases.length / criteria.useCases.length) * 40
        }

        // パフォーマンス要件
        if (criteria.performance) {
          const performanceMatch = Function.pipe(
            Match.value(criteria.performance),
            Match.when('speed', () => (templateDef.performance.expectedDuration === 'fast' ? 20 : 0)),
            Match.when('quality', () => (templateDef.configuration.maxConcurrentChunks <= 2 ? 20 : 0)),
            Match.when('memory', () => (templateDef.performance.expectedMemoryUsage === 'low' ? 20 : 0)),
            Match.orElse(() => 0)
          )
          score += performanceMatch
        }

        // プロファイル互換性
        if (criteria.profile) {
          const isSupported = templateDef.requirements.supportedProfiles.includes(criteria.profile)
          score += isSupported ? 10 : -10
        }

        scores.set(templateType, score)
      }

      // スコア順でソート
      return Array.from(scores.entries())
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
        .map(([type, _]) => type)
        .slice(0, 5) // 上位5つ
    }),

  search: (query) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      return yield* registry.search(query)
    }),

  create: (name: string, definition: SessionTemplateDefinition) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      yield* registry.registerCustom(name, definition)
    }),

  compose: (baseType: SessionTemplateType, modifications: Partial<SessionTemplateDefinition>) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const baseTemplate = yield* registry.get(baseType)

      if (Option.isNone(baseTemplate)) {
        return yield* Effect.fail(
          new SessionFactoryError({
            category: 'configuration_invalid',
            message: `Unknown base template type: ${baseType}`,
          })
        )
      }

      const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))
      return {
        ...baseTemplate.value,
        ...modifications,
        configuration: {
          ...baseTemplate.value.configuration,
          ...modifications.configuration,
        },
        metadata: {
          ...baseTemplate.value.metadata,
          ...modifications.metadata,
          lastModified: now,
        },
      }
    }),
})

// ================================
// Helper Functions
// ================================

/**
 * カスタマイゼーション適用
 */
const applyCustomizations = (
  configuration: GenerationSession.SessionConfiguration,
  customizations: Record<string, unknown>
): Effect.Effect<GenerationSession.SessionConfiguration, SessionFactoryError> =>
  Effect.succeed({
    ...configuration,
    // カスタマイゼーションロジックの実装
    // 実際の実装では、キーマッピングと型安全な変換が必要
  })

// ================================
// Public API
// ================================

export const SessionTemplateResolverTag = Symbol('SessionTemplateResolver')

export const SessionTemplateResolverLive = createSessionTemplateResolver()

export const getTemplate = (type: SessionTemplateType): Effect.Effect<SessionTemplateDefinition, SessionFactoryError> =>
  Effect.gen(function* () {
    const registry = yield* SessionTemplateRegistryService
    const template = yield* registry.get(type)

    if (Option.isNone(template)) {
      return yield* Effect.fail(
        new SessionFactoryError({
          category: 'configuration_invalid',
          message: `Template not found: ${type}`,
        })
      )
    }

    return template.value
  })

export const listTemplates = (): Effect.Effect<readonly SessionTemplateType[]> =>
  Effect.gen(function* () {
    const registry = yield* SessionTemplateRegistryService
    return yield* registry.list
  })

export const searchTemplates = (query: {
  readonly useCases?: ReadonlyArray<string>
  readonly performance?: Partial<SessionTemplateDefinition['performance']>
  readonly requirements?: Partial<SessionTemplateDefinition['requirements']>
  readonly tags?: ReadonlyArray<string>
}): Effect.Effect<readonly SessionTemplateType[]> =>
  Effect.gen(function* () {
    const registry = yield* SessionTemplateRegistryService
    return yield* registry.search(query)
  })

// ================================
// Exports
// ================================

export { SessionTemplateRegistryLive } from './template_registry_live'
export { SessionTemplateRegistryService } from './template_registry_service'
export type { SessionTemplateDefinition, SessionTemplateResolver, TemplateResolutionResult }
