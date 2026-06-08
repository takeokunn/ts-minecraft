import { Array as Arr, Option } from 'effect'
import type { Position, BlockType } from '@ts-minecraft/core'

/**
 * Nether portal frame detection (pure domain — Phase 17 foundation).
 *
 * A valid Nether portal is a rectangular ring of OBSIDIAN standing in a vertical
 * plane aligned to either the X- or Z-axis. The hollow interior — the cells that
 * become portal blocks on ignition — is between {@link MIN_PORTAL_WIDTH} and
 * {@link MAX_PORTAL_WIDTH} wide and {@link MIN_PORTAL_HEIGHT}–{@link MAX_PORTAL_HEIGHT}
 * tall, and must be filled with replaceable AIR. Following modern Minecraft, the
 * four corner blocks of the frame are NOT required to be obsidian.
 *
 * Detection is decoupled from any chunk/service: callers pass a {@link BlockAt}
 * accessor, which keeps this trivially unit-testable and reusable from either the
 * world generator or an interactive flint-&-steel ignition handler.
 */

/** Reads the block type at an integer world coordinate. */
export type BlockAt = (x: number, y: number, z: number) => BlockType

/** The horizontal axis the portal's vertical plane is aligned to. */
export type PortalAxis = 'x' | 'z'

export type PortalFrame = {
  readonly axis: PortalAxis
  readonly width: number
  readonly height: number
  /** Interior cells (AIR pre-ignition) that become portal blocks. */
  readonly interior: ReadonlyArray<Position>
}

export const MIN_PORTAL_WIDTH = 2
export const MAX_PORTAL_WIDTH = 21
export const MIN_PORTAL_HEIGHT = 3
export const MAX_PORTAL_HEIGHT = 21

const OBSIDIAN: BlockType = 'OBSIDIAN'
const AIR: BlockType = 'AIR'

// Maps an in-plane (horizontal, vertical) coordinate to a world Position. For the
// X-aligned plane the horizontal coordinate is X (Z fixed); for the Z-aligned
// plane it is Z (X fixed).
type PlaneMap = (h: number, y: number) => Position

const planeMapFor = (axis: PortalAxis, fixed: number): PlaneMap =>
  axis === 'x' ? (h, y) => ({ x: h, y, z: fixed }) : (h, y) => ({ x: fixed, y, z: h })

const blockInPlane = (blockAt: BlockAt, at: PlaneMap, h: number, y: number): BlockType => {
  const p = at(h, y)
  return blockAt(p.x, p.y, p.z)
}

// Counts consecutive AIR cells from (h0,y0) inclusive, stepping (dh,dy), capped at
// `max` so an unbounded air region cannot loop forever (the dimension guards then
// reject the over-sized result).
const countAir = (
  blockAt: BlockAt,
  at: PlaneMap,
  h0: number,
  y0: number,
  dh: number,
  dy: number,
  max: number,
): number => {
  let n = 0
  while (n < max) {
    if (blockInPlane(blockAt, at, h0 + dh * n, y0 + dy * n) !== AIR) break
    n += 1
  }
  return n
}

// Resolves a portal frame in one plane, anchored at an interior AIR cell (h0,y0).
const detectInPlane = (
  blockAt: BlockAt,
  axis: PortalAxis,
  fixed: number,
  h0: number,
  y0: number,
): Option.Option<PortalFrame> => {
  const at = planeMapFor(axis, fixed)

  // Walk to the bottom-left interior corner (ignition is guaranteed AIR by the caller).
  const bottomY = y0 - (countAir(blockAt, at, h0, y0, 0, -1, MAX_PORTAL_HEIGHT + 1) - 1)
  const leftH = h0 - (countAir(blockAt, at, h0, bottomY, -1, 0, MAX_PORTAL_WIDTH + 1) - 1)

  // Measure the interior extent from that corner (capped one past the max).
  const width = countAir(blockAt, at, leftH, bottomY, 1, 0, MAX_PORTAL_WIDTH + 1)
  const height = countAir(blockAt, at, leftH, bottomY, 0, 1, MAX_PORTAL_HEIGHT + 1)

  if (width < MIN_PORTAL_WIDTH) return Option.none()
  if (width > MAX_PORTAL_WIDTH) return Option.none()
  if (height < MIN_PORTAL_HEIGHT) return Option.none()
  if (height > MAX_PORTAL_HEIGHT) return Option.none()

  const hs = Arr.makeBy(width, (i) => leftH + i)
  const ys = Arr.makeBy(height, (i) => bottomY + i)

  // Interior must be entirely AIR — rejects a stray block inside the rectangle.
  const interior = hs.flatMap((h) => ys.map((y) => at(h, y)))
  const interiorClear = interior.every((p) => blockAt(p.x, p.y, p.z) === AIR)
  if (!interiorClear) return Option.none()

  // Obsidian ring on all four edges (corners excluded, per vanilla).
  const ring: ReadonlyArray<Position> = [
    ...hs.map((h) => at(h, bottomY - 1)),
    ...hs.map((h) => at(h, bottomY + height)),
    ...ys.map((y) => at(leftH - 1, y)),
    ...ys.map((y) => at(leftH + width, y)),
  ]
  const ringComplete = ring.every((p) => blockAt(p.x, p.y, p.z) === OBSIDIAN)
  if (!ringComplete) return Option.none()

  return Option.some({ axis, width, height, interior })
}

/**
 * Detects a valid Nether portal anchored at `ignition` (the block where flint &
 * steel is applied). Tries the X-aligned plane first, then the Z-aligned plane.
 * Returns the interior portal-block positions, or None when no valid obsidian
 * frame surrounds the ignition point.
 */
export const detectNetherPortal = (blockAt: BlockAt, ignition: Position): Option.Option<PortalFrame> => {
  const x = Math.floor(ignition.x)
  const y = Math.floor(ignition.y)
  const z = Math.floor(ignition.z)
  if (blockAt(x, y, z) !== AIR) return Option.none()
  return Option.orElse(detectInPlane(blockAt, 'x', z, x, y), () => detectInPlane(blockAt, 'z', x, z, y))
}

/** The block positions that make up a portal: its obsidian ring and interior. */
export type PortalLayout = {
  /** Full rectangular obsidian ring, corners included (as vanilla auto-generated portals). */
  readonly frame: ReadonlyArray<Position>
  /** Interior cells that become portal blocks. */
  readonly interior: ReadonlyArray<Position>
}

/**
 * Generates the block positions for a portal whose interior bottom-left corner is
 * `origin`, sized `width` × `height`, in the given axis plane. The frame is the
 * complete rectangular obsidian ring (corners included); the interior holds the
 * portal blocks. This is the inverse of {@link detectNetherPortal} — used to place
 * an auto-generated linked portal when none exists at a travel destination, and
 * round-trips back through detection.
 */
export const generatePortalLayout = (
  origin: Position,
  axis: PortalAxis,
  width: number,
  height: number,
): PortalLayout => {
  const fixed = axis === 'x' ? origin.z : origin.x
  const leftH = axis === 'x' ? origin.x : origin.z
  const bottomY = origin.y
  const at = planeMapFor(axis, fixed)

  const interior = Arr.makeBy(width, (i) => leftH + i).flatMap((h) =>
    Arr.makeBy(height, (j) => at(h, bottomY + j)),
  )

  // Bounding rectangle one block larger on every side; a cell belongs to the ring
  // when it lies on the outer row or column (interior cells are excluded).
  const ringHs = Arr.makeBy(width + 2, (i) => leftH - 1 + i)
  const ringYs = Arr.makeBy(height + 2, (j) => bottomY - 1 + j)
  const frame = ringHs.flatMap((h) =>
    ringYs
      .filter((y) => h === leftH - 1 || h === leftH + width || y === bottomY - 1 || y === bottomY + height)
      .map((y) => at(h, y)),
  )

  return { frame, interior }
}
