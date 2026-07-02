import { Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { BlockAt } from '../nether/portal-frame'

// End-portal ring detection. A completed portal is the classic vanilla ring:
// 12 filled frames (three per side) around an empty 3×3 interior, all at the
// same height. Detection is pure — callers pass a BlockAt sampler — and works
// for both generated stronghold rings and player-built ones.

// Ring slots relative to the interior centre: three per side, two out.
const RING_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -2], [0, -2], [1, -2],
  [-1, 2], [0, 2], [1, 2],
  [-2, -1], [-2, 0], [-2, 1],
  [2, -1], [2, 0], [2, 1],
]

export type CompletedEndPortal = {
  /** The 3×3 interior cells that become END_PORTAL blocks. */
  readonly interior: ReadonlyArray<Position>
}

const ringCompletedAround = (
  blockAt: BlockAt,
  centerX: number,
  y: number,
  centerZ: number,
): boolean => {
  for (const [dx, dz] of RING_OFFSETS) {
    if (blockAt(centerX + dx, y, centerZ + dz) !== 'END_PORTAL_FRAME_FILLED') return false
  }
  return true
}

/**
 * Detects a completed end-portal ring containing the frame at `framePos`
 * (typically the frame that just received an eye). The frame can occupy any
 * of the 12 ring slots, so every candidate interior centre is tried.
 */
export const detectCompletedEndPortal = (
  blockAt: BlockAt,
  framePos: Position,
): Option.Option<CompletedEndPortal> => {
  const fx = Math.floor(framePos.x)
  const y = Math.floor(framePos.y)
  const fz = Math.floor(framePos.z)

  for (const [dx, dz] of RING_OFFSETS) {
    const centerX = fx - dx
    const centerZ = fz - dz
    if (!ringCompletedAround(blockAt, centerX, y, centerZ)) continue

    const interior: Position[] = []
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        interior.push({ x: centerX + ix, y, z: centerZ + iz })
      }
    }
    return Option.some({ interior })
  }

  return Option.none()
}
