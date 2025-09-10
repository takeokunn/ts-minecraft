import { Data } from 'effect'

/**
 * System-related errors
 */

export class SystemExecutionError extends Data.TaggedError('SystemExecutionError')<{
  readonly systemName: string
  readonly error: unknown
  readonly timestamp: Date
}> {
  constructor(systemName: string, error: unknown) {
    super({ systemName, error, timestamp: new Date() })
  }
}

export class InvalidSystemStateError extends Data.TaggedError('InvalidSystemStateError')<{
  readonly systemName: string
  readonly reason: string
  readonly timestamp: Date
}> {
  constructor(systemName: string, reason: string) {
    super({ systemName, reason, timestamp: new Date() })
  }
}

/**
 * Query-related errors
 */

export class QueryExecutionError extends Data.TaggedError('QueryExecutionError')<{
  readonly queryName: string
  readonly components: ReadonlyArray<string>
  readonly error: unknown
  readonly timestamp: Date
}> {
  constructor(queryName: string, components: ReadonlyArray<string>, error: unknown) {
    super({ queryName, components, error, timestamp: new Date() })
  }
}

export class EmptyQueryResultError extends Data.TaggedError('EmptyQueryResultError')<{
  readonly queryName: string
  readonly components: ReadonlyArray<string>
  readonly timestamp: Date
}> {
  constructor(queryName: string, components: ReadonlyArray<string>) {
    super({ queryName, components, timestamp: new Date() })
  }
}