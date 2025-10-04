import { Context, Effect, HashMap, Layer, Option, pipe } from 'effect'
import { materialByBlockId, materialCatalog } from './catalog'
import { BlockId, Material, MaterialError } from './types'

export interface MaterialRepository {
  readonly getByBlockId: (blockId: BlockId) => Effect.Effect<Material, MaterialError>
  readonly all: Effect.Effect<ReadonlyArray<Material>, never>
}

export const MaterialRepository = Context.GenericTag<MaterialRepository>('@minecraft/materials/MaterialRepository')

const notFound = (blockId: BlockId): MaterialError => MaterialError.MaterialNotFound({ blockId })

export const MaterialRepositoryLive: MaterialRepository = {
  getByBlockId: (blockId) =>
    pipe(
      HashMap.get(materialByBlockId, blockId),
      Option.match({
        onNone: () => Effect.fail(notFound(blockId)),
        onSome: (material) => Effect.succeed(material),
      })
    ),
  all: Effect.succeed(materialCatalog),
}

export const MaterialRepositoryLayer = Layer.succeed(MaterialRepository, MaterialRepositoryLive)
