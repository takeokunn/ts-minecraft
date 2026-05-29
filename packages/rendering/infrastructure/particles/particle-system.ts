import { Effect, MutableRef, type Scope } from 'effect'
import * as THREE from 'three'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import { getTileIndex, getTileUVs, type FaceDir } from '../textures/block-texture-map'

// Particle system (FR-1.6) — pre-allocated InstancedMesh pool for block-break visuals.
// p99 frame impact ≤ 1ms; ZERO per-particle GC allocation in update()/spawnBurst(); pool size fixed at 512.
// State: Float32Array pre-allocated for positions/velocities/lifetimes/uvOffsets.
// Inactive slots use ZERO_MATRIX (scale=0); Euler integrator, NOT PhysicsService (wrong scope for visual flecks).

export const MAX_PARTICLES = 512
export const PARTICLE_LIFETIME_SECS = 0.5
const PARTICLE_GRAVITY = 12 // m/s² — tuned to feel snappy in 0.5s lifetime
const PARTICLE_BASE_SIZE = 0.1
// Default burst velocity envelope — random uniform per axis.
// Tuned so 6-particle bursts visually scatter without leaving the 1m source cube.
const SPREAD_HORIZONTAL = 2.0 // m/s
const SPREAD_UP = 3.0          // m/s upward kick
const SPREAD_DOWN = 0.5        // m/s downward seed (so some particles fall faster)

// Tile size (in atlas UV space) — particle quad samples a single tile patch
// so per-particle UV varies by `(uOffset, vOffset)` from the base UV (0,0)..(tileSize,tileSize).
const TILE_FRACTION = 1 / 16 // ATLAS_COLS=16; one tile spans 1/16 of UV space

// Pre-built constant: identity matrix scaled to zero (inactive slot marker).
// Allocated once at module load — never recreated.
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0)

// Per-instance UV comes from `uvOffset` instanced buffer attribute, sampled via onBeforeCompile shader patch.
const buildParticleGeometry = (atlasTileFraction: number): THREE.PlaneGeometry => {
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

export type ParticleSystemServiceAPI = {
  // Must be called exactly once per session, inside an Effect.scoped parent. Finalizer removes mesh from scene.
  readonly attach: (scene: THREE.Scene) => Effect.Effect<void, never, Scope.Scope>

  // Synchronous — no allocation in hot path. uvU/uvV from getParticleUvOffset(blockId).
  readonly spawnBurst: (
    x: number,
    y: number,
    z: number,
    uvU: number,
    uvV: number,
    count?: number,
  ) => Effect.Effect<void, never>

  // O(N) cache-friendly typed-array sweep. Writes instanceMatrix exactly once per call.
  readonly update: (dtSecs: number) => Effect.Effect<void, never>

  readonly getActiveCount: () => Effect.Effect<number, never>
}

export class ParticleSystemService extends Effect.Service<ParticleSystemService>()(
  '@minecraft/infrastructure/three/ParticleSystemService',
  {
    scoped: Effect.gen(function* () {
      const chunkMeshService = yield* ChunkMeshService

      // Pre-allocated typed-array state buffers. Allocated ONCE; never reallocated.
      const positions = new Float32Array(MAX_PARTICLES * 3)
      const velocities = new Float32Array(MAX_PARTICLES * 3)
      const lifetimes = new Float32Array(MAX_PARTICLES) // 0 = inactive
      const uvOffsets = new Float32Array(MAX_PARTICLES * 2)
      // Per-instance "spawn frame" counter used to find the OLDEST active slot
      // when the pool is full. Wraps every ~136 years at 60fps — irrelevant.
      // Stored as Float32 because JS Number bitwidth doesn't matter here and
      // Float32 keeps the state vector homogeneous in cache layout.
      const ages = new Float32Array(MAX_PARTICLES)

      // Pre-allocated scratch — reused EVERY update / spawn. No per-call alloc.
      const scratchMatrix = new THREE.Matrix4()
      const scratchPos = new THREE.Vector3()
      const scratchScale = new THREE.Vector3(1, 1, 1)
      const scratchQuat = new THREE.Quaternion()

      // Walking-pointer for next slot to write. When `activeCount === MAX`,
      // the burst-spawner falls back to "evict oldest" (linear scan over `ages`).
      const nextSlotRef = MutableRef.make(0)
      const ageCounterRef = MutableRef.make(0)
      const activeCountRef = MutableRef.make(0)

      // Build geometry, atlas material, and InstancedMesh once.
      const geometry = buildParticleGeometry(TILE_FRACTION)
      // Per-instance UV offset attribute — a custom InstancedBufferAttribute.
      // Sampled in the vertex shader via onBeforeCompile patch.
      const uvOffsetAttribute = new THREE.InstancedBufferAttribute(uvOffsets, 2)
      uvOffsetAttribute.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute('uvOffset', uvOffsetAttribute)

      // MeshBasicMaterial keyed off the atlas — no lighting needed (particles
      // are short-lived flecks that look better unlit).
      const material = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        map: chunkMeshService.atlasTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      // Patch the shader to add the `uvOffset` instanced attribute to the
      // sampled UV. Three.js' MeshBasicMaterial ships with a `vUv = uv;` line
      // we hook before texture sampling.
      material.onBeforeCompile = (shader) => {
        // Inject attribute declaration + offset application.
        // The replace tokens come from Three.js' built-in `uv_pars_vertex` and
        // `uv_vertex` shader chunks. Guard against silent breakage on upgrade.
        if (
          !shader.vertexShader.includes('#include <uv_pars_vertex>') ||
          !shader.vertexShader.includes('#include <uv_vertex>')
        ) {
          throw new Error(
            'particle-system: Three.js vertex shader tokens for uvOffset injection not found',
          )
        }
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <uv_pars_vertex>',
            `#include <uv_pars_vertex>\nattribute vec2 uvOffset;`,
          )
          .replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = vMapUv + uvOffset;\n#endif`,
          )
      }
      material.needsUpdate = true

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

      // Geometry + material are released at scope close. Scene attachment is
      // managed separately via `attach()` so the scope owner controls lifecycle.
      yield* Effect.acquireRelease(Effect.void, () =>
        Effect.sync(() => {
          geometry.dispose()
          material.dispose()
        }),
      )

      // ── Internal helpers (no allocation) ───────────────────────────────────

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

      // ── Service API ────────────────────────────────────────────────────────

      const attach = (scene: THREE.Scene): Effect.Effect<void, never, Scope.Scope> =>
        Effect.acquireRelease(
          Effect.sync(() => {
            scene.add(mesh)
          }),
          () =>
            Effect.sync(() => {
              scene.remove(mesh)
            }),
        )

      const spawnBurst = (
        x: number,
        y: number,
        z: number,
        uvU: number,
        uvV: number,
        count: number = 6,
      ): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const clamped = Math.max(1, Math.min(MAX_PARTICLES, Math.floor(count)))
          for (let i = 0; i < clamped; i++) {
            const slot = acquireSlot()
            const p3 = slot * 3
            const v3 = slot * 3
            const u2 = slot * 2

            positions[p3] = x
            positions[p3 + 1] = y
            positions[p3 + 2] = z

            velocities[v3] = randInRange(-SPREAD_HORIZONTAL, SPREAD_HORIZONTAL)
            velocities[v3 + 1] = randInRange(-SPREAD_DOWN, SPREAD_UP)
            velocities[v3 + 2] = randInRange(-SPREAD_HORIZONTAL, SPREAD_HORIZONTAL)

            uvOffsets[u2] = uvU
            uvOffsets[u2 + 1] = uvV

            lifetimes[slot] = PARTICLE_LIFETIME_SECS
            ages[slot] = MutableRef.updateAndGet(ageCounterRef, (n) => n + 1)

            // Make the particle visible THIS frame even if `update()` hasn't run yet.
            scratchPos.set(x, y, z)
            scratchScale.set(1, 1, 1)
            scratchMatrix.compose(scratchPos, scratchQuat, scratchScale)
            mesh.setMatrixAt(slot, scratchMatrix)
          }
          uvOffsetAttribute.needsUpdate = true
          mesh.instanceMatrix.needsUpdate = true
        })

      const update = (dtSecs: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          // Clamp dt — at the start of a tab-resumed frame dtSecs can be huge
          // and we don't want particles to teleport into orbit.
          const dt = Math.max(0, Math.min(dtSecs, 0.1))
          let activeReleased = 0
          for (let slot = 0; slot < MAX_PARTICLES; slot++) {
            const lifeRemaining = lifetimes[slot]!
            if (lifeRemaining <= 0) {
              // Already inactive — nothing to do; matrix was set to ZERO at
              // last expiry (or at init). Skip.
              continue
            }
            const newLife = lifeRemaining - dt
            if (newLife <= 0) {
              // Expired this frame: hide and free slot.
              lifetimes[slot] = 0
              ages[slot] = 0
              mesh.setMatrixAt(slot, ZERO_MATRIX)
              activeReleased++
              continue
            }
            lifetimes[slot] = newLife

            const p3 = slot * 3
            const v3 = slot * 3

            // Euler integration: velocity += gravity * dt, position += velocity * dt.
            velocities[v3 + 1] = velocities[v3 + 1]! - PARTICLE_GRAVITY * dt
            positions[p3] = positions[p3]! + velocities[v3]! * dt
            positions[p3 + 1] = positions[p3 + 1]! + velocities[v3 + 1]! * dt
            positions[p3 + 2] = positions[p3 + 2]! + velocities[v3 + 2]! * dt

            scratchPos.set(positions[p3]!, positions[p3 + 1]!, positions[p3 + 2]!)
            // Lifetime fade: scale from 1 → 0 across remaining lifetime.
            const fadeFactor = newLife / PARTICLE_LIFETIME_SECS
            scratchScale.set(fadeFactor, fadeFactor, fadeFactor)
            scratchMatrix.compose(scratchPos, scratchQuat, scratchScale)
            mesh.setMatrixAt(slot, scratchMatrix)
          }
          if (activeReleased > 0) {
            const cur = MutableRef.get(activeCountRef)
            MutableRef.set(activeCountRef, Math.max(0, cur - activeReleased))
          }
          mesh.instanceMatrix.needsUpdate = true
        })

      const getActiveCount = (): Effect.Effect<number, never> =>
        Effect.sync(() => MutableRef.get(activeCountRef))

      return {
        attach,
        spawnBurst,
        update,
        getActiveCount,
      } satisfies ParticleSystemServiceAPI
    }),
  },
) {}

export const ParticleSystemServiceLive = ParticleSystemService.Default
