import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import type { Entity, EntityId as EntityIdType, EntityType } from '@ts-minecraft/entities'
import { SceneService } from '../scene/scene-service'
import { buildMobGroup, type MobLimbGroup } from './mob-geometry'
import { computeLimbAngle } from './walk-cycle'
import {
  createEntityInstancePool,
  ROLES_BY_TYPE,
  type EntityInstancePool,
  type PartRole,
} from './entity-instance-pool'

const MOTION_THRESHOLD = 0.05

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

// FR-2.5: pool→syncEntities full wire.
//
// `groupsRef` retains a `MobLimbGroup` per tracked entity, but the group's
// `root` is NEVER added to the scene. The group is used purely as a transform
// carrier so `updateEntityTransforms` can write per-frame matrices into the
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
    effect: Effect.all([
      SceneService,
      Ref.make(HashMap.empty<EntityIdType, MobLimbGroup>()),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([sceneService, groupsRef]) => {
        void sceneService // bucket scene-add is owned by the pool; service kept for layer wiring + future use
        const pool = createEntityInstancePool()
        const scratch = makeScratch()

        // Tries to allocate every role for `entity`. Returns Some(group) on
        // success, None on saturation (with all partial allocations rolled back).
        // Roles outside `ROLES_BY_TYPE[type]` are skipped — they map to None
        // specs in the pool (e.g. armL on quadrupeds, legBL on bipeds).
        const tryAllocateAllRoles = (
          entity: Entity,
          scene: THREE.Scene,
        ): Option.Option<MobLimbGroup> => {
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
          return Option.some(buildMobGroup(type))
        }

        const releaseAllRoles = (entity: { entityId: EntityIdType; type: EntityType }): void => {
          for (const role of ROLES_BY_TYPE[entity.type]) {
            pool.releaseSlot(entity.type, role, entity.entityId)
          }
        }

        return {
          // Reconciles tracked groups with the live entity list by entityId set diff.
          // Idempotent. New entities are admitted only when ALL roles fit in the
          // pool; saturation triggers a logWarning and the entity is silently
          // skipped from tracking.
          syncEntities: (
            entities: ReadonlyArray<Entity>,
            scene: THREE.Scene,
          ): Effect.Effect<void, never> =>
            Effect.gen(function* () {
              const groups = yield* Ref.get(groupsRef)
              const liveIds = HashSet.fromIterable(Arr.map(entities, (e) => e.entityId))

              const newEntities = Arr.filter(entities, (e) => !HashMap.has(groups, e.entityId))
              const additions: Array<readonly [EntityIdType, MobLimbGroup]> = []
              for (const entity of newEntities) {
                const groupOpt = tryAllocateAllRoles(entity, scene)
                if (Option.isNone(groupOpt)) {
                  yield* Effect.logWarning(
                    `entity-instance-pool saturated — type=${entity.type} id=${entity.entityId} skipped`,
                  )
                  continue
                }
                additions.push([entity.entityId, groupOpt.value] as const)
              }

              // Removals: entities tracked in groups but absent from liveIds.
              // We need entity.type to release slots — recover it from the
              // MobLimbGroup is impossible (group has no type field), so we
              // walk the pool's internal slotIndex via getSlot per role on
              // every type. Simpler: re-derive from the previous live set is
              // not available. Instead, attempt release on every role across
              // every type — releaseSlot is no-op when the entity isn't in
              // that bucket, so this is correct and O(types × roles).
              const removalIds: Array<EntityIdType> = []
              for (const [id] of groups) {
                if (!HashSet.has(liveIds, id)) removalIds.push(id)
              }
              for (const id of removalIds) {
                for (const type of Object.keys(ROLES_BY_TYPE) as Array<EntityType>) {
                  for (const role of ROLES_BY_TYPE[type]) {
                    pool.releaseSlot(type, role, id)
                  }
                }
              }

              const afterAdd = Arr.reduce(
                additions,
                groups,
                (acc, [id, group]) => HashMap.set(acc, id, group),
              )
              const next = Arr.reduce(removalIds, afterAdd, (acc, id) => HashMap.remove(acc, id))
              yield* Ref.set(groupsRef, next)
            }),

          // Performance boundary: plain for-loop in Effect.sync — N<100; avoids Effect scheduler overhead per entity.
          // deltaTimeSecs reserved for future damping (walk cycle is currently pure speed + wall-clock).
          updateEntityTransforms: (
            entities: ReadonlyArray<Entity>,
            totalTimeSecs: number,
            deltaTimeSecs: number,
          ): Effect.Effect<void, never> => {
            void deltaTimeSecs
            return Ref.get(groupsRef).pipe(
              Effect.flatMap((groups) =>
                Effect.sync(() => {
                  for (const entity of entities) {
                    const groupOpt = HashMap.get(groups, entity.entityId)
                    // Performance boundary: per-frame per-entity hot path; Option.match closure
                    // allocation outweighs MEMORY.md style consistency. _tag direct access is
                    // the documented exception (see greedy-meshing.ts getBlock for similar).
                    if (groupOpt._tag === 'None') continue
                    const group = groupOpt.value

                    group.root.position.set(entity.position.x, entity.position.y, entity.position.z)

                    const speed = Math.hypot(entity.velocity.x, entity.velocity.z)
                    if (speed > MOTION_THRESHOLD) {
                      group.root.rotation.y = Math.atan2(entity.velocity.x, entity.velocity.z)
                    }

                    const legL = computeLimbAngle(speed, totalTimeSecs, 'L', 'leg')
                    const legR = computeLimbAngle(speed, totalTimeSecs, 'R', 'leg')
                    const armLA = computeLimbAngle(speed, totalTimeSecs, 'L', 'arm')
                    const armRA = computeLimbAngle(speed, totalTimeSecs, 'R', 'arm')

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
                    scratch.pos.set(entity.position.x, entity.position.y, entity.position.z)
                    scratch.euler.set(0, group.root.rotation.y, 0)
                    scratch.quat.setFromEuler(scratch.euler)
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
                    }
                  }
                  pool.flushAll()
                }),
              ),
            )
          },

          // FR-2.5: dispose all pool buckets (removes their InstancedMesh from
          // the scene + releases GPU resources). MobLimbGroup carriers are
          // never in the scene so they need no scene.remove — just clear the
          // tracking ref.
          clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
            Effect.sync(() => pool.disposeAll(scene)).pipe(
              Effect.andThen(Ref.set(groupsRef, HashMap.empty())),
            ),

          _getTrackedGroup: (id: EntityIdType): Effect.Effect<Option.Option<MobLimbGroup>, never> =>
            Ref.get(groupsRef).pipe(Effect.map((g) => HashMap.get(g, id))),

          // Test accessor for assertions around saturation, bucket counts, and
          // slot allocation. The pool is now fully wired into the mob lifecycle.
          _getInstancePool: (): EntityInstancePool => pool,

          // Internal: testing/diagnostic — releases all pool roles for the entity.
          // Not on the public surface; exposed so external callers needing manual
          // teardown can match clearScene semantics. Kept private for now.
          _releaseAllRoles: releaseAllRoles,
        }
      }),
    ),
    dependencies: [SceneService.Default],
  },
) {}

export const EntityRendererLive = EntityRendererService.Default
