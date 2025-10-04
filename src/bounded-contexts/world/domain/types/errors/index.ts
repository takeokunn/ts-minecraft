/**
 * @fileoverview Errors Export Module for World Domain
 * エラー型の統合エクスポート
 */

import { Schema } from 'effect'

export * from './world-errors'
export * from './generation-errors'
export * from './validation-errors'

// 主要エラータイプの再エクスポート
export type {
  // World Errors
  ErrorContext,
  WorldNotFoundError,
  WorldCreationError,
  WorldLoadError,
  WorldSaveError,
  InvalidCoordinateError,
  OutOfWorldBoundsError,
  OutOfChunkBoundsError,
  DimensionNotFoundError,
  DimensionSwitchError,
  InsufficientMemoryError,
  OperationTimeoutError,
  InvalidWorldSettingsError,
  WorldDomainError,
} from './world-errors'

export type {
  // Generation Errors
  ChunkGenerationError,
  GenerationSessionError,
  GenerationTimeoutError,
  InvalidNoiseParametersError,
  NoiseGenerationError,
  HeightMapGenerationError,
  TerrainShapeError,
  BiomeAssignmentError,
  ClimateDataError,
  StructurePlacementError,
  GenerationDependencyError,
  GenerationDomainError,
} from './generation-errors'

export type {
  // Validation Errors
  SchemaValidationError,
  MissingRequiredFieldError,
  UnexpectedFieldError,
  NumberOutOfRangeError,
  StringLengthError,
  ArraySizeError,
  PatternMismatchError,
  InvalidUUIDError,
  TypeMismatchError,
  BrandValidationError,
  ReferenceIntegrityError,
  CircularReferenceError,
  DuplicateValueError,
  MultipleValidationError,
  ValidationDomainError,
} from './validation-errors'

// 主要スキーマの再エクスポート
export {
  // World Error Schemas
  ErrorContextSchema,
  WorldNotFoundErrorSchema,
  WorldCreationErrorSchema,
  WorldLoadErrorSchema,
  WorldSaveErrorSchema,
  InvalidCoordinateErrorSchema,
  OutOfWorldBoundsErrorSchema,
  OutOfChunkBoundsErrorSchema,
  DimensionNotFoundErrorSchema,
  InsufficientMemoryErrorSchema,
  OperationTimeoutErrorSchema,
  InvalidWorldSettingsErrorSchema,
  WorldDomainErrorSchema,
} from './world-errors'

export {
  // Generation Error Schemas
  ChunkGenerationErrorSchema,
  GenerationSessionErrorSchema,
  GenerationTimeoutErrorSchema,
  InvalidNoiseParametersErrorSchema,
  NoiseGenerationErrorSchema,
  HeightMapGenerationErrorSchema,
  TerrainShapeErrorSchema,
  BiomeAssignmentErrorSchema,
  ClimateDataErrorSchema,
  StructurePlacementErrorSchema,
  GenerationDependencyErrorSchema,
  GenerationDomainErrorSchema,
} from './generation-errors'

export {
  // Validation Error Schemas
  SchemaValidationErrorSchema,
  MissingRequiredFieldErrorSchema,
  UnexpectedFieldErrorSchema,
  NumberOutOfRangeErrorSchema,
  StringLengthErrorSchema,
  ArraySizeErrorSchema,
  PatternMismatchErrorSchema,
  InvalidUUIDErrorSchema,
  TypeMismatchErrorSchema,
  BrandValidationErrorSchema,
  ReferenceIntegrityErrorSchema,
  CircularReferenceErrorSchema,
  DuplicateValueErrorSchema,
  MultipleValidationErrorSchema,
  ValidationDomainErrorSchema,
} from './validation-errors'

// ヘルパー関数の再エクスポート
export {
  // World Error Helpers
  createErrorContext,
  createWorldNotFoundError,
  createInvalidCoordinateError,
  createOperationTimeoutError,
} from './world-errors'

export {
  // Generation Error Helpers
  createChunkGenerationError,
  createNoiseGenerationError,
  createBiomeAssignmentError,
} from './generation-errors'

export {
  // Validation Error Helpers
  createSchemaValidationError,
  createNumberOutOfRangeError,
  createPatternMismatchError,
  createMultipleValidationError,
} from './validation-errors'

// 統合エラー型
export type WorldTypesError =
  | WorldDomainError
  | GenerationDomainError
  | ValidationDomainError

export const WorldTypesErrorSchema = Schema.Union(
  WorldDomainErrorSchema,
  GenerationDomainErrorSchema,
  ValidationDomainErrorSchema
).pipe(
  Schema.annotations({
    title: 'World Types Error',
    description: 'Union of all world domain error types',
  })
)

// エラーカテゴリ分類
export const ERROR_CATEGORIES = {
  WORLD_MANAGEMENT: 'world_management',
  COORDINATE_VALIDATION: 'coordinate_validation',
  DIMENSION_HANDLING: 'dimension_handling',
  PERFORMANCE: 'performance',
  CONFIGURATION: 'configuration',
  GENERATION_PROCESS: 'generation_process',
  NOISE_GENERATION: 'noise_generation',
  TERRAIN_FORMATION: 'terrain_formation',
  BIOME_ASSIGNMENT: 'biome_assignment',
  STRUCTURE_PLACEMENT: 'structure_placement',
  DEPENDENCY_MANAGEMENT: 'dependency_management',
  SCHEMA_VALIDATION: 'schema_validation',
  RANGE_VALIDATION: 'range_validation',
  PATTERN_VALIDATION: 'pattern_validation',
  TYPE_VALIDATION: 'type_validation',
  REFERENCE_VALIDATION: 'reference_validation',
  UNIQUENESS_VALIDATION: 'uniqueness_validation',
} as const

export type ErrorCategory = typeof ERROR_CATEGORIES[keyof typeof ERROR_CATEGORIES]

// エラー重要度レベル
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY]

// エラーの復旧可能性
export const ERROR_RECOVERY = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  RESTART_REQUIRED: 'restart_required',
  UNRECOVERABLE: 'unrecoverable',
} as const

export type ErrorRecovery = typeof ERROR_RECOVERY[keyof typeof ERROR_RECOVERY]