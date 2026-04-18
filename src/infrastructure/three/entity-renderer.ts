import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import type { Entity, EntityId as EntityIdType } from '@/entity/entity'
import { SceneService } from './scene/scene-service'
import { buildMobGroup, type MobLimbGroup } from './entity/mob-geometry'
import { computeLimbAngle } from './entity/walk-cycle'

const MOTION_THRESHOLD = 0.05

const setLimbRotation = (mesh: THREE.Mesh | null, angle: number): void => {
  if (mesh === null) return
  mesh.rotation.x = angle
}

/**
 * EntityRendererService — keeps a THREE.Group per tracked entity in sync with
 * the game's mob list. Add/remove based on entityId set diff; per-frame
 * transform + walk-cycle update applied to every tracked group.
 *
 * State: Ref<HashMap<EntityId, MobLimbGroup>>. Geometries and materials owned
 * by mob-geometry are shared per-type; this service does NOT dispose them.
 */
export class EntityRendererService extends Effect.Service<EntityRendererService>()(
  '@minecraft/infrastructure/three/EntityRendererService',
  {
    effect: Effect.all([
      SceneService,
      Ref.make(HashMap.empty<EntityIdType, MobLimbGroup>()),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([sceneService, groupsRef]) => ({
        /**
         * Reconcile the tracked group set with the live entity list:
         * - Build + add a Group for any new entityId.
         * - Remove the Group for any entityId no longer present.
         * Idempotent: a no-op if the entityId set is unchanged.
         */
        syncEntities: (
          entities: ReadonlyArray<Entity>,
          scene: THREE.Scene,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const groups = yield* Ref.get(groupsRef)
            const liveIds = HashSet.fromIterable(Arr.map(entities, (e) => e.entityId))

            const newEntities = Arr.filter(entities, (e) => !HashMap.has(groups, e.entityId))
            const additions = yield* Effect.forEach(
              newEntities,
              (entity) =>
                Effect.sync(() => buildMobGroup(entity.type)).pipe(
                  Effect.tap((group) => sceneService.add(scene, group.root)),
                  Effect.map((group) => [entity.entityId, group] as const),
                ),
              { concurrency: 'unbounded' },
            )

            const removalPairs = Arr.filter(
              Arr.fromIterable(groups),
              ([id]) => !HashSet.has(liveIds, id),
            )
            const removedKeys = yield* Effect.forEach(
              removalPairs,
              ([id, group]) =>
                sceneService.remove(scene, group.root).pipe(Effect.as(id)),
              { concurrency: 'unbounded' },
            )

            const afterAdd = Arr.reduce(
              additions,
              groups,
              (acc, [id, group]) => HashMap.set(acc, id, group),
            )
            const next = Arr.reduce(removedKeys, afterAdd, (acc, id) => HashMap.remove(acc, id))
            yield* Ref.set(groupsRef, next)
          }),

        /**
         * Per-frame transform + walk-cycle update for every tracked entity.
         * Performance boundary: plain for-loop inside Effect.sync — N is small
         * (<100 typical), avoiding Effect scheduler overhead per entity.
         * `deltaTimeSecs` is reserved for future damping (currently the walk
         * cycle is a pure function of speed + wall-clock time).
         */
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
                  // Direct _tag check avoids Option.match closure allocation in the hot loop.
                  if (groupOpt._tag === 'None') continue
                  const group = groupOpt.value

                  group.root.position.set(entity.position.x, entity.position.y, entity.position.z)

                  const speed = Math.hypot(entity.velocity.x, entity.velocity.z)
                  if (speed > MOTION_THRESHOLD) {
                    group.root.rotation.y = Math.atan2(entity.velocity.x, entity.velocity.z)
                  }

                  const legL = computeLimbAngle(speed, totalTimeSecs, 'L', 'leg')
                  const legR = computeLimbAngle(speed, totalTimeSecs, 'R', 'leg')
                  const armL = computeLimbAngle(speed, totalTimeSecs, 'L', 'arm')
                  const armR = computeLimbAngle(speed, totalTimeSecs, 'R', 'arm')

                  group.legFL.rotation.x = legL
                  group.legFR.rotation.x = legR
                  setLimbRotation(group.armL, armL)
                  setLimbRotation(group.armR, armR)
                  // Quadruped back legs swing opposite to front legs on the same side.
                  setLimbRotation(group.legBL, -legL)
                  setLimbRotation(group.legBR, -legR)
                }
              }),
            ),
          )
        },

        /**
         * Remove every tracked group from the scene and clear internal state.
         * Geometries/materials are shared via mob-geometry caches and are NOT
         * disposed here.
         */
        clearScene: (scene: THREE.Scene): Effect.Effect<void, never> =>
          Ref.get(groupsRef).pipe(
            Effect.flatMap((groups) =>
              Effect.forEach(
                Arr.fromIterable(HashMap.values(groups)),
                (group) => sceneService.remove(scene, group.root),
                { concurrency: 'unbounded', discard: true },
              ),
            ),
            Effect.andThen(Ref.set(groupsRef, HashMap.empty())),
          ),

        /**
         * Test-only accessor.
         */
        _getTrackedGroup: (id: EntityIdType): Effect.Effect<Option.Option<MobLimbGroup>, never> =>
          Ref.get(groupsRef).pipe(Effect.map((g) => HashMap.get(g, id))),
      })),
    ),
    dependencies: [SceneService.Default],
  },
) {}

export const EntityRendererLive = EntityRendererService.Default
