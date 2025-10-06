/**
 * @fileoverview SessionTemplateRegistry Live Implementation
 *
 * セッションテンプレートレジストリのLive Layer実装
 */

import { Effect, Layer, Option, Ref } from 'effect'
import { DEFAULT_TIMESTAMP } from '../../constants'
import type { SessionTemplateDefinition, SessionTemplateType } from './index'
import { SessionTemplateRegistryService } from './template_registry_service'

/**
 * SessionTemplateRegistry Live Layer
 * 2つのRefを使用した状態管理による実装
 * - templates: ビルトインテンプレート
 * - customTemplates: ユーザー定義カスタムテンプレート
 */
export const SessionTemplateRegistryLive = Layer.effect(
  SessionTemplateRegistryService,
  Effect.gen(function* () {
    // ビルトインテンプレート定義を初期化（イミュータブルMap）
    const templates = yield* Ref.make(
      new Map<SessionTemplateType, SessionTemplateDefinition>([
        // Single Chunk Template
        [
          'single_chunk',
          {
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
                maxDelayMs: 5000,
              },
              timeoutPolicy: {
                chunkTimeoutMs: 30000,
                sessionTimeoutMs: 60000,
                gracefulShutdownMs: 5000,
              },
              priorityPolicy: {
                enablePriorityQueuing: false,
                priorityThreshold: 5,
                highPriorityWeight: 1.0,
              },
            },
            executionMode: 'sync',
            defaultOptions: {
              includeStructures: true,
              includeCaves: true,
              includeOres: true,
              generateVegetation: true,
              applyPostProcessing: true,
            },
            useCases: ['block placement', 'structure building', 'detailed generation'],
            performance: {
              expectedCpuUsage: 'low',
              expectedMemoryUsage: 'low',
              expectedDuration: 'fast',
              scalability: 'poor',
            },
            requirements: {
              minCpuCores: 1,
              minMemoryMB: 512,
              supportedProfiles: ['development', 'testing', 'production'],
              dependencies: [],
            },
            metadata: {
              author: 'minecraft-core',
              tags: ['basic', 'single', 'quality'],
              stability: 'stable',
              lastModified: DEFAULT_TIMESTAMP,
              compatibilityVersion: '1.0.0',
            },
          },
        ],

        // Area Generation Template
        [
          'area_generation',
          {
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
                maxDelayMs: 10000,
              },
              timeoutPolicy: {
                chunkTimeoutMs: 30000,
                sessionTimeoutMs: 600000,
                gracefulShutdownMs: 5000,
              },
              priorityPolicy: {
                enablePriorityQueuing: true,
                priorityThreshold: 5,
                highPriorityWeight: 2.0,
              },
            },
            executionMode: 'async',
            defaultOptions: {
              includeStructures: true,
              includeCaves: true,
              includeOres: true,
              generateVegetation: true,
              applyPostProcessing: true,
            },
            useCases: ['world exploration', 'base building', 'resource gathering'],
            performance: {
              expectedCpuUsage: 'medium',
              expectedMemoryUsage: 'medium',
              expectedDuration: 'normal',
              scalability: 'good',
            },
            requirements: {
              minCpuCores: 2,
              minMemoryMB: 1024,
              supportedProfiles: ['development', 'staging', 'production'],
              dependencies: [],
            },
            metadata: {
              author: 'minecraft-core',
              tags: ['area', 'exploration', 'balanced'],
              stability: 'stable',
              lastModified: DEFAULT_TIMESTAMP,
              compatibilityVersion: '1.0.0',
            },
          },
        ],

        // World Exploration Template
        [
          'world_exploration',
          {
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
                maxDelayMs: 2000,
              },
              timeoutPolicy: {
                chunkTimeoutMs: 10000,
                sessionTimeoutMs: 300000,
                gracefulShutdownMs: 2000,
              },
              priorityPolicy: {
                enablePriorityQueuing: true,
                priorityThreshold: 7,
                highPriorityWeight: 3.0,
              },
            },
            executionMode: 'streaming',
            defaultOptions: {
              includeStructures: true,
              includeCaves: false,
              includeOres: false,
              generateVegetation: false,
              applyPostProcessing: false,
            },
            useCases: ['player movement', 'real-time exploration', 'streaming'],
            performance: {
              expectedCpuUsage: 'high',
              expectedMemoryUsage: 'medium',
              expectedDuration: 'fast',
              scalability: 'excellent',
            },
            requirements: {
              minCpuCores: 4,
              minMemoryMB: 2048,
              supportedProfiles: ['production', 'high_performance'],
              dependencies: [],
            },
            metadata: {
              author: 'minecraft-core',
              tags: ['exploration', 'streaming', 'performance'],
              stability: 'stable',
              lastModified: DEFAULT_TIMESTAMP,
              compatibilityVersion: '1.0.0',
            },
          },
        ],

        // Structure Placement Template
        [
          'structure_placement',
          {
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
                maxDelayMs: 30000,
              },
              timeoutPolicy: {
                chunkTimeoutMs: 60000,
                sessionTimeoutMs: 1800000,
                gracefulShutdownMs: 10000,
              },
              priorityPolicy: {
                enablePriorityQueuing: true,
                priorityThreshold: 3,
                highPriorityWeight: 5.0,
              },
            },
            executionMode: 'async',
            defaultOptions: {
              includeStructures: true,
              includeCaves: false,
              includeOres: false,
              generateVegetation: false,
              applyPostProcessing: true,
            },
            useCases: ['village generation', 'dungeon placement', 'custom structures'],
            performance: {
              expectedCpuUsage: 'medium',
              expectedMemoryUsage: 'high',
              expectedDuration: 'slow',
              scalability: 'fair',
            },
            requirements: {
              minCpuCores: 2,
              minMemoryMB: 2048,
              supportedProfiles: ['staging', 'production'],
              dependencies: ['structure_generator'],
            },
            metadata: {
              author: 'minecraft-core',
              tags: ['structures', 'precision', 'quality'],
              stability: 'stable',
              lastModified: DEFAULT_TIMESTAMP,
              compatibilityVersion: '1.0.0',
            },
          },
        ],
      ])
    )

    // カスタムテンプレート（ユーザー定義）を保持するRef
    const customTemplates = yield* Ref.make(new Map<string, SessionTemplateDefinition>())

    return SessionTemplateRegistryService.of({
      register: (type, definition) => Ref.update(templates, (m) => new Map(m).set(type, definition)),

      registerCustom: (name, definition) => Ref.update(customTemplates, (m) => new Map(m).set(name, definition)),

      get: (type) => Ref.get(templates).pipe(Effect.map((m) => Option.fromNullable(m.get(type)))),

      getCustom: (name) => Ref.get(customTemplates).pipe(Effect.map((m) => Option.fromNullable(m.get(name)))),

      list: Ref.get(templates).pipe(Effect.map((m) => Array.from(m.keys()))),

      listCustom: Ref.get(customTemplates).pipe(Effect.map((m) => Array.from(m.keys()))),

      listByCategory: (category) =>
        Ref.get(templates).pipe(
          Effect.map((m) =>
            Array.from(m.entries())
              .filter(([_, definition]) => definition.category === category)
              .map(([type, _]) => type)
          )
        ),

      search: (query) =>
        Ref.get(templates).pipe(
          Effect.map((m) =>
            Array.from(m.entries())
              .filter(([_, template]) => {
                // ユースケースフィルタ
                if (query.useCases) {
                  const hasMatchingUseCase = query.useCases.some((useCase) =>
                    template.useCases.some((templateUseCase) =>
                      templateUseCase.toLowerCase().includes(useCase.toLowerCase())
                    )
                  )
                  if (!hasMatchingUseCase) return false
                }

                // パフォーマンスフィルタ
                if (query.performance) {
                  if (
                    query.performance.expectedCpuUsage &&
                    template.performance.expectedCpuUsage !== query.performance.expectedCpuUsage
                  ) {
                    return false
                  }
                  if (
                    query.performance.expectedMemoryUsage &&
                    template.performance.expectedMemoryUsage !== query.performance.expectedMemoryUsage
                  ) {
                    return false
                  }
                }

                // 要件フィルタ
                if (query.requirements) {
                  if (
                    query.requirements.minCpuCores &&
                    template.requirements.minCpuCores > query.requirements.minCpuCores
                  ) {
                    return false
                  }
                  if (
                    query.requirements.minMemoryMB &&
                    template.requirements.minMemoryMB > query.requirements.minMemoryMB
                  ) {
                    return false
                  }
                }

                // タグフィルタ
                if (query.tags) {
                  const hasMatchingTag = query.tags.some((tag) =>
                    template.metadata.tags.some((templateTag) => templateTag.toLowerCase().includes(tag.toLowerCase()))
                  )
                  if (!hasMatchingTag) return false
                }

                return true
              })
              .map(([type, _]) => type)
          )
        ),
    })
  })
)
