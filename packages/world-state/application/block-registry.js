import { Array as Arr, Effect, HashMap, Ref } from 'effect';
import { initialBlocks } from '../domain/blocks.config';
export class BlockRegistry extends Effect.Service()('@minecraft/domain/BlockRegistry', {
    effect: Effect.gen(function* () {
        // Build the initial registry immutably from the static block list — no loop needed.
        const registryRef = yield* Ref.make(HashMap.fromIterable(Arr.map(initialBlocks, (b) => [b.type, b])));
        return {
            register: (block) => Ref.update(registryRef, (registry) => HashMap.set(registry, block.type, block)),
            get: (blockType) => Ref.get(registryRef).pipe(Effect.map((registry) => HashMap.get(registry, blockType))),
            getAll: () => Ref.get(registryRef).pipe(Effect.map((registry) => Arr.fromIterable(HashMap.values(registry)))),
            dispose: () => Ref.set(registryRef, HashMap.empty()),
        };
    }),
}) {
}
export const BlockRegistryLive = BlockRegistry.Default;
//# sourceMappingURL=block-registry.js.map