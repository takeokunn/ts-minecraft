// Core error system
export {
  createErrorContext,
  logError,
  createRecoveryHandler,
  createTaggedError,
  createErrorFactory,
  ErrorAggregator,
  type RecoveryStrategy,
  type ErrorContext,
  type BaseErrorData,
  type ErrorAggregatorState,
} from '@domain/errors/generator'

// Unified error system - all domain errors in one place using Schema.TaggedError
export {
  // Base error hierarchy
  GameError,
  DomainError,
  InfrastructureError,
  ApplicationError,
  
  // Entity subsystem errors
  EntityNotFoundError,
  EntityAlreadyExistsError,
  EntityCreationError,
  EntityDestructionError,
  EntityLimitExceededError,
  InvalidEntityStateError,
  
  // Component subsystem errors
  ComponentNotFoundError,
  ComponentAlreadyExistsError,
  InvalidComponentDataError,
  ComponentTypeMismatchError,
  
  // World subsystem errors
  ChunkNotLoadedError,
  ChunkGenerationError,
  InvalidPositionError,
  BlockNotFoundError,
  WorldStateError,
  
  // Physics subsystem errors
  CollisionDetectionError,
  PhysicsSimulationError,
  RaycastError,
  RigidBodyError,
  GravityError,
  ConstraintViolationError,
  PhysicsMaterialError,
  VelocityLimitError,
  CollisionShapeError,
  PhysicsEngineError,
  
  // System errors
  SystemExecutionError,
  QueryExecutionError,
  SystemInitializationError,
  
  // Resource errors
  ResourceNotFoundError,
  ResourceLoadError,
  
  // Validation errors
  ValidationError,
  
  // Adapter errors
  MeshGenerationError,
  MeshOptimizationError,
  TerrainGenerationError,
  NoiseGenerationError,
  AdapterInitializationError,
  ExternalLibraryError,
  
  // Error type unions
  type DomainErrors,
  type InfrastructureErrors,
  type ApplicationErrors,
  type AllGameErrors,
  
  // Error utilities
  ErrorCategories,
  isEntityError,
  isComponentError,
  isWorldError,
  isPhysicsError,
  isSystemError,
  isResourceError,
  isAdapterError,
  getErrorSeverity,
  getRecoveryStrategy,
  
  // Factory functions for creating error instances
  createGameError,
  createDomainError,
  createInfrastructureError,
  createApplicationError,
  createEntityNotFoundError,
  createEntityAlreadyExistsError,
  createEntityCreationError,
  createEntityDestructionError,
  createEntityLimitExceededError,
  createInvalidEntityStateError,
  createComponentNotFoundError,
  createComponentAlreadyExistsError,
  createInvalidComponentDataError,
  createComponentTypeMismatchError,
  createChunkNotLoadedError,
  createChunkGenerationError,
  createInvalidPositionError,
  createBlockNotFoundError,
  createWorldStateError,
  createCollisionDetectionError,
  createPhysicsSimulationError,
  createRaycastError,
  createRigidBodyError,
  createGravityError,
  createSystemExecutionError,
  createQueryExecutionError,
  createSystemInitializationError,
  createResourceNotFoundError,
  createResourceLoadError,
  createValidationError as createUnifiedValidationError,
  createMeshGenerationError,
  createMeshOptimizationError,
  createTerrainGenerationError,
  createNoiseGenerationError,
  createAdapterInitializationError,
  createExternalLibraryError,
} from '@domain/errors/unified-errors'

// Schema validation errors  
export {
  SchemaValidationError,
  createSchemaValidationError,
  UnknownTypeError,
  createUnknownTypeError,
  TypeGuardError,
  createTypeGuardError,
  ExternalDataValidationError,
  DeserializationError,
  TypeAssertionError,
  ValidationHelpers,
  SchemaValidationUtils,
  withValidation,
  createValidationError,
  validateError,
  ValidationErrorValidation
} from '@domain/errors/validation-errors'

// Error utilities
export { 
  globalErrorAggregator,
  isRecoverableError,
  getErrorSeverity as getErrorSeverityUtil,
  isCriticalError,
  createTypedErrorHandler,
  generateDetailedErrorReport,
  type SchemaTaggedError,
  type AllGameErrors,
  type ErrorPatternMatcher, 
  type ErrorRecoveryStrategy, 
  type ErrorAnalysisResult, 
  type ErrorReport, 
  type ValidationResult 
} from '@domain/errors/error-utils'
