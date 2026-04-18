import { Array as Arr, Effect, HashMap, Option, Ref } from 'effect'
import { Block, BlockType } from './block'
import { initialBlocks } from './blocks.config'

export { initialBlocks } from './blocks.config'

type BlockMap = HashMap.HashMap<BlockType, Block>

export class BlockRegistry extends Effect.Service<BlockRegistry>()(
  '@minecraft/domain/BlockRegistry',
  {
    effect: Effect.gen(function* () {
      // Build the initial registry immutably from the static block list — no loop needed
      const registryRef = yield* Ref.make<BlockMap>(
        HashMap.fromIterable(Arr.map(initialBlocks, (b) => [b.type, b] as [BlockType, Block]))
      )

      return {
        register: (block: Block): Effect.Effect<void, never> =>
          Ref.update(registryRef, (registry) => HashMap.set(registry, block.type, block)),
        get: (blockType: BlockType): Effect.Effect<Option.Option<Block>, never> =>
          Ref.get(registryRef).pipe(
            Effect.map((registry) => HashMap.get(registry, blockType))
          ),
        getAll: (): Effect.Effect<ReadonlyArray<Block>, never> =>
          Ref.get(registryRef).pipe(
            Effect.map((registry) => Arr.fromIterable(HashMap.values(registry)))
          ),
        dispose: (): Effect.Effect<void, never> =>
          Ref.set(registryRef, HashMap.empty<BlockType, Block>()),
      }
    }),
  }
) {}

export const BlockRegistryLive = BlockRegistry.Default
