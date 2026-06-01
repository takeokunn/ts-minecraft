import * as THREE from 'three'
import { getTileIndex, getTileUVs, type FaceDir } from '../textures/block-texture-map'

export const MAX_PARTICLES = 512
export const PARTICLE_LIFETIME_SECS = 0.5
export const PARTICLE_GRAVITY = 12 // m/s² — tuned to feel snappy in 0.5s lifetime
export const PARTICLE_BASE_SIZE = 0.1
// Default burst velocity envelope — random uniform per axis.
// Tuned so 6-particle bursts visually scatter without leaving the 1m source cube.
export const SPREAD_HORIZONTAL = 2.0 // m/s
export const SPREAD_UP = 3.0          // m/s upward kick
export const SPREAD_DOWN = 0.5        // m/s downward seed (so some particles fall faster)

// Tile size (in atlas UV space) — particle quad samples a single tile patch
// so per-particle UV varies by `(uOffset, vOffset)` from the base UV (0,0)..(tileSize,tileSize).
export const TILE_FRACTION = 1 / 16 // ATLAS_COLS=16; one tile spans 1/16 of UV space

// Pre-built constant: identity matrix scaled to zero (inactive slot marker).
// Allocated once at module load — never recreated.
export const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0)

// Per-instance UV comes from `uvOffset` instanced buffer attribute, sampled via onBeforeCompile shader patch.
export const buildParticleGeometry = (atlasTileFraction: number): THREE.PlaneGeometry => {
  const geom = new THREE.PlaneGeometry(PARTICLE_BASE_SIZE, PARTICLE_BASE_SIZE)
  // Replace the default UVs (which span the full atlas) with a sub-tile patch
  // anchored at (0,0). The per-instance uvOffset attribute slides this patch
  // across the atlas at render time.
  const uv = geom.getAttribute('uv') as THREE.BufferAttribute
  const arr = uv.array as Float32Array
  // Quad UVs: top-left, top-right, bottom-left, bottom-right.
  // We want each particle to sample a `tileFraction`-sized patch.
  arr[0] = 0;                  arr[1] = atlasTileFraction
  arr[2] = atlasTileFraction;  arr[3] = atlasTileFraction
  arr[4] = 0;                  arr[5] = 0
  arr[6] = atlasTileFraction;  arr[7] = 0
  uv.needsUpdate = true
  return geom
}

// Uses top face tile (most visually representative). Unknown blockId → dirt (tile 0).
export const getParticleUvOffset = (
  blockId: number,
  faceDir: FaceDir = 'top',
): { readonly u: number; readonly v: number } => {
  const tileIndex = getTileIndex(blockId, faceDir)
  const { u0, v0 } = getTileUVs(tileIndex)
  return { u: u0, v: v0 }
}
