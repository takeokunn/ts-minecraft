import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { DroppedItemRendererService, SceneService } from '@ts-minecraft/rendering'
import type { DroppedItemEntity } from '@ts-minecraft/entity/domain/dropped-item'

const makeDroppedItem = (overrides: Partial<DroppedItemEntity> = {}): DroppedItemEntity => ({
  id: 'drop-1',
  itemType: 'DIRT',
  count: 3,
  position: { x: 1, y: 64, z: 2 },
  velocity: { x: 0, y: 0, z: 0 },
  ageTicks: 4,
  pickupDelayTicks: 0,
  ...overrides,
})

const buildTestLayer = () => {
  const sceneLayer = Layer.succeed(SceneService, SceneService.of({
    _tag: '@minecraft/infrastructure/three/SceneService' as const,
    create: () => Effect.succeed(new THREE.Scene()),
    add: (scene: THREE.Scene, object: THREE.Object3D) => Effect.sync(() => { scene.add(object) }),
    remove: (scene: THREE.Scene, object: THREE.Object3D) => Effect.sync(() => { scene.remove(object) }),
  }))
  return Layer.provide(DroppedItemRendererService.Default, sceneLayer)
}

const makeScene = (): THREE.Scene => {
  const scene = new THREE.Scene()
  vi.spyOn(scene, 'add')
  vi.spyOn(scene, 'remove')
  return scene
}

describe('infrastructure/three/dropped-item-renderer', () => {
  it.effect('adds and updates a dropped item group', () => {
    const TestLayer = buildTestLayer()
    const scene = makeScene()
    return Effect.gen(function* () {
      const renderer = yield* DroppedItemRendererService
      const item = makeDroppedItem()

      yield* renderer.syncItems([item], scene, 1)
      const tracked = Option.getOrThrow(yield* renderer._getTrackedGroup(item.id))

      expect(scene.add).toHaveBeenCalledOnce()
      expect(scene.children).toContain(tracked)
      expect(tracked.name).toBe(`dropped-item:${item.id}`)
      expect(tracked.position.x).toBe(item.position.x)
      expect(tracked.position.z).toBe(item.position.z)
      expect(tracked.position.y).toBeGreaterThan(item.position.y)

      yield* renderer.syncItems([makeDroppedItem({ position: { x: 4, y: 65, z: -1 } })], scene, 2)

      expect(scene.add).toHaveBeenCalledOnce()
      expect(tracked.position.x).toBe(4)
      expect(tracked.position.z).toBe(-1)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('removes stale dropped item groups and clears tracked state', () => {
    const TestLayer = buildTestLayer()
    const scene = makeScene()
    return Effect.gen(function* () {
      const renderer = yield* DroppedItemRendererService
      const item = makeDroppedItem()

      yield* renderer.syncItems([item], scene, 1)
      const tracked = Option.getOrThrow(yield* renderer._getTrackedGroup(item.id))
      yield* renderer.syncItems([], scene, 2)

      expect(scene.remove).toHaveBeenCalledWith(tracked)
      expect(scene.children).not.toContain(tracked)
      expect(Option.isNone(yield* renderer._getTrackedGroup(item.id))).toBe(true)

      yield* renderer.syncItems([item], scene, 3)
      yield* renderer.clearScene(scene)

      expect(Option.isNone(yield* renderer._getTrackedGroup(item.id))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  })
})
