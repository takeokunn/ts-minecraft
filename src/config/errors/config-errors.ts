import * as S from 'effect/Schema'

/**
 * Configuration error types using Effect-TS Schema.TaggedError
 * All configuration errors are now type-safe and structured
 */

// Base configuration validation error
export class ConfigValidationError extends S.TaggedError<ConfigValidationError>()(
  'ConfigValidationError',
  {
    section: S.String.pipe(
      S.annotations({
        title: 'Configuration Section',
        description: 'The configuration section where the error occurred'
      })
    ),
    details: S.String.pipe(
      S.annotations({
        title: 'Error Details',
        description: 'Detailed description of the validation error'
      })
    ),
    cause: S.optional(S.Unknown).pipe(
      S.annotations({
        title: 'Error Cause',
        description: 'The underlying cause of the error, if any'
      })
    ),
  }
) {}

// Configuration loading error
export class ConfigLoadError extends S.TaggedError<ConfigLoadError>()(
  'ConfigLoadError',
  {
    source: S.Literal('file', 'environment', 'storage', 'service').pipe(
      S.annotations({
        title: 'Configuration Source',
        description: 'The source from which configuration loading failed'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
    path: S.optional(S.String).pipe(
      S.annotations({
        title: 'Configuration Path',
        description: 'The configuration path or key that failed to load'
      })
    ),
    cause: S.optional(S.Unknown).pipe(
      S.annotations({
        title: 'Error Cause',
        description: 'The underlying cause of the error, if any'
      })
    ),
  }
) {}

// Configuration saving error
export class ConfigSaveError extends S.TaggedError<ConfigSaveError>()(
  'ConfigSaveError',
  {
    destination: S.Literal('storage', 'file', 'service').pipe(
      S.annotations({
        title: 'Save Destination',
        description: 'The destination where configuration saving failed'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
    configSection: S.optional(S.String).pipe(
      S.annotations({
        title: 'Configuration Section',
        description: 'The specific configuration section that failed to save'
      })
    ),
    cause: S.optional(S.Unknown).pipe(
      S.annotations({
        title: 'Error Cause',
        description: 'The underlying cause of the error, if any'
      })
    ),
  }
) {}

// Schema parsing error
export class ConfigParseError extends S.TaggedError<ConfigParseError>()(
  'ConfigParseError',
  {
    input: S.String.pipe(
      S.annotations({
        title: 'Input Data',
        description: 'The input data that failed to parse (truncated if too long)'
      })
    ),
    expectedType: S.String.pipe(
      S.annotations({
        title: 'Expected Type',
        description: 'The expected configuration type or schema'
      })
    ),
    parseErrors: S.Array(S.String).pipe(
      S.annotations({
        title: 'Parse Errors',
        description: 'List of specific parsing errors encountered'
      })
    ),
    cause: S.optional(S.Unknown).pipe(
      S.annotations({
        title: 'Error Cause',
        description: 'The underlying cause of the error, if any'
      })
    ),
  }
) {}

// Environment configuration error
export class ConfigEnvironmentError extends S.TaggedError<ConfigEnvironmentError>()(
  'ConfigEnvironmentError',
  {
    environment: S.String.pipe(
      S.annotations({
        title: 'Environment',
        description: 'The environment where the error occurred'
      })
    ),
    missingKeys: S.Array(S.String).pipe(
      S.annotations({
        title: 'Missing Keys',
        description: 'List of missing environment variables or configuration keys'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
  }
) {}

// Service initialization error
export class ConfigServiceError extends S.TaggedError<ConfigServiceError>()(
  'ConfigServiceError',
  {
    service: S.String.pipe(
      S.annotations({
        title: 'Service Name',
        description: 'The name of the configuration service that failed'
      })
    ),
    operation: S.Literal('initialize', 'load', 'save', 'validate', 'update').pipe(
      S.annotations({
        title: 'Failed Operation',
        description: 'The operation that failed on the service'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
    cause: S.optional(S.Unknown).pipe(
      S.annotations({
        title: 'Error Cause',
        description: 'The underlying cause of the error, if any'
      })
    ),
  }
) {}

// Migration error for legacy config compatibility
export class ConfigMigrationError extends S.TaggedError<ConfigMigrationError>()(
  'ConfigMigrationError',
  {
    fromVersion: S.String.pipe(
      S.annotations({
        title: 'Source Version',
        description: 'The version of configuration being migrated from'
      })
    ),
    toVersion: S.String.pipe(
      S.annotations({
        title: 'Target Version',
        description: 'The version of configuration being migrated to'
      })
    ),
    failedKeys: S.Array(S.String).pipe(
      S.annotations({
        title: 'Failed Keys',
        description: 'List of configuration keys that failed to migrate'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
  }
) {}

// Permission error for configuration access
export class ConfigPermissionError extends S.TaggedError<ConfigPermissionError>()(
  'ConfigPermissionError',
  {
    resource: S.String.pipe(
      S.annotations({
        title: 'Resource',
        description: 'The configuration resource that access was denied to'
      })
    ),
    operation: S.Literal('read', 'write', 'delete', 'create').pipe(
      S.annotations({
        title: 'Attempted Operation',
        description: 'The operation that was denied'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
  }
) {}

// Network-related configuration error
export class ConfigNetworkError extends S.TaggedError<ConfigNetworkError>()(
  'ConfigNetworkError',
  {
    url: S.optional(S.String).pipe(
      S.annotations({
        title: 'URL',
        description: 'The URL that was being accessed, if applicable'
      })
    ),
    method: S.optional(S.Literal('GET', 'POST', 'PUT', 'DELETE')).pipe(
      S.annotations({
        title: 'HTTP Method',
        description: 'The HTTP method being used, if applicable'
      })
    ),
    statusCode: S.optional(S.Number).pipe(
      S.annotations({
        title: 'Status Code',
        description: 'The HTTP status code returned, if applicable'
      })
    ),
    message: S.String.pipe(
      S.annotations({
        title: 'Error Message',
        description: 'Human-readable error message'
      })
    ),
    cause: S.optional(S.Unknown).pipe(
      S.annotations({
        title: 'Error Cause',
        description: 'The underlying network error, if any'
      })
    ),
  }
) {}

// Union type for all configuration errors
export const ConfigError = S.Union(
  ConfigValidationError,
  ConfigLoadError,
  ConfigSaveError,
  ConfigParseError,
  ConfigEnvironmentError,
  ConfigServiceError,
  ConfigMigrationError,
  ConfigPermissionError,
  ConfigNetworkError
)

export type ConfigError = S.Schema.Type<typeof ConfigError>

// Error type guards for runtime checking
export const isConfigValidationError = (error: unknown): error is ConfigValidationError =>
  error instanceof ConfigValidationError

export const isConfigLoadError = (error: unknown): error is ConfigLoadError =>
  error instanceof ConfigLoadError

export const isConfigSaveError = (error: unknown): error is ConfigSaveError =>
  error instanceof ConfigSaveError

export const isConfigParseError = (error: unknown): error is ConfigParseError =>
  error instanceof ConfigParseError

export const isConfigEnvironmentError = (error: unknown): error is ConfigEnvironmentError =>
  error instanceof ConfigEnvironmentError

export const isConfigServiceError = (error: unknown): error is ConfigServiceError =>
  error instanceof ConfigServiceError

export const isConfigMigrationError = (error: unknown): error is ConfigMigrationError =>
  error instanceof ConfigMigrationError

export const isConfigPermissionError = (error: unknown): error is ConfigPermissionError =>
  error instanceof ConfigPermissionError

export const isConfigNetworkError = (error: unknown): error is ConfigNetworkError =>
  error instanceof ConfigNetworkError

// Helper functions for creating common error instances
export const createValidationError = (
  section: string,
  details: string,
  cause?: unknown
): ConfigValidationError =>
  new ConfigValidationError({ section, details, cause })

export const createLoadError = (
  source: 'file' | 'environment' | 'storage' | 'service',
  message: string,
  path?: string,
  cause?: unknown
): ConfigLoadError =>
  new ConfigLoadError({ source, message, path, cause })

export const createSaveError = (
  destination: 'storage' | 'file' | 'service',
  message: string,
  configSection?: string,
  cause?: unknown
): ConfigSaveError =>
  new ConfigSaveError({ destination, message, configSection, cause })

export const createParseError = (
  input: string,
  expectedType: string,
  parseErrors: string[],
  cause?: unknown
): ConfigParseError =>
  new ConfigParseError({ 
    input: input.length > 200 ? input.substring(0, 200) + '...' : input,
    expectedType,
    parseErrors,
    cause 
  })

export const createEnvironmentError = (
  environment: string,
  missingKeys: string[],
  message: string
): ConfigEnvironmentError =>
  new ConfigEnvironmentError({ environment, missingKeys, message })

export const createServiceError = (
  service: string,
  operation: 'initialize' | 'load' | 'save' | 'validate' | 'update',
  message: string,
  cause?: unknown
): ConfigServiceError =>
  new ConfigServiceError({ service, operation, message, cause })

export const createMigrationError = (
  fromVersion: string,
  toVersion: string,
  failedKeys: string[],
  message: string
): ConfigMigrationError =>
  new ConfigMigrationError({ fromVersion, toVersion, failedKeys, message })

export const createPermissionError = (
  resource: string,
  operation: 'read' | 'write' | 'delete' | 'create',
  message: string
): ConfigPermissionError =>
  new ConfigPermissionError({ resource, operation, message })

export const createNetworkError = (
  message: string,
  url?: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
  statusCode?: number,
  cause?: unknown
): ConfigNetworkError =>
  new ConfigNetworkError({ url, method, statusCode, message, cause })