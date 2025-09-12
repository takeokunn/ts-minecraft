/**
 * Comprehensive tests for functional utilities
 * Tests Effect-TS patterns, async operations, and complex functional compositions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Duration from 'effect/Duration'
import * as TestClock from 'effect/TestClock'
import * as Schedule from 'effect/Schedule'
import { pipe } from 'effect/Function'
import {
  // Array utilities
  chunk,
  flatten,
  unique,
  groupBy,
  safeHead,
  safeLast,
  safeGet,
  // Control flow
  debounce,
  throttle,
  memoize,
  retryWithPolicy,
  compose,
  forEachParallel,
  // Conditional
  when,
  unless,
  tapWhen,
  // Measurement & Resource management
  withTiming,
  bracket,
  // Concurrency
  raceAll,
  sequence,
  traverse,
  // Error handling
  tryCatch,
  fromPromise,
  fromCallback,
  // Effects
  filterEffect,
  foldEffect,
  // Math
  safeDivide,
  // Utilities
  pipeline,
  Combinators,
  Functional,
  JsonValue
} from '@shared/utils/functional'
import { runEffect, runEffectSync, runEffectExit, withTestClock, expectEffect } from '../../../setup/shared.setup'

describe('functional utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Array utilities', () => {
    describe('chunk', () => {
      it('should split array into chunks of specified size', () => {
        const result = chunk(3)([1, 2, 3, 4, 5, 6, 7, 8])
        expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8]])
      })

      it('should handle empty arrays', () => {
        const result = chunk(3)([])
        expect(result).toEqual([])
      })

      it('should handle arrays smaller than chunk size', () => {
        const result = chunk(5)([1, 2])
        expect(result).toEqual([[1, 2]])
      })
    })

    describe('flatten', () => {
      it('should flatten nested arrays', () => {
        const result = flatten([[1, 2], [3, 4], [5]])
        expect(result).toEqual([1, 2, 3, 4, 5])
      })

      it('should handle empty arrays', () => {
        const result = flatten([])
        expect(result).toEqual([])
      })

      it('should handle arrays with empty subarrays', () => {
        const result = flatten([[1], [], [2, 3]])
        expect(result).toEqual([1, 2, 3])
      })
    })

    describe('unique', () => {
      it('should remove duplicate primitives', () => {
        const result = unique([1, 2, 2, 3, 1, 4])
        expect(result).toEqual([1, 2, 3, 4])
      })

      it('should handle empty arrays', () => {
        const result = unique([])
        expect(result).toEqual([])
      })

      it('should handle arrays with no duplicates', () => {
        const result = unique([1, 2, 3])
        expect(result).toEqual([1, 2, 3])
      })
    })

    describe('groupBy', () => {
      it('should group items by key function', () => {
        const items = [
          { type: 'fruit', name: 'apple' },
          { type: 'vegetable', name: 'carrot' },
          { type: 'fruit', name: 'banana' }
        ]
        const result = groupBy((item: typeof items[0]) => item.type)(items)
        
        expect(Object.keys(result)).toEqual(['fruit', 'vegetable'])
        expect(result.fruit).toHaveLength(2)
        expect(result.vegetable).toHaveLength(1)
      })

      it('should handle empty arrays', () => {
        const result = groupBy((x: number) => x.toString())([])
        expect(result).toEqual({})
      })
    })

    describe('safeHead', () => {
      it('should return Some for non-empty array', () => {
        const result = safeHead([1, 2, 3])
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrNull(result)).toBe(1)
      })

      it('should return None for empty array', () => {
        const result = safeHead([])
        expect(Option.isNone(result)).toBe(true)
      })
    })

    describe('safeLast', () => {
      it('should return Some for non-empty array', () => {
        const result = safeLast([1, 2, 3])
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrNull(result)).toBe(3)
      })

      it('should return None for empty array', () => {
        const result = safeLast([])
        expect(Option.isNone(result)).toBe(true)
      })
    })

    describe('safeGet', () => {
      it('should return Some for valid index', () => {
        const result = safeGet(1)([1, 2, 3])
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrNull(result)).toBe(2)
      })

      it('should return None for invalid index', () => {
        const result = safeGet(5)([1, 2, 3])
        expect(Option.isNone(result)).toBe(true)
      })

      it('should return None for negative index', () => {
        const result = safeGet(-1)([1, 2, 3])
        expect(Option.isNone(result)).toBe(true)
      })
    })
  })

  describe('Control flow', () => {
    describe('debounce', () => {
      it('should delay effect execution', async () => {
        const mockEffect = Effect.succeed('test')
        const delay = Duration.millis(100)
        const debouncedEffect = debounce(delay)(mockEffect)

        await withTestClock(Effect.gen(function* () {
          const fiber = yield* Effect.fork(debouncedEffect)
          yield* TestClock.adjust(Duration.millis(50))
          expect(yield* Effect.fiber.poll(fiber)).toEqual(Option.none())
          
          yield* TestClock.adjust(Duration.millis(60))
          const result = yield* Effect.fiber.join(fiber)
          expect(result).toBe('test')
        }))
      })
    })

    describe('throttle', () => {
      it('should throttle effect execution', async () => {
        const mockEffect = Effect.succeed('test')
        const interval = Duration.millis(100)
        
        const result = await runEffect(
          withTestClock(Effect.gen(function* () {
            const throttledEffect = throttle(interval)(mockEffect)
            return yield* throttledEffect
          }))
        )
        
        expect(result).toBe('test')
      })
    })

    describe('memoize', () => {
      it('should cache effect results', async () => {
        let callCount = 0
        const mockFn = (x: number) => Effect.sync(() => {
          callCount++
          return x * 2
        })

        const memoizedFn = memoize(mockFn)

        const result1 = await runEffect(memoizedFn(5))
        const result2 = await runEffect(memoizedFn(5))
        
        expect(result1).toBe(10)
        expect(result2).toBe(10)
        expect(callCount).toBe(1) // Should only call once due to memoization
      })

      it('should respect TTL', async () => {
        let callCount = 0
        const mockFn = (x: number) => Effect.sync(() => {
          callCount++
          return x * 2
        })

        const ttl = Duration.millis(100)
        const memoizedFn = memoize(mockFn, ttl)

        await withTestClock(Effect.gen(function* () {
          yield* memoizedFn(5)
          yield* TestClock.adjust(Duration.millis(150))
          yield* memoizedFn(5)
          
          expect(callCount).toBe(2) // Should call twice after TTL expires
        }))
      })

      it('should handle different arguments separately', async () => {
        let callCount = 0
        const mockFn = (x: number) => Effect.sync(() => {
          callCount++
          return x * 2
        })

        const memoizedFn = memoize(mockFn)

        await runEffect(memoizedFn(5))
        await runEffect(memoizedFn(10))
        
        expect(callCount).toBe(2) // Should call for each unique argument
      })
    })

    describe('retryWithPolicy', () => {
      it('should retry failed effects according to policy', async () => {
        let attempts = 0
        const failingEffect = Effect.gen(function* () {
          attempts++
          if (attempts < 3) {
            yield* Effect.fail('error')
          }
          return 'success'
        })

        const policy = Schedule.recurs(3)
        const result = await runEffect(retryWithPolicy(policy)(failingEffect))
        
        expect(result).toBe('success')
        expect(attempts).toBe(3)
      })
    })

    describe('compose', () => {
      it('should compose two effects sequentially', async () => {
        const f = (x: number) => Effect.succeed(x * 2)
        const g = (x: number) => Effect.succeed(x + 1)
        
        const composed = compose(f, g)
        const result = await runEffect(composed(5))
        
        expect(result).toBe(11) // (5 * 2) + 1
      })

      it('should propagate errors from first effect', async () => {
        const f = (x: number) => Effect.fail('first error')
        const g = (x: number) => Effect.succeed(x + 1)
        
        const composed = compose(f, g)
        
        await expectEffect.toFailWith(composed(5), 'first error')
      })

      it('should propagate errors from second effect', async () => {
        const f = (x: number) => Effect.succeed(x * 2)
        const g = (x: number) => Effect.fail('second error')
        
        const composed = compose(f, g)
        
        await expectEffect.toFailWith(composed(5), 'second error')
      })
    })

    describe('forEachParallel', () => {
      it('should execute effects in parallel with concurrency limit', async () => {
        const items = [1, 2, 3, 4, 5]
        const processor = (x: number) => Effect.succeed(x * 2)
        
        const result = await runEffect(forEachParallel(2)(processor)(items))
        
        expect(result).toEqual([2, 4, 6, 8, 10])
      })

      it('should handle unbounded concurrency', async () => {
        const items = [1, 2, 3]
        const processor = (x: number) => Effect.succeed(x * 2)
        
        const result = await runEffect(forEachParallel('unbounded')(processor)(items))
        
        expect(result).toEqual([2, 4, 6])
      })
    })
  })

  describe('Conditional utilities', () => {
    describe('when', () => {
      it('should execute effect when condition is true', async () => {
        const effect = Effect.succeed('executed')
        const result = await runEffect(when(true, effect))
        
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrNull(result)).toBe('executed')
      })

      it('should return None when condition is false', async () => {
        const effect = Effect.succeed('executed')
        const result = await runEffect(when(false, effect))
        
        expect(Option.isNone(result)).toBe(true)
      })
    })

    describe('unless', () => {
      it('should execute effect when condition is false', async () => {
        const effect = Effect.succeed('executed')
        const result = await runEffect(unless(false, effect))
        
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrNull(result)).toBe('executed')
      })

      it('should return None when condition is true', async () => {
        const effect = Effect.succeed('executed')
        const result = await runEffect(unless(true, effect))
        
        expect(Option.isNone(result)).toBe(true)
      })
    })

    describe('tapWhen', () => {
      it('should execute tap effect when condition is true', async () => {
        let tapped = false
        const tapEffect = () => Effect.sync(() => { tapped = true })
        const condition = (x: number) => x > 5
        const sourceEffect = Effect.succeed(10)
        
        const result = await runEffect(tapWhen(condition, tapEffect)(sourceEffect))
        
        expect(result).toBe(10)
        expect(tapped).toBe(true)
      })

      it('should not execute tap effect when condition is false', async () => {
        let tapped = false
        const tapEffect = () => Effect.sync(() => { tapped = true })
        const condition = (x: number) => x > 5
        const sourceEffect = Effect.succeed(3)
        
        const result = await runEffect(tapWhen(condition, tapEffect)(sourceEffect))
        
        expect(result).toBe(3)
        expect(tapped).toBe(false)
      })
    })
  })

  describe('Measurement and resource management', () => {
    describe('withTiming', () => {
      it('should measure execution time', async () => {
        const effect = Effect.sync(() => 'test')
        
        const result = await runEffect(
          withTestClock(Effect.gen(function* () {
            const fiber = yield* Effect.fork(withTiming('test-op', effect))
            yield* TestClock.adjust(Duration.millis(100))
            return yield* Effect.fiber.join(fiber)
          }))
        )
        
        expect(result.result).toBe('test')
        expect(typeof result.duration).toBe('object') // Duration object
      })
    })

    describe('bracket', () => {
      it('should ensure cleanup happens on success', async () => {
        let acquired = false
        let released = false
        
        const acquire = Effect.sync(() => {
          acquired = true
          return 'resource'
        })
        
        const use = (resource: string) => Effect.succeed(resource.toUpperCase())
        
        const release = () => Effect.sync(() => { 
          released = true 
        })
        
        const result = await runEffect(bracket(acquire, use, release))
        
        expect(result).toBe('RESOURCE')
        expect(acquired).toBe(true)
        expect(released).toBe(true)
      })

      it('should ensure cleanup happens on failure', async () => {
        let acquired = false
        let released = false
        
        const acquire = Effect.sync(() => {
          acquired = true
          return 'resource'
        })
        
        const use = () => Effect.fail('use error')
        
        const release = () => Effect.sync(() => { 
          released = true 
        })
        
        await expectEffect.toFailWith(bracket(acquire, use, release), 'use error')
        
        expect(acquired).toBe(true)
        expect(released).toBe(true)
      })
    })
  })

  describe('Concurrency utilities', () => {
    describe('raceAll', () => {
      it('should return result from fastest effect', async () => {
        const effects = [
          Effect.succeed('first'),
          Effect.succeed('second'),
          Effect.succeed('third')
        ]
        
        const result = await runEffect(raceAll(effects))
        
        expect(['first', 'second', 'third']).toContain(result)
      })

      it('should handle single effect', async () => {
        const effects = [Effect.succeed('only')]
        
        const result = await runEffect(raceAll(effects))
        
        expect(result).toBe('only')
      })
    })

    describe('sequence', () => {
      it('should collect all results in order', async () => {
        const effects = [
          Effect.succeed(1),
          Effect.succeed(2),
          Effect.succeed(3)
        ]
        
        const result = await runEffect(sequence(effects))
        
        expect(result).toEqual([1, 2, 3])
      })

      it('should fail if any effect fails', async () => {
        const effects = [
          Effect.succeed(1),
          Effect.fail('error'),
          Effect.succeed(3)
        ]
        
        await expectEffect.toFailWith(sequence(effects), 'error')
      })
    })

    describe('traverse', () => {
      it('should map and sequence effects', async () => {
        const items = [1, 2, 3]
        const f = (x: number) => Effect.succeed(x * 2)
        
        const result = await runEffect(traverse(f)(items))
        
        expect(result).toEqual([2, 4, 6])
      })

      it('should fail if any mapped effect fails', async () => {
        const items = [1, 2, 3]
        const f = (x: number) => x === 2 ? Effect.fail('error') : Effect.succeed(x * 2)
        
        await expectEffect.toFailWith(traverse(f)(items), 'error')
      })
    })
  })

  describe('Error handling utilities', () => {
    describe('tryCatch', () => {
      it('should catch exceptions and convert to effect errors', async () => {
        const throwingFn = () => {
          throw new Error('sync error')
        }
        
        const onError = (error: Error) => `Caught: ${error.message}`
        
        const result = await runEffect(tryCatch(throwingFn, onError))
        
        await expectEffect.toFailWith(
          tryCatch(throwingFn, onError), 
          'Caught: sync error'
        )
      })

      it('should succeed for non-throwing functions', async () => {
        const nonThrowingFn = () => 'success'
        const onError = (error: Error) => `Caught: ${error.message}`
        
        const result = await runEffect(tryCatch(nonThrowingFn, onError))
        
        expect(result).toBe('success')
      })
    })

    describe('fromPromise', () => {
      it('should convert successful promise to effect', async () => {
        const promise = () => Promise.resolve('success')
        
        const result = await runEffect(fromPromise(promise))
        
        expect(result).toBe('success')
      })

      it('should convert rejected promise to effect error', async () => {
        const promise = () => Promise.reject(new Error('promise error'))
        
        await expectEffect.toFail(fromPromise(promise))
      })
    })

    describe('fromCallback', () => {
      it('should convert successful callback to effect', async () => {
        const callbackFn = (callback: (error: null, result?: string) => void) => {
          setTimeout(() => callback(null, 'success'), 10)
        }
        
        const result = await runEffect(fromCallback(callbackFn))
        
        expect(result).toBe('success')
      })

      it('should convert error callback to effect error', async () => {
        const callbackFn = (callback: (error: Error | null, result?: string) => void) => {
          setTimeout(() => callback(new Error('callback error')), 10)
        }
        
        await expectEffect.toFail(fromCallback(callbackFn))
      })

      it('should handle callback with no result', async () => {
        const callbackFn = (callback: (error: null) => void) => {
          setTimeout(() => callback(null), 10)
        }
        
        await expectEffect.toFail(fromCallback(callbackFn))
      })
    })
  })

  describe('Effect utilities', () => {
    describe('filterEffect', () => {
      it('should filter items based on effect predicate', async () => {
        const items = [1, 2, 3, 4, 5]
        const predicate = (x: number) => Effect.succeed(x % 2 === 0)
        
        const result = await runEffect(filterEffect(predicate)(items))
        
        expect(result).toEqual([2, 4])
      })

      it('should handle failing predicate', async () => {
        const items = [1, 2, 3]
        const predicate = (x: number) => x === 2 ? Effect.fail('error') : Effect.succeed(true)
        
        await expectEffect.toFailWith(filterEffect(predicate)(items), 'error')
      })
    })

    describe('foldEffect', () => {
      it('should fold items with effect accumulator', async () => {
        const items = [1, 2, 3, 4, 5]
        const folder = (acc: number, x: number) => Effect.succeed(acc + x)
        
        const result = await runEffect(foldEffect(0, folder)(items))
        
        expect(result).toBe(15)
      })

      it('should handle failing folder', async () => {
        const items = [1, 2, 3]
        const folder = (acc: number, x: number) => x === 2 ? Effect.fail('error') : Effect.succeed(acc + x)
        
        await expectEffect.toFailWith(foldEffect(0, folder)(items), 'error')
      })
    })
  })

  describe('Math utilities', () => {
    describe('safeDivide', () => {
      it('should return Some for valid division', () => {
        const result = safeDivide(10, 2)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrNull(result)).toBe(5)
      })

      it('should return None for division by zero', () => {
        const result = safeDivide(10, 0)
        expect(Option.isNone(result)).toBe(true)
      })

      it('should handle negative numbers', () => {
        const result = safeDivide(-10, 2)
        expect(Option.getOrNull(result)).toBe(-5)
      })
    })
  })

  describe('Combinators', () => {
    describe('constant', () => {
      it('should return constant function', () => {
        const constantFn = Combinators.constant(42)
        expect(constantFn()).toBe(42)
        expect(constantFn()).toBe(42) // Always returns same value
      })
    })

    describe('identity', () => {
      it('should return input unchanged', () => {
        expect(Combinators.identity(42)).toBe(42)
        expect(Combinators.identity('test')).toBe('test')
        expect(Combinators.identity(null)).toBe(null)
      })
    })

    describe('flip', () => {
      it('should flip function arguments', () => {
        const subtract = (a: number) => (b: number) => a - b
        const flipped = Combinators.flip(subtract)
        
        expect(subtract(10)(3)).toBe(7) // 10 - 3
        expect(flipped(3)(10)).toBe(7)  // 10 - 3 (args flipped)
      })
    })

    describe('curry', () => {
      it('should curry binary function', () => {
        const add = (a: number, b: number) => a + b
        const curried = Combinators.curry(add)
        
        expect(curried(5)(3)).toBe(8)
        expect(curried(10)(7)).toBe(17)
      })
    })

    describe('uncurry', () => {
      it('should uncurry curried function', () => {
        const curriedAdd = (a: number) => (b: number) => a + b
        const uncurried = Combinators.uncurry(curriedAdd)
        
        expect(uncurried(5, 3)).toBe(8)
        expect(uncurried(10, 7)).toBe(17)
      })
    })
  })

  describe('Functional namespace', () => {
    it('should export all utilities', () => {
      expect(typeof Functional.chunk).toBe('function')
      expect(typeof Functional.debounce).toBe('function')
      expect(typeof Functional.memoize).toBe('function')
      expect(typeof Functional.safeDivide).toBe('function')
      expect(typeof Functional.identity).toBe('function')
      expect(typeof Functional.constant).toBe('function')
    })

    it('should include all combinators', () => {
      expect(typeof Functional.flip).toBe('function')
      expect(typeof Functional.curry).toBe('function')
      expect(typeof Functional.uncurry).toBe('function')
    })
  })

  describe('JsonValue type', () => {
    it('should handle various JSON values in memoized functions', async () => {
      const jsonValues: JsonValue[] = [
        'string',
        42,
        true,
        null,
        [1, 2, 3],
        { key: 'value', nested: { prop: 123 } }
      ]

      const processor = (...args: JsonValue[]) => Effect.succeed(args.length)
      const memoized = memoize(processor)

      for (const value of jsonValues) {
        const result = await runEffect(memoized(value))
        expect(result).toBe(1)
      }
    })
  })

  describe('Integration tests', () => {
    it('should combine multiple utilities in complex pipeline', async () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      
      // Complex pipeline: chunk -> parallel processing -> filter -> fold
      const result = await runEffect(
        pipe(
          data,
          chunk(3),
          flatten,
          traverse(x => Effect.succeed(x * 2)), // Double each number
          Effect.flatMap(doubled => 
            filterEffect((x: number) => Effect.succeed(x > 10))(doubled)
          ),
          Effect.flatMap(filtered => 
            foldEffect(0, (acc: number, x: number) => Effect.succeed(acc + x))(filtered)
          )
        )
      )
      
      // Expected: [2,4,6,8,10,12,14,16,18,20] -> [12,14,16,18,20] -> 80
      expect(result).toBe(80)
    })

    it('should handle error propagation in complex pipeline', async () => {
      const data = [1, 2, 3, 4, 5]
      
      const pipeline = pipe(
        data,
        traverse(x => x === 3 ? Effect.fail('error at 3') : Effect.succeed(x * 2)),
        Effect.flatMap(doubled => 
          filterEffect((x: number) => Effect.succeed(x > 5))(doubled)
        )
      )
      
      await expectEffect.toFailWith(pipeline, 'error at 3')
    })
  })
})