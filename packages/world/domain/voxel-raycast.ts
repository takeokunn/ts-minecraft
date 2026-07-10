import { Option } from 'effect'

// Voxel ray traversal (Amanatides & Woo). Replaces three.js Raycaster for block
// targeting: the mesh path brute-forces every triangle of every chunk mesh the
// ray's bounds touch (~16% of main thread when facing terrain), while this
// walks at most ceil(maxDistance·√3)+1 grid cells against raw chunk data.
export type VoxelRaycastHit = {
  readonly point: { readonly x: number; readonly y: number; readonly z: number }
  // Unit axis normal of the face the ray entered through.
  readonly normal: { readonly x: number; readonly y: number; readonly z: number }
  readonly distance: number
  readonly blockX: number
  readonly blockY: number
  readonly blockZ: number
}

// Walks voxels from `origin` along `direction` (need not be normalized — it is
// normalized internally) up to `maxDistance`, returning the first cell for
// which `isTargetable` is true. The STARTING cell is never targeted (the
// camera eye sits inside it; a mesh raycast cannot hit it either).
export const voxelRaycast = (
  origin: { readonly x: number; readonly y: number; readonly z: number },
  direction: { readonly x: number; readonly y: number; readonly z: number },
  maxDistance: number,
  isTargetable: (x: number, y: number, z: number) => boolean,
): Option.Option<VoxelRaycastHit> => {
  const len = Math.hypot(direction.x, direction.y, direction.z)
  if (!Number.isFinite(len) || len === 0 || !Number.isFinite(maxDistance) || maxDistance <= 0) return Option.none()
  const dx = direction.x / len
  const dy = direction.y / len
  const dz = direction.z / len

  let cx = Math.floor(origin.x)
  let cy = Math.floor(origin.y)
  let cz = Math.floor(origin.z)

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0

  // Distance along the ray to the first boundary crossing per axis, and the
  // distance between successive crossings. A zero component never crosses.
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx)
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy)
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz)

  let tMaxX = stepX === 0 ? Infinity : (stepX > 0 ? (cx + 1 - origin.x) : (origin.x - cx)) * tDeltaX
  let tMaxY = stepY === 0 ? Infinity : (stepY > 0 ? (cy + 1 - origin.y) : (origin.y - cy)) * tDeltaY
  let tMaxZ = stepZ === 0 ? Infinity : (stepZ > 0 ? (cz + 1 - origin.z) : (origin.z - cz)) * tDeltaZ

  // Cell count bound: the ray crosses at most maxDistance/tDelta boundaries per
  // axis; the +3 covers the entry cell and rounding at the range boundary.
  const maxSteps = Math.ceil(maxDistance * (Math.abs(dx) + Math.abs(dy) + Math.abs(dz))) + 3

  for (let i = 0; i < maxSteps; i++) {
    // Advance to the next cell through the nearest boundary.
    let t: number
    let nx = 0
    let ny = 0
    let nz = 0
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX
      cx += stepX
      tMaxX += tDeltaX
      nx = -stepX
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY
      cy += stepY
      tMaxY += tDeltaY
      ny = -stepY
    } else {
      t = tMaxZ
      cz += stepZ
      tMaxZ += tDeltaZ
      nz = -stepZ
    }
    if (t > maxDistance) return Option.none()
    if (!isTargetable(cx, cy, cz)) continue
    return Option.some({
      point: { x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t },
      normal: { x: nx, y: ny, z: nz },
      distance: t,
      blockX: cx,
      blockY: cy,
      blockZ: cz,
    })
  }
  return Option.none()
}
