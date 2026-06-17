// @effect-boundary Three.js particle adapter validates renderer capabilities at the WebGL boundary.
import { Effect, MutableRef, type Scope } from 'effect'
import * as THREE from 'three'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import {
  buildParticleGeometry,
  createParticlePool,
  MAX_PARTICLES,
  PARTICLE_GRAVITY,
  PARTICLE_LIFETIME_SECS,
  SPREAD_DOWN,
  SPREAD_HORIZONTAL,
  SPREAD_UP,
  TILE_FRACTION,
  ZERO_MATRIX,
} from './particle-system-factory'
export { getParticleUvOffset, MAX_PARTICLES, PARTICLE_LIFETIME_SECS } from './particle-system-factory'

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

      // Build geometry + atlas material once.
      const geometry = buildParticleGeometry(TILE_FRACTION)

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

      // Pool owns all typed-array state, the InstancedMesh, and internal helpers.
      const pool = createParticlePool(geometry, material)
      const {
        positions, velocities, lifetimes, uvOffsets, ages,
        mesh, uvOffsetAttribute,
        scratchMatrix, scratchPos, scratchScale, scratchQuat,
        ageCounterRef, activeCountRef, acquireSlot, randInRange,
      } = pool

      // Geometry + material are released at scope close. Scene attachment is
      // managed separately via `attach()` so the scope owner controls lifecycle.
      yield* Effect.acquireRelease(Effect.void, () =>
        Effect.sync(() => {
          geometry.dispose()
          material.dispose()
        }),
      )

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
            const nextAge = MutableRef.get(ageCounterRef) + 1
            MutableRef.set(ageCounterRef, nextAge)
            ages[slot] = nextAge

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
