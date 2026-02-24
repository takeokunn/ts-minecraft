import { Effect, Context, Layer, Ref, Option } from 'effect'
import * as THREE from 'three'

export class TextureError {
  readonly _tag = 'TextureError'
  constructor(
    readonly message: string,
    readonly url?: string,
    readonly cause?: unknown
  ) {}
}

export interface TextureService {
  readonly load: (url: string) => Effect.Effect<THREE.Texture, TextureError>
  readonly createSolidColor: (color: string | number) => Effect.Effect<THREE.Texture, never>
  readonly getCached: (url: string) => Effect.Effect<Option.Option<THREE.Texture>, never>
  readonly preload: (urls: string[]) => Effect.Effect<void, TextureError>
  readonly dispose: () => Effect.Effect<void, never>
}

export const TextureService = Context.GenericTag<TextureService>(
  '@minecraft/infrastructure/TextureService'
)

export const TextureServiceLive = Layer.effect(
  TextureService,
  Effect.gen(function* () {
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
            new TextureError(`Failed to load texture from ${url}`, url, cause)
        }).pipe(
          Effect.tap((texture) =>
            Ref.update(textureCache, (cache) => new Map(cache).set(url, texture))
          )
        )
      })

    return TextureService.of({
      load: loadEffect,

      createSolidColor: (color) =>
        Effect.gen(function* () {
          const canvas = document.createElement('canvas')
          canvas.width = 64
          canvas.height = 64
          const context = canvas.getContext('2d')

          if (!context) {
            throw new Error('Failed to create canvas context')
          }

          context.fillStyle = typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`
          context.fillRect(0, 0, 64, 64)

          const texture = new THREE.CanvasTexture(canvas)
          texture.magFilter = THREE.NearestFilter
          texture.minFilter = THREE.NearestFilter

          return texture
        }),

      getCached: (url) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(textureCache)
          return Option.fromNullable(cache.get(url))
        }),

      preload: (urls) =>
        Effect.forEach(urls, (url) => Effect.ignore(loadEffect(url)), { concurrency: 'unbounded' }),

      dispose: () =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(textureCache)
          cache.forEach((texture) => texture.dispose())
          yield* Ref.set(textureCache, new Map())
        })
    })
  })
)
