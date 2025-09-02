import { TextureLoader, MeshBasicMaterial, type Material, SRGBColorSpace, NearestFilter } from 'three'
import { Context, Data, Effect, Layer } from 'effect'

// --- Error Type ---

export class TextureLoadError extends Data.TaggedError('TextureLoadError')<{
  readonly path: string
  readonly originalError: unknown
}> {}

// --- Service Definition ---

export interface MaterialManager {
  readonly get: (key: string) => Effect.Effect<Material, TextureLoadError>
  readonly dispose: () => Effect.Effect<void>
}

export class MaterialManager extends Context.Tag('app/MaterialManager')<MaterialManager, MaterialManager>() {}

// --- Service Implementation ---

const makeMaterialManager = Effect.tryPromise({
  try: async () => {
    const textureLoader = new TextureLoader()
    const texture = await textureLoader.loadAsync('/texture/texture.png')
    texture.colorSpace = SRGBColorSpace
    // Use NearestFilter for crisp pixel art style textures
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    const material = new MeshBasicMaterial({ map: texture })

    const dispose = Effect.sync(() => {
      if (material.map) {
        material.map.dispose()
      }
      material.dispose()
    })

    return {
      get: (_key: string) => Effect.succeed(material),
      dispose: () => dispose,
    }
  },
  catch: (originalError) => new TextureLoadError({ path: '/texture/texture.png', originalError }),
})

export const MaterialManagerLive = Layer.effect(MaterialManager, makeMaterialManager)
