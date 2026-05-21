import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import * as THREE from 'three'
import {
  EntityRendererService,
  EntityRendererLive,
  SceneService,
  LIMB_SWING_AMPLITUDE,
} from '@ts-minecraft/rendering'
import { EntityId, type Entity, type EntityType } from '@ts-minecraft/entities'
import { identity } from '@ts-minecraft/kernel'

// FR-2.5: pool→syncEntities full wire. `scene.add` is now called once per
// (type, role) bucket (lazy creation), NOT once per entity. Each entity type
// materializes 6 buckets (Zombie: head/body/armL/armR/legFL/legFR; quadrupeds:
// head/body/legFL/legFR/legBL/legBR). The tracking ref still holds a per-entity
// MobLimbGroup carrier, but the carrier root is NEVER added to the scene.
const ROLES_PER_TYPE = 6

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEntity = (params: {
  id: string
  type?: EntityType
  position?: { x: number; y: number; z: number }
  velocity?: { x: number; y: number; z: number }
}): Entity => ({
  entityId: EntityId.make(params.id),
  type: Option.getOrElse(Option.fromNullable(params.type), (): EntityType => 'Zombie'),
  position: Option.getOrElse(Option.fromNullable(params.position), () => ({ x: 0, y: 64, z: 0 })),
  velocity: Option.getOrElse(Option.fromNullable(params.velocity), () => ({ x: 0, y: 0, z: 0 })),
  rotation: identity,
  health: 20,
})

const buildTestLayer = () => {
  // Use real SceneService.Default (which internally calls scene.add/scene.remove).
  // We assert on the scene mock's spies, not on a stubbed SceneService.
  const sceneLayer = Layer.succeed(SceneService, SceneService.of({
    _tag: '@minecraft/infrastructure/three/SceneService' as const,
    create: () => Effect.succeed(new THREE.Scene()),
    add: (scene: THREE.Scene, object: THREE.Object3D) => Effect.sync(() => { scene.add(object) }),
    remove: (scene: THREE.Scene, object: THREE.Object3D) => Effect.sync(() => { scene.remove(object) }),
  }))
  return Layer.provide(EntityRendererLive, sceneLayer)
}

const makeScene = (): THREE.Scene => {
  const scene = new THREE.Scene()
  vi.spyOn(scene, 'add')
  vi.spyOn(scene, 'remove')
  return scene
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('infrastructure/three/entity-renderer', () => {
  describe('syncEntities', () => {
    it.effect('adds buckets for a new entity (1 InstancedMesh per role)', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({ id: 'mob-1', type: 'Zombie' })
        yield* r.syncEntities([e], scene)
        // 6 buckets are lazily created on first allocation: head/body/armL/armR/legFL/legFR.
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ROLES_PER_TYPE)
        // The pool reports 6 buckets, each containing 1 active instance.
        const pool = r._getInstancePool()
        const buckets = pool.getBuckets()
        expect(buckets.length).toBe(ROLES_PER_TYPE)
        for (const bucket of buckets) expect(bucket.count).toBe(1)
        // Tracking carrier still exists (used by updateEntityTransforms).
        const tracked = yield* r._getTrackedGroup(e.entityId)
        expect(Option.isSome(tracked)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('releases pool slots when the entity is no longer in the list', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e1 = makeEntity({ id: 'mob-a', type: 'Cow' })
        const e2 = makeEntity({ id: 'mob-b', type: 'Pig' })
        yield* r.syncEntities([e1, e2], scene)
        // 2 types × 6 roles = 12 buckets created.
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ROLES_PER_TYPE * 2)
        const pool = r._getInstancePool()
        // Each bucket holds 1 instance — one Cow + one Pig populate disjoint buckets.
        for (const bucket of pool.getBuckets()) expect(bucket.count).toBe(1)
        yield* r.syncEntities([e1], scene)
        // Buckets are NOT removed from the scene on entity drop — only slots
        // are released. Pig buckets drop to count=0; Cow buckets stay at 1.
        expect((scene.remove as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
        expect(Option.isNone(yield* r._getTrackedGroup(e2.entityId))).toBe(true)
        expect(Option.isSome(yield* r._getTrackedGroup(e1.entityId))).toBe(true)
        // Verify slot release: total active instances across all buckets is 6
        // (one Cow occupying its 6 buckets); Pig buckets are empty.
        const totalActive = pool
          .getBuckets()
          .reduce((sum, b) => sum + b.count, 0)
        expect(totalActive).toBe(ROLES_PER_TYPE)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('is idempotent when called twice with the same list', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({ id: 'mob-x' })
        yield* r.syncEntities([e], scene)
        yield* r.syncEntities([e], scene)
        // Buckets are reused on the second call — no additional scene.add.
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ROLES_PER_TYPE)
        // And the pool didn't double-allocate.
        const pool = r._getInstancePool()
        for (const bucket of pool.getBuckets()) expect(bucket.count).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('updateEntityTransforms', () => {
    it.effect('writes entity position to the group root', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({ id: 'mob-pos', position: { x: 12, y: 70, z: -3 } })
        yield* r.syncEntities([e], scene)
        yield* r.updateEntityTransforms([e], 0, 0.016)
        const opt = yield* r._getTrackedGroup(e.entityId)
        const group = Option.getOrThrow(opt)
        expect(group.root.position.x).toBe(12)
        expect(group.root.position.y).toBe(70)
        expect(group.root.position.z).toBe(-3)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('rotates limbs when speed > threshold', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({
          id: 'mob-walk',
          type: 'Zombie',
          velocity: { x: 2, y: 0, z: 2 },
        })
        yield* r.syncEntities([e], scene)
        yield* r.updateEntityTransforms([e], 0.5, 0.016)
        const opt = yield* r._getTrackedGroup(e.entityId)
        const group = Option.getOrThrow(opt)
        // At least one of {legFL, legFR} must have a non-zero swing
        // (sin can be zero at specific phases, but not for both sides simultaneously
        // because they are π apart — when one is 0, the other is 0 too, so test t≠0).
        const total = Math.abs(group.legFL.rotation.x) + Math.abs(group.legFR.rotation.x)
        expect(total).toBeGreaterThan(0)
        expect(Math.abs(group.legFL.rotation.x)).toBeLessThanOrEqual(LIMB_SWING_AMPLITUDE + 1e-9)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('holds limbs at 0 when speed is below threshold', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({
          id: 'mob-still',
          type: 'Zombie',
          velocity: { x: 0, y: 0, z: 0 },
        })
        yield* r.syncEntities([e], scene)
        yield* r.updateEntityTransforms([e], 1.5, 0.016)
        const opt = yield* r._getTrackedGroup(e.entityId)
        const group = Option.getOrThrow(opt)
        expect(group.legFL.rotation.x).toBe(0)
        expect(group.legFR.rotation.x).toBe(0)
        const armL = Option.getOrThrow(Option.fromNullable(group.armL))
        const armR = Option.getOrThrow(Option.fromNullable(group.armR))
        expect(armL.rotation.x).toBe(0)
        expect(armR.rotation.x).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('quadruped back legs swing opposite to front legs', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({
          id: 'mob-cow',
          type: 'Cow',
          velocity: { x: 2, y: 0, z: 0 },
        })
        yield* r.syncEntities([e], scene)
        yield* r.updateEntityTransforms([e], 0.4, 0.016)
        const opt = yield* r._getTrackedGroup(e.entityId)
        const group = Option.getOrThrow(opt)
        const legBL = Option.getOrThrow(Option.fromNullable(group.legBL))
        const legBR = Option.getOrThrow(Option.fromNullable(group.legBR))
        expect(legBL.rotation.x).toBeCloseTo(-group.legFL.rotation.x, 12)
        expect(legBR.rotation.x).toBeCloseTo(-group.legFR.rotation.x, 12)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('updateEntityTransforms is a no-op for entities not yet tracked', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e = makeEntity({ id: 'untracked' })
        // Should not throw even though the entity was never sync'd.
        yield* r.updateEntityTransforms([e], 0.2, 0.016)
        expect(true).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('clearScene', () => {
    it.effect('disposes all bucket InstancedMeshes and resets state', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        const e1 = makeEntity({ id: 'm1', type: 'Pig' })
        const e2 = makeEntity({ id: 'm2', type: 'Sheep' })
        yield* r.syncEntities([e1, e2], scene)
        // 2 types × 6 buckets = 12 buckets created.
        expect((scene.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ROLES_PER_TYPE * 2)
        yield* r.clearScene(scene)
        // disposeAll removes every bucket from the scene.
        expect((scene.remove as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ROLES_PER_TYPE * 2)
        expect(Option.isNone(yield* r._getTrackedGroup(e1.entityId))).toBe(true)
        expect(Option.isNone(yield* r._getTrackedGroup(e2.entityId))).toBe(true)
        // Pool is empty post-dispose.
        expect(r._getInstancePool().getBuckets().length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('is a no-op on empty state', () => {
      const TestLayer = buildTestLayer()
      const scene = makeScene()
      return Effect.gen(function* () {
        const r = yield* EntityRendererService
        yield* r.clearScene(scene)
        expect(true).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
