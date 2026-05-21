import { HashSet, Option } from 'effect';
import { CHUNK_SIZE, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/kernel';
import { DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, IRON_PICKAXE_HARVESTABLE_BLOCKS, STONE_PICKAXE_HARVESTABLE_BLOCKS, WOODEN_PICKAXE_HARVESTABLE_BLOCKS, } from './harvestable-blocks';
// Double-modulo handles negative coordinates correctly.
export const worldToBlockLocal = (pos) => {
    const cx = Math.floor(pos.x / CHUNK_SIZE);
    const cz = Math.floor(pos.z / CHUNK_SIZE);
    const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { chunkCoord: { x: cx, z: cz }, lx, lz };
};
const PICKAXE_HARVEST_SETS = {
    DIAMOND_PICKAXE: DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
    IRON_PICKAXE: IRON_PICKAXE_HARVESTABLE_BLOCKS,
    STONE_PICKAXE: STONE_PICKAXE_HARVESTABLE_BLOCKS,
    WOODEN_PICKAXE: WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
};
const isPickaxeTool = (item) => item === 'DIAMOND_PICKAXE' ||
    item === 'IRON_PICKAXE' ||
    item === 'STONE_PICKAXE' ||
    item === 'WOODEN_PICKAXE';
export const canHarvestBlock = (blockType, selectedTool) => Option.match(selectedTool, {
    onNone: () => !HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, blockType),
    onSome: (tool) => {
        if (!isPickaxeTool(tool))
            return !HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, blockType);
        return HashSet.has(PICKAXE_HARVEST_SETS[tool], blockType);
    },
});
// Player AABB centered at (feet.x, feet.y+HALF_HEIGHT, feet.z); block is unit cube centered at (pos+0.5).
export const blockOverlapsPlayer = (blockPos, playerFeetPos) => {
    const playerCenterY = playerFeetPos.y + PLAYER_HALF_HEIGHT;
    const blockHalf = 0.5;
    return (Math.abs(blockPos.x + blockHalf - playerFeetPos.x) < blockHalf + PLAYER_HALF_WIDTH &&
        Math.abs(blockPos.y + blockHalf - playerCenterY) < blockHalf + PLAYER_HALF_HEIGHT &&
        Math.abs(blockPos.z + blockHalf - playerFeetPos.z) < blockHalf + PLAYER_HALF_WIDTH);
};
//# sourceMappingURL=../../../dist/packages/terrain/application/block-utils.js.map