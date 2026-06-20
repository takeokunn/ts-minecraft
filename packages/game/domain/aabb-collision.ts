// Pure AABB block collision resolution.
// Separate-axis resolution order: Y first → X → Z (Y establishes correct floor/ceiling before
// horizontal axes run, preventing corner-climbing and step-up artifacts).

export interface CollisionResult {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number }
  readonly isGrounded: boolean
}

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

const EPSILON = 0.001

// A block counts as a floor/ceiling only when its surface is within MAX_STEP_UP of the
// player's feet/head, OR the player is moving fast enough (|vy| ≥ FALL_VELOCITY_THRESHOLD)
// that the feet/head could have swept past it in one frame. This distinguishes a block the
// player lands ON / hits their head ON (a vertical collision) from a WALL beside them that
// their horizontal edge merely penetrated (resolved by the X/Z phase). Without it, walking
// into a wall snaps the player onto its top — i.e. every wall becomes climbable.
//
// Derivation (tied to the deltaTime cap 0.05 s): below the threshold the max descent in one
// capped frame is FALL_VELOCITY_THRESHOLD × 0.05 = 0.4 < MAX_STEP_UP, so a floor reached while
// moving slower is always caught by the distance test; faster falls take the velocity branch
// (full scan) which preserves tunnel-prevention. A full-block wall sits 1.0 above the feet
// (> MAX_STEP_UP) and is therefore excluded.
const MAX_STEP_UP = 0.6
const FALL_VELOCITY_THRESHOLD = 8

// Integer block range for a player extent (with epsilon to avoid edge ambiguity)
const bMin = (center: number, half: number): number =>
  Math.floor(center - half + EPSILON)
const bMax = (center: number, half: number): number =>
  Math.floor(center + half - EPSILON)

export const resolveBlockCollisionsInto = (
  outPos: { x: number; y: number; z: number },
  outVel: { x: number; y: number; z: number },
  pos: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  halfW: number,   // PLAYER_HALF_WIDTH = 0.3
  halfH: number,   // PLAYER_HALF_HEIGHT = 0.9
  isBlockSolid: (bx: number, by: number, bz: number) => boolean,
  getBlockCollisionShape?: BlockCollisionShapeFn
): boolean => {
  let x = pos.x, y = pos.y, z = pos.z
  let vx = velocity.x, vy = velocity.y, vz = velocity.z
  let isGrounded = false
  const shapeForBlock = (
    bx: number,
    by: number,
    bz: number,
    isBlockSolid: (bx: number, by: number, bz: number) => boolean,
    getBlockCollisionShape?: BlockCollisionShapeFn
  ): BlockCollisionShape | null =>
    getBlockCollisionShape?.(bx, by, bz) ?? (isBlockSolid(bx, by, bz) ? FULL_BLOCK_COLLISION_SHAPE : null)
  const rangesOverlap = (aMin: number, aMax: number, bMin: number, bMax: number): boolean => aMax > bMin && aMin < bMax

  // ── Y axis ──────────────────────────────────────────────────────────────
  {
    const feetY = y - halfH
    const headY = y + halfH
    const playerMinX = x - halfW
    const playerMaxX = x + halfW
    const playerMinZ = z - halfW
    const playerMaxZ = z + halfW
    const bxMin = bMin(x, halfW); const bxMax = bMax(x, halfW)
    const bzMin = bMin(z, halfW); const bzMax = bMax(z, halfW)
    const byLow = Math.floor(feetY)
    const byHigh = Math.floor(headY)
    const centerBx = Math.floor(x)
    const centerBz = Math.floor(z)

    let maxFloorY = Number.NEGATIVE_INFINITY
    let minCeilY = Number.POSITIVE_INFINITY

    for (let bx = bxMin; bx <= bxMax; bx++) {
      for (let bz = bzMin; bz <= bzMax; bz++) {
        for (let by = byLow; by <= byHigh; by++) {
          const shape = shapeForBlock(bx, by, bz, isBlockSolid, getBlockCollisionShape)
          if (shape === null) continue

          const blockMinX = bx + shape.minX
          const blockMaxX = bx + shape.maxX
          const blockMinZ = bz + shape.minZ
          const blockMaxZ = bz + shape.maxZ
          if (!rangesOverlap(playerMinX, playerMaxX, blockMinX, blockMaxX)
            || !rangesOverlap(playerMinZ, playerMaxZ, blockMinZ, blockMaxZ)) continue

          const blockTop = by + shape.maxY
          const blockBot = by + shape.minY
          if (headY > blockBot && feetY < blockTop) {
            const overCenter = bx === centerBx && bz === centerBz
            if (vy <= 0) {
              if ((blockTop - feetY <= MAX_STEP_UP || vy <= -FALL_VELOCITY_THRESHOLD || overCenter)
                && blockTop > maxFloorY) {
                maxFloorY = blockTop
              }
            } else {
              if ((headY - blockBot <= MAX_STEP_UP || vy >= FALL_VELOCITY_THRESHOLD || overCenter)
                && blockBot < minCeilY) {
                minCeilY = blockBot
              }
            }
          }
        }
      }
    }

    if (maxFloorY > Number.NEGATIVE_INFINITY) {
      y = maxFloorY + halfH
      vy = 0
      isGrounded = true
    }
    if (minCeilY < Number.POSITIVE_INFINITY) {
      y = minCeilY - halfH
      if (vy > 0) vy = 0
    }
  }

  // ── X axis (use corrected Y) ─────────────────────────────────────────────
  {
    const playerMinY = y - halfH
    const playerMaxY = y + halfH
    const playerMinZ = z - halfW
    const playerMaxZ = z + halfW
    const byMin = Math.floor(playerMinY); const byMax = Math.floor(playerMaxY)
    const bzMin = Math.floor(playerMinZ); const bzMax = Math.floor(playerMaxZ)
    const bxMin = Math.floor(x - halfW) - 1
    const bxMax = Math.floor(x + halfW) + 1

    if (vx < 0) {
      let maxFace = Number.NEGATIVE_INFINITY
      for (let bx = bxMin; bx <= bxMax; bx++) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            const shape = shapeForBlock(bx, by, bz, isBlockSolid, getBlockCollisionShape)
            if (shape === null) continue

            if (!rangesOverlap(playerMinY, playerMaxY, by + shape.minY, by + shape.maxY)
              || !rangesOverlap(playerMinZ, playerMaxZ, bz + shape.minZ, bz + shape.maxZ)) continue

            const face = bx + shape.maxX
            if (face > x - halfW && face <= x + halfW && face > maxFace) maxFace = face
          }
        }
      }
      if (maxFace > Number.NEGATIVE_INFINITY) {
        x = maxFace + halfW
        vx = 0
      }
    } else if (vx > 0) {
      let minFace = Number.POSITIVE_INFINITY
      for (let bx = bxMin; bx <= bxMax; bx++) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            const shape = shapeForBlock(bx, by, bz, isBlockSolid, getBlockCollisionShape)
            if (shape === null) continue

            if (!rangesOverlap(playerMinY, playerMaxY, by + shape.minY, by + shape.maxY)
              || !rangesOverlap(playerMinZ, playerMaxZ, bz + shape.minZ, bz + shape.maxZ)) continue

            const face = bx + shape.minX
            if (face >= x - halfW && face < x + halfW && face < minFace) minFace = face
          }
        }
      }
      if (minFace < Number.POSITIVE_INFINITY) {
        x = minFace - halfW
        vx = 0
      }
    }
  }

  // ── Z axis (use corrected Y and X) ──────────────────────────────────────
  {
    const playerMinX = x - halfW
    const playerMaxX = x + halfW
    const playerMinY = y - halfH
    const playerMaxY = y + halfH
    const bxMin = Math.floor(playerMinX); const bxMax = Math.floor(playerMaxX)
    const byMin = Math.floor(playerMinY); const byMax = Math.floor(playerMaxY)
    const bzMin = Math.floor(z - halfW) - 1
    const bzMax = Math.floor(z + halfW) + 1

    if (vz < 0) {
      let maxFace = Number.NEGATIVE_INFINITY
      for (let bz = bzMin; bz <= bzMax; bz++) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bx = bxMin; bx <= bxMax; bx++) {
            const shape = shapeForBlock(bx, by, bz, isBlockSolid, getBlockCollisionShape)
            if (shape === null) continue

            if (!rangesOverlap(playerMinX, playerMaxX, bx + shape.minX, bx + shape.maxX)
              || !rangesOverlap(playerMinY, playerMaxY, by + shape.minY, by + shape.maxY)) continue

            const face = bz + shape.maxZ
            if (face > z - halfW && face <= z + halfW && face > maxFace) maxFace = face
          }
        }
      }
      if (maxFace > Number.NEGATIVE_INFINITY) {
        z = maxFace + halfW
        vz = 0
      }
    } else if (vz > 0) {
      let minFace = Number.POSITIVE_INFINITY
      for (let bz = bzMin; bz <= bzMax; bz++) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bx = bxMin; bx <= bxMax; bx++) {
            const shape = shapeForBlock(bx, by, bz, isBlockSolid, getBlockCollisionShape)
            if (shape === null) continue

            if (!rangesOverlap(playerMinX, playerMaxX, bx + shape.minX, bx + shape.maxX)
              || !rangesOverlap(playerMinY, playerMaxY, by + shape.minY, by + shape.maxY)) continue

            const face = bz + shape.minZ
            if (face >= z - halfW && face < z + halfW && face < minFace) minFace = face
          }
        }
      }
      if (minFace < Number.POSITIVE_INFINITY) {
        z = minFace - halfW
        vz = 0
      }
    }
  }

  outPos.x = x; outPos.y = y; outPos.z = z
  outVel.x = vx; outVel.y = vy; outVel.z = vz
  return isGrounded
}

export const resolveBlockCollisions = (
  pos: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  halfW: number,
  halfH: number,
  isBlockSolid: (bx: number, by: number, bz: number) => boolean,
  getBlockCollisionShape?: BlockCollisionShapeFn
): CollisionResult => {
  const outPos = { x: 0, y: 0, z: 0 }
  const outVel = { x: 0, y: 0, z: 0 }
  const isGrounded = resolveBlockCollisionsInto(outPos, outVel, pos, velocity, halfW, halfH, isBlockSolid, getBlockCollisionShape)
  return { position: outPos, velocity: outVel, isGrounded }
}

// R7: how far below the feet a block still counts as "support" while sneaking —
// covers stepping down a single block; a drop of more than this is treated as a fall.
export const SNEAK_STEP_DOWN = 1.0

/**
 * Sneak edge-protection: while sneaking on the ground, prevent horizontal movement
 * from carrying the player off an unsupported edge into a fall. Per-axis (so the
 * player can still slide ALONG an edge): if moving in X to the new spot has no ground
 * support there, keep the previous X; likewise for Z. `hasGroundSupport(x, z)` reports
 * whether solid ground exists below the player's feet at (x, z) within SNEAK_STEP_DOWN.
 *
 * Conservative by construction — on flat ground support always exists, so this never
 * traps the player; it only clamps at genuine edges.
 */
export const clampSneakEdge = (
  prev: { readonly x: number; readonly z: number },
  next: { readonly x: number; readonly z: number },
  hasGroundSupport: (x: number, z: number) => boolean,
): { readonly x: number; readonly z: number } => {
  const x = next.x !== prev.x && !hasGroundSupport(next.x, prev.z) ? prev.x : next.x
  const z = next.z !== prev.z && !hasGroundSupport(prev.x, next.z) ? prev.z : next.z
  return { x, z }
}
