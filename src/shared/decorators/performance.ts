/**
 * Performance-related decorators
 */

import { debounce as debounceUtil, throttle as throttleUtil, memoize as memoizeUtil } from '@shared/utils/common'

/**
 * Measure execution time of a method
 */
export function measureTime(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = function (...args: any[]) {
    const start = performance.now()
    const result = originalMethod.apply(this, args)

    if (result instanceof Promise) {
      return result.then((value) => {
        const end = performance.now()
        console.log(`${target.constructor.name}.${propertyKey} took ${end - start}ms`)
        return value
      })
    } else {
      const end = performance.now()
      console.log(`${target.constructor.name}.${propertyKey} took ${end - start}ms`)
      return result
    }
  }

  return descriptor
}

/**
 * Throttle method execution - uses shared utility
 */
export function throttle(delay: number) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const throttledMethod = throttleUtil(originalMethod, delay)

    descriptor.value = function (...args: any[]) {
      return throttledMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Debounce method execution - uses shared utility
 */
export function debounce(delay: number) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const debouncedMethod = debounceUtil(originalMethod, delay)

    descriptor.value = function (...args: any[]) {
      return debouncedMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Memoize method results - uses shared utility
 */
export function memoize(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value
  const memoizedMethod = memoizeUtil(originalMethod)

  descriptor.value = function (...args: any[]) {
    return memoizedMethod.apply(this, args)
  }

  return descriptor
}

/**
 * Log method calls
 */
export function logCalls(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${target.constructor.name}.${propertyKey} with args:`, args)
    const result = originalMethod.apply(this, args)
    console.log(`${target.constructor.name}.${propertyKey} returned:`, result)
    return result
  }

  return descriptor
}
