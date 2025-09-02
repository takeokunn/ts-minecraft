import { TextureLoader, MeshBasicMaterial, type Material, SRGBColorSpace, Texture, NearestFilter } from 'three'
import { Context, Effect, Layer } from 'effect'

// --- Error Type ---

export class TextureLoadError extends Error {
  readonly _tag = 'TextureLoadError'
  constructor(
    readonly path: string,
    readonly originalError: unknown,
  ) {
    super(`Failed to load texture: ${path}`, { cause: originalError })
    this.name = 'TextureLoadError'
  }
}

// --- Service Definition ---

export interface MaterialManager {
  readonly get: (key: string) => Effect.Effect<Material, TextureLoadError>
  readonly dispose: () => Effect.Effect<void>
}

export const MaterialManager = Context.GenericTag<MaterialManager>('app/MaterialManager')

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
  catch: (e) => new TextureLoadError('/texture/texture.png', e),
})

export const MaterialManagerLive = Layer.effect(MaterialManager, makeMaterialManager)
