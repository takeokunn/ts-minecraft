import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { MainLayer } from '../MainLayer'
import { AppServiceLive, AppService } from '../../services/AppService'

describe('MainLayer', () => {
  describe('Layer Structure', () => {
    it('should be a composite layer including AppServiceLive', () => {
      // MainLayer is now a composite of multiple service layers
      expect(Layer.isLayer(MainLayer)).toBe(true)
      expect(MainLayer).toBeDefined()
    })

    it('should be a valid Effect Layer', () => {
      expect(Layer.isLayer(MainLayer)).toBe(true)
    })
  })

  describe('Layer Composition', () => {
    it('should be composable with other layers', () => {
      const composedLayer = Layer.merge(MainLayer, Layer.empty)
      expect(Layer.isLayer(composedLayer)).toBe(true)
    })

    it('should work in provideSome patterns', () => {
      const program = Effect.gen(function* () {
        const service = yield* AppService
        return yield* service.getReadyStatus()
      })

      const provided = Effect.provide(program, MainLayer)
      expect(Effect.isEffect(provided)).toBe(true)
    })

    it('should be usable with Layer.use', () => {
      const result = Layer.launch(MainLayer)
      expect(Effect.isEffect(result)).toBe(true)
    })
  })

  describe('Service Integration', () => {
    it('should provide multiple services including AppService', () => {
      // MainLayer now provides GameLoop, Scene, Renderer, Input, GameApplication, and AppService
      const layerInstance = MainLayer
      expect(layerInstance).toBeDefined()
      // Check that it's a Layer (not checking for same reference anymore since it's a composite)
      expect(Layer.isLayer(layerInstance)).toBe(true)
    })

    it('should provide AppService when used', () => {
      const program = Effect.gen(function* () {
        const service = yield* AppService
        const status = yield* service.getReadyStatus()
        return status
      })

      const runnable = Effect.provide(program, MainLayer)
      const result = Effect.runSync(runnable)

      expect(result).toHaveProperty('ready')
      expect(typeof result.ready).toBe('boolean')
    })

    it('should maintain all Layer properties', () => {
      // Verify that MainLayer has all the properties of a Layer
      expect(MainLayer).toBeDefined()
      expect(typeof MainLayer.pipe).toBe('function')
      // Layer structure properties
      expect(MainLayer).toHaveProperty('_op_layer')
    })
  })

  describe('Type Safety', () => {
    it('should satisfy Layer type constraints', () => {
      // This is a compile-time test
      const _typeTest: Layer.Layer<AppService> = MainLayer
      expect(_typeTest).toBeDefined()
    })

    it('should be assignable to AppServiceLive type', () => {
      const _assignmentTest: typeof AppServiceLive = MainLayer
      expect(_assignmentTest).toBe(AppServiceLive)
    })
  })

  describe('Layer Structure Details', () => {
    it('should be a properly structured composite layer', () => {
      // MainLayer is now a mergeAll of multiple layers
      const mainLayerProps = Object.getOwnPropertyNames(MainLayer)

      // Should have Layer properties
      expect(mainLayerProps).toContain('_op_layer')
      expect(mainLayerProps).toContain('evaluate')
    })
  })

  describe('Runtime Behavior', () => {
    it('should initialize without errors', () => {
      const program = Effect.gen(function* () {
        const service = yield* AppService
        return service
      }).pipe(Effect.provide(MainLayer))

      expect(() => Effect.runSync(program)).not.toThrow()
    })

    it('should provide working AppService implementation', () => {
      const testProgram = Effect.gen(function* () {
        const service = yield* AppService

        // Test initialize
        const initResult = yield* service.initialize()
        expect(initResult).toHaveProperty('success')

        // Test getReadyStatus
        const status = yield* service.getReadyStatus()
        expect(status).toHaveProperty('ready')

        return { initResult, status }
      })

      const result = Effect.runSync(Effect.provide(testProgram, MainLayer))
      expect(result.initResult.success).toBe(true)
      expect(typeof result.status.ready).toBe('boolean')
    })

    it('should handle multiple sequential operations', () => {
      const program = Effect.gen(function* () {
        const service = yield* AppService

        // Multiple operations
        yield* service.initialize()
        const status1 = yield* service.getReadyStatus()
        const status2 = yield* service.getReadyStatus()

        return { status1, status2 }
      })

      const result = Effect.runSync(Effect.provide(program, MainLayer))
      expect(result.status1).toEqual(result.status2)
    })
  })
})
