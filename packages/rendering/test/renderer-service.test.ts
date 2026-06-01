import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'
import { RendererService, RendererServiceLive } from '@ts-minecraft/rendering'

const makeCanvas = (): HTMLCanvasElement =>
  ({
    width: 0,
    height: 0,
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as HTMLCanvasElement

const makeRenderer = (): THREE.WebGLRenderer =>
  Object.create(THREE.WebGLRenderer.prototype) as THREE.WebGLRenderer

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
        const createEffect = service.create(makeCanvas())
        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof createEffect).toBe('object')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should create Effect for render operation', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Verify render returns an Effect
        const renderEffect = service.render(makeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera())
        expect(typeof renderEffect.pipe).toBe('function')
        expect(typeof renderEffect).toBe('object')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should create Effect for resize operation', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Verify resize returns an Effect
        const resizeEffect = service.resize(makeRenderer(), 100, 100)
        expect(typeof resizeEffect.pipe).toBe('function')
        expect(typeof resizeEffect).toBe('object')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should support multiple Effect compositions', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        // Compose multiple Effect operations
        const createEffect = service.create(makeCanvas())
        const resizeEffect = service.resize(makeRenderer(), 1024, 768)
        const renderEffect = service.render(makeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera())

        // Verify all have pipe method (indicating they're Effects)
        expect(typeof createEffect.pipe).toBe('function')
        expect(typeof resizeEffect.pipe).toBe('function')
        expect(typeof renderEffect.pipe).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should support Effect.map on service methods', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        const result = service.resize(makeRenderer(), 100, 100).pipe(
          Effect.map(() => 'resized')
        )

        expect(typeof result.pipe).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )

    it.effect('should support Effect.flatMap on service methods', () =>
      Effect.gen(function* () {
        const service = yield* RendererService

        const result = service.create(makeCanvas()).pipe(
          Effect.flatMap((renderer) => service.resize(renderer, 1024, 768))
        )

        expect(typeof result.pipe).toBe('function')
      }).pipe(Effect.provide(RendererServiceLive))
    )
  })
})
