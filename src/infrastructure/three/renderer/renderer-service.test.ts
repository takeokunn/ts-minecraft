import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { RendererService, RendererServiceLive } from './renderer-service'

describe('three/renderer/renderer-service', () => {
  describe('RendererServiceLive', () => {
    it('should provide RendererService as Layer', () => {
      const layer = RendererServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have create, render, and resize methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        expect(typeof service.create).toBe('function')
        expect(typeof service.render).toBe('function')
        expect(typeof service.resize).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should create Effect for renderer creation', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Verify create returns an Effect
        const createEffect = service.create(null as any)
        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof createEffect).toBe('object')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should create Effect for render operation', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Verify render returns an Effect
        const renderEffect = service.render(null as any, null as any, null as any)
        expect(typeof renderEffect.pipe).toBe('function')
        expect(typeof renderEffect).toBe('object')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should create Effect for resize operation', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Verify resize returns an Effect
        const resizeEffect = service.resize(null as any, 100, 100)
        expect(typeof resizeEffect.pipe).toBe('function')
        expect(typeof resizeEffect).toBe('object')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should support multiple Effect compositions', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Compose multiple Effect operations
        const createEffect = service.create(null as any)
        const resizeEffect = service.resize(null as any, 1024, 768)
        const renderEffect = service.render(null as any, null as any, null as any)

        // Verify all have pipe method (indicating they're Effects)
        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof resizeEffect.pipe).toBe('function')
        expect(typeof renderEffect.pipe).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should support Effect.map on service methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        const result = service.resize(null as any, 100, 100).pipe(
          Effect.map(() => 'resized')
        )

        expect(typeof result.pipe).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should support Effect.flatMap on service methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        const result = service.create(null as any).pipe(
          Effect.flatMap((renderer) => service.resize(renderer, 1024, 768))
        )

        expect(typeof result.pipe).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(RendererServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })
})
