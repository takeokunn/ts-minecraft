import { Schema } from 'effect';
import { TILE_MAP } from './block-texture-map.config';
export { TILE_MAP };
export const FaceDirSchema = Schema.Literal('top', 'bottom', 'side');
export const ATLAS_COLS = 16;
export const ATLAS_SIZE = 512;
export const HALF_TEXEL = 0.5 / ATLAS_SIZE;
export const getTileIndex = (blockId, faceDir) => TILE_MAP[blockId]?.[faceDir] ?? 0;
export const getTileUVs = (tileIndex) => {
    const col = tileIndex % ATLAS_COLS;
    const row = Math.floor(tileIndex / ATLAS_COLS);
    return {
        u0: col / ATLAS_COLS + HALF_TEXEL,
        v0: 1 - (row + 1) / ATLAS_COLS + HALF_TEXEL,
        u1: (col + 1) / ATLAS_COLS - HALF_TEXEL,
        v1: 1 - row / ATLAS_COLS - HALF_TEXEL,
    };
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/textures/block-texture-map.js.map