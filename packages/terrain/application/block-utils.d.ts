import { Option } from 'effect';
import type { ChunkCoord } from '@ts-minecraft/kernel';
import type { BlockType, InventoryItem, Position } from '@ts-minecraft/kernel';
export declare const worldToBlockLocal: (pos: Position) => {
    chunkCoord: ChunkCoord;
    lx: number;
    lz: number;
};
export declare const canHarvestBlock: (blockType: BlockType, selectedTool: Option.Option<InventoryItem>) => boolean;
export declare const blockOverlapsPlayer: (blockPos: Position, playerFeetPos: Position) => boolean;
//# sourceMappingURL=block-utils.d.ts.map