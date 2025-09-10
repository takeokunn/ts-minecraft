/**
 * Unified error definitions for the entire application
 * All errors should be imported from this single location
 */

// Base error
export { DomainError } from './base/domain-error'

// Entity errors
export {
  EntityNotFoundError,
  EntityAlreadyExistsError,
  InvalidEntityStateError,
} from './entity-errors'

// Component errors
export {
  ComponentNotFoundError,
  InvalidComponentDataError,
} from './component-errors'

// World errors
export {
  ChunkNotLoadedError,
  InvalidPositionError,
  BlockNotFoundError,
  InvalidBlockTypeError,
  WorldStateError,
  ArchetypeNotFoundError,
  QuerySingleResultNotFoundError,
  ComponentDecodeError,
} from './world-errors'

// Physics errors
export { CollisionDetectionError } from './physics-errors'

// System errors
export {
  SystemExecutionError,
  InvalidSystemStateError,
  QueryExecutionError,
  EmptyQueryResultError,
} from './system-errors'

// Worker errors
export {
  WorkerCommunicationError,
  WorkerTaskFailedError,
} from './worker-errors'

// Rendering errors
export {
  RenderingError,
  TextureNotFoundError,
  MaterialNotFoundError,
} from './rendering-errors'

// Resource and input errors
export {
  InputNotAvailableError,
  ResourceNotFoundError,
  ResourceLoadError,
  ValidationError,
  NetworkError,
} from './resource-errors'

// Type alias for all error types
export type AllDomainErrors =
  | EntityNotFoundError
  | EntityAlreadyExistsError
  | InvalidEntityStateError
  | ComponentNotFoundError
  | InvalidComponentDataError
  | ChunkNotLoadedError
  | InvalidPositionError
  | BlockNotFoundError
  | InvalidBlockTypeError
  | WorldStateError
  | ArchetypeNotFoundError
  | QuerySingleResultNotFoundError
  | ComponentDecodeError
  | CollisionDetectionError
  | SystemExecutionError
  | InvalidSystemStateError
  | QueryExecutionError
  | EmptyQueryResultError
  | WorkerCommunicationError
  | WorkerTaskFailedError
  | RenderingError
  | TextureNotFoundError
  | MaterialNotFoundError
  | InputNotAvailableError
  | ResourceNotFoundError
  | ResourceLoadError
  | ValidationError
  | NetworkError