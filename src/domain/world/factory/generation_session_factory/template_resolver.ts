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

import { Effect, Schema, Match, Function, Option, Array as EffectArray } from "effect"
import type * as GenerationSession from "../../aggregate/generation_session/generation_session.js"
import * as Coordinates from "../../value_object/coordinates/index.js"
import type { CreateSessionParams, SessionTemplateType, SessionFactoryError } from "./factory.js"
import type { ConfigurationProfile } from "./configuration.js"

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
  defaultOptions: Schema.optional(Schema.Struct({
    includeStructures: Schema.Boolean,
    includeCaves: Schema.Boolean,
    includeOres: Schema.Boolean,
    generateVegetation: Schema.Boolean,
    applyPostProcessing: Schema.Boolean
  })),

  // 推奨使用ケース
  useCases: Schema.Array(Schema.String),

  // パフォーマンス特性
  performance: Schema.Struct({
    expectedCpuUsage: Schema.Literal('low', 'medium', 'high'),
    expectedMemoryUsage: Schema.Literal('low', 'medium', 'high'),
    expectedDuration: Schema.Literal('fast', 'normal', 'slow'),
    scalability: Schema.Literal('poor', 'fair', 'good', 'excellent')
  }),

  // 制約と要件
  requirements: Schema.Struct({
    minCpuCores: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    minMemoryMB: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    supportedProfiles: Schema.Array(Schema.String),
    dependencies: Schema.Array(Schema.String)
  }),

  // メタデータ
  metadata: Schema.Struct({
    author: Schema.String,
    tags: Schema.Array(Schema.String),
    stability: Schema.Literal('experimental', 'beta', 'stable', 'deprecated'),
    lastModified: Schema.DateTimeUtc,
    compatibilityVersion: Schema.String
  })
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
    value: Schema.Unknown
  }),
  warnings: Schema.Array(Schema.String),
  recommendations: Schema.Array(Schema.String)
})

export type TemplateResolutionResult = typeof TemplateResolutionResultSchema.Type

// ================================
// Template Registry
// ================================

class SessionTemplateRegistry {
  private readonly templates = new Map<SessionTemplateType, SessionTemplateDefinition>()
  private readonly customTemplates = new Map<string, SessionTemplateDefinition>()

  register(type: SessionTemplateType, definition: SessionTemplateDefinition): void {
    this.templates.set(type, definition)
  }

  registerCustom(name: string, definition: SessionTemplateDefinition): void {
    this.customTemplates.set(name, definition)
  }

  get(type: SessionTemplateType): Option.Option<SessionTemplateDefinition> {
    return Option.fromNullable(this.templates.get(type))
  }

  getCustom(name: string): Option.Option<SessionTemplateDefinition> {
    return Option.fromNullable(this.customTemplates.get(name))
  }

  list(): readonly SessionTemplateType[] {
    return Array.from(this.templates.keys())
  }

  listCustom(): readonly string[] {
    return Array.from(this.customTemplates.keys())
  }

  listByCategory(category: SessionTemplateDefinition['category']): readonly SessionTemplateType[] {
    return Array.from(this.templates.entries())
      .filter(([_, definition]) => definition.category === category)
      .map(([type, _]) => type)
  }

  search(query: {
    useCases?: string[]
    performance?: Partial<SessionTemplateDefinition['performance']>
    requirements?: Partial<SessionTemplateDefinition['requirements']>
    tags?: string[]
  }): readonly SessionTemplateType[] {
    return Array.from(this.templates.entries())
      .filter(([_, template]) => {
        // ユースケースフィルタ
        if (query.useCases) {
          const hasMatchingUseCase = query.useCases.some(useCase =>
            template.useCases.some(templateUseCase =>
              templateUseCase.toLowerCase().includes(useCase.toLowerCase())
            )
          )
          if (!hasMatchingUseCase) return false
        }

        // パフォーマンスフィルタ
        if (query.performance) {
          if (query.performance.expectedCpuUsage &&
              template.performance.expectedCpuUsage !== query.performance.expectedCpuUsage) {
            return false
          }
          if (query.performance.expectedMemoryUsage &&
              template.performance.expectedMemoryUsage !== query.performance.expectedMemoryUsage) {
            return false
          }
        }

        // 要件フィルタ
        if (query.requirements) {
          if (query.requirements.minCpuCores &&
              template.requirements.minCpuCores > query.requirements.minCpuCores) {
            return false
          }
          if (query.requirements.minMemoryMB &&
              template.requirements.minMemoryMB > query.requirements.minMemoryMB) {
            return false
          }
        }

        // タグフィルタ
        if (query.tags) {
          const hasMatchingTag = query.tags.some(tag =>
            template.metadata.tags.some(templateTag =>
              templateTag.toLowerCase().includes(tag.toLowerCase())
            )
          )
          if (!hasMatchingTag) return false
        }

        return true
      })
      .map(([type, _]) => type)
  }
}

const registry = new SessionTemplateRegistry()

// ================================
// Template Definitions
// ================================

/**
 * 基本テンプレート定義
 */
const defineTemplates = (): void => {
  // Single Chunk Template
  registry.register('single_chunk', {
    name: 'Single Chunk Generation',
    description: 'Optimized for generating a single chunk with high quality',
    category: 'basic',
    version: '1.0.0',
    configuration: {
      maxConcurrentChunks: 1,
      chunkBatchSize: 1,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 5000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 60000,
        gracefulShutdownMs: 5000
      },
      priorityPolicy: {
        enablePriorityQueuing: false,
        priorityThreshold: 5,
        highPriorityWeight: 1.0
      }
    },
    executionMode: 'sync',
    defaultOptions: {
      includeStructures: true,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: true
    },
    useCases: ['block placement', 'structure building', 'detailed generation'],
    performance: {
      expectedCpuUsage: 'low',
      expectedMemoryUsage: 'low',
      expectedDuration: 'fast',
      scalability: 'poor'
    },
    requirements: {
      minCpuCores: 1,
      minMemoryMB: 512,
      supportedProfiles: ['development', 'testing', 'production'],
      dependencies: []
    },
    metadata: {
      author: 'minecraft-core',
      tags: ['basic', 'single', 'quality'],
      stability: 'stable',
      lastModified: new Date('2025-01-01'),
      compatibilityVersion: '1.0.0'
    }
  })

  // Area Generation Template
  registry.register('area_generation', {
    name: 'Area Generation',
    description: 'Optimized for generating large areas efficiently',
    category: 'basic',
    version: '1.0.0',
    configuration: {
      maxConcurrentChunks: 4,
      chunkBatchSize: 16,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 10000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 600000,
        gracefulShutdownMs: 5000
      },
      priorityPolicy: {
        enablePriorityQueuing: true,
        priorityThreshold: 5,
        highPriorityWeight: 2.0
      }
    },
    executionMode: 'async',
    defaultOptions: {
      includeStructures: true,
      includeCaves: true,
      includeOres: true,
      generateVegetation: true,
      applyPostProcessing: true
    },
    useCases: ['world exploration', 'base building', 'resource gathering'],
    performance: {
      expectedCpuUsage: 'medium',
      expectedMemoryUsage: 'medium',
      expectedDuration: 'normal',
      scalability: 'good'
    },
    requirements: {
      minCpuCores: 2,
      minMemoryMB: 1024,
      supportedProfiles: ['development', 'staging', 'production'],
      dependencies: []
    },
    metadata: {
      author: 'minecraft-core',
      tags: ['area', 'exploration', 'balanced'],
      stability: 'stable',
      lastModified: new Date('2025-01-01'),
      compatibilityVersion: '1.0.0'
    }
  })

  // World Exploration Template
  registry.register('world_exploration', {
    name: 'World Exploration',
    description: 'Optimized for real-time exploration with fast terrain generation',
    category: 'optimization',
    version: '1.0.0',
    configuration: {
      maxConcurrentChunks: 8,
      chunkBatchSize: 4,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelayMs: 500,
        maxDelayMs: 2000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 10000,
        sessionTimeoutMs: 300000,
        gracefulShutdownMs: 2000
      },
      priorityPolicy: {
        enablePriorityQueuing: true,
        priorityThreshold: 7,
        highPriorityWeight: 3.0
      }
    },
    executionMode: 'streaming',
    defaultOptions: {
      includeStructures: true,
      includeCaves: false,
      includeOres: false,
      generateVegetation: false,
      applyPostProcessing: false
    },
    useCases: ['player movement', 'real-time exploration', 'streaming'],
    performance: {
      expectedCpuUsage: 'high',
      expectedMemoryUsage: 'medium',
      expectedDuration: 'fast',
      scalability: 'excellent'
    },
    requirements: {
      minCpuCores: 4,
      minMemoryMB: 2048,
      supportedProfiles: ['production', 'high_performance'],
      dependencies: []
    },
    metadata: {
      author: 'minecraft-core',
      tags: ['exploration', 'streaming', 'performance'],
      stability: 'stable',
      lastModified: new Date('2025-01-01'),
      compatibilityVersion: '1.0.0'
    }
  })

  // Structure Placement Template
  registry.register('structure_placement', {
    name: 'Structure Placement',
    description: 'Optimized for placing structures with high precision',
    category: 'specialized',
    version: '1.0.0',
    configuration: {
      maxConcurrentChunks: 2,
      chunkBatchSize: 8,
      retryPolicy: {
        maxAttempts: 5,
        backoffStrategy: 'exponential',
        baseDelayMs: 2000,
        maxDelayMs: 30000
      },
      timeoutPolicy: {
        chunkTimeoutMs: 60000,
        sessionTimeoutMs: 1800000,
        gracefulShutdownMs: 10000
      },
      priorityPolicy: {
        enablePriorityQueuing: true,
        priorityThreshold: 3,
        highPriorityWeight: 5.0
      }
    },
    executionMode: 'async',
    defaultOptions: {
      includeStructures: true,
      includeCaves: false,
      includeOres: false,
      generateVegetation: false,
      applyPostProcessing: true
    },
    useCases: ['village generation', 'dungeon placement', 'custom structures'],
    performance: {
      expectedCpuUsage: 'medium',
      expectedMemoryUsage: 'high',
      expectedDuration: 'slow',
      scalability: 'fair'
    },
    requirements: {
      minCpuCores: 2,
      minMemoryMB: 2048,
      supportedProfiles: ['staging', 'production'],
      dependencies: ['structure_generator']
    },
    metadata: {
      author: 'minecraft-core',
      tags: ['structures', 'precision', 'quality'],
      stability: 'stable',
      lastModified: new Date('2025-01-01'),
      compatibilityVersion: '1.0.0'
    }
  })

  // 他のテンプレート定義も同様に追加...
  // terrain_modification, bulk_generation, streaming_generation
}

// テンプレート定義を初期化
defineTemplates()

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
  readonly recommend: (
    criteria: {
      chunkCount?: number
      useCases?: string[]
      performance?: 'speed' | 'quality' | 'memory'
      profile?: ConfigurationProfile
    }
  ) => Effect.Effect<readonly SessionTemplateType[], SessionFactoryError>

  /**
   * テンプレート検索
   */
  readonly search: (
    query: Parameters<SessionTemplateRegistry['search']>[0]
  ) => Effect.Effect<readonly SessionTemplateType[], SessionFactoryError>

  /**
   * テンプレート作成
   */
  readonly create: (
    name: string,
    definition: SessionTemplateDefinition
  ) => Effect.Effect<void, SessionFactoryError>

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
      const template = registry.get(type)

      if (Option.isNone(template)) {
        return yield* Effect.fail(new SessionFactoryError({
          category: 'configuration_invalid',
          message: `Unknown template type: ${type}`
        }))
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
        recommendations
      }
    }),

  resolveCustom: (name: string, customizations?: Record<string, unknown>) =>
    Effect.gen(function* () {
      const template = registry.getCustom(name)

      if (Option.isNone(template)) {
        return yield* Effect.fail(new SessionFactoryError({
          category: 'configuration_invalid',
          message: `Unknown custom template: ${name}`
        }))
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
        recommendations: []
      }
    }),

  recommend: (criteria) =>
    Effect.gen(function* () {
      const allTemplates = registry.list()
      const scores = new Map<SessionTemplateType, number>()

      for (const templateType of allTemplates) {
        const template = registry.get(templateType)
        if (Option.isNone(template)) continue

        let score = 0
        const templateDef = template.value

        // チャンク数に基づくスコアリング
        if (criteria.chunkCount) {
          const optimalConcurrency = templateDef.configuration.maxConcurrentChunks
          const efficiencyScore = Math.min(criteria.chunkCount / optimalConcurrency, optimalConcurrency / criteria.chunkCount)
          score += efficiencyScore * 30
        }

        // ユースケース一致度
        if (criteria.useCases) {
          const matchingUseCases = criteria.useCases.filter(useCase =>
            templateDef.useCases.some(templateUseCase =>
              templateUseCase.toLowerCase().includes(useCase.toLowerCase())
            )
          )
          score += (matchingUseCases.length / criteria.useCases.length) * 40
        }

        // パフォーマンス要件
        if (criteria.performance) {
          const performanceMatch = Function.pipe(
            Match.value(criteria.performance),
            Match.when('speed', () => templateDef.performance.expectedDuration === 'fast' ? 20 : 0),
            Match.when('quality', () => templateDef.configuration.maxConcurrentChunks <= 2 ? 20 : 0),
            Match.when('memory', () => templateDef.performance.expectedMemoryUsage === 'low' ? 20 : 0),
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
    Effect.succeed(registry.search(query)),

  create: (name: string, definition: SessionTemplateDefinition) =>
    Effect.sync(() => {
      registry.registerCustom(name, definition)
    }),

  compose: (baseType: SessionTemplateType, modifications: Partial<SessionTemplateDefinition>) =>
    Effect.gen(function* () {
      const baseTemplate = registry.get(baseType)

      if (Option.isNone(baseTemplate)) {
        return yield* Effect.fail(new SessionFactoryError({
          category: 'configuration_invalid',
          message: `Unknown base template type: ${baseType}`
        }))
      }

      return {
        ...baseTemplate.value,
        ...modifications,
        configuration: {
          ...baseTemplate.value.configuration,
          ...modifications.configuration
        },
        metadata: {
          ...baseTemplate.value.metadata,
          ...modifications.metadata,
          lastModified: new Date()
        }
      }
    })
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
  Function.pipe(
    registry.get(type),
    Option.match({
      onNone: () => Effect.fail(new SessionFactoryError({
        category: 'configuration_invalid',
        message: `Template not found: ${type}`
      })),
      onSome: (template) => Effect.succeed(template)
    })
  )

export const listTemplates = (): readonly SessionTemplateType[] =>
  registry.list()

export const searchTemplates = (query: Parameters<SessionTemplateRegistry['search']>[0]): readonly SessionTemplateType[] =>
  registry.search(query)

// ================================
// Exports
// ================================

export {
  type SessionTemplateDefinition,
  type TemplateResolutionResult,
  type SessionTemplateResolver,
  registry as SessionTemplateRegistry,
}