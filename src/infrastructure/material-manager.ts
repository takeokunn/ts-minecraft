import { getUvForFace, TILE_SIZE } from '@/domain/block'
import { Context, Data, Effect, Layer } from 'effect'
import { MeshBasicMaterial, NearestFilter, SRGBColorSpace, Texture, TextureLoader } from 'three'

export class TextureLoadError extends Data.TaggedError('TextureLoadError')<{
  readonly path: string
  readonly originalError: unknown
}> {}

const createTexture = (path: string) => {
  return Effect.async<Texture, TextureLoadError>((resume) => {
    new TextureLoader().load(
      path,
      (texture) => {
        texture.magFilter = NearestFilter
        texture.colorSpace = SRGBColorSpace
        resume(Effect.succeed(texture))
      },
      undefined,
      (error) => {
        resume(Effect.fail(new TextureLoadError({ path, originalError: error })))
      },
    )
  })
}

const makeMaterialManager = Effect.gen(function* (_) {
  const texture = yield* _(createTexture('/texture/texture.png'))
  const material = new MeshBasicMaterial({
    map: texture,
    alphaTest: 0.1,
    transparent: true,
  })

  return {
    material,
    getUv: (blockType: any, faceName: any) => {
      const [u, v] = getUvForFace(blockType, faceName)
      return [u * TILE_SIZE, v * TILE_SIZE] as const
    },
    dispose: () => Effect.sync(() => material.dispose()),
  }
})

export interface MaterialManager {
  readonly get: (key: string) => Effect.Effect<MeshBasicMaterial, never>
  readonly getUv: (
    blockType: any,
    faceName: any,
  ) => readonly [number, number]
  readonly dispose: () => Effect.Effect<void>
}

export const MaterialManager = Context.Tag<MaterialManager>('MaterialManager')

export const MaterialManagerLive = Layer.scoped(
  MaterialManager,
  Effect.gen(function* (_) {
    const manager = yield* _(makeMaterialManager)
    return {
      get: (_key: string) => Effect.succeed(manager.material.clone()),
      getUv: manager.getUv,
      dispose: manager.dispose,
    }
  }),
)
