/**
 * @fileoverview Errors Export Module for World Domain
 * エラー型の統合エクスポート
 */

import { Schema } from 'effect'

export * from './index'
export * from './index'
export * from './index'

// 主要エラータイプの再エクスポート
export type {
  DimensionNotFoundError,
  DimensionSwitchError,
  // World Errors
  ErrorContext,
  InsufficientMemoryError,
  InvalidCoordinateError,
  InvalidWorldSettingsError,
  OperationTimeoutError,
  OutOfChunkBoundsError,
  OutOfWorldBoundsError,
  WorldCreationError,
  WorldDomainError,
  WorldLoadError,
  WorldNotFoundError,
  WorldSaveError,
} from './index'

export type {
  BiomeAssignmentError,
  // Generation Errors
  ChunkGenerationError,
  ClimateDataError,
  GenerationDependencyError,
  GenerationDomainError,
  GenerationSessionError,
  GenerationTimeoutError,
  HeightMapGenerationError,
  InvalidNoiseParametersError,
  NoiseGenerationError,
  StructurePlacementError,
  TerrainShapeError,
} from './index'

export type {
  ArraySizeError,
  BrandValidationError,
  CircularReferenceError,
  DuplicateValueError,
  InvalidUUIDError,
  MissingRequiredFieldError,
  MultipleValidationError,
  NumberOutOfRangeError,
  PatternMismatchError,
  ReferenceIntegrityError,
  // Validation Errors
  SchemaValidationError,
  StringLengthError,
  TypeMismatchError,
  UnexpectedFieldError,
  ValidationDomainError,
} from './index'

// 主要スキーマの再エクスポート
export {
  DimensionNotFoundErrorSchema,
  // World Error Schemas
  ErrorContextSchema,
  InsufficientMemoryErrorSchema,
  InvalidCoordinateErrorSchema,
  InvalidWorldSettingsErrorSchema,
  OperationTimeoutErrorSchema,
  OutOfChunkBoundsErrorSchema,
  OutOfWorldBoundsErrorSchema,
  WorldCreationErrorSchema,
  WorldDomainErrorSchema,
  WorldLoadErrorSchema,
  WorldNotFoundErrorSchema,
  WorldSaveErrorSchema,
} from './index'

export {
  BiomeAssignmentErrorSchema,
  // Generation Error Schemas
  ChunkGenerationErrorSchema,
  ClimateDataErrorSchema,
  GenerationDependencyErrorSchema,
  GenerationDomainErrorSchema,
  GenerationSessionErrorSchema,
  GenerationTimeoutErrorSchema,
  HeightMapGenerationErrorSchema,
  InvalidNoiseParametersErrorSchema,
  NoiseGenerationErrorSchema,
  StructurePlacementErrorSchema,
  TerrainShapeErrorSchema,
} from './index'

export {
  ArraySizeErrorSchema,
  BrandValidationErrorSchema,
  CircularReferenceErrorSchema,
  DuplicateValueErrorSchema,
  InvalidUUIDErrorSchema,
  MissingRequiredFieldErrorSchema,
  MultipleValidationErrorSchema,
  NumberOutOfRangeErrorSchema,
  PatternMismatchErrorSchema,
  ReferenceIntegrityErrorSchema,
  // Validation Error Schemas
  SchemaValidationErrorSchema,
  StringLengthErrorSchema,
  TypeMismatchErrorSchema,
  UnexpectedFieldErrorSchema,
  ValidationDomainErrorSchema,
} from './index'

// ヘルパー関数の再エクスポート
export {
  // World Error Helpers
  createErrorContext,
  createInvalidCoordinateError,
  createOperationTimeoutError,
  createWorldNotFoundError,
} from './index'

export {
  createBiomeAssignmentError,
  // Generation Error Helpers
  createChunkGenerationError,
  createNoiseGenerationError,
} from './index'

export {
  createMultipleValidationError,
  createNumberOutOfRangeError,
  createPatternMismatchError,
  // Validation Error Helpers
  createSchemaValidationError,
} from './index'

// 統合エラー型
export type WorldTypesError = WorldDomainError | GenerationDomainError | ValidationDomainError

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

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES]

// エラー重要度レベル
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type ErrorSeverity = (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY]

// エラーの復旧可能性
export const ERROR_RECOVERY = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  RESTART_REQUIRED: 'restart_required',
  UNRECOVERABLE: 'unrecoverable',
} as const

export type ErrorRecovery = (typeof ERROR_RECOVERY)[keyof typeof ERROR_RECOVERY]
export * from './index';
export * from './world_errors';
export * from './generation_errors';
