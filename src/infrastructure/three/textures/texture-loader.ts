import { Effect, Ref, Option } from 'effect'
import * as THREE from 'three'
import { TextureError } from '@/domain'

export class TextureService extends Effect.Service<TextureService>()(
  '@minecraft/infrastructure/TextureService',
  {
    effect: Effect.gen(function* () {
      const textureCache = yield* Ref.make<Map<string, THREE.Texture>>(new Map())

      const loadEffect = (url: string) =>
        Effect.gen(function* () {
          const cached = yield* Ref.get(textureCache)
          if (cached.has(url)) {
            return cached.get(url)!
          }

          return yield* Effect.tryPromise({
            try: async () => {
              const loader = new THREE.TextureLoader()
              const texture = await loader.loadAsync(url)
              texture.magFilter = THREE.NearestFilter
              texture.minFilter = THREE.NearestFilter
              texture.wrapS = THREE.RepeatWrapping
              texture.wrapT = THREE.RepeatWrapping
              return texture
            },
            catch: (cause) =>
              new TextureError({ url, cause })
          }).pipe(
            Effect.tap((texture) =>
              Ref.update(textureCache, (cache) => new Map(cache).set(url, texture))
            )
          )
        })

      return {
        load: loadEffect,

        createSolidColor: (color: string | number): Effect.Effect<THREE.Texture, TextureError> =>
          Effect.gen(function* () {
            const canvas = document.createElement('canvas')
            canvas.width = 64
            canvas.height = 64
            const context = canvas.getContext('2d')

            if (!context) {
              return yield* Effect.fail(new TextureError({ url: 'solid-color-canvas', cause: 'Failed to create canvas context' }))
            }

            context.fillStyle = typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`
            context.fillRect(0, 0, 64, 64)

            const texture = new THREE.CanvasTexture(canvas)
            texture.magFilter = THREE.NearestFilter
            texture.minFilter = THREE.NearestFilter

            return texture
          }),

        getCached: (url: string): Effect.Effect<Option.Option<THREE.Texture>, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(textureCache)
            return Option.fromNullable(cache.get(url))
          }),

        preload: (urls: string[]): Effect.Effect<void, never> =>
          Effect.forEach(urls, (url) => Effect.ignore(loadEffect(url)), { concurrency: 'unbounded' }),

        dispose: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(textureCache)
            cache.forEach((texture) => texture.dispose())
            yield* Ref.set(textureCache, new Map())
          }),
      }
    }),
  }
) {}
export const TextureServiceLive = TextureService.Default
