// @effect-boundary Three.js TextureLoader exposes Promise/callback APIs; this adapter wraps them in Effect.
import { Effect, Ref, Option, HashMap } from 'effect'
import * as THREE from 'three'
import { TextureError } from '../../domain/errors'
import { TextureUrl } from '@ts-minecraft/core'

export class TextureService extends Effect.Service<TextureService>()(
  '@minecraft/infrastructure/three/TextureService',
  {
    effect: Effect.gen(function* () {
      const textureCache = yield* Ref.make(HashMap.empty<TextureUrl, THREE.Texture>())
      const loadEffect = (url: string) => {
        const textureUrl = TextureUrl.make(url)
        return Effect.gen(function* () {
          const cached = Option.getOrNull(HashMap.get(yield* Ref.get(textureCache), textureUrl))
          if (cached !== null) return cached
          const texture = yield* Effect.tryPromise({
            try: async () => {
              const loader = new THREE.TextureLoader()
              const loaded = await loader.loadAsync(url)
              loaded.magFilter = THREE.NearestFilter
              loaded.minFilter = THREE.NearestFilter
              loaded.generateMipmaps = false
              loaded.wrapS = THREE.RepeatWrapping
              loaded.wrapT = THREE.RepeatWrapping
              // The textures loaded here (notably /textures/atlas.png for the hotbar) are
              // sRGB-encoded color images. With renderer.outputColorSpace = SRGBColorSpace,
              // an untagged texture is treated as linear and skips the sRGB→linear decode,
              // so the SAME atlas rendered in the hotbar would mismatch the world blocks
              // (buildAtlasTexture sets this; this path previously did not). Keep them in sync.
              loaded.colorSpace = THREE.SRGBColorSpace
              return loaded
            },
            catch: (cause) => new TextureError({ url, cause }),
          })
          const cache = yield* Ref.get(textureCache)
          yield* Ref.set(textureCache, HashMap.set(cache, textureUrl, texture))
          return texture
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
              texture.generateMipmaps = false
              // Canvas holds an sRGB-encoded fill color; tag it so it round-trips correctly
              // under renderer.outputColorSpace = SRGBColorSpace (consistent with load()).
              texture.colorSpace = THREE.SRGBColorSpace
              return texture
            })
          }),

        getCached: (url: string): Effect.Effect<Option.Option<THREE.Texture>, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(textureCache)
            return HashMap.get(cache, TextureUrl.make(url))
          }),

        preload: (urls: ReadonlyArray<string>): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            for (const url of urls) {
              yield* Effect.ignore(loadEffect(url))
            }
          }),

        dispose: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const cache = yield* Ref.get(textureCache)
            yield* Effect.sync(() => {
              for (const texture of HashMap.values(cache)) texture.dispose()
            })
            yield* Ref.set(textureCache, HashMap.empty())
          }),
      }
    }),
  }
) {}
