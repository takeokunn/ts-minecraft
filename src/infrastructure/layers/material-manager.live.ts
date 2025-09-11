import { Layer, Effect, Ref, HashMap } from 'effect'
import { MaterialManager } from '@/services/rendering/material-manager'
import { BlockType } from '@/core/values/block-type'

/**
 * Production implementation of MaterialManager service
 */
export const MaterialManagerLive = Layer.effect(
  MaterialManager,
  Effect.gen(function* () {
    const materials = yield* Ref.make(HashMap.empty<BlockType, any>())
    const textures = yield* Ref.make(HashMap.empty<string, any>())
    
    return MaterialManager.of({
      getMaterial: (blockType) => 
        Ref.get(materials).pipe(
          Effect.map(m => HashMap.get(m, blockType))
        ),
      
      loadTexture: (path) =>
        Effect.succeed(undefined),
      
      createMaterial: (blockType) =>
        Effect.succeed(undefined)
    })
  })
)