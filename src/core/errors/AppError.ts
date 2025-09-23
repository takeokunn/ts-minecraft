import { Schema } from 'effect'

export interface InitError {
  readonly _tag: 'InitError'
  readonly message: Schema.Schema.Type<typeof Schema.String>
  readonly cause?: unknown
}

export const InitError = (message: string, cause?: unknown): InitError => {
  const error = Object.create(Error.prototype)
  error._tag = 'InitError'
  error.message = message
  if (cause !== undefined) {
    error.cause = cause
  }
  return error
}

export const isInitError = (error: unknown): error is InitError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InitError'

export interface ConfigError {
  readonly _tag: 'ConfigError'
  readonly message: Schema.Schema.Type<typeof Schema.String>
  readonly path: string
}

export const ConfigError = (message: string, path: string): ConfigError => {
  const error = Object.create(Error.prototype)
  error._tag = 'ConfigError'
  error.message = message
  error.path = path
  return error
}

export const isConfigError = (error: unknown): error is ConfigError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'ConfigError'
