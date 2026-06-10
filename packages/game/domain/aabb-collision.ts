// Pure AABB block collision resolution.
// Separate-axis resolution order: Y first → X → Z (Y establishes correct floor/ceiling before
// horizontal axes run, preventing corner-climbing and step-up artifacts).

export interface CollisionResult {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number }
  readonly isGrounded: boolean
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
const MAX_STEP_UP = 0.5
const FALL_VELOCITY_THRESHOLD = 8

// Integer block range for a player extent (with epsilon to avoid edge ambiguity)
function bMin(center: number, half: number): number {
  return Math.floor(center - half + EPSILON)
}
function bMax(center: number, half: number): number {
  return Math.floor(center + half - EPSILON)
}

export function resolveBlockCollisions(
  pos: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  halfW: number,   // PLAYER_HALF_WIDTH = 0.3
  halfH: number,   // PLAYER_HALF_HEIGHT = 0.9
  isBlockSolid: (bx: number, by: number, bz: number) => boolean
): CollisionResult {
  let x = pos.x, y = pos.y, z = pos.z
  let vx = velocity.x, vy = velocity.y, vz = velocity.z
  let isGrounded = false

  // ── Y axis ──────────────────────────────────────────────────────────────
  {
    const feetY = y - halfH
    const headY = y + halfH
    const bxMin = bMin(x, halfW); const bxMax = bMax(x, halfW)
    const bzMin = bMin(z, halfW); const bzMax = bMax(z, halfW)
    // Scan all Y levels in the player's bounding box (handles multi-block tunneling)
    const byLow = Math.floor(feetY)
    const byHigh = Math.floor(headY)
    // The block column directly under the player's centre. A genuine vertical collision —
    // floor, ceiling, or being embedded in a block placed on the player (anti-stuck) — is
    // over/under the centre; a wall the player merely walked INTO is BESIDE the centre (the
    // X/Z phase keeps the centre off it). This is what distinguishes them.
    const centerBx = Math.floor(x)
    const centerBz = Math.floor(z)

    let maxFloorY = Number.NEGATIVE_INFINITY
    let minCeilY = Number.POSITIVE_INFINITY

    for (let bx = bxMin; bx <= bxMax; bx++) {
      for (let bz = bzMin; bz <= bzMax; bz++) {
        for (let by = byLow; by <= byHigh; by++) {
          if (isBlockSolid(bx, by, bz)) {
            const blockTop = by + 1
            const blockBot = by
            // Player Y range overlaps this block?
            if (headY > blockBot && feetY < blockTop) {
              const overCenter = bx === centerBx && bz === centerBz
              if (vy <= 0) {
                // Floor — a block the feet land on/near, a fast fall sweeping past it, or a
                // block under the player's centre (landing / anti-stuck). NOT a wall beside
                // the player (the X/Z phase resolves that) — treating a beside-wall as a
                // floor is what made walls climbable.
                if ((blockTop - feetY <= MAX_STEP_UP || vy <= -FALL_VELOCITY_THRESHOLD || overCenter)
                  && blockTop > maxFloorY) {
                  maxFloorY = blockTop
                }
              } else {
                // Ceiling — a block just above the head, a fast rise, or a block over the centre.
                if ((headY - blockBot <= MAX_STEP_UP || vy >= FALL_VELOCITY_THRESHOLD || overCenter)
                  && blockBot < minCeilY) {
                  minCeilY = blockBot
                }
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
    const byMin = bMin(y, halfH); const byMax = bMax(y, halfH)
    const bzMin = bMin(z, halfW); const bzMax = bMax(z, halfW)

    if (vx < 0) {
      const bxFace = Math.floor(x - halfW)
      outer: for (let by = byMin; by <= byMax; by++) {
        for (let bz = bzMin; bz <= bzMax; bz++) {
          if (isBlockSolid(bxFace, by, bz)) {
            x = bxFace + 1 + halfW
            vx = 0
            break outer
          }
        }
      }
    } else if (vx > 0) {
      const bxFace = Math.floor(x + halfW - EPSILON)
      outer: for (let by = byMin; by <= byMax; by++) {
        for (let bz = bzMin; bz <= bzMax; bz++) {
          if (isBlockSolid(bxFace, by, bz)) {
            x = bxFace - halfW
            vx = 0
            break outer
          }
        }
      }
    }
  }

  // ── Z axis (use corrected Y and X) ──────────────────────────────────────
  {
    const byMin = bMin(y, halfH); const byMax = bMax(y, halfH)
    const bxMin = bMin(x, halfW); const bxMax = bMax(x, halfW)

    if (vz < 0) {
      const bzFace = Math.floor(z - halfW)
      outer: for (let by = byMin; by <= byMax; by++) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          if (isBlockSolid(bx, by, bzFace)) {
            z = bzFace + 1 + halfW
            vz = 0
            break outer
          }
        }
      }
    } else if (vz > 0) {
      const bzFace = Math.floor(z + halfW - EPSILON)
      outer: for (let by = byMin; by <= byMax; by++) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          if (isBlockSolid(bx, by, bzFace)) {
            z = bzFace - halfW
            vz = 0
            break outer
          }
        }
      }
    }
  }

  return { position: { x, y, z }, velocity: { x: vx, y: vy, z: vz }, isGrounded }
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
