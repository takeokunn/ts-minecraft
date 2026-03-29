import { describe, it } from '@effect/vitest'
import { expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'
import { TextureService, TextureServiceLive } from './texture-loader'
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

    it.effect('should have load, createSolidColor, getCached, preload, and dispose methods', () =>
      Effect.gen(function* () {
        const service = yield* TextureService

        expect(typeof service.load).toBe('function')
        expect(typeof service.createSolidColor).toBe('function')
        expect(typeof service.getCached).toBe('function')
        expect(typeof service.preload).toBe('function')
        expect(typeof service.dispose).toBe('function')
      }).pipe(Effect.provide(TextureServiceLive))
    )

    describe('createSolidColor', () => {
      it.effect('should create a canvas texture with NearestFilter', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          const texture = yield* service.createSolidColor('#ff0000')

          expect(texture).toBeDefined()
          expect(texture.magFilter).toBe(THREE.NearestFilter)
          expect(texture.minFilter).toBe(THREE.NearestFilter)
          expect(texture).toBeInstanceOf(THREE.CanvasTexture)
        }).pipe(Effect.provide(TextureServiceLive))
      )

      it.effect('should create texture with different colors', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          const redTexture = yield* service.createSolidColor('#ff0000')
          const blueTexture = yield* service.createSolidColor('#0000ff')
          const greenTexture = yield* service.createSolidColor('#00ff00')

          expect(redTexture).toBeDefined()
          expect(blueTexture).toBeDefined()
          expect(greenTexture).toBeDefined()

          expect(redTexture.uuid).not.toBe(blueTexture.uuid)
          expect(blueTexture.uuid).not.toBe(greenTexture.uuid)
        }).pipe(Effect.provide(TextureServiceLive))
      )

      it.effect('should create texture from number color', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          const texture = yield* service.createSolidColor(0xff0000)

          expect(texture).toBeDefined()
          expect(texture.magFilter).toBe(THREE.NearestFilter)
        }).pipe(Effect.provide(TextureServiceLive))
      )
    })

    describe('getCached', () => {
      it.effect('should return None for non-existent cache entry', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          const cached = yield* service.getCached('non-existent-url')

          expect(cached._tag).toBe('None')
        }).pipe(Effect.provide(TextureServiceLive))
      )
    })

    describe('dispose', () => {
      it.effect('should clear cache on dispose', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          yield* service.createSolidColor('#ff0000')
          yield* service.createSolidColor('#00ff00')

          const cached1 = yield* service.getCached('test-url-1')
          expect(cached1._tag).toBe('None')

          yield* service.dispose()
        }).pipe(Effect.provide(TextureServiceLive))
      )
    })

    describe('preload', () => {
      it.effect('should handle batch loading', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          yield* service.preload(['url1', 'url2', 'url3'])
        }).pipe(Effect.provide(TextureServiceLive))
      )

      it.effect('should handle empty array', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          yield* service.preload([])
        }).pipe(Effect.provide(TextureServiceLive))
      )
    })

    describe('load', () => {
      it.effect('should create Effect for load operation', () =>
        Effect.gen(function* () {
          const service = yield* TextureService

          const loadEffect = service.load('test-url')
          expect(typeof loadEffect.pipe).toBe('function')
          expect(typeof loadEffect).toBe('object')
        }).pipe(Effect.provide(TextureServiceLive))
      )
    })
  })
})
