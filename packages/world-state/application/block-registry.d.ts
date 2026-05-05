import { Effect, Option } from 'effect';
import { Block } from '../domain/block';
import { BlockType } from '@ts-minecraft/kernel';
declare const BlockRegistry_base: Effect.Service.Class<BlockRegistry, "@minecraft/domain/BlockRegistry", {
    readonly effect: Effect.Effect<{
        register: (block: Block) => Effect.Effect<void, never>;
        get: (blockType: BlockType) => Effect.Effect<Option.Option<Block>, never>;
        getAll: () => Effect.Effect<ReadonlyArray<Block>, never>;
        dispose: () => Effect.Effect<void, never>;
    }, never, never>;
}>;
export declare class BlockRegistry extends BlockRegistry_base {
}
export declare const BlockRegistryLive: import("effect/Layer").Layer<BlockRegistry, never, never>;
export {};
//# sourceMappingURL=block-registry.d.ts.map