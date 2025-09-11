/**
 * Performance-related decorators
 */

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
 * Throttle method execution
 */
export function throttle(delay: number) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    let lastExecution = 0
    
    descriptor.value = function (...args: any[]) {
      const now = Date.now()
      if (now - lastExecution >= delay) {
        lastExecution = now
        return originalMethod.apply(this, args)
      }
    }
    
    return descriptor
  }
}

/**
 * Debounce method execution
 */
export function debounce(delay: number) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    let timeoutId: NodeJS.Timeout
    
    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        originalMethod.apply(this, args)
      }, delay)
    }
    
    return descriptor
  }
}

/**
 * Memoize method results
 */
export function memoize(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value
  const cache = new Map<string, any>()
  
  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)
    }
    
    const result = originalMethod.apply(this, args)
    cache.set(key, result)
    
    return result
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