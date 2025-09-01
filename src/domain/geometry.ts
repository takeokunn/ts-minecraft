import type { Collider, Position } from './components';

export type Vector3 = readonly [number, number, number];
export type Vector2 = readonly [number, number];

/**
 * An Axis-Aligned Bounding Box, defined by its minimum and maximum corners.
 */
export type AABB = {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
};

/**
 * Creates an AABB from an entity's position and collider components.
 * @param position The entity's position.
 * @param collider The entity's collider.
 * @returns A new AABB object.
 */
export const createAABB = (
  position: Position,
  collider: Collider,
): AABB => ({
  minX: position.x - collider.width / 2,
  minY: position.y, // Player's origin is at their feet
  minZ: position.z - collider.depth / 2,
  maxX: position.x + collider.width / 2,
  maxY: position.y + collider.height,
  maxZ: position.z + collider.depth / 2,
});

/**
 * Checks if two AABBs are intersecting.
 * @param a The first AABB.
 * @param b The second AABB.
 * @returns True if they intersect, false otherwise.
 */
export const areAABBsIntersecting = (a: AABB, b: AABB): boolean => {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
};

/**
 * Calculates the minimum translation vector (MTV) to resolve a collision between two AABBs.
 * This function is currently not used in the collision system but is kept for potential future use.
 * @param a The first AABB.
 * @param b The second AABB.
 * @returns The MTV as a 3D vector.
 */
export const getIntersectionDepth = (a: AABB, b: AABB): Vector3 => {
  if (!areAABBsIntersecting(a, b)) {
    return [0, 0, 0];
  }

  const overlaps = [
    { axis: 0, value: a.maxX - b.minX, sign: -1 }, // Push left
    { axis: 0, value: b.maxX - a.minX, sign: 1 }, // Push right
    { axis: 1, value: a.maxY - b.minY, sign: -1 }, // Push down
    { axis: 1, value: b.maxY - a.minY, sign: 1 }, // Push up
    { axis: 2, value: a.maxZ - b.minZ, sign: -1 }, // Push back
    { axis: 2, value: b.maxZ - a.minZ, sign: 1 }, // Push forward
  ];

  const minOverlap = overlaps.reduce((min, current) =>
    current.value < min.value ? current : min,
  );

  const mtv: [number, number, number] = [0, 0, 0];
  mtv[minOverlap.axis] = minOverlap.value * minOverlap.sign;

  return mtv;
};

