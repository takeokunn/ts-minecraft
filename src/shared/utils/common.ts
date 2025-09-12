/**
 * Common utility functions used across the application
 * Enhanced with Effect-TS patterns for better functional programming
 */

import { Effect, Option, Either, pipe } from 'effect'

/**
 * Type guard for non-null values - deprecated, use Option.fromNullable instead
 * @deprecated Use Effect-TS Option.fromNullable for better functional programming patterns
 */
export const isNotNull = <T>(value: T | null): value is T => value !== null

/**
 * Type guard for non-undefined values - deprecated, use Option.fromNullable instead
 * @deprecated Use Effect-TS Option.fromNullable for better functional programming patterns
 */
export const isNotUndefined = <T>(value: T | undefined): value is T => value !== undefined

/**
 * Type guard for non-nullish values - deprecated, use Option.fromNullable instead
 * @deprecated Use Effect-TS Option.fromNullable for better functional programming patterns
 */
export const isNotNullish = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined

/**
 * Effect-TS compliant safe value access using Option
 */
export const safeOption = <T>(value: T | null | undefined): Option.Option<T> =>
  Option.fromNullable(value)

/**
 * Effect-TS compliant safe value access with default
 */
export const safeValue = <T>(value: T | null | undefined, defaultValue: T): T =>
  pipe(
    Option.fromNullable(value),
    Option.getOrElse(() => defaultValue)
  )

/**
 * Safe array access with default value - now using Effect-TS Option
 */
export const safeArrayAccess = <T>(array: T[], index: number, defaultValue: T): T =>
  pipe(
    Option.fromNullable(array[index]),
    Option.filter(() => index >= 0 && index < array.length),
    Option.getOrElse(() => defaultValue)
  )

/**
 * Effect-TS compliant safe array access returning Option
 */
export const safeArrayAccessOption = <T>(array: T[], index: number): Option.Option<T> =>
  pipe(
    Option.fromNullable(array[index]),
    Option.filter(() => index >= 0 && index < array.length)
  )

/**
 * Deep clone an object (simple implementation)
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as T
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as T

  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * Debounce function - shared utility for both function and decorator use
 */
export const debounce = <T extends (...args: readonly unknown[]) => unknown>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function - shared utility for both function and decorator use
 */
export const throttle = <T extends (...args: readonly unknown[]) => unknown>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let lastTime = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= wait) {
      lastTime = now
      func(...args)
    }
  }
}

/**
 * Create a range of numbers
 */
export const range = (start: number, end: number, step = 1): number[] => {
  const result: number[] = []
  for (let i = start; i < end; i += step) {
    result.push(i)
  }
  return result
}

/**
 * Create memoized version of a function - shared utility for both function and decorator use
 */
export const memoize = <T extends (...args: readonly unknown[]) => unknown>(fn: T): T => {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

/**
 * Group array items by a key function
 */
export const groupBy = <T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, T[]> => {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    },
    {} as Record<K, T[]>,
  )
}

/**
 * Remove duplicates from array
 */
export const unique = <T>(array: T[]): T[] => [...new Set(array)]

/**
 * Chunk array into smaller arrays
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Flatten nested arrays
 */
export const flatten = <T>(array: (T | T[])[]): T[] => array.reduce<T[]>((acc, item) => (Array.isArray(item) ? acc.concat(flatten(item)) : acc.concat(item)), [])

/**
 * Generate random ID
 */
export const generateId = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Wait for a specified amount of time
 */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry function with exponential backoff - legacy Promise-based version
 * @deprecated Use Effect-TS retry utilities from shared/utils/effect.ts
 */
export const retry = async <T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 1000): Promise<T> => {
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      return await fn()
    } catch (error) {
      attempts++
      if (attempts >= maxAttempts) throw error

      const delay = baseDelay * Math.pow(2, attempts - 1)
      await sleep(delay)
    }
  }

  throw new Error('Max attempts reached')
}

/**
 * Effect-TS compliant retry with Either for error handling
 */
export const retryWithEither = <A, E>(
  effect: Effect.Effect<A, E>, 
  maxAttempts = 3, 
  baseDelay = 1000
): Effect.Effect<A, E> =>
  pipe(
    effect,
    Effect.retry({
      times: maxAttempts,
      schedule: pipe(
        Effect.schedule.exponential(`${baseDelay} millis`),
        Effect.schedule.intersect(Effect.schedule.recurs(maxAttempts))
      )
    })
  )

/**
 * Effect-TS compliant validation with Either
 */
export const validateWithEither = <T, E>(
  value: unknown,
  validator: (value: unknown) => Either.Either<T, E>
): Either.Either<T, E> => validator(value)

/**
 * Effect-TS compliant async operation with proper error handling
 */
export const safeAsync = <A>(fn: () => Promise<A>): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    try: fn,
    catch: (error) => error instanceof Error ? error : new Error(String(error))
  })
