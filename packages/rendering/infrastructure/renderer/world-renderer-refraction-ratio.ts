import * as THREE from 'three'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'

// FR-4.4: pre-allocated scratch for AABB projection — reused across frames to avoid GC pressure
// Sized for the 8 corners of an AABB; vpMatrix is the combined view-projection matrix.
const _vpMatrix = new THREE.Matrix4()
const _projCorner = new THREE.Vector4()

/**
 * FR-4.4: estimate the fraction of screen pixels covered by water meshes via
 * conservative AABB projection. Each mesh's chunk AABB (derived from the
 * `chunkCoord` + `chunkMaxY` userData populated by the meshing pipeline) is
 * projected to NDC; the bounding rect of the 8 projected corners gives an
 * upper bound on the mesh's screen footprint.
 *
 * Math:
 *   - viewport NDC area = 4 (width 2 * height 2)
 *   - clamped NDC bounding rect area / 4 = per-mesh ratio
 *   - sum without union dedupe → upper bound (safe for skip decisions)
 *
 * Returns 1.0 (no skip) whenever any corner is behind the near plane, since
 * partial-clip projection produces invalid NDC values; treating those frames
 * as "fully visible" prevents false-positive skips when water is right under
 * the camera.
 */
export const estimateWaterScreenRatio = (
  waterMeshes: ReadonlyArray<THREE.Mesh>,
  camera: THREE.Camera,
): number => {
  // Combined view-projection: NDC = vpMatrix * worldPos / w
  _vpMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)

  let totalRatio = 0
  for (const mesh of waterMeshes) {
    if (!mesh.visible) continue
    const coord = (mesh.userData as { chunkCoord?: { x: number; z: number } }).chunkCoord
    /* c8 ignore next */
    if (coord == null) continue
    const chunkMaxY = (mesh.userData as { chunkMaxY?: number }).chunkMaxY
    /* c8 ignore start -- meshes without chunkMaxY use CHUNK_HEIGHT; not produced in unit tests */
    const maxYBound = chunkMaxY === undefined
      ? CHUNK_HEIGHT
      : chunkMaxY < 0 ? 0 : chunkMaxY + 1
    /* c8 ignore end */

    const x0 = coord.x * CHUNK_SIZE
    const x1 = x0 + CHUNK_SIZE
    const z0 = coord.z * CHUNK_SIZE
    const z1 = z0 + CHUNK_SIZE
    const y0 = 0
    const y1 = maxYBound

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let behindCamera = false

    // 8 AABB corners: (x0|x1) × (y0|y1) × (z0|z1)
    for (let i = 0; i < 8; i += 1) {
      const cx = (i & 1) === 0 ? x0 : x1
      const cy = (i & 2) === 0 ? y0 : y1
      const cz = (i & 4) === 0 ? z0 : z1
      _projCorner.set(cx, cy, cz, 1)
      _projCorner.applyMatrix4(_vpMatrix)
      // applyMatrix4 on Vector4 returns clip-space (x, y, z, w); divide by w for NDC.
      // w <= 0 means the corner is at/behind the near plane → bail out conservatively.
      if (_projCorner.w <= 0) {
        behindCamera = true
        break
      }
      const invW = 1 / _projCorner.w
      const nx = _projCorner.x * invW
      const ny = _projCorner.y * invW
      if (nx < minX) minX = nx
      if (nx > maxX) maxX = nx
      if (ny < minY) minY = ny
      if (ny > maxY) maxY = ny
    }

    if (behindCamera) {
      // Conservative: treat as fully on-screen → never skip when any water mesh straddles near plane.
      return 1
    }

    // Clamp to viewport [-1, 1]^2; rect can be fully off-screen (negative width/height) → 0.
    const cMinX = minX < -1 ? -1 : minX
    const cMaxX = maxX > 1 ? 1 : maxX
    const cMinY = minY < -1 ? -1 : minY
    const cMaxY = maxY > 1 ? 1 : maxY
    const w = cMaxX - cMinX
    const h = cMaxY - cMinY
    if (w <= 0 || h <= 0) continue
    // Total NDC area is 4 (2 × 2); ratio = clipped rect area / 4.
    totalRatio += (w * h) * 0.25
    if (totalRatio >= 1) return 1
  }
  return totalRatio
}
