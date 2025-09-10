import { Data } from 'effect'

/**
 * Resource and Input-related errors
 */

export class InputNotAvailableError extends Data.TaggedError('InputNotAvailableError')<{
  readonly inputType: string
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(inputType: string, reason: string) {
    super({ inputType, reason, timestamp: new Date() })
  }
}

export class ResourceNotFoundError extends Data.TaggedError('ResourceNotFoundError')<{
  readonly resourceType: string
  readonly resourceId: string
  readonly timestamp: Date
}> {
  constructor(resourceType: string, resourceId: string) {
    super({ resourceType, resourceId, timestamp: new Date() })
  }
}

export class ResourceLoadError extends Data.TaggedError('ResourceLoadError')<{
  readonly resourceType: string
  readonly resourcePath: string
  readonly error: unknown
  readonly timestamp: Date
}> {
  constructor(resourceType: string, resourcePath: string, error: unknown) {
    super({ resourceType, resourcePath, error, timestamp: new Date() })
  }
}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string
  readonly value: unknown
  readonly constraints: ReadonlyArray<string>
  readonly timestamp: Date
}> {
  constructor(field: string, value: unknown, constraints: ReadonlyArray<string>) {
    super({ field, value, constraints, timestamp: new Date() })
  }
}

export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly operation: string
  readonly endpoint?: string
  readonly statusCode?: number
  readonly error: unknown
  readonly timestamp: Date
}> {
  constructor(operation: string, error: unknown, endpoint?: string, statusCode?: number) {
    super({ operation, endpoint, statusCode, error, timestamp: new Date() })
  }
}