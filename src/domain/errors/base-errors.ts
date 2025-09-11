import { Schema } from 'effect'
import { BaseErrorData, createErrorContext } from '@domain/errors/generator'

/**
 * Root error for all game-related errors
 * Provides the foundation for the entire error hierarchy
 */
export const GameError = Schema.TaggedError('GameError')<
  BaseErrorData & {
    readonly code?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    code: Schema.optional(Schema.String),
  }),
)
export type GameError = Schema.Schema.Type<typeof GameError>

/**
 * Create a GameError instance
 */
export const createGameError = (message: string, code?: string, metadata?: Record<string, unknown>): GameError =>
  GameError({
    message,
    code,
    context: createErrorContext('terminate', 'critical', metadata),
  })

/**
 * Domain-specific error base
 * All business logic errors use this
 */
export const DomainError = Schema.TaggedError('DomainError')<
  BaseErrorData & {
    readonly domain: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    domain: Schema.String,
  }),
)
export type DomainError = Schema.Schema.Type<typeof DomainError>

/**
 * Create a DomainError instance
 */
export const createDomainError = (message: string, domain: string, metadata?: Record<string, unknown>): DomainError =>
  DomainError({
    message,
    domain,
    context: createErrorContext('terminate', 'high', metadata),
  })

/**
 * Entity subsystem error
 * For errors related to entity management
 */
export const EntityError = Schema.TaggedError('EntityError')<
  BaseErrorData & {
    readonly entityContext?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    entityContext: Schema.optional(Schema.String),
  }),
)
export type EntityError = Schema.Schema.Type<typeof EntityError>

/**
 * Create an EntityError instance
 */
export const createEntityError = (message: string, entityContext?: string, metadata?: Record<string, unknown>): EntityError =>
  EntityError({
    message,
    entityContext,
    context: createErrorContext('fallback', 'medium', metadata),
  })

/**
 * Component subsystem error
 * For errors related to ECS components
 */
export const ComponentError = Schema.TaggedError('ComponentError')<
  BaseErrorData & {
    readonly componentType?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    componentType: Schema.optional(Schema.String),
  }),
)
export type ComponentError = Schema.Schema.Type<typeof ComponentError>

/**
 * Create a ComponentError instance
 */
export const createComponentError = (message: string, componentType?: string, metadata?: Record<string, unknown>): ComponentError =>
  ComponentError({
    message,
    componentType,
    context: createErrorContext('fallback', 'medium', metadata),
  })

/**
 * World subsystem error
 * For errors related to world state and management
 */
export const WorldError = Schema.TaggedError('WorldError')<
  BaseErrorData & {
    readonly worldContext?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    worldContext: Schema.optional(Schema.String),
  }),
)
export type WorldError = Schema.Schema.Type<typeof WorldError>

/**
 * Create a WorldError instance
 */
export const createWorldError = (message: string, worldContext?: string, metadata?: Record<string, unknown>): WorldError =>
  WorldError({
    message,
    worldContext,
    context: createErrorContext('retry', 'medium', metadata),
  })

/**
 * Physics subsystem error
 * For errors related to physics calculations and collisions
 */
export const PhysicsError = Schema.TaggedError('PhysicsError')<
  BaseErrorData & {
    readonly physicsContext?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    physicsContext: Schema.optional(Schema.String),
  }),
)
export type PhysicsError = Schema.Schema.Type<typeof PhysicsError>

/**
 * Create a PhysicsError instance
 */
export const createPhysicsError = (message: string, physicsContext?: string, metadata?: Record<string, unknown>): PhysicsError =>
  PhysicsError({
    message,
    physicsContext,
    context: createErrorContext('ignore', 'low', metadata),
  })

/**
 * System execution error
 * For errors in ECS systems
 */
export const SystemError = Schema.TaggedError('SystemError')<
  BaseErrorData & {
    readonly systemName?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    systemName: Schema.optional(Schema.String),
  }),
)
export type SystemError = Schema.Schema.Type<typeof SystemError>

/**
 * Create a SystemError instance
 */
export const createSystemError = (message: string, systemName?: string, metadata?: Record<string, unknown>): SystemError =>
  SystemError({
    message,
    systemName,
    context: createErrorContext('retry', 'high', metadata),
  })

/**
 * Resource management error
 * For errors related to asset loading and resource management
 */
export const ResourceError = Schema.TaggedError('ResourceError')<
  BaseErrorData & {
    readonly resourcePath?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    resourcePath: Schema.optional(Schema.String),
  }),
)
export type ResourceError = Schema.Schema.Type<typeof ResourceError>

/**
 * Create a ResourceError instance
 */
export const createResourceError = (message: string, resourcePath?: string, metadata?: Record<string, unknown>): ResourceError =>
  ResourceError({
    message,
    resourcePath,
    context: createErrorContext('fallback', 'medium', metadata),
  })

/**
 * Rendering error
 * For errors related to graphics and rendering
 */
export const RenderingError = Schema.TaggedError('RenderingError')<
  BaseErrorData & {
    readonly renderContext?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    renderContext: Schema.optional(Schema.String),
  }),
)
export type RenderingError = Schema.Schema.Type<typeof RenderingError>

/**
 * Create a RenderingError instance
 */
export const createRenderingError = (message: string, renderContext?: string, metadata?: Record<string, unknown>): RenderingError =>
  RenderingError({
    message,
    renderContext,
    context: createErrorContext('fallback', 'medium', metadata),
  })

/**
 * Network and communication error
 * For errors related to multiplayer and network communication
 */
export const NetworkError = Schema.TaggedError('NetworkError')<
  BaseErrorData & {
    readonly networkContext?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    networkContext: Schema.optional(Schema.String),
  }),
)
export type NetworkError = Schema.Schema.Type<typeof NetworkError>

/**
 * Create a NetworkError instance
 */
export const createNetworkError = (message: string, networkContext?: string, metadata?: Record<string, unknown>): NetworkError =>
  NetworkError({
    message,
    networkContext,
    context: createErrorContext('retry', 'high', metadata),
  })

/**
 * Input handling error
 * For errors related to user input processing
 */
export const InputError = Schema.TaggedError('InputError')<
  BaseErrorData & {
    readonly inputType?: string
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    inputType: Schema.optional(Schema.String),
  }),
)
export type InputError = Schema.Schema.Type<typeof InputError>

/**
 * Create an InputError instance
 */
export const createInputError = (message: string, inputType?: string, metadata?: Record<string, unknown>): InputError =>
  InputError({
    message,
    inputType,
    context: createErrorContext('ignore', 'low', metadata),
  })

/**
 * Error chain schema for aggregating multiple errors
 */
export const ErrorChain = Schema.TaggedError('ErrorChain')<
  BaseErrorData & {
    readonly chain: ReadonlyArray<string>
    readonly originalErrors: ReadonlyArray<{ type: string; message: string }>
  }
>(
  Schema.Struct({
    ...BaseErrorData.fields,
    chain: Schema.Array(Schema.String),
    originalErrors: Schema.Array(
      Schema.Struct({
        type: Schema.String,
        message: Schema.String,
      }),
    ),
  }),
)
export type ErrorChain = Schema.Schema.Type<typeof ErrorChain>

/**
 * Create error chain from multiple errors - functional approach
 */
export const createErrorChain = (errors: ReadonlyArray<{ _tag: string; message: string }>, metadata?: Record<string, unknown>): ErrorChain => {
  const chain = errors.map((error) => error._tag)
  const originalErrors = errors.map((e) => ({ type: e._tag, message: e.message }))

  return ErrorChain({
    message: `Error chain: ${chain.join(' -> ')}`,
    chain,
    originalErrors,
    context: createErrorContext('terminate', 'critical', {
      ...metadata,
      errorCount: errors.length,
    }),
  })
}

/**
 * Error hierarchy validation - functional approach
 */
export const validateErrorHierarchy = (error: { context: ErrorContext }): boolean => {
  // Check if error has proper context
  if (!error.context) return false

  // Check if error has timestamp
  if (!error.context.timestamp) return false

  // Check if error has recovery strategy
  if (!error.context.recoveryStrategy) return false

  // Check if error has severity
  if (!error.context.severity) return false

  return true
}

/**
 * Get error ancestry chain - functional approach
 */
export const getErrorAncestry = (error: { _tag: string }): ReadonlyArray<string> => {
  // For functional errors, we'll maintain a simple tag-based ancestry
  const tagHierarchy: Record<string, string[]> = {
    GameError: [],
    DomainError: ['GameError'],
    EntityError: ['GameError', 'DomainError'],
    ComponentError: ['GameError', 'DomainError'],
    WorldError: ['GameError', 'DomainError'],
    PhysicsError: ['GameError', 'DomainError'],
    SystemError: ['GameError', 'DomainError'],
    ResourceError: ['GameError', 'DomainError'],
    RenderingError: ['GameError', 'DomainError'],
    NetworkError: ['GameError', 'DomainError'],
    InputError: ['GameError', 'DomainError'],
    ErrorChain: ['GameError'],
  }

  return [...(tagHierarchy[error._tag] || []), error._tag]
}
