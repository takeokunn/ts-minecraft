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

import type * as GenerationSession from '@domain/world_generation/aggregate/generation_session'
import type { JsonValue } from '@shared/schema/json'
import { JsonValueSchema } from '@shared/schema/json'
import { DateTime, Effect, Function, Match, Option, ReadonlyArray, Schema } from 'effect'
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
    value: JsonValueSchema,
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
    customizations?: Record<string, JsonValue>
  ) => Effect.Effect<TemplateResolutionResult, SessionFactoryError>

  /**
   * カスタムテンプレート解決
   */
  readonly resolveCustom: (
    name: string,
    customizations?: Record<string, JsonValue>
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
  resolve: (type: SessionTemplateType, customizations?: Record<string, JsonValue>) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const template = yield* registry.get(type)

      return yield* pipe(
        Match.value(template),
        Match.tag('None', () =>
          Effect.fail(SessionFactoryError.configurationInvalid(`Unknown template type: ${type}`))
        ),
        Match.tag('Some', ({ value: templateDef }) =>
          Effect.gen(function* () {
            const resolvedConfiguration = yield* pipe(
              Match.value(customizations),
              Match.when(
                (params): params is Record<string, JsonValue> => params !== undefined,
                (params) => applyCustomizations(templateDef.configuration, params)
              ),
              Match.orElse(() => Effect.succeed(templateDef.configuration))
            )

            const warnings: string[] = []
            const recommendations: string[] = []

            pipe(
              Match.value(templateDef.performance.expectedCpuUsage),
              Match.when(
                (usage) => usage === 'high',
                () => {
                  recommendations.push('Consider monitoring CPU usage during execution')
                }
              ),
              Match.orElse(() => undefined)
            )

            pipe(
              Match.value(templateDef.performance.expectedMemoryUsage),
              Match.when(
                (usage) => usage === 'high',
                () => {
                  recommendations.push('Ensure sufficient memory is available')
                }
              ),
              Match.orElse(() => undefined)
            )

            return {
              template: templateDef,
              resolvedConfiguration,
              appliedCustomizations: customizations ?? {},
              warnings,
              recommendations,
            }
          })
        ),
        Match.exhaustive
      )
    }),

  resolveCustom: (name: string, customizations?: Record<string, JsonValue>) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const template = yield* registry.getCustom(name)

      return yield* pipe(
        Match.value(template),
        Match.tag('None', () =>
          Effect.fail(SessionFactoryError.configurationInvalid(`Unknown custom template: ${name}`))
        ),
        Match.tag('Some', ({ value: templateDef }) =>
          Effect.gen(function* () {
            const resolvedConfiguration = yield* pipe(
              Match.value(customizations),
              Match.when(
                (params): params is Record<string, JsonValue> => params !== undefined,
                (params) => applyCustomizations(templateDef.configuration, params)
              ),
              Match.orElse(() => Effect.succeed(templateDef.configuration))
            )

            return {
              template: templateDef,
              resolvedConfiguration,
              appliedCustomizations: customizations ?? {},
              warnings: [],
              recommendations: [],
            }
          })
        ),
        Match.exhaustive
      )
    }),

  recommend: (criteria) =>
    Effect.gen(function* () {
      const registry = yield* SessionTemplateRegistryService
      const allTemplates = yield* registry.list

      // 各テンプレートのスコアを計算
      const scoredTemplates = yield* Function.pipe(
        allTemplates,
        Effect.forEach((templateType) =>
          Effect.gen(function* () {
            const template = yield* registry.get(templateType)

            return yield* pipe(
              Match.value(template),
              Match.tag('None', () => Effect.succeed(Option.none<readonly [SessionTemplateType, number]>())),
              Match.tag('Some', ({ value: templateDef }) =>
                Effect.gen(function* () {
                  const chunkScore = pipe(
                    Match.value(criteria.chunkCount),
                    Match.when(
                      (chunkCount): chunkCount is number =>
                        chunkCount !== undefined && chunkCount > 0 && templateDef.configuration.maxConcurrentChunks > 0,
                      (chunkCount) => {
                        const optimalConcurrency = templateDef.configuration.maxConcurrentChunks
                        const efficiencyScore = Math.min(
                          chunkCount / optimalConcurrency,
                          optimalConcurrency / chunkCount
                        )
                        return efficiencyScore * 30
                      }
                    ),
                    Match.orElse(() => 0)
                  )

                  const useCaseScore = pipe(
                    Match.value(criteria.useCases),
                    Match.when(
                      (useCases): useCases is string[] => !!useCases && useCases.length > 0,
                      (useCases) => {
                        const matchingUseCases = useCases.filter((useCase) =>
                          templateDef.useCases.some((templateUseCase) =>
                            templateUseCase.toLowerCase().includes(useCase.toLowerCase())
                          )
                        )
                        return (matchingUseCases.length / useCases.length) * 40
                      }
                    ),
                    Match.orElse(() => 0)
                  )

                  const performanceScore = Function.pipe(
                    Match.value(criteria.performance),
                    Match.when('speed', () => (templateDef.performance.expectedDuration === 'fast' ? 20 : 0)),
                    Match.when('quality', () => (templateDef.configuration.maxConcurrentChunks <= 2 ? 20 : 0)),
                    Match.when('memory', () => (templateDef.performance.expectedMemoryUsage === 'low' ? 20 : 0)),
                    Match.orElse(() => 0)
                  )

                  const profileScore = pipe(
                    Match.value(criteria.profile),
                    Match.when(
                      (profile): profile is ConfigurationProfile => profile !== undefined,
                      (profile) => (templateDef.requirements.supportedProfiles.includes(profile) ? 10 : -10)
                    ),
                    Match.orElse(() => 0)
                  )

                  const score = chunkScore + useCaseScore + performanceScore + profileScore

                  return Option.some([templateType, score] as const)
                })
              ),
              Match.exhaustive
            )
          })
        )
      )

      // スコア順でソートして上位5つを返す
      return Function.pipe(
        scoredTemplates,
        ReadonlyArray.filterMap((x) => x),
        ReadonlyArray.sort(([, scoreA], [, scoreB]) => scoreB - scoreA),
        ReadonlyArray.map(([type, _]) => type),
        ReadonlyArray.take(5)
      )
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

      return yield* pipe(
        Match.value(baseTemplate),
        Match.tag('None', () =>
          Effect.fail(SessionFactoryError.configurationInvalid(`Unknown base template type: ${baseType}`))
        ),
        Match.tag('Some', ({ value }) =>
          Effect.gen(function* () {
            const now = yield* DateTime.nowAsDate
            return {
              ...value,
              ...modifications,
              configuration: {
                ...value.configuration,
                ...modifications.configuration,
              },
              metadata: {
                ...value.metadata,
                ...modifications.metadata,
                lastModified: now,
              },
            }
          })
        ),
        Match.exhaustive
      )
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
  customizations: Record<string, JsonValue>
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

    return yield* pipe(
      Match.value(template),
      Match.tag('None', () => Effect.fail(SessionFactoryError.configurationInvalid(`Template not found: ${type}`))),
      Match.tag('Some', ({ value }) => Effect.succeed(value)),
      Match.exhaustive
    )
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
