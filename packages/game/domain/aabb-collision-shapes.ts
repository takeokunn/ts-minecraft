// Block collision-shape vocabulary: the AABB a block occupies within its cell,
// and the standard shapes (full cube, pressure plate, slab, cactus inset). The
// resolver in aabb-collision.ts consumes these via a BlockCollisionShapeFn.

export interface BlockCollisionShape {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
  readonly minZ: number
  readonly maxZ: number
}

export type BlockCollisionShapeFn = (bx: number, by: number, bz: number) => BlockCollisionShape | null

export const FULL_BLOCK_COLLISION_SHAPE: BlockCollisionShape = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
  minZ: 0,
  maxZ: 1,
}

export const PRESSURE_PLATE_COLLISION_HEIGHT = 1 / 16

export const PRESSURE_PLATE_COLLISION_SHAPE: BlockCollisionShape = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: PRESSURE_PLATE_COLLISION_HEIGHT,
  minZ: 0,
  maxZ: 1,
}

export const SLAB_COLLISION_HEIGHT = 1 / 2

export const SLAB_COLLISION_SHAPE: BlockCollisionShape = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: SLAB_COLLISION_HEIGHT,
  minZ: 0,
  maxZ: 1,
}

export const CACTUS_COLLISION_INSET = 1 / 16

export const CACTUS_COLLISION_SHAPE: BlockCollisionShape = {
  minX: CACTUS_COLLISION_INSET,
  maxX: 1 - CACTUS_COLLISION_INSET,
  minY: 0,
  maxY: 1,
  minZ: CACTUS_COLLISION_INSET,
  maxZ: 1 - CACTUS_COLLISION_INSET,
}
