/**
 * @fileoverview WorldGeneratorBuilder State Schema
 *
 * Builder状態のSchema定義により、型安全性と実行時検証を提供します。
 * Builder Pattern → Schema + Pure Functions への移行に伴う状態定義です。
 */

import * as WorldSeed from '@domain/shared/value_object/world_seed/index'
import * as BiomeProperties from '@domain/world/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/value_object/generation_parameters/index'
import * as NoiseConfiguration from '@domain/world/value_object/noise_configuration/index'
import { Schema } from 'effect'

// ================================
// Quality Level Schema
// ================================

export const QualityLevelSchema = Schema.Literal('fast', 'balanced', 'quality').pipe(
  Schema.annotations({
    title: 'Quality Level',
    description: 'Generation quality level affecting performance and output quality',
  })
)

export type QualityLevel = Schema.Schema.Type<typeof QualityLevelSchema>

// ================================
// Log Level Schema
// ================================

export const LogLevelSchema = Schema.Literal('error', 'warn', 'info', 'debug').pipe(
  Schema.annotations({
    title: 'Log Level',
    description: 'Logging verbosity level',
  })
)

export type LogLevel = Schema.Schema.Type<typeof LogLevelSchema>

// ================================
// Builder State Schema
// ================================

/**
 * WorldGeneratorBuilder状態Schema
 *
 * 全フィールドがOptionalで、段階的な設定を可能にします。
 * buildメソッドで必須フィールドの検証が行われます。
 */
export const WorldGeneratorBuilderStateSchema = Schema.Struct({
  seed: Schema.optional(WorldSeed.WorldSeedSchema),
  parameters: Schema.optional(GenerationParameters.BiomeConfigSchema),
  biomeConfig: Schema.optional(BiomeProperties.TemperatureRangeSchema),
  noiseConfig: Schema.optional(NoiseConfiguration.BasicNoiseSettingsSchema),
  maxConcurrentGenerations: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 16))),
  cacheSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(100, 10000))),
  enableStructures: Schema.optional(Schema.Boolean),
  enableCaves: Schema.optional(Schema.Boolean),
  enableOres: Schema.optional(Schema.Boolean),
  qualityLevel: Schema.optional(QualityLevelSchema),
  enableDebugMode: Schema.optional(Schema.Boolean),
  logLevel: Schema.optional(LogLevelSchema),
}).pipe(
  Schema.annotations({
    identifier: 'WorldGeneratorBuilderState',
    title: 'World Generator Builder State',
    description: 'State for building WorldGenerator with fluent API',
  })
)

export type WorldGeneratorBuilderState = Schema.Schema.Type<typeof WorldGeneratorBuilderStateSchema>

// ================================
// Initial State
// ================================

/**
 * 初期Builder状態
 *
 * 全フィールドが未設定の空オブジェクトです。
 */
export const initialWorldGeneratorBuilderState: WorldGeneratorBuilderState = {}

// ================================
// Validation State Schema
// ================================

/**
 * Builder検証結果Schema
 */
export const ValidationStateSchema = Schema.Struct({
  isValid: Schema.Boolean,
  errors: Schema.Array(Schema.String),
  warnings: Schema.Array(Schema.String),
}).pipe(
  Schema.annotations({
    identifier: 'ValidationState',
    title: 'Validation State',
    description: 'Builder validation result with errors and warnings',
  })
)

export type ValidationState = Schema.Schema.Type<typeof ValidationStateSchema>
