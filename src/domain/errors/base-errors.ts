import { defineError, type BaseErrorData } from './generator'

type TaggedError<Tag extends string, Value> = {
  readonly _tag: Tag
} & Value

/**
 * Root error class for all game-related errors
 * Provides the foundation for the entire error hierarchy
 */
export const GameError = defineError<{
  readonly message: string
  readonly code?: string
}>('GameError', undefined, 'terminate', 'critical')

/**
 * Domain-specific error base class
 * All business logic errors inherit from this
 */
export const DomainError = defineError<{
  readonly message: string
  readonly domain: string
}>('DomainError', GameError, 'terminate', 'high')

/**
 * Entity subsystem error base class
 * For errors related to entity management
 */
export const EntityError = defineError<{
  readonly message: string
  readonly entityContext?: string
}>('EntityError', DomainError, 'fallback', 'medium')

/**
 * Component subsystem error base class
 * For errors related to ECS components
 */
export const ComponentError = defineError<{
  readonly message: string
  readonly componentType?: string
}>('ComponentError', DomainError, 'fallback', 'medium')

/**
 * World subsystem error base class
 * For errors related to world state and management
 */
export const WorldError = defineError<{
  readonly message: string
  readonly worldContext?: string
}>('WorldError', DomainError, 'retry', 'medium')

/**
 * Physics subsystem error base class
 * For errors related to physics calculations and collisions
 */
export const PhysicsError = defineError<{
  readonly message: string
  readonly physicsContext?: string
}>('PhysicsError', DomainError, 'ignore', 'low')

/**
 * System execution error base class
 * For errors in ECS systems
 */
export const SystemError = defineError<{
  readonly message: string
  readonly systemName?: string
}>('SystemError', DomainError, 'retry', 'high')

/**
 * Resource management error base class
 * For errors related to asset loading and resource management
 */
export const ResourceError = defineError<{
  readonly message: string
  readonly resourcePath?: string
}>('ResourceError', DomainError, 'fallback', 'medium')

/**
 * Rendering error base class
 * For errors related to graphics and rendering
 */
export const RenderingError = defineError<{
  readonly message: string
  readonly renderContext?: string
}>('RenderingError', DomainError, 'fallback', 'medium')

/**
 * Network and communication error base class
 * For errors related to multiplayer and network communication
 */
export const NetworkError = defineError<{
  readonly message: string
  readonly networkContext?: string
}>('NetworkError', DomainError, 'retry', 'high')

/**
 * Input handling error base class
 * For errors related to user input processing
 */
export const InputError = defineError<{
  readonly message: string
  readonly inputType?: string
}>('InputError', DomainError, 'ignore', 'low')

/**
 * Utility function to create error hierarchy chain
 */
export function createErrorChain(errors: Array<TaggedError<string, BaseErrorData>>): TaggedError<string, BaseErrorData & { chain: Array<string> }> {
  const chain = errors.map((error) => error._tag)

  const ErrorChainConstructor = defineError<{ chain: Array<string> }>('ErrorChain', GameError, 'terminate', 'critical')

  return new ErrorChainConstructor(
    { chain },
    {
      metadata: {
        originalErrors: errors.map((e) => ({ type: e._tag, message: JSON.stringify(e) })),
      },
    },
  )
}

/**
 * Error hierarchy validation
 */
export function validateErrorHierarchy(error: TaggedError<string, BaseErrorData>): boolean {
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
 * Get error ancestry chain
 */
export function getErrorAncestry(error: TaggedError<string, BaseErrorData>): string[] {
  const ancestry: string[] = [error._tag]

  // Use prototype chain to trace ancestry
  let currentProto = Object.getPrototypeOf(error.constructor)
  while (currentProto && currentProto.name !== 'Object') {
    if (currentProto.name && currentProto.name.endsWith('Error')) {
      ancestry.push(currentProto.name)
    }
    currentProto = Object.getPrototypeOf(currentProto)
  }

  return ancestry.reverse()
}
