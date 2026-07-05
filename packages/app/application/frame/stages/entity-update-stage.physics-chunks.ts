// The chunk-cache neighborhood that entity physics samples each frame, and the
// missing-chunk guard. Split out of entity-update-stage.ts as a self-contained
// concern (spatial cache layout, independent of the entity update itself).

// 7x7 chunk neighborhood (radius 3 = 48 blocks) so entity physics covers the
// full 16-40 block mob spawn band. The old 3x3 (radius 1 = 16 blocks) left
// most spawned mobs outside the cache, where the terrain read as air and they
// fell to bedrock (the y=0.9 pile-up).
export const ENTITY_PHYSICS_CHUNK_RADIUS = 3
const ENTITY_PHYSICS_CHUNK_SIDE = ENTITY_PHYSICS_CHUNK_RADIUS * 2 + 1

export const ENTITY_PHYSICS_CHUNK_OFFSETS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const offsets: Array<readonly [number, number, number]> = []
  for (let dx = -ENTITY_PHYSICS_CHUNK_RADIUS; dx <= ENTITY_PHYSICS_CHUNK_RADIUS; dx++) {
    for (let dz = -ENTITY_PHYSICS_CHUNK_RADIUS; dz <= ENTITY_PHYSICS_CHUNK_RADIUS; dz++) {
      offsets.push([
        dx,
        dz,
        (dx + ENTITY_PHYSICS_CHUNK_RADIUS) * ENTITY_PHYSICS_CHUNK_SIDE + (dz + ENTITY_PHYSICS_CHUNK_RADIUS),
      ] as const)
    }
  }
  return offsets
})()

// True if any slot in the entity-physics chunk cache is still unloaded.
export const hasMissingPhysicsChunk = (chunkCache: ReadonlyArray<unknown>): boolean => {
  for (let i = 0; i < chunkCache.length; i++) {
    if (chunkCache[i] == null) return true
  }
  return false
}
