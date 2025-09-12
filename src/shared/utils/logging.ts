/**
 * Centralized logging utilities for ts-minecraft
 *
 * Provides consistent logging interface across all layers
 * with structured output and Effect-TS integration.
 */

import * as Effect from 'effect/Effect'
import * as Console from 'effect/Console'
import * as Ref from 'effect/Ref'
import * as Clock from 'effect/Clock'
import * as S from '@effect/schema/Schema'
import { pipe } from 'effect/Function'

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

// Enhanced schema definitions for comprehensive validation
const LogContextSchema = S.Union(
  S.Record(S.String, S.Unknown),
  S.Null,
  S.Undefined
)

const ErrorLikeSchema = S.Union(
  S.InstanceOf(Error),
  S.String,
  S.Struct({
    _tag: S.String,
    message: S.optional(S.String),
    stack: S.optional(S.String)
  }),
  S.Unknown
)

const StateSchema = S.Union(
  S.Record(S.String, S.Unknown),
  S.Array(S.Unknown),
  S.String,
  S.Number,
  S.Boolean,
  S.Null,
  S.Undefined,
  S.Unknown
)

const LogLevelSchema = S.Literal('debug', 'info', 'warn', 'error', 'critical')
const TagsSchema = S.Array(S.String)
const ComponentSchema = S.String

// Schema for complete log entry validation
const LogEntrySchema = S.Struct({
  timestamp: S.InstanceOf(Date),
  level: LogLevelSchema,
  component: ComponentSchema,
  message: S.String,
  context: S.optional(S.Record(S.String, S.Unknown)),
  error: S.optional(S.InstanceOf(Error)),
  tags: S.optional(TagsSchema)
})

// Enhanced type guards and validators using Schema.parse
const validateLogContext = (context: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  return pipe(
    S.decodeUnknown(LogContextSchema)(context),
    Effect.match({
      onFailure: () => {
        // Provide fallback for invalid context
        if (context == null) return {}
        if (typeof context === 'object' && !Array.isArray(context)) {
          return context as Record<string, unknown>
        }
        return { value: context, type: typeof context, raw: String(context) }
      },
      onSuccess: (validated) => {
        if (validated == null) return {}
        return validated as Record<string, unknown>
      }
    }),
    Effect.succeed
  )
}

const validateError = (error: unknown): Effect.Effect<Error, never, never> => {
  return pipe(
    S.decodeUnknown(ErrorLikeSchema)(error),
    Effect.match({
      onFailure: () => {
        // Fallback error creation for invalid schemas
        if (error instanceof Error) return error
        if (typeof error === 'string') return new Error(error)
        return new Error(String(error))
      },
      onSuccess: (validated) => {
        if (validated instanceof Error) return validated
        if (typeof validated === 'string') return new Error(validated)
        if (typeof validated === 'object' && validated !== null && '_tag' in validated) {
          const message = 'message' in validated && typeof validated.message === 'string'
            ? validated.message 
            : `Error: ${validated._tag}`
          const error = new Error(message)
          if ('stack' in validated && typeof validated.stack === 'string') {
            error.stack = validated.stack
          }
          return error
        }
        return new Error(String(validated))
      }
    }),
    Effect.succeed
  )
}

const validateState = (state: unknown): Effect.Effect<Record<string, unknown>, never, never> => {
  return pipe(
    S.decodeUnknown(StateSchema)(state),
    Effect.match({
      onFailure: () => {
        try {
          return {
            state: typeof state === 'object' && state !== null ? state : { value: state, type: typeof state },
          }
        } catch {
          return { state: '[Unserializable]', type: typeof state }
        }
      },
      onSuccess: (validated) => {
        try {
          return {
            state: typeof validated === 'object' && validated !== null 
              ? validated 
              : { value: validated, type: typeof validated },
            isValid: true
          }
        } catch {
          return { state: '[Unserializable]', type: typeof validated, isValid: false }
        }
      }
    }),
    Effect.succeed
  )
}

// Log entry structure
export interface LogEntry {
  timestamp: Date
  level: LogLevel
  component: string
  message: string
  context?: Record<string, unknown>
  error?: Error
  tags?: string[]
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableStructured: boolean
  includeStackTrace: boolean
  component?: string
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  enableConsole: true,
  enableStructured: false,
  includeStackTrace: false,
}

// Logger state using Effect-TS Ref
interface LoggerStateData {
  config: LoggerConfig
  entries: LogEntry[]
}

// Initial logger state
const initialLoggerState: LoggerStateData = {
  config: DEFAULT_CONFIG,
  entries: [],
}

// Global logger state ref
const loggerStateRef = Ref.unsafeMake(initialLoggerState)

// Functional logger state operations
const LoggerStateOps = {
  updateConfig: (config: Partial<LoggerConfig>) =>
    Ref.update(loggerStateRef, (state) => ({
      ...state,
      config: { ...state.config, ...config },
    })),

  getConfig: () =>
    pipe(
      Ref.get(loggerStateRef),
      Effect.map((state) => ({ ...state.config })),
    ),

  addEntry: (entry: LogEntry) =>
    Ref.update(loggerStateRef, (state) => {
      const newEntries = [...state.entries, entry]

      // Keep only the last 1000 entries to prevent memory leaks
      const limitedEntries = newEntries.length > 1000 ? newEntries.slice(-1000) : newEntries

      return {
        ...state,
        entries: limitedEntries,
      }
    }),

  getEntries: () =>
    pipe(
      Ref.get(loggerStateRef),
      Effect.map((state) => [...state.entries]),
    ),

  clearEntries: () =>
    Ref.update(loggerStateRef, (state) => ({
      ...state,
      entries: [],
    })),
}

// Log level hierarchy for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
}

// Check if log level should be output
const shouldLog = (level: LogLevel): Effect.Effect<boolean, never, never> =>
  pipe(
    LoggerStateOps.getConfig(),
    Effect.map((config) => LOG_LEVELS[level] >= LOG_LEVELS[config.level]),
  )

// Create log entry with validation
function createLogEntry(
  level: LogLevel,
  message: string,
  component: string,
  context?: Record<string, unknown>,
  error?: Error,
  tags?: string[],
): Effect.Effect<LogEntry, never, Clock.Clock> {
  return Effect.gen(function* () {
    const validatedContext = context ? yield* validateLogContext(context) : undefined
    const currentTime = yield* Clock.currentTimeMillis
    
    return {
      timestamp: new Date(currentTime),
      level,
      component,
      message,
      context: validatedContext,
      error,
      tags,
    }
  })
}

// Format log entry for console output
const formatForConsole = (entry: LogEntry): Effect.Effect<string, never, never> =>
  pipe(
    LoggerStateOps.getConfig(),
    Effect.map((config) => {
      const timestamp = entry.timestamp.toISOString()
      const level = entry.level.toUpperCase().padEnd(8)
      const component = `[${entry.component}]`.padEnd(20)

      let output = `${timestamp} ${level} ${component} ${entry.message}`

      if (entry.context && Object.keys(entry.context).length > 0) {
        output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`
        if (config.includeStackTrace && entry.error.stack) {
          output += `\n  Stack: ${entry.error.stack}`
        }
      }

      if (entry.tags && entry.tags.length > 0) {
        output += `\n  Tags: ${entry.tags.join(', ')}`
      }

      return output
    }),
  )

// Core logging function with validation
function log(level: LogLevel, message: string, component?: string, context?: unknown, error?: unknown, tags?: string[]): Effect.Effect<void, never, Clock.Clock> {
  return pipe(
    Effect.gen(function* (_) {
      const config = yield* _(LoggerStateOps.getConfig())
      const actualComponent = component || config.component || 'Unknown'

      const shouldOutput = yield* _(shouldLog(level))
      if (!shouldOutput) {
        return
      }

      // Validate inputs
      const validatedContext = context ? yield* _(validateLogContext(context)) : undefined
      const validatedError = error ? yield* _(validateError(error)) : undefined

      const entry = yield* _(createLogEntry(level, message, actualComponent, validatedContext, validatedError, tags))
      yield* _(LoggerStateOps.addEntry(entry))

      if (!config.enableConsole) {
        return
      }

      if (config.enableStructured) {
        yield* _(Console.log(JSON.stringify(entry, null, 2)))
      } else {
        const formatted = yield* _(formatForConsole(entry))

        switch (level) {
          case 'debug':
            yield* _(Console.debug(formatted))
            break
          case 'info':
            yield* _(Console.info(formatted))
            break
          case 'warn':
            yield* _(Console.warn(formatted))
            break
          case 'error':
          case 'critical':
            yield* _(Console.error(formatted))
            break
        }
      }
    }),
  )
}

// Public logging interface
export const Logger = {
  // Configuration
  configure: (config: Partial<LoggerConfig>) => LoggerStateOps.updateConfig(config),

  getConfig: () => LoggerStateOps.getConfig(),

  // Enhanced schema validation utilities
  validateContext: validateLogContext,
  validateError: validateError,
  validateState: validateState,
  
  // Schema validators for external use
  validateLogEntry: (entry: unknown): Effect.Effect<LogEntry, string, never> => {
    return pipe(
      S.decodeUnknown(LogEntrySchema)(entry),
      Effect.mapError((error) => `Invalid log entry: ${error}`)
    )
  },
  
  validateLogLevel: (level: unknown): Effect.Effect<LogLevel, string, never> => {
    return pipe(
      S.decodeUnknown(LogLevelSchema)(level),
      Effect.mapError((error) => `Invalid log level: ${error}`)
    )
  },
  
  validateTags: (tags: unknown): Effect.Effect<string[], string, never> => {
    return pipe(
      S.decodeUnknown(TagsSchema)(tags),
      Effect.mapError((error) => `Invalid tags: ${error}`)
    )
  },
  
  // Schema exports for external validation
  LogContextSchema,
  ErrorLikeSchema,
  StateSchema,
  LogEntrySchema,
  LogLevelSchema,
  TagsSchema,

  // Logging methods with unknown type validation
  debug: (message: string, component?: string, context?: unknown, tags?: string[]) => log('debug', message, component, context, undefined, tags),

  info: (message: string, component?: string, context?: unknown, tags?: string[]) => log('info', message, component, context, undefined, tags),

  warn: (message: string, component?: string, context?: unknown, tags?: string[]) => log('warn', message, component, context, undefined, tags),

  error: (message: string, component?: string, error?: unknown, context?: unknown, tags?: string[]) => log('error', message, component, context, error, tags),

  critical: (message: string, component?: string, error?: unknown, context?: unknown, tags?: string[]) => log('critical', message, component, context, error, tags),

  // Utility methods with unknown type validation
  withComponent: (component: string) => ({
    debug: (message: string, context?: unknown, tags?: string[]) => log('debug', message, component, context, undefined, tags),

    info: (message: string, context?: unknown, tags?: string[]) => log('info', message, component, context, undefined, tags),

    warn: (message: string, context?: unknown, tags?: string[]) => log('warn', message, component, context, undefined, tags),

    error: (message: string, error?: unknown, context?: unknown, tags?: string[]) => log('error', message, component, context, error, tags),

    critical: (message: string, error?: unknown, context?: unknown, tags?: string[]) => log('critical', message, component, context, error, tags),
  }),

  // Log retrieval and management
  getEntries: () => LoggerStateOps.getEntries(),

  clearEntries: () => LoggerStateOps.clearEntries(),

  getEntriesByLevel: (level: LogLevel) =>
    pipe(
      LoggerStateOps.getEntries(),
      Effect.map((entries) => entries.filter((entry) => entry.level === level)),
    ),

  getEntriesByComponent: (component: string) =>
    pipe(
      LoggerStateOps.getEntries(),
      Effect.map((entries) => entries.filter((entry) => entry.component === component)),
    ),

  getEntriesByTag: (tag: string) =>
    pipe(
      LoggerStateOps.getEntries(),
      Effect.map((entries) => entries.filter((entry) => entry.tags?.includes(tag))),
    ),

  // Performance logging helpers
  performance: {
    start: (operation: string, component?: string): Effect.Effect<{ end: (context?: unknown) => Effect.Effect<void, never, Clock.Clock> }, never, Clock.Clock> => 
      Effect.gen(function* () {
        const startTime = yield* Clock.currentTimeNanos
        return {
          end: (context?: unknown) =>
            Effect.gen(function* () {
              const endTime = yield* Clock.currentTimeNanos
              const duration = Number(endTime - startTime) / 1_000_000 // Convert to milliseconds
              const validatedContext = context ? yield* validateLogContext(context) : {}
              return yield* log(
                'debug',
                `${operation} completed`,
                component,
                {
                  ...validatedContext,
                  duration: `${duration.toFixed(2)}ms`,
                  operation,
                },
                undefined,
                ['performance'],
              )
            })
        }
      }),

    measure: <T, E, R>(operation: string, effect: Effect.Effect<T, E, R>, component?: string, context?: unknown): Effect.Effect<T, E, R | Clock.Clock> => {
      return pipe(
        Clock.currentTimeNanos,
        Effect.flatMap((startTime) =>
          pipe(
            effect,
            Effect.tap((result) =>
              Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeNanos
                const duration = Number(endTime - startTime) / 1_000_000 // Convert to milliseconds
                const validatedContext = context ? yield* validateLogContext(context) : {}
                return yield* log(
                  'debug',
                  `${operation} completed`,
                  component,
                  {
                    ...validatedContext,
                    duration: `${duration.toFixed(2)}ms`,
                    operation,
                    result: typeof result === 'object' ? 'Object' : String(result),
                  },
                  undefined,
                  ['performance'],
                )
              })
            ),
          ),
        ),
      )
    },
  },
}

// Export commonly used logger instances
export const createComponentLogger = (component: string) => Logger.withComponent(component)

// Development helpers with proper unknown handling
export const DevLogger = {
  logState: (state: unknown, component?: string, label?: string) =>
    Effect.gen(function* () {
      const validatedState = yield* validateState(state)
      return yield* Logger.debug(`State${label ? ` (${label})` : ''}`, component, validatedState, ['state'])
    }),

  logEffect: <T>(label: string, component?: string) =>
    Effect.tap<T>((value: T) =>
      Effect.gen(function* () {
        const validatedValue = yield* validateState(value)
        return yield* Logger.debug(`Effect: ${label}`, component, { value: validatedValue }, ['effect'])
      }),
    ),

  logError: (error: unknown, component?: string, operation?: string) =>
    Effect.gen(function* () {
      const validatedError = yield* validateError(error)
      return yield* Logger.error(`${operation ? `${operation} failed` : 'Operation failed'}`, component, validatedError, { operation }, ['error'])
    }),
}
