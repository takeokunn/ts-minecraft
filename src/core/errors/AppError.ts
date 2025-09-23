export interface InitError {
  readonly _tag: 'InitError'
  readonly message: string
  readonly cause?: unknown
}

export const InitError = (message: string, cause?: unknown): InitError => ({
  _tag: 'InitError',
  message,
  ...(cause !== undefined && { cause })
})

export const isInitError = (error: unknown): error is InitError =>
  typeof error === 'object' && 
  error !== null && 
  '_tag' in error && 
  error._tag === 'InitError'

export interface ConfigError {
  readonly _tag: 'ConfigError'
  readonly message: string
  readonly path: string
}

export const ConfigError = (message: string, path: string): ConfigError => ({
  _tag: 'ConfigError',
  message,
  path
})

export const isConfigError = (error: unknown): error is ConfigError =>
  typeof error === 'object' && 
  error !== null && 
  '_tag' in error && 
  error._tag === 'ConfigError'
