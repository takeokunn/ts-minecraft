/**
 * @fileoverview GenerationSessionBuilder State Schema
 *
 * GenerationSessionBuilderの状態を表すSchema定義です。
 * Builder Pattern → Schema + Pure Functions パターンの一部として実装されています。
 */

import type * as GenerationSession from '@domain/world/aggregate/generation_session'
import type * as WorldGenerator from '@domain/world/aggregate/world_generator'
import * as Coordinates from '@domain/world/value_object/coordinates/index'
import { Duration, Schema } from 'effect'

// ================================
// Schema Definitions
// ================================

/**
 * GenerationSessionBuilder状態のSchema
 *
 * すべてのフィールドはオプショナルで、段階的な構築をサポートします。
 */
export const GenerationSessionBuilderStateSchema = Schema.Struct({
  coordinates: Schema.optional(Schema.Array(Coordinates.ChunkCoordinateSchema)),
  configuration: Schema.optional(
    Schema.Struct({
      maxConcurrentChunks: Schema.Number,
      chunkBatchSize: Schema.Number,
      retryPolicy: Schema.Struct({
        maxAttempts: Schema.Number,
        backoffStrategy: Schema.Literal('linear', 'exponential', 'constant'),
        baseDelayMs: Schema.Number,
        maxDelayMs: Schema.Number,
      }),
      timeoutPolicy: Schema.Struct({
        chunkTimeoutMs: Schema.Number,
        sessionTimeoutMs: Schema.Number,
        gracefulShutdownMs: Schema.Number,
      }),
      priorityPolicy: Schema.Struct({
        enablePriorityQueuing: Schema.Boolean,
        priorityThreshold: Schema.Number,
        highPriorityWeight: Schema.Number,
      }),
    })
  ),
  generatorId: Schema.optional(WorldGenerator.WorldGeneratorIdSchema),
  executionMode: Schema.optional(Schema.Literal('sync', 'async', 'streaming')),
  priority: Schema.optional(Schema.Number),
  options: Schema.optional(
    Schema.Struct({
      includeStructures: Schema.optional(Schema.Boolean),
      includeCaves: Schema.optional(Schema.Boolean),
      includeOres: Schema.optional(Schema.Boolean),
      generateVegetation: Schema.optional(Schema.Boolean),
      applyPostProcessing: Schema.optional(Schema.Boolean),
    })
  ),
  enableProgressTracking: Schema.optional(Schema.Boolean),
  enableDetailedLogging: Schema.optional(Schema.Boolean),
  enableMetrics: Schema.optional(Schema.Boolean),
  enableAutoRecovery: Schema.optional(Schema.Boolean),
  checkpointInterval: Schema.optional(Duration.DurationSchema),
  customOptions: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
})

export type GenerationSessionBuilderState = Schema.Schema.Type<typeof GenerationSessionBuilderStateSchema>

/**
 * セッション検証状態のSchema
 */
export const SessionValidationStateSchema = Schema.Struct({
  isValid: Schema.Boolean,
  errors: Schema.Array(Schema.String),
  warnings: Schema.Array(Schema.String),
  estimatedDuration: Duration.DurationSchema,
  estimatedResourceUsage: Schema.Struct({
    memory: Schema.Number,
    cpu: Schema.Number,
    storage: Schema.Number,
  }),
})

export type SessionValidationState = Schema.Schema.Type<typeof SessionValidationStateSchema>

// ================================
// Initial State
// ================================

/**
 * 初期状態（空のビルダー）
 */
export const initialGenerationSessionBuilderState: GenerationSessionBuilderState = {}

// ================================
// Type Exports
// ================================

export type { GenerationSession, WorldGenerator }
