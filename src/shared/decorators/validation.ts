/**
 * Validation decorators
 */

/**
 * Validate method parameters
 */
export function validate(validators: { [paramIndex: number]: (value: any) => boolean }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      for (const [index, validator] of Object.entries(validators)) {
        const paramIndex = parseInt(index, 10)
        if (!validator(args[paramIndex])) {
          throw new Error(`Invalid parameter at index ${paramIndex} for ${target.constructor.name}.${propertyKey}`)
        }
      }

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Ensure method parameters are not null or undefined
 */
export function notNull(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = function (...args: any[]) {
    for (let i = 0; i < args.length; i++) {
      if (args[i] == null) {
        throw new Error(`Parameter at index ${i} cannot be null or undefined for ${target.constructor.name}.${propertyKey}`)
      }
    }

    return originalMethod.apply(this, args)
  }

  return descriptor
}

/**
 * Validate return value
 */
export function validateReturn(validator: (value: any) => boolean, errorMessage?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args)

      if (!validator(result)) {
        throw new Error(errorMessage || `Invalid return value from ${target.constructor.name}.${propertyKey}`)
      }

      return result
    }

    return descriptor
  }
}

/**
 * Ensure method is called with specific types
 */
export function requireTypes(...types: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      for (let i = 0; i < types.length && i < args.length; i++) {
        const expectedType = types[i]
        const actualType = typeof args[i]

        if (actualType !== expectedType) {
          throw new Error(`Parameter ${i} of ${target.constructor.name}.${propertyKey} ` + `expected ${expectedType} but got ${actualType}`)
        }
      }

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Range validation for numeric parameters
 */
export function range(min: number, max: number, paramIndex = 0) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      const value = args[paramIndex]

      if (typeof value === 'number' && (value < min || value > max)) {
        throw new Error(`Parameter ${paramIndex} of ${target.constructor.name}.${propertyKey} ` + `must be between ${min} and ${max}, got ${value}`)
      }

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}
