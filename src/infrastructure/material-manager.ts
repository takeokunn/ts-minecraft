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
}

export class MaterialManager extends Context.Tag('app/MaterialManager')<MaterialManager, MaterialManager>() {}

// --- Service Implementation ---

const makeMaterialManager = Effect.acquireRelease(
  Effect.tryPromise({
    try: async () => {
      const textureLoader = new TextureLoader()
      const texture = await textureLoader.loadAsync('/texture/texture.png')
      texture.colorSpace = SRGBColorSpace
      texture.magFilter = NearestFilter
      texture.minFilter = NearestFilter
      const material = new MeshBasicMaterial({ map: texture })
      return { material, texture }
    },
    catch: (originalError) => new TextureLoadError({ path: '/texture/texture.png', originalError }),
  }),
  ({ material, texture }) =>
    Effect.sync(() => {
      texture.dispose()
      material.dispose()
    }),
)

export const MaterialManagerLive = Layer.scoped(
  MaterialManager,
  Effect.map(makeMaterialManager, ({ material }) => ({
    get: (_key: string) => Effect.succeed(material),
  })),
)
