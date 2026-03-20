// Domain exports
export * from './block'
export { BlockRegistry, BlockRegistryLive } from './block-registry'
export * from './errors'
export * from './item-stack'
export { ChunkService, CHUNK_SIZE, CHUNK_HEIGHT, BlockIndexError, blockIndex, setBlockInChunk, getBlocksBatch } from './chunk'
export type { ChunkCoord, Chunk } from './chunk'
export { PlayerHealth, PlayerHealthInvariant } from './player-health'
export { Recipe, RecipeIngredient } from './crafting'
