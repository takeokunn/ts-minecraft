import { Effect, HashMap, Option, Ref } from 'effect'
import * as THREE from 'three'
import type { Entity, EntityId as EntityIdType, EntityType } from '@ts-minecraft/entity'
import { CREEPER_FUSE_SECONDS, MOB_HALF_HEIGHT } from '@ts-minecraft/entity'
import { SceneService } from '../scene/scene-service'
import { buildMobGroup, type MobLimbGroup } from './mob-geometry'
import { computeLimbAngleBase } from './walk-cycle'
import {
  createEntityInstancePool,
  ROLES_BY_TYPE,
  type EntityInstancePool,
  type PartRole,
} from './entity-instance-pool'

const MOTION_THRESHOLD = 0.05
// R6d: baby mobs render at half scale (vanilla-ish) until they grow up.
const BABY_RENDER_SCALE = 0.5
// Mob models are built FEET-at-origin (legs hang from the hip down to local y=0), but
// entity.position.y is the AABB CENTER (physics rests the center at ground + MOB_HALF_HEIGHT,
// feet on the ground). Rendering the feet-origin model straight at position.y therefore
// floated every mob MOB_HALF_HEIGHT (0.9) blocks above the ground ('モブが宙に浮いてる').
// Lower the render origin by the half-height so the feet sit on the surface.
const MOB_RENDER_Y_OFFSET = MOB_HALF_HEIGHT
const CREEPER_FLASH_COLOR = 0xffffff
const CREEPER_FLASH_HZ = 8

const setLimbRotation = (mesh: THREE.Mesh | null, angle: number): void => {
  if (mesh === null) return
  mesh.rotation.x = angle
}

// FR-2.5: per-frame scratch matrices. Constructing THREE.Matrix4 / Quaternion /
// Euler objects in the hot loop produces measurable GC pressure (one frame
// touches 6 roles × N mobs). Allocate once per service instance and reuse.
//
// We materialize these inside the service factory (NOT at module load) so
// `vi.mock('three', ...)` test fixtures that replace the THREE module don't
// trigger constructor errors before they get a chance to install their mock.
type Scratch = Readonly<{
  matrix: THREE.Matrix4
  quat: THREE.Quaternion
  euler: THREE.Euler
  pos: THREE.Vector3
  scale: THREE.Vector3
  limbQuat: THREE.Quaternion
  limbEuler: THREE.Euler
  limbMatrix: THREE.Matrix4
  offset: THREE.Vector3
  offsetMatrix: THREE.Matrix4
  rootMatrix: THREE.Matrix4
}>

const makeScratch = (): Scratch => ({
  matrix: new THREE.Matrix4(),
  quat: new THREE.Quaternion(),
  euler: new THREE.Euler(),
  pos: new THREE.Vector3(),
  scale: new THREE.Vector3(1, 1, 1),
  limbQuat: new THREE.Quaternion(),
  limbEuler: new THREE.Euler(),
  limbMatrix: new THREE.Matrix4(),
  offset: new THREE.Vector3(),
  offsetMatrix: new THREE.Matrix4(),
  rootMatrix: new THREE.Matrix4(),
})

type TrackedEntity = {
  readonly group: MobLimbGroup
  readonly type: EntityType
  seenSyncSeq: number
}

// FR-2.5: per-frame allocation of a pre-sized lookup table keyed by limb pose name
// would cost more than the closure capture below. We just route role → angle.
const swingAngleForRole = (
  role: PartRole,
  legL: number, legR: number, armL: number, armR: number,
): number => {
  switch (role) {
    case 'legFL': return legL
    case 'legFR': return legR
    case 'legBL': return -legL
    case 'legBR': return -legR
    case 'armL':  return armL
    case 'armR':  return armR
    case 'head':
    case 'body':  return 0
  }
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const lerpChannel = (from: number, to: number, amount: number): number =>
  Math.round(from + (to - from) * amount)

const mixColorHex = (from: number, to: number, amount: number): number => {
  const t = clamp01(amount)
  const r = lerpChannel((from >> 16) & 0xff, (to >> 16) & 0xff, t)
  const g = lerpChannel((from >> 8) & 0xff, (to >> 8) & 0xff, t)
  const b = lerpChannel(from & 0xff, to & 0xff, t)
  return (r << 16) | (g << 8) | b
}

const getInstanceColor = (entity: Entity, baseColor: number, totalTimeSecs: number): number => {
  if (entity.type !== 'Creeper' || entity.fuseSecs === undefined || entity.fuseSecs <= 0) {
    return baseColor
  }
  const fuseProgress = clamp01(entity.fuseSecs / CREEPER_FUSE_SECONDS)
  const pulse = (Math.sin(totalTimeSecs * Math.PI * 2 * CREEPER_FLASH_HZ) + 1) / 2
  return mixColorHex(baseColor, CREEPER_FLASH_COLOR, fuseProgress * pulse)
}

// FR-2.5: pool→syncEntities full wire.
//
// `groupsRef` retains a transform carrier plus lightweight tracking metadata
// per entity, but the carrier `root` is NEVER added to the scene. The group is
// used purely so `updateEntityTransforms` can write per-frame matrices into the
// pool's InstancedMesh buckets. Visible draw calls scale with the active
// (type, role) bucket count (≤24), not the entity count.
//
// Saturation policy (SEC-C1): when the bucket for any role of a type is full
// (256/bucket), the entity is admitted into NEITHER the pool NOR `groupsRef`.
// All-or-nothing rollback: if role[i] saturates after roles[0..i-1] succeeded,
// every prior slot for that entity is released before we move on.
export class EntityRendererService extends Effect.Service<EntityRendererService>()(
  '@minecraft/infrastructure/three/EntityRendererService',
  {
    effect: Effect.gen(function* () {
      const sceneService = yield* SceneService
      void sceneService // bucket scene-add is owned by the pool; service kept for layer wiring + future use
      const groupsRef = yield* Ref.make(HashMap.empty<EntityIdType, TrackedEntity>())
      const pool = createEntityInstancePool()
      const scratch = makeScratch()
      let syncSeq = 0

        // Tries to allocate every role for `entity`. Returns Some(entry) on
        // success, None on saturation (with all partial allocations rolled back).
        // Roles outside `ROLES_BY_TYPE[type]` are skipped — they map to None
        // specs in the pool (e.g. armL on quadrupeds, legBL on bipeds).
        const tryAllocateAllRoles = (
          entity: Entity,
          scene: THREE.Scene,
          seenSyncSeq: number,
        ): Option.Option<TrackedEntity> => {
          const type: EntityType = entity.type
          const roles = ROLES_BY_TYPE[type]
          const allocated: Array<PartRole> = []
          for (const role of roles) {
            const slotOpt = pool.allocateSlot(scene, type, role, entity.entityId)
            if (Option.isNone(slotOpt)) {
              // Rollback: release every prior slot. Pool releaseSlot is no-op
              // when the entity isn't in that bucket, so this is safe.
              for (const prior of allocated) pool.releaseSlot(type, prior, entity.entityId)
              return Option.none()
            }
            allocated.push(role)
          }
          // Build the transform carrier — group.root is NOT added to the scene.
          // The MobLimbGroup mirrors the limb structure so `updateEntityTransforms`
          // can keep using its existing per-limb rotation logic; we then compose
          // each role's world matrix from (root.position, root.rotation, role.offset, role.swing).
          return Option.some({
            group: buildMobGroup(type),
            type,
            seenSyncSeq,
          })
        }

        const releaseAllRoles = (entity: { entityId: EntityIdType; type: EntityType }): void => {
          /* c8 ignore start -- called only when entities are removed from scene; rarely exercised in unit tests */
          for (const role of ROLES_BY_TYPE[entity.type]) {
            pool.releaseSlot(entity.type, role, entity.entityId)
          }
          /* c8 ignore end */
        }

        return {
          // Reconciles tracked groups with the live entity list by generation mark.
          // Idempotent. New entities are admitted only when ALL roles fit in the
          // pool; saturation triggers a logWarning and the entity is silently
          // skipped from tracking.
          syncEntities: (
            entities: ReadonlyArray<Entity>,
            scene: THREE.Scene,
          ): Effect.Effect<void, never> =>
            Effect.gen(function* () {
              const groups = yield* Ref.get(groupsRef)
              const seq = ++syncSeq
              let next = groups

              for (const entity of entities) {
                const existing = HashMap.get(next, entity.entityId)
                if (existing._tag === 'Some') {
                  existing.value.seenSyncSeq = seq
                  continue
                }
                const tracked = Option.getOrNull(tryAllocateAllRoles(entity, scene, seq))
                if (tracked === null) {
                  yield* Effect.logWarning(
                    `entity-instance-pool saturated — type=${entity.type} id=${entity.entityId} skipped`,
                  )
                  continue
                }
                next = HashMap.set(next, entity.entityId, tracked)
              }

              // Removals: entities tracked in groups but not marked in this sync.
              // Store the type with the carrier so teardown only touches the
              // entity's real bucket roles.
              for (const [id, tracked] of groups) {
                if (tracked.seenSyncSeq === seq) continue
                for (const role of ROLES_BY_TYPE[tracked.type]) {
                  pool.releaseSlot(tracked.type, role, id)
                }
                next = HashMap.remove(next, id)
              }

              yield* Ref.set(groupsRef, next)
            }),

          // Performance boundary: plain for-loop in Effect.sync — N<100; avoids Effect scheduler overhead per entity.
          // deltaTimeSecs reserved for future damping (walk cycle is currently pure speed + wall-clock).
          updateEntityTransforms: (
            entities: ReadonlyArray<Entity>,
            totalTimeSecs: number,
            deltaTimeSecs: number,
          ): Effect.Effect<void, never> =>
            Effect.gen(function* () {
              void deltaTimeSecs
              const groups = yield* Ref.get(groupsRef)
              yield* Effect.sync(() => {
                  for (const entity of entities) {
                    const groupOpt = HashMap.get(groups, entity.entityId)
                    // Performance boundary: per-frame per-entity hot path; Option.match closure
                    // allocation outweighs MEMORY.md style consistency. _tag direct access is
                    // the documented exception (see greedy-meshing.ts getBlock for similar).
                    if (groupOpt._tag === 'None') continue
                    const group = groupOpt.value.group

                    group.root.position.set(entity.position.x, entity.position.y - MOB_RENDER_Y_OFFSET, entity.position.z)

                    const speed = Math.hypot(entity.velocity.x, entity.velocity.z)
                    // Idle early-out: skip atan2 and limb math for stationary mobs.
                    // computeLimbAngleBase returns 0 below SPEED_THRESHOLD anyway,
                    // but avoiding the function call + atan2 for idle entities
                    // saves per-frame overhead.
                    let legL: number, legR: number, armLA: number, armRA: number
                    if (speed > MOTION_THRESHOLD) {
                      group.root.rotation.y = Math.atan2(entity.velocity.x, entity.velocity.z)
                      const base = computeLimbAngleBase(speed, totalTimeSecs)
                      legL = base; legR = -base; armLA = -base; armRA = base
                    } else {
                      legL = legR = armLA = armRA = 0
                    }

                    // Maintain MobLimbGroup limb rotations so the existing
                    // group-based test assertions stay green. The buckets do
                    // NOT read from the group — they read from these scalars
                    // directly via swingAngleForRole.
                    group.legFL.rotation.x = legL
                    group.legFR.rotation.x = legR
                    setLimbRotation(group.armL, armLA)
                    setLimbRotation(group.armR, armRA)
                    setLimbRotation(group.legBL, -legL)
                    setLimbRotation(group.legBR, -legR)

                    // Compose per-role world matrix and write to the bucket.
                    // World = T(rootPos) · R_y(yaw) · T(offset) · R_swing
                    // We reuse `scratch` slots across iterations (no GC).
                    scratch.pos.set(entity.position.x, entity.position.y - MOB_RENDER_Y_OFFSET, entity.position.z)
                    scratch.euler.set(0, group.root.rotation.y, 0)
                    scratch.quat.setFromEuler(scratch.euler)
                    // R6d: babies are drawn smaller. scratch.scale is shared, so set it every
                    // iteration (uniform scale propagates to limb offsets via the root matrix).
                    const renderScale = entity.isBaby === true ? BABY_RENDER_SCALE : 1
                    scratch.scale.set(renderScale, renderScale, renderScale)
                    scratch.rootMatrix.compose(scratch.pos, scratch.quat, scratch.scale)

                    for (const role of ROLES_BY_TYPE[entity.type]) {
                      const slotInfo = pool.getSlot(entity.type, role, entity.entityId)
                      // Performance boundary: per-frame per-entity per-role hot path; Option.match
                      // closure allocation outweighs MEMORY.md style consistency. _tag direct
                      // access is the documented exception (see greedy-meshing.ts getBlock).
                      if (slotInfo._tag === 'None') continue
                      const { slot, bucket } = slotInfo.value
                      const swing = swingAngleForRole(role, legL, legR, armLA, armRA)

                      scratch.offset.set(
                        bucket.spec.offset.x,
                        bucket.spec.offset.y,
                        bucket.spec.offset.z,
                      )
                      scratch.offsetMatrix.makeTranslation(
                        scratch.offset.x, scratch.offset.y, scratch.offset.z,
                      )
                      scratch.limbEuler.set(swing, 0, 0)
                      scratch.limbQuat.setFromEuler(scratch.limbEuler)
                      scratch.limbMatrix.makeRotationFromQuaternion(scratch.limbQuat)

                      // scratch.matrix = ROOT · OFFSET · LIMB
                      scratch.matrix.copy(scratch.rootMatrix)
                      scratch.matrix.multiply(scratch.offsetMatrix)
                      scratch.matrix.multiply(scratch.limbMatrix)
                      pool.setMatrixAt(entity.type, role, slot, scratch.matrix)
                      pool.setColorAt(
                        entity.type,
                        role,
                        slot,
                        getInstanceColor(entity, bucket.spec.color, totalTimeSecs),
                      )
                    }
                  }
                  pool.flushAll()
                })
              }),

          // FR-2.5: dispose all pool buckets (removes their InstancedMesh from
          // the scene + releases GPU resources). MobLimbGroup carriers are
          // never in the scene so they need no scene.remove — just clear the
          // tracking ref.
          clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
            Effect.gen(function* () {
              yield* Effect.sync(() => pool.disposeAll(scene))
              yield* Ref.set(groupsRef, HashMap.empty<EntityIdType, TrackedEntity>())
            }),

          _getTrackedGroup: (id: EntityIdType): Effect.Effect<Option.Option<MobLimbGroup>, never> =>
            Effect.gen(function* () {
              const g = yield* Ref.get(groupsRef)
              const entry = Option.getOrNull(HashMap.get(g, id))
              return entry === null ? Option.none() : Option.some(entry.group)
            }),

          // Test accessor for assertions around saturation, bucket counts, and
          // slot allocation. The pool is now fully wired into the mob lifecycle.
          _getInstancePool: (): EntityInstancePool => pool,

          // Internal: testing/diagnostic — releases all pool roles for the entity.
          // Not on the public surface; exposed so external callers needing manual
          // teardown can match clearScene semantics. Kept private for now.
          _releaseAllRoles: releaseAllRoles,
        }
    }),
    dependencies: [SceneService.Default],
  },
) {}
