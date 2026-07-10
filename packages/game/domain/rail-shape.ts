// Rail shapes and minecart velocity constraint. Rails resolve their shape
// from neighbouring rails (same cell height ±1 so slopes connect); riding a
// straight locks the cart to the rail axis, curves let it turn, and a rail
// one block up along the motion direction climbs the cart onto it.

export type RailShape = 'ns' | 'ew' | 'curve' | 'isolated'

export type IsRailAt = (wx: number, wy: number, wz: number) => boolean

const hasRailNear = (isRailAt: IsRailAt, wx: number, wy: number, wz: number): boolean =>
  isRailAt(wx, wy, wz) || isRailAt(wx, wy + 1, wz) || isRailAt(wx, wy - 1, wz)

// Shape from the four horizontal neighbours (north = -z, south = +z,
// east = +x, west = -x). A straight pair wins; an L of two perpendicular
// neighbours is a curve; a single neighbour extends that axis; no neighbours
// leaves the rail isolated (unconstrained — a lone rail is a plain floor).
export const resolveRailShape = (
  isRailAt: IsRailAt,
  wx: number,
  wy: number,
  wz: number,
): RailShape => {
  const north = hasRailNear(isRailAt, wx, wy, wz - 1)
  const south = hasRailNear(isRailAt, wx, wy, wz + 1)
  const east = hasRailNear(isRailAt, wx + 1, wy, wz)
  const west = hasRailNear(isRailAt, wx - 1, wy, wz)

  const nsCount = (north ? 1 : 0) + (south ? 1 : 0)
  const ewCount = (east ? 1 : 0) + (west ? 1 : 0)
  if (nsCount > 0 && ewCount > 0) return 'curve'
  if (nsCount > 0) return 'ns'
  if (ewCount > 0) return 'ew'
  return 'isolated'
}

// Constrain a riding cart's horizontal velocity to the rail:
// - straights zero the cross-axis component (the cart cannot strafe off)
// - curves preserve speed but let the dominant input axis steer the turn
// - isolated rails leave velocity untouched
export const projectMinecartVelocity = (
  shape: RailShape,
  vx: number,
  vz: number,
): { readonly vx: number; readonly vz: number } => {
  switch (shape) {
    case 'ns':
      return { vx: 0, vz }
    case 'ew':
      return { vx, vz: 0 }
    case 'curve': {
      // Redirect the full speed onto the dominant axis so corners turn
      // crisply instead of drifting diagonally off the bend.
      const speed = Math.hypot(vx, vz)
      if (speed < 1e-9) return { vx, vz }
      return Math.abs(vx) >= Math.abs(vz)
        ? { vx: Math.sign(vx) * speed, vz: 0 }
        : { vx: 0, vz: Math.sign(vz) * speed }
    }
    case 'isolated':
      return { vx, vz }
  }
}

// True when the cell one step along the motion direction holds a rail one
// block UP — the cart should climb onto it (ascending rail).
export const isAscendingAhead = (
  isRailAt: IsRailAt,
  wx: number,
  wy: number,
  wz: number,
  vx: number,
  vz: number,
): boolean => {
  if (Math.abs(vx) < 1e-9 && Math.abs(vz) < 1e-9) return false
  const stepX = Math.abs(vx) >= Math.abs(vz) ? Math.sign(vx) : 0
  const stepZ = stepX === 0 ? Math.sign(vz) : 0
  return isRailAt(wx + stepX, wy + 1, wz + stepZ)
}

// Vertical climb speed while ascending a sloped rail (blocks/second). Fast
// enough to mount a 1-block step within a cell's travel at minecart pace.
export const RAIL_CLIMB_SPEED = 3.5
