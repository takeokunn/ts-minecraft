import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { RendererService, RendererServiceLive } from './renderer-service'

describe('three/renderer/renderer-service', () => {
  describe('RendererServiceLive', () => {
    it('should provide RendererService as Layer', () => {
      const layer = RendererServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it.effect('should have create, render, and resize methods', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        expect(typeof service.create).toBe('function')
        expect(typeof service.render).toBe('function')
        expect(typeof service.resize).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should create Effect for renderer creation', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Verify create returns an Effect
        const createEffect = service.create(null as any)
        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof createEffect).toBe('object')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should create Effect for render operation', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Verify render returns an Effect
        const renderEffect = service.render(null as any, null as any, null as any)
        expect(typeof renderEffect.pipe).toBe('function')
        expect(typeof renderEffect).toBe('object')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should create Effect for resize operation', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Verify resize returns an Effect
        const resizeEffect = service.resize(null as any, 100, 100)
        expect(typeof resizeEffect.pipe).toBe('function')
        expect(typeof resizeEffect).toBe('object')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should support multiple Effect compositions', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Compose multiple Effect operations
        const createEffect = service.create(null as any)
        const resizeEffect = service.resize(null as any, 1024, 768)
        const renderEffect = service.render(null as any, null as any, null as any)

        // Verify all have pipe method (indicating they're Effects)
        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof resizeEffect.pipe).toBe('function')
        expect(typeof renderEffect.pipe).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should support Effect.map on service methods', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        const result = service.resize(null as any, 100, 100).pipe(
          Effect.map(() => 'resized')
        )

        expect(typeof result.pipe).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should support Effect.flatMap on service methods', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        const result = service.create(null as any).pipe(
          Effect.flatMap((renderer) => service.resize(renderer, 1024, 768))
        )

        expect(typeof result.pipe).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )
  })
})
