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
    
    return MaterialManager.of({
      getMaterial: (blockType: BlockType) => 
        Ref.get(materials).pipe(
          Effect.map(m => HashMap.get(m, blockType))
        ),
      
      loadTexture: () =>
        Effect.succeed(undefined),
      
      createMaterial: () =>
        Effect.succeed(undefined)
    })
  })
)