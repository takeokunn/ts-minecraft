import { ChunkCacheKey } from '@ts-minecraft/kernel';
export const nowMs = () => 
/* c8 ignore next */
typeof performance !== 'undefined' ? performance.now() : Date.now();
export const chunkKey = (coord) => ChunkCacheKey.make(coord);
// Only dispose geometry; materials may be shared across chunk meshes
export const disposeMesh = (mesh) => {
    mesh.geometry.dispose();
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/renderer/world-renderer-utils.js.map