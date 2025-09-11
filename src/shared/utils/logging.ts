/**
 * Centralized logging utilities for ts-minecraft
 *
 * Provides consistent logging interface across all layers
 * with structured output and Effect-TS integration.
 */

import * as Effect from 'effect/Effect'
import * as Console from 'effect/Console'
import * as Ref from 'effect/Ref'
import { pipe } from 'effect/Function'

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

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

// Create log entry
function createLogEntry(level: LogLevel, message: string, component: string, context?: Record<string, unknown>, error?: Error, tags?: string[]): LogEntry {
  return {
    timestamp: new Date(),
    level,
    component,
    message,
    context,
    error,
    tags,
  }
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

// Core logging function
function log(level: LogLevel, message: string, component?: string, context?: Record<string, unknown>, error?: Error, tags?: string[]): Effect.Effect<void, never, never> {
  return pipe(
    Effect.gen(function* (_) {
      const config = yield* _(LoggerStateOps.getConfig())
      const actualComponent = component || config.component || 'Unknown'

      const shouldOutput = yield* _(shouldLog(level))
      if (!shouldOutput) {
        return
      }

      const entry = createLogEntry(level, message, actualComponent, context, error, tags)
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

  // Logging methods
  debug: (message: string, component?: string, context?: Record<string, unknown>, tags?: string[]) => log('debug', message, component, context, undefined, tags),

  info: (message: string, component?: string, context?: Record<string, unknown>, tags?: string[]) => log('info', message, component, context, undefined, tags),

  warn: (message: string, component?: string, context?: Record<string, unknown>, tags?: string[]) => log('warn', message, component, context, undefined, tags),

  error: (message: string, component?: string, error?: Error, context?: Record<string, unknown>, tags?: string[]) => log('error', message, component, context, error, tags),

  critical: (message: string, component?: string, error?: Error, context?: Record<string, unknown>, tags?: string[]) => log('critical', message, component, context, error, tags),

  // Utility methods
  withComponent: (component: string) => ({
    debug: (message: string, context?: Record<string, unknown>, tags?: string[]) => log('debug', message, component, context, undefined, tags),

    info: (message: string, context?: Record<string, unknown>, tags?: string[]) => log('info', message, component, context, undefined, tags),

    warn: (message: string, context?: Record<string, unknown>, tags?: string[]) => log('warn', message, component, context, undefined, tags),

    error: (message: string, error?: Error, context?: Record<string, unknown>, tags?: string[]) => log('error', message, component, context, error, tags),

    critical: (message: string, error?: Error, context?: Record<string, unknown>, tags?: string[]) => log('critical', message, component, context, error, tags),
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
    start: (operation: string, component?: string) => {
      const startTime = performance.now()
      return {
        end: (context?: Record<string, unknown>) => {
          const duration = performance.now() - startTime
          return log(
            'debug',
            `${operation} completed`,
            component,
            {
              ...context,
              duration: `${duration.toFixed(2)}ms`,
              operation,
            },
            undefined,
            ['performance'],
          )
        },
      }
    },

    measure: <T>(operation: string, effect: Effect.Effect<T, any, any>, component?: string, context?: Record<string, unknown>): Effect.Effect<T, any, never> => {
      return pipe(
        Effect.sync(() => performance.now()),
        Effect.flatMap((startTime) =>
          pipe(
            effect,
            Effect.tap((result) => {
              const duration = performance.now() - startTime
              return log(
                'debug',
                `${operation} completed`,
                component,
                {
                  ...context,
                  duration: `${duration.toFixed(2)}ms`,
                  operation,
                  result: typeof result === 'object' ? 'Object' : String(result),
                },
                undefined,
                ['performance'],
              )
            }),
          ),
        ),
      )
    },
  },
}

// Export commonly used logger instances
export const createComponentLogger = (component: string) => Logger.withComponent(component)

// Development helpers
export const DevLogger = {
  logState: (state: unknown, component?: string, label?: string) => Logger.debug(`State${label ? ` (${label})` : ''}`, component, { state }, ['state']),

  logEffect: <T>(label: string, component?: string) => Effect.tap<T>((value: T) => Logger.debug(`Effect: ${label}`, component, { value }, ['effect'])),

  logError: (error: unknown, component?: string, operation?: string) => {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    return Logger.error(`${operation ? `${operation} failed` : 'Operation failed'}`, component, errorObj, { operation }, ['error'])
  },
}
