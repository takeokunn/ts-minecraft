import { TILE_SIZE, UV_MAPPINGS } from '@/domain/block'
import { Effect, Layer, Ref } from 'effect'
import { TextureLoader, MeshBasicMaterial, NearestFilter, SRGBColorSpace, Texture } from 'three'

export class TextureLoadError extends Effect.Tag('TextureLoadError')<
  TextureLoadError,
  {
    readonly cause: unknown
  }
>() {}

const createTexture = (url: string) =>
  Effect.async<Texture, TextureLoadError>((resume) => {
    new TextureLoader().load(
      url,
      (texture) => {
        texture.magFilter = NearestFilter
        texture.colorSpace = SRGBColorSpace
        resume(Effect.succeed(texture))
      },
      undefined,
      (err) => {
        resume(Effect.fail(new TextureLoadError({ cause: err })))
      },
    )
  })

const makeMaterialManager = Effect.gen(function* ($) {
  const texture = yield* $(createTexture('/texture/texture-atlas.png'))
  const material = new MeshBasicMaterial({
    map: texture,
    alphaTest: 0.1,
    transparent: true,
  })
  const uvCache = yield* $(Ref.make(new Map(Object.entries(UV_MAPPINGS).map(([key, value]) => [key, value]))))
  const getUvForFace = (faceName: string) =>
    Ref.get(uvCache).pipe(Effect.map((cache) => cache.get(faceName) ?? [0, 0]))

  return {
    material,
    getUvForFace,
    getUv: (x: number, y: number) => [x * TILE_SIZE, y * TILE_SIZE] as const,
  }
})

export interface MaterialManager {
  readonly get: (_key: string) => Effect.Effect<MeshBasicMaterial>
}

export const MaterialManager = Effect.Tag<MaterialManager>()

export const MaterialManagerLive = Layer.scoped(
  MaterialManager,
  Effect.map(makeMaterialManager, ({ material }) =>
    MaterialManager.of({
      get: (_key: string) => Effect.succeed(material),
    }),
  ),
)