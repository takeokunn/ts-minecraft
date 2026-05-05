import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import type { Entity, EntityId as EntityIdType } from '@ts-minecraft/entities'
import { SceneService } from '../scene/scene-service'
import { buildMobGroup, type MobLimbGroup } from './mob-geometry'
import { computeLimbAngle } from './walk-cycle'

const MOTION_THRESHOLD = 0.05

const setLimbRotation = (mesh: THREE.Mesh | null, angle: number): void => {
  if (mesh === null) return
  mesh.rotation.x = angle
}

// State: Ref<HashMap<EntityId, MobLimbGroup>>. Geometries/materials owned by mob-geometry are shared — NOT disposed here.
export class EntityRendererService extends Effect.Service<EntityRendererService>()(
  '@minecraft/infrastructure/three/EntityRendererService',
  {
    effect: Effect.all([
      SceneService,
      Ref.make(HashMap.empty<EntityIdType, MobLimbGroup>()),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([sceneService, groupsRef]) => ({
        // Reconciles tracked groups with the live entity list by entityId set diff. Idempotent.
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

        // Geometries/materials are shared via mob-geometry caches — NOT disposed here.
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

        _getTrackedGroup: (id: EntityIdType): Effect.Effect<Option.Option<MobLimbGroup>, never> =>
          Ref.get(groupsRef).pipe(Effect.map((g) => HashMap.get(g, id))),
      })),
    ),
    dependencies: [SceneService.Default],
  },
) {}

export const EntityRendererLive = EntityRendererService.Default
