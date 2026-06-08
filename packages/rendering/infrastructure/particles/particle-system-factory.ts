import * as THREE from 'three'
import { MutableRef } from 'effect'
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

// ─── Particle pool ─────────────────────────────────────────────────────────────
//
// Encapsulates all mutable typed-array state and internal helpers (findOldestSlot,
// acquireSlot, randInRange). The pool owns the pre-allocated buffers and the
// Three.js InstancedMesh. The service factory delegates to this object and only
// handles Effect wiring and scope/lifecycle management.

export type ParticlePool = {
  readonly positions: Float32Array
  readonly velocities: Float32Array
  readonly lifetimes: Float32Array
  readonly uvOffsets: Float32Array
  readonly ages: Float32Array
  readonly mesh: THREE.InstancedMesh
  readonly uvOffsetAttribute: THREE.InstancedBufferAttribute
  readonly scratchMatrix: THREE.Matrix4
  readonly scratchPos: THREE.Vector3
  readonly scratchScale: THREE.Vector3
  readonly scratchQuat: THREE.Quaternion
  readonly nextSlotRef: MutableRef.MutableRef<number>
  readonly ageCounterRef: MutableRef.MutableRef<number>
  readonly activeCountRef: MutableRef.MutableRef<number>
  readonly acquireSlot: () => number
  readonly randInRange: (min: number, max: number) => number
}

export const createParticlePool = (
  geometry: THREE.PlaneGeometry,
  material: THREE.MeshBasicMaterial,
): ParticlePool => {
  // Pre-allocated typed-array state buffers. Allocated ONCE; never reallocated.
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const velocities = new Float32Array(MAX_PARTICLES * 3)
  const lifetimes = new Float32Array(MAX_PARTICLES) // 0 = inactive
  const uvOffsets = new Float32Array(MAX_PARTICLES * 2)
  // Per-instance "spawn frame" counter used to find the OLDEST active slot
  // when the pool is full. Wraps every ~136 years at 60fps — irrelevant.
  const ages = new Float32Array(MAX_PARTICLES)

  const scratchMatrix = new THREE.Matrix4()
  const scratchPos = new THREE.Vector3()
  const scratchScale = new THREE.Vector3(1, 1, 1)
  const scratchQuat = new THREE.Quaternion()

  const nextSlotRef = MutableRef.make(0)
  const ageCounterRef = MutableRef.make(0)
  const activeCountRef = MutableRef.make(0)

  // Per-instance UV offset attribute — a custom InstancedBufferAttribute.
  const uvOffsetAttribute = new THREE.InstancedBufferAttribute(uvOffsets, 2)
  uvOffsetAttribute.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('uvOffset', uvOffsetAttribute)

  const mesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES)
  mesh.frustumCulled = false // particles always near player; skip per-frame test
  mesh.castShadow = false
  mesh.receiveShadow = false
  // Initialize all slots as hidden (zero-scale matrix).
  for (let i = 0; i < MAX_PARTICLES; i++) {
    mesh.setMatrixAt(i, ZERO_MATRIX)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const findOldestSlot = (): number => {
    // Linear scan to find slot with smallest `age`. O(N) but N=512 and
    // this only runs when pool is fully saturated.
    let oldestIdx = 0
    let oldestAge = Number.POSITIVE_INFINITY
    for (let i = 0; i < MAX_PARTICLES; i++) {
      // Age 0 here means "never used" so we still treat it as a candidate
      // — but a slot with lifetime>0 has been used and `age` reflects the
      // spawn count. Lower age = older slot.
      if (lifetimes[i]! > 0 && ages[i]! < oldestAge) {
        oldestAge = ages[i]!
        oldestIdx = i
      }
    }
    return oldestIdx
  }

  const acquireSlot = (): number => {
    const active = MutableRef.get(activeCountRef)
    if (active < MAX_PARTICLES) {
      // Walk forward looking for an inactive (lifetime=0) slot, starting
      // from `nextSlot`. Worst case scans all slots — but only happens
      // when free slots are sparse; the common path finds a free slot
      // immediately.
      let slot = MutableRef.get(nextSlotRef)
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const candidate = (slot + i) % MAX_PARTICLES
        if (lifetimes[candidate] === 0) {
          MutableRef.set(nextSlotRef, (candidate + 1) % MAX_PARTICLES)
          MutableRef.set(activeCountRef, active + 1)
          return candidate
        }
        /* c8 ignore next 4 */
      }
      // Fall through: state is inconsistent (active < MAX but no free slot
      // found). Treat as a saturated pool and recycle.
    }
    // Pool full → evict oldest.
    return findOldestSlot()
  }

  // Tiny xorshift PRNG would avoid Math.random's allocator cost, but
  // Math.random is already non-allocating in modern V8. Stick with it.
  const randInRange = (min: number, max: number): number =>
    min + Math.random() * (max - min)

  return {
    positions,
    velocities,
    lifetimes,
    uvOffsets,
    ages,
    mesh,
    uvOffsetAttribute,
    scratchMatrix,
    scratchPos,
    scratchScale,
    scratchQuat,
    nextSlotRef,
    ageCounterRef,
    activeCountRef,
    acquireSlot,
    randInRange,
  }
}
