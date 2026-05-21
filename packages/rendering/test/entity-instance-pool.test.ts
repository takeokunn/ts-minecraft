import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Logger, LogLevel, Option } from 'effect'
import * as THREE from 'three'
import {
  EntityRendererService,
  EntityRendererLive,
  SceneService,
  MAX_INSTANCES_PER_TYPE,
} from '@ts-minecraft/rendering'
import { EntityId, type Entity, type EntityType } from '@ts-minecraft/entities'
import { identity } from '@ts-minecraft/kernel'

// ---------------------------------------------------------------------------
// Test infrastructure
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

const buildSceneLayer = () =>
  Layer.succeed(SceneService, SceneService.of({
    _tag: '@minecraft/infrastructure/three/SceneService' as const,
    create: () => Effect.succeed(new THREE.Scene()),
    add: (scene: THREE.Scene, object: THREE.Object3D) => Effect.sync(() => { scene.add(object) }),
    remove: (scene: THREE.Scene, object: THREE.Object3D) => Effect.sync(() => { scene.remove(object) }),
  }))

const buildTestLayer = () => Layer.provide(EntityRendererLive, buildSceneLayer())

// Logger that captures every Warning/Error message into an in-memory array.
// Returns the layer + a getter to read captured messages after the Effect runs.
const makeCapturingLogger = () => {
  const captured: Array<{ level: string; message: string }> = []
  const logger = Logger.make(({ logLevel, message }) => {
    captured.push({ level: logLevel.label, message: String(message) })
  })
  const layer = Logger.replace(Logger.defaultLogger, logger)
  return { layer, captured }
}

// ---------------------------------------------------------------------------
// Tests — saturation behaviour (FR-2.5 / SEC-C1)
// ---------------------------------------------------------------------------

describe('infrastructure/three/entity-instance-pool — saturation', () => {
  it.effect('caps each bucket at MAX_INSTANCES_PER_TYPE; the 257th entity is silently skipped from tracking', () => {
    const TestLayer = buildTestLayer()
    const scene = new THREE.Scene()
    const ids = Array.from({ length: MAX_INSTANCES_PER_TYPE + 1 }, (_, i) =>
      makeEntity({ id: `zombie-${i}`, type: 'Zombie' }),
    )
    return Effect.gen(function* () {
      const r = yield* EntityRendererService
      yield* r.syncEntities(ids, scene)
      const pool = r._getInstancePool()
      // Every zombie bucket caps at MAX_INSTANCES_PER_TYPE — never grows.
      for (const bucket of pool.getBuckets()) {
        expect(bucket.count).toBe(MAX_INSTANCES_PER_TYPE)
        expect(bucket.mesh.count).toBe(MAX_INSTANCES_PER_TYPE)
      }
      // The 257th entity must NOT be tracked (no partial state retained).
      const overflow = ids[MAX_INSTANCES_PER_TYPE]!
      expect(Option.isNone(yield* r._getTrackedGroup(overflow.entityId))).toBe(true)
      // The 256th entity (last successful) IS tracked.
      const lastFit = ids[MAX_INSTANCES_PER_TYPE - 1]!
      expect(Option.isSome(yield* r._getTrackedGroup(lastFit.entityId))).toBe(true)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('emits Effect.logWarning when an entity is rejected due to saturation', () => {
    const { layer: LoggerLayer, captured } = makeCapturingLogger()
    const TestLayer = Layer.provide(buildTestLayer(), LoggerLayer)
    const scene = new THREE.Scene()
    const ids = Array.from({ length: MAX_INSTANCES_PER_TYPE + 2 }, (_, i) =>
      makeEntity({ id: `cow-${i}`, type: 'Cow' }),
    )
    return Effect.gen(function* () {
      const r = yield* EntityRendererService
      yield* r.syncEntities(ids, scene)
      // Two saturation events expected (entries [256] and [257]).
      const warnings = captured.filter((c) => c.message.includes('entity-instance-pool saturated'))
      expect(warnings.length).toBe(2)
      // Each warning carries the entity type + id for debugging.
      expect(warnings[0]!.message).toContain('type=Cow')
      expect(warnings[0]!.message).toContain('cow-256')
      expect(warnings[1]!.message).toContain('cow-257')
      expect(warnings[0]!.level).toBe('WARN')
    }).pipe(Effect.provide(TestLayer), Logger.withMinimumLogLevel(LogLevel.Warning))
  })

  it.effect('all-or-nothing rollback: when one role saturates after another succeeded, every prior slot is released', () => {
    // Setup: sync a single Cow first to materialize ALL six quadruped buckets
    // (head/body/legFL/legFR/legBL/legBR), then directly fill the `body` bucket
    // with phantom ids until saturation while leaving the other buckets nearly
    // empty. When we sync a fresh Cow:
    //   - role iteration order is [head, body, legFL, legFR, legBL, legBR]
    //   - head allocates successfully → slot N
    //   - body fails (saturated) → rollback releases head slot
    //   - entity skipped from tracking
    const TestLayer = buildTestLayer()
    const scene = new THREE.Scene()
    return Effect.gen(function* () {
      const r = yield* EntityRendererService
      const pool = r._getInstancePool()
      // Materialize every bucket with one real cow first.
      const seed = makeEntity({ id: 'cow-seed', type: 'Cow' })
      yield* r.syncEntities([seed], scene)
      // Fill the body bucket with phantom ids up to MAX.
      // Body bucket is the unique one with center pivot AND offset.x=0 AND
      // offset.z=0 AND smaller offset.y than head.
      const buckets = pool.getBuckets()
      const headCountBefore = buckets.find((b) => b.spec.offset.z > 0)!.count
      // Fill body bucket directly via the pool API.
      let i = 0
      while (true) {
        const slotOpt = pool.allocateSlot(scene, 'Cow', 'body', `phantom-${i}`)
        if (Option.isNone(slotOpt)) break
        i++
      }
      // Sanity: body bucket is now full. Cow body offset: x=0, y=1.0, z=0 (only
      // bucket with x=0 AND z=0 — head has z>0 because of the cow's snout).
      const bodyBucket = pool
        .getBuckets()
        .find((b) => b.spec.offset.x === 0 && b.spec.offset.z === 0)
      expect(bodyBucket).toBeDefined()
      expect(bodyBucket!.count).toBe(MAX_INSTANCES_PER_TYPE)
      // Now try to sync a real victim — head succeeds, body fails → rollback.
      const cow = makeEntity({ id: 'cow-victim', type: 'Cow' })
      yield* r.syncEntities([seed, cow], scene)
      // Victim must NOT be tracked.
      expect(Option.isNone(yield* r._getTrackedGroup(cow.entityId))).toBe(true)
      // Seed cow still tracked.
      expect(Option.isSome(yield* r._getTrackedGroup(seed.entityId))).toBe(true)
      // Head bucket count must NOT have grown beyond the seed cow — the
      // partial allocation was rolled back.
      const headBucketAfter = pool.getBuckets().find((b) => b.spec.offset.z > 0)
      expect(headBucketAfter!.count).toBe(headCountBefore)
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('saturation of one entity type does NOT affect a different type in the same sync call', () => {
    const TestLayer = buildTestLayer()
    const scene = new THREE.Scene()
    const zombies = Array.from({ length: MAX_INSTANCES_PER_TYPE + 1 }, (_, i) =>
      makeEntity({ id: `z-${i}`, type: 'Zombie' }),
    )
    const cow = makeEntity({ id: 'lone-cow', type: 'Cow' })
    return Effect.gen(function* () {
      const r = yield* EntityRendererService
      yield* r.syncEntities([...zombies, cow], scene)
      // Cow buckets accept the lone cow normally.
      expect(Option.isSome(yield* r._getTrackedGroup(cow.entityId))).toBe(true)
      // Overflow zombie is rejected.
      expect(Option.isNone(yield* r._getTrackedGroup(zombies[MAX_INSTANCES_PER_TYPE]!.entityId))).toBe(
        true,
      )
    }).pipe(Effect.provide(TestLayer))
  })

  it.effect('rejected entities free the bucket for re-use after another mob is removed', () => {
    const TestLayer = buildTestLayer()
    const scene = new THREE.Scene()
    return Effect.gen(function* () {
      const r = yield* EntityRendererService
      const fillers = Array.from({ length: MAX_INSTANCES_PER_TYPE }, (_, i) =>
        makeEntity({ id: `pig-${i}`, type: 'Pig' }),
      )
      yield* r.syncEntities(fillers, scene)
      const overflow = makeEntity({ id: 'pig-extra', type: 'Pig' })
      yield* r.syncEntities([...fillers, overflow], scene)
      // Overflow rejected.
      expect(Option.isNone(yield* r._getTrackedGroup(overflow.entityId))).toBe(true)
      // Step 1: drop pig-0 (no overflow in list yet) → freeing slots in every bucket.
      const survivors = fillers.slice(1)
      yield* r.syncEntities(survivors, scene)
      // Step 2: now retry overflow — buckets have free slots, so allocation succeeds.
      yield* r.syncEntities([...survivors, overflow], scene)
      expect(Option.isSome(yield* r._getTrackedGroup(overflow.entityId))).toBe(true)
      // Pool counts back at MAX.
      const pool = r._getInstancePool()
      for (const bucket of pool.getBuckets()) {
        expect(bucket.count).toBe(MAX_INSTANCES_PER_TYPE)
      }
    }).pipe(Effect.provide(TestLayer))
  })
})
