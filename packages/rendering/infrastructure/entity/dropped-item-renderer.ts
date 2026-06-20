import { Effect, Option, Ref } from 'effect'
import * as THREE from 'three'
import type { DroppedItemEntity } from '@ts-minecraft/entity/domain/dropped-item'
import { SceneService } from '../scene/scene-service'

type TrackedDroppedItem = {
  readonly group: THREE.Group
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
}

const colorFromItemType = (itemType: string): THREE.Color => {
  let hash = 0
  for (let i = 0; i < itemType.length; i++) {
    hash = (hash * 31 + itemType.charCodeAt(i)) >>> 0
  }
  const hue = (hash % 360) / 360
  return new THREE.Color().setHSL(hue, 0.65, 0.55)
}

const createDroppedItemGroup = (item: DroppedItemEntity): TrackedDroppedItem => {
  const group = new THREE.Group()
  group.name = `dropped-item:${item.id}`

  const geometry = new THREE.BoxGeometry(0.35, 0.35, 0.08)
  const material = new THREE.MeshStandardMaterial({
    color: colorFromItemType(item.itemType),
    roughness: 0.8,
    metalness: 0.05,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  return { group, mesh }
}

const updateDroppedItemTransform = (
  tracked: TrackedDroppedItem,
  item: DroppedItemEntity,
  totalTimeSecs: number,
): void => {
  const bob = Math.sin(totalTimeSecs * 3 + item.ageTicks * 0.08) * 0.08
  const stackScale = Math.min(1.25, 0.75 + item.count * 0.05)

  tracked.group.position.set(item.position.x, item.position.y + 0.35 + bob, item.position.z)
  tracked.group.rotation.y = totalTimeSecs * 2 + item.ageTicks * 0.02
  tracked.group.scale.setScalar(stackScale)
}

const disposeTracked = (tracked: TrackedDroppedItem): void => {
  tracked.mesh.geometry.dispose()
  tracked.mesh.material.dispose()
}

export class DroppedItemRendererService extends Effect.Service<DroppedItemRendererService>()(
  '@minecraft/rendering/DroppedItemRendererService',
  {
    effect: Effect.gen(function* () {
      const sceneService = yield* SceneService
      const trackedRef = yield* Ref.make<ReadonlyMap<string, TrackedDroppedItem>>(new Map())

      const clearScene = (scene: THREE.Scene): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const trackedItems = yield* Ref.get(trackedRef)
          for (const tracked of trackedItems.values()) {
            yield* sceneService.remove(scene, tracked.group)
            disposeTracked(tracked)
          }
          yield* Ref.set(trackedRef, new Map())
        })

      return {
        syncItems: (
          items: ReadonlyArray<DroppedItemEntity>,
          scene: THREE.Scene,
          totalTimeSecs: number,
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const current = yield* Ref.get(trackedRef)
            const next = new Map(current)
            const liveIds = new Set(items.map((item) => item.id))

            for (const [id, tracked] of current) {
              if (!liveIds.has(id)) {
                yield* sceneService.remove(scene, tracked.group)
                disposeTracked(tracked)
                next.delete(id)
              }
            }

            for (const item of items) {
              let tracked = next.get(item.id)
              if (tracked === undefined) {
                tracked = createDroppedItemGroup(item)
                next.set(item.id, tracked)
                yield* sceneService.add(scene, tracked.group)
              }
              updateDroppedItemTransform(tracked, item, totalTimeSecs)
            }

            yield* Ref.set(trackedRef, next)
          }),

        clearScene,

        _getTrackedGroup: (id: string): Effect.Effect<Option.Option<THREE.Group>, never> =>
          Effect.map(Ref.get(trackedRef), (trackedItems) =>
            Option.fromNullable(trackedItems.get(id)?.group),
          ),
      }
    }),
  },
) {}
