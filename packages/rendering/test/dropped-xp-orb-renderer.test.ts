import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import { expect, vi } from 'vitest'

import { DroppedXpOrbRendererService, SceneService } from '@ts-minecraft/rendering'
import type { DroppedXpOrbEntity } from '@ts-minecraft/entity/domain/dropped-xp-orb'

const makeScene = (): THREE.Scene => {
  const scene = new THREE.Scene()
  vi.spyOn(scene, 'add')
  vi.spyOn(scene, 'remove')
  return scene
}

const buildTestLayer = () => DroppedXpOrbRendererService.Default.pipe(Layer.provide(SceneService.Default))

const makeDroppedXpOrb = (overrides: Partial<DroppedXpOrbEntity> = {}): DroppedXpOrbEntity => ({
  id: 'xp-orb-1',
  amount: 5,
  position: { x: 1, y: 64, z: 2 },
  velocity: { x: 0, y: 0, z: 0 },
  ageTicks: 4,
  pickupDelayTicks: 0,
  ...overrides,
})

describe('infrastructure/three/dropped-xp-orb-renderer', () => {
  it.effect('adds and updates a dropped XP orb group', () => {
    const TestLayer = buildTestLayer()
    const scene = makeScene()

    return Effect.gen(function* () {
      const renderer = yield* DroppedXpOrbRendererService
      const orb = makeDroppedXpOrb()

      yield* renderer.syncOrbs([orb], scene, 1)
      const tracked = Option.getOrThrow(yield* renderer._getTrackedGroup(orb.id))

      expect(scene.add).toHaveBeenCalledOnce()
      expect(scene.children).toContain(tracked)
      expect(tracked.name).toBe(`dropped-xp-orb:${orb.id}`)
      expect(tracked.position.x).toBe(orb.position.x)
      expect(tracked.position.z).toBe(orb.position.z)
      expect(tracked.position.y).toBeGreaterThan(orb.position.y)
      expect(tracked.children.map((child) => child.name)).toEqual([
        `dropped-xp-orb-glow:${orb.id}`,
        `dropped-xp-orb-core:${orb.id}`,
      ])

      yield* renderer.syncOrbs(
        [makeDroppedXpOrb({ position: { x: 4, y: 65, z: -1 } })],
        scene,
        2,
      )

      expect(scene.add).toHaveBeenCalledOnce()
      expect(tracked.position.x).toBe(4)
      expect(tracked.position.z).toBe(-1)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('removes stale XP orb groups and clears scene resources', () => {
    const TestLayer = buildTestLayer()
    const scene = makeScene()

    return Effect.gen(function* () {
      const renderer = yield* DroppedXpOrbRendererService
      const orb = makeDroppedXpOrb()

      yield* renderer.syncOrbs([orb], scene, 1)
      const tracked = Option.getOrThrow(yield* renderer._getTrackedGroup(orb.id))
      const core = tracked.children.find(
        (child) => child.name === `dropped-xp-orb-core:${orb.id}`,
      ) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
      const glow = tracked.children.find(
        (child) => child.name === `dropped-xp-orb-glow:${orb.id}`,
      ) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
      vi.spyOn(core.geometry, 'dispose')
      vi.spyOn(core.material, 'dispose')
      vi.spyOn(glow.geometry, 'dispose')
      vi.spyOn(glow.material, 'dispose')

      yield* renderer.syncOrbs([], scene, 2)

      expect(scene.remove).toHaveBeenCalledWith(tracked)
      expect(core.geometry.dispose).toHaveBeenCalledOnce()
      expect(core.material.dispose).toHaveBeenCalledOnce()
      expect(glow.geometry.dispose).toHaveBeenCalledOnce()
      expect(glow.material.dispose).toHaveBeenCalledOnce()
      expect(Option.isNone(yield* renderer._getTrackedGroup(orb.id))).toBe(true)

      yield* renderer.syncOrbs([makeDroppedXpOrb({ id: 'xp-orb-2' })], scene, 3)
      yield* renderer.clearScene(scene)

      expect(Option.isNone(yield* renderer._getTrackedGroup('xp-orb-2'))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  })
})
