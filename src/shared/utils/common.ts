/**
 * Common utility functions used across the application
 */

/**
 * Type guard for non-null values
 */
export const isNotNull = <T>(value: T | null): value is T => value !== null

/**
 * Type guard for non-undefined values
 */
export const isNotUndefined = <T>(value: T | undefined): value is T => value !== undefined

/**
 * Type guard for non-nullish values
 */
export const isNotNullish = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined

/**
 * Safe array access with default value
 */
export const safeArrayAccess = <T>(array: T[], index: number, defaultValue: T): T => {
  const value = array[index]
  return index >= 0 && index < array.length && value !== undefined ? value : defaultValue
}

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
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function - shared utility for both function and decorator use
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
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
export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
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
 * Retry function with exponential backoff
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
