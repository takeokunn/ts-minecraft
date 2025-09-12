import { describe, it, expect } from 'vitest'
import { Effect, Layer, Context, pipe } from 'effect'

describe('Effect-TS patterns used in main.ts and layers.ts', () => {
  describe('Effect composition patterns', () => {
    it('should demonstrate proper Effect chaining', async () => {
      // Test the Effect patterns used in main.ts
      const chainPattern = pipe(
        Effect.succeed(1),
        Effect.tap((value) => Effect.log(`Step 1: ${value}`)),
        Effect.flatMap((value) => Effect.succeed(value + 1)),
        Effect.tap((value) => Effect.log(`Step 2: ${value}`)),
      )
      
      const result = await Effect.runPromise(chainPattern)
      expect(result).toBe(2)
    })

    it('should handle concurrent execution patterns', async () => {
      // Test the concurrency pattern used in the game loop
      const tasks = [
        () => Effect.succeed('task1'),
        () => Effect.succeed('task2'),
        () => Effect.succeed('task3'),
      ]
      
      const concurrentPattern = Effect.forEach(
        tasks,
        (task) => task(),
        { concurrency: 'unbounded' }
      )
      
      const result = await Effect.runPromise(concurrentPattern)
      expect(result).toEqual(['task1', 'task2', 'task3'])
    })

    it('should handle error recovery patterns', async () => {
      // Test the error handling pattern used in game loop
      const testSystemSuccess = () => Effect.succeed(undefined)
      const testSystemFailure = () => Effect.fail(new Error('Test failure'))
      
      const systems = [testSystemSuccess, testSystemFailure, testSystemSuccess]
      
      // Simulate the same pattern as in gameLoop
      const gameLoopPattern = pipe(
        Effect.forEach(
          systems,
          (system) =>
            pipe(
              Effect.tryPromise(() => Effect.runPromise(system())),
              Effect.tapBoth({
                onSuccess: () => Effect.log(`System executed successfully`),
                onFailure: (error) => Effect.log(`System execution failed - ${error}`),
              }),
              Effect.orElse(() => Effect.succeed(undefined)),
            ),
          { concurrency: 'unbounded' },
        )
      )
      
      const result = await Effect.runPromiseExit(gameLoopPattern)
      
      // Should succeed despite individual system failure
      expect(result._tag).toBe('Success')
    })
  })

  describe('Layer composition patterns', () => {
    it('should work with Layer.succeed pattern', async () => {
      // Test basic layer patterns without complex dependencies
      const MockService = { test: () => 'working' }
      const TestTag = Context.GenericTag<typeof MockService>('TestService')
      
      const testLayer = Layer.succeed(TestTag, MockService)
      
      const testEffect = pipe(
        TestTag,
        Effect.map(service => service.test())
      )
      
      const result = await Effect.runPromise(
        pipe(testEffect, Effect.provide(testLayer))
      )
      
      expect(result).toBe('working')
    })

    it('should handle layer merging patterns', () => {
      // Test basic layer merging without complex dependencies
      const layer1 = Layer.empty
      const layer2 = Layer.empty
      
      expect(() => {
        Layer.mergeAll(layer1, layer2)
      }).not.toThrow()
      
      const merged = Layer.mergeAll(layer1, layer2)
      expect(Layer.isLayer(merged)).toBe(true)
    })

    it('should support nested layer composition', () => {
      // Test nested layer composition patterns
      const layer1 = Layer.empty
      const layer2 = Layer.empty
      const layer3 = Layer.empty
      
      const composed = Layer.mergeAll(
        layer1,
        Layer.mergeAll(layer2, layer3)
      )
      
      expect(Layer.isLayer(composed)).toBe(true)
    })
  })

  describe('Service context patterns', () => {
    it('should work with Context.GenericTag pattern', () => {
      // Test the Context.GenericTag pattern used for services
      interface MockServiceInterface {
        readonly operation: () => Effect.Effect<string>
      }
      
      const MockServiceTag = Context.GenericTag<MockServiceInterface>('MockService')
      
      expect(MockServiceTag).toBeDefined()
      expect(Context.isTag(MockServiceTag)).toBe(true)
    })

    it('should handle service dependencies', async () => {
      // Test service dependency patterns
      interface ServiceA {
        readonly getValue: () => string
      }
      
      interface ServiceB {
        readonly processValue: (value: string) => string
      }
      
      const ServiceATag = Context.GenericTag<ServiceA>('ServiceA')
      const ServiceBTag = Context.GenericTag<ServiceB>('ServiceB')
      
      const serviceA: ServiceA = { getValue: () => 'input' }
      const serviceB: ServiceB = { processValue: (value) => `processed-${value}` }
      
      const layerA = Layer.succeed(ServiceATag, serviceA)
      const layerB = Layer.succeed(ServiceBTag, serviceB)
      const combinedLayer = Layer.mergeAll(layerA, layerB)
      
      const testEffect = Effect.gen(function* () {
        const svcA = yield* ServiceATag
        const svcB = yield* ServiceBTag
        
        const value = svcA.getValue()
        return svcB.processValue(value)
      })
      
      const result = await Effect.runPromise(
        pipe(testEffect, Effect.provide(combinedLayer))
      )
      
      expect(result).toBe('processed-input')
    })

    it('should handle complex dependency graphs', async () => {
      // Test complex service dependency patterns
      interface ConfigService {
        readonly getConfig: () => { value: string }
      }
      
      interface DataService {
        readonly getData: () => Effect.Effect<string, never, ConfigService>
      }
      
      const ConfigServiceTag = Context.GenericTag<ConfigService>('ConfigService')
      const DataServiceTag = Context.GenericTag<DataService>('DataService')
      
      const configImpl: ConfigService = {
        getConfig: () => ({ value: 'config-data' })
      }
      
      const dataImpl: DataService = {
        getData: () => Effect.gen(function* () {
          const config = yield* ConfigServiceTag
          return `data-from-${config.getConfig().value}`
        })
      }
      
      const configLayer = Layer.succeed(ConfigServiceTag, configImpl)
      const dataLayer = Layer.succeed(DataServiceTag, dataImpl)
      
      // Data service depends on config service
      const appLayer = Layer.mergeAll(configLayer, dataLayer)
      
      const testEffect = Effect.gen(function* () {
        const dataService = yield* DataServiceTag
        return yield* dataService.getData()
      })
      
      const result = await Effect.runPromise(
        pipe(testEffect, Effect.provide(appLayer))
      )
      
      expect(result).toBe('data-from-config-data')
    })
  })

  describe('Error handling patterns', () => {
    it('should handle service provision failures gracefully', async () => {
      // Test service provision error handling
      const FailingService = Context.GenericTag<{ fail: () => Effect.Effect<never, Error> }>('FailingService')
      
      const failingImplementation = {
        fail: () => Effect.fail(new Error('Service intentionally failed'))
      }
      
      const failingLayer = Layer.succeed(FailingService, failingImplementation)
      
      const testEffect = pipe(
        FailingService,
        Effect.flatMap(service => service.fail())
      )
      
      const result = await Effect.runPromiseExit(
        pipe(testEffect, Effect.provide(failingLayer))
      )
      
      expect(result._tag).toBe('Failure')
    })

    it('should handle Effect.gen error patterns', async () => {
      const testEffect = Effect.gen(function* () {
        const value1 = yield* Effect.succeed(1)
        const value2 = yield* Effect.fail(new Error('intentional failure'))
        return value1 + value2
      })
      
      const result = await Effect.runPromiseExit(testEffect)
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Integration with Effect-TS ecosystem', () => {
    it('should work with Effect.gen patterns', async () => {
      // Test integration with Effect.gen
      const TestService = Context.GenericTag<{ compute: (x: number) => number }>('TestService')
      const testLayer = Layer.succeed(TestService, { compute: (x) => x * 2 })
      
      const computation = Effect.gen(function* () {
        const service = yield* TestService
        const result1 = service.compute(5)
        const result2 = service.compute(result1)
        return result2
      })
      
      const result = await Effect.runPromise(
        pipe(computation, Effect.provide(testLayer))
      )
      
      expect(result).toBe(20) // 5 * 2 * 2
    })

    it('should support Effect.provide patterns', async () => {
      // Test Effect.provide patterns used throughout the codebase
      const SimpleService = Context.GenericTag<{ msg: string }>('SimpleService')
      const simpleLayer = Layer.succeed(SimpleService, { msg: 'hello' })
      
      const effect1 = pipe(
        SimpleService,
        Effect.map(service => service.msg)
      )
      
      const effect2 = pipe(
        effect1,
        Effect.provide(simpleLayer)
      )
      
      const result = await Effect.runPromise(effect2)
      expect(result).toBe('hello')
    })
  })
})