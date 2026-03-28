import { Effect, Ref, Option, HashMap, Array as Arr } from 'effect'
import * as THREE from 'three'
import { TextureError } from '@/domain'
import { TextureUrl } from '@/shared/kernel'

export class TextureService extends Effect.Service<TextureService>()(
  '@minecraft/infrastructure/three/TextureService',
  {
    effect: Effect.gen(function* () {
      const textureCache = yield* Ref.make(HashMap.empty<TextureUrl, THREE.Texture>())

      const loadEffect = (url: string) => {
        const textureUrl = TextureUrl.make(url)
        return Effect.gen(function* () {
          return yield* Option.match(HashMap.get(yield* Ref.get(textureCache), textureUrl), {
            onSome: Effect.succeed,
            onNone: () => Effect.tryPromise({
              try: async () => {
                const loader = new THREE.TextureLoader()
                const texture = await loader.loadAsync(url)
                texture.magFilter = THREE.NearestFilter
                texture.minFilter = THREE.NearestFilter
                texture.wrapS = THREE.RepeatWrapping
                texture.wrapT = THREE.RepeatWrapping
                return texture
              },
              catch: (cause) => new TextureError({ url, cause }),
            }).pipe(
              Effect.tap((texture) =>
                Ref.update(textureCache, (cache) => HashMap.set(cache, textureUrl, texture))
              )
            ),
          })
        })
      }

      return {
        load: loadEffect,

        createSolidColor: (color: string | number): Effect.Effect<THREE.Texture, TextureError> =>
          Effect.gen(function* () {
            const result = yield* Effect.sync(() => {
              const canvas = document.createElement('canvas')
              canvas.width = 64
              canvas.height = 64
              const context = canvas.getContext('2d')
              return { canvas, context }
            })

            const { canvas, context } = result
            if (!context) {
              return yield* Effect.fail(new TextureError({ url: 'solid-color-canvas', cause: 'Failed to create canvas context' }))
            }

            return yield* Effect.sync(() => {
              context.fillStyle = typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`
              context.fillRect(0, 0, 64, 64)

              const texture = new THREE.CanvasTexture(canvas)
              texture.magFilter = THREE.NearestFilter
              texture.minFilter = THREE.NearestFilter
              return texture
            })
          }),

        getCached: (url: string): Effect.Effect<Option.Option<THREE.Texture>, never> =>
          Ref.get(textureCache).pipe(Effect.map((cache) => HashMap.get(cache, TextureUrl.make(url)))),

        preload: (urls: ReadonlyArray<string>): Effect.Effect<void, never> =>
          Effect.forEach(urls, (url) => Effect.ignore(loadEffect(url)), { concurrency: 'unbounded' }),

        dispose: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(textureCache)
            yield* Effect.sync(() => {
              Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (texture) => texture.dispose())
            })
            yield* Ref.set(textureCache, HashMap.empty())
          }),
      }
    }),
  }
) {}
export const TextureServiceLive = TextureService.Default
