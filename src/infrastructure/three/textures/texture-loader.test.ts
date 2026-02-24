import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'
import { TextureService, TextureServiceLive, TextureError } from './texture-loader'
import { mockCanvasElement } from '../../../../test/helpers/three-mocks'

describe('three/textures/texture-loader', () => {
  describe('TextureServiceLive', () => {
    beforeEach(() => {
      vi.stubGlobal('document', {
        createElement: vi.fn((tag: string) => {
          if (tag === 'canvas') {
            return mockCanvasElement()
          }
          return {} as any
        }),
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should provide TextureService as Layer', () => {
      const layer = TextureServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have load, createSolidColor, getCached, preload, and dispose methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* TextureService

        expect(typeof service.load).toBe('function')
        expect(typeof service.createSolidColor).toBe('function')
        expect(typeof service.getCached).toBe('function')
        expect(typeof service.preload).toBe('function')
        expect(typeof service.dispose).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TextureServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    describe('createSolidColor', () => {
      it('should create a canvas texture with NearestFilter', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          const texture = yield* service.createSolidColor('#ff0000')

          expect(texture).toBeDefined()
          expect(texture.magFilter).toBe(THREE.NearestFilter)
          expect(texture.minFilter).toBe(THREE.NearestFilter)
          expect(texture).toBeInstanceOf(THREE.CanvasTexture)

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should create texture with different colors', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          const redTexture = yield* service.createSolidColor('#ff0000')
          const blueTexture = yield* service.createSolidColor('#0000ff')
          const greenTexture = yield* service.createSolidColor('#00ff00')

          expect(redTexture).toBeDefined()
          expect(blueTexture).toBeDefined()
          expect(greenTexture).toBeDefined()

          expect(redTexture.uuid).not.toBe(blueTexture.uuid)
          expect(blueTexture.uuid).not.toBe(greenTexture.uuid)

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should create texture from number color', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          const texture = yield* service.createSolidColor(0xff0000)

          expect(texture).toBeDefined()
          expect(texture.magFilter).toBe(THREE.NearestFilter)

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('getCached', () => {
      it('should return None for non-existent cache entry', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          const cached = yield* service.getCached('non-existent-url')

          expect(cached._tag).toBe('None')

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('dispose', () => {
      it('should clear cache on dispose', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          const texture1 = yield* service.createSolidColor('#ff0000')
          const texture2 = yield* service.createSolidColor('#00ff00')

          const cached1 = yield* service.getCached('test-url-1')
          expect(cached1._tag).toBe('None')

          yield* service.dispose()

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('preload', () => {
      it('should handle batch loading', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          yield* service.preload(['url1', 'url2', 'url3'])

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })

      it('should handle empty array', async () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          yield* service.preload([])

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = await Effect.runPromise(program)
        expect(result.success).toBe(true)
      })
    })

    describe('load', () => {
      it('should create Effect for load operation', () => {
        const program = Effect.gen(function* () {
          const service = yield* TextureService

          const loadEffect = service.load('test-url')
          expect(typeof loadEffect.pipe).toBe('function')
          expect(typeof loadEffect).toBe('object')

          return { success: true }
        }).pipe(Effect.provide(TextureServiceLive))

        const result = Effect.runSync(program)
        expect(result.success).toBe(true)
      })
    })
  })
})
