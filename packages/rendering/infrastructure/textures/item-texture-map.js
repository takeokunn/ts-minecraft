import { ITEM_TILE_MAP } from './item-texture-map.config';
export { ITEM_TILE_MAP };
export const ITEM_ATLAS_COLS = 16;
export const ITEM_ATLAS_SIZE = 512;
export const ITEM_HALF_TEXEL = 0.5 / ITEM_ATLAS_SIZE;
export const getItemTileIndex = (item) => ITEM_TILE_MAP[item];
export const getItemTileUVs = (tileIndex) => {
    const col = tileIndex % ITEM_ATLAS_COLS;
    const row = Math.floor(tileIndex / ITEM_ATLAS_COLS);
    return {
        u0: col / ITEM_ATLAS_COLS + ITEM_HALF_TEXEL,
        v0: 1 - (row + 1) / ITEM_ATLAS_COLS + ITEM_HALF_TEXEL,
        u1: (col + 1) / ITEM_ATLAS_COLS - ITEM_HALF_TEXEL,
        v1: 1 - row / ITEM_ATLAS_COLS - ITEM_HALF_TEXEL,
    };
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/textures/item-texture-map.js.map