import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option } from 'effect'
import {
  AIState,
  DESPAWN_DISTANCE,
  EntityManager,
  EntityManagerLive,
  EntityType,
  computeStateVelocity,
  resolveAIState,
  type AIMotionContext,
  type AITransitionContext,
} from '@ts-minecraft/entity'
import { DeltaTimeSecs, type Position } from '@ts-minecraft/core'

// Phase 13 (Entity System) regression guards for the functional 受け入れ条件.
// Plan: phase/plans/13-entity-system-completion.md — Tasks 3 (AI / contact damage /
// drops) and 4 (night daylight-burn through update()).
//
// Deadlock-safe convention (effect-vitest fork deadlock): plain vitest `it` +
// Effect.runPromise(Effect.provide(program, EntityManagerLive)) for any
// Layer/forking flow; pure domain fns asserted directly. No Math.random, no THREE.

// Mirrors the live values pulled from each mob definition / state-machine call
// site (entity-manager.ts:213-222 builds the AITransitionContext this way).
const ZOMBIE_DETECTION_RANGE = 16
const ZOMBIE_ATTACK_RANGE = 1.6
const ZOMBIE_ATTACK_DAMAGE = 3
const ZOMBIE_FLEE_HEALTH_THRESHOLD = 0.1
const COW_DETECTION_RANGE = 12

describe('phase-13 acceptance — AI state transitions (pure resolveAIState/computeStateVelocity)', () => {
  // AC: プレイヤーに気づくと追いかける（敵対的）.
  // A hostile mob within detection range (but outside attack range, so not Attack)
  // resolves to Chase, and its motion velocity points TOWARD the player.
  it('hostile within detection range → Chase, velocity moves toward player', () => {
    const context: AITransitionContext = {
      behavior: 'hostile',
      // 8 blocks away: > attackRange 1.6 (so not Attack) and < detectionRange 16.
      distanceToPlayer: 8,
      canSeePlayer: true,
      healthRatio: 1,
      randomWanderRoll: 0.99,
      attackRange: ZOMBIE_ATTACK_RANGE,
      detectionRange: ZOMBIE_DETECTION_RANGE,
      fleeHealthThreshold: ZOMBIE_FLEE_HEALTH_THRESHOLD,
    }

    expect(resolveAIState(AIState.Idle, context)).toBe(AIState.Chase)

    // Zombie at origin, player to the +x; Chase velocity should have +x component
    // (moving toward the player) and zero on the unused axis.
    const motion: AIMotionContext = {
      state: AIState.Chase,
      entityPosition: { x: 0, y: 64, z: 0 },
      playerPosition: { x: 8, y: 64, z: 0 },
      speed: 1.25,
      wanderDirection: { x: 1, y: 0, z: 0 },
    }
    const velocity = computeStateVelocity(motion)
    expect(velocity.x).toBeGreaterThan(0)
    expect(velocity.z).toBe(0)
    // Chase speed magnitude matches the configured mob speed.
    expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(1.25)
  })

  // AC: プレイヤーから逃げる（受動的）.
  // A passive mob within detection range resolves to Flee, and its motion velocity
  // points AWAY from the player.
  it('passive within detection range → Flee, velocity moves away from player', () => {
    const context: AITransitionContext = {
      behavior: 'passive',
      distanceToPlayer: 5,
      canSeePlayer: true,
      healthRatio: 1,
      randomWanderRoll: 0.99,
      // Cow attackRange is 0, but the schema requires positive; passives never reach
      // the Attack branch (it is hostile-gated), so any positive sentinel is inert here.
      // The production call site (entity-manager.ts:219) feeds the real
      // definition.attackRange through the AITransitionContext schema — this 1 is a
      // test-only stand-in for that hostile-only field, never exercised on this path.
      attackRange: 1,
      detectionRange: COW_DETECTION_RANGE,
      fleeHealthThreshold: 0.6,
    }

    expect(resolveAIState(AIState.Idle, context)).toBe(AIState.Flee)

    // Cow at origin, player at +x; Flee velocity should have -x component (away).
    const motion: AIMotionContext = {
      state: AIState.Flee,
      entityPosition: { x: 0, y: 64, z: 0 },
      playerPosition: { x: 5, y: 64, z: 0 },
      speed: 1.0,
      wanderDirection: { x: 1, y: 0, z: 0 },
    }
    const velocity = computeStateVelocity(motion)
    expect(velocity.x).toBeLessThan(0)
    expect(velocity.z).toBe(0)
    expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(1.0)
  })

  // Out of detection range with a non-wander roll → Idle (no chase/flee).
  it('out of detection range with high wander roll → Idle, zero velocity', () => {
    const context: AITransitionContext = {
      behavior: 'hostile',
      distanceToPlayer: 100,
      canSeePlayer: false,
      healthRatio: 1,
      randomWanderRoll: 0.99,
      attackRange: ZOMBIE_ATTACK_RANGE,
      detectionRange: ZOMBIE_DETECTION_RANGE,
      fleeHealthThreshold: ZOMBIE_FLEE_HEALTH_THRESHOLD,
    }
    expect(resolveAIState(AIState.Idle, context)).toBe(AIState.Idle)

    const velocity = computeStateVelocity({
      state: AIState.Idle,
      entityPosition: { x: 0, y: 64, z: 0 },
      playerPosition: { x: 100, y: 64, z: 0 },
      speed: 1.25,
      wanderDirection: { x: 1, y: 0, z: 0 },
    })
    expect(velocity.x).toBe(0)
    expect(velocity.z).toBe(0)
  })

  // AC: モブが攻撃できる (Attack-state trigger). A hostile mob that can see the player and
  // is within attackRange resolves to Attack (the highest-priority branch in
  // resolveAIState, gated ahead of Chase). Attack has zero motion velocity — the mob
  // holds position while dealing contact damage.
  it('hostile within attack range → Attack, zero velocity', () => {
    const context: AITransitionContext = {
      behavior: 'hostile',
      // 1 block away: <= attackRange 1.6 → Attack (not Chase).
      distanceToPlayer: 1,
      canSeePlayer: true,
      healthRatio: 1,
      randomWanderRoll: 0.99,
      attackRange: ZOMBIE_ATTACK_RANGE,
      detectionRange: ZOMBIE_DETECTION_RANGE,
      fleeHealthThreshold: ZOMBIE_FLEE_HEALTH_THRESHOLD,
    }
    expect(resolveAIState(AIState.Chase, context)).toBe(AIState.Attack)

    const velocity = computeStateVelocity({
      state: AIState.Attack,
      entityPosition: { x: 0, y: 64, z: 0 },
      playerPosition: { x: 1, y: 64, z: 0 },
      speed: 1.25,
      wanderDirection: { x: 1, y: 0, z: 0 },
    })
    expect(velocity.x).toBe(0)
    expect(velocity.z).toBe(0)
  })

  // AC: モブが逃げる (hostile flee-on-low-health). A hostile mob within detection range
  // (but outside attack range) whose healthRatio has dropped to/below
  // fleeHealthThreshold resolves to Flee instead of Chase, and its motion velocity
  // points AWAY from the player.
  it('hostile within detection range with low health → Flee (away from player)', () => {
    const context: AITransitionContext = {
      behavior: 'hostile',
      // 8 blocks: > attackRange 1.6 (so not Attack) and < detectionRange 16.
      distanceToPlayer: 8,
      canSeePlayer: true,
      // At threshold (0.1) → Flee (<= comparison).
      healthRatio: ZOMBIE_FLEE_HEALTH_THRESHOLD,
      randomWanderRoll: 0.99,
      attackRange: ZOMBIE_ATTACK_RANGE,
      detectionRange: ZOMBIE_DETECTION_RANGE,
      fleeHealthThreshold: ZOMBIE_FLEE_HEALTH_THRESHOLD,
    }
    expect(resolveAIState(AIState.Chase, context)).toBe(AIState.Flee)

    // Just above the threshold the same hostile mob would Chase — guards the
    // boundary so a flipped comparison (< vs <=) is caught.
    expect(
      resolveAIState(AIState.Chase, { ...context, healthRatio: ZOMBIE_FLEE_HEALTH_THRESHOLD + 0.01 }),
    ).toBe(AIState.Chase)

    const velocity = computeStateVelocity({
      state: AIState.Flee,
      entityPosition: { x: 0, y: 64, z: 0 },
      playerPosition: { x: 8, y: 64, z: 0 },
      speed: 1.25,
      wanderDirection: { x: 1, y: 0, z: 0 },
    })
    expect(velocity.x).toBeLessThan(0)
    expect(velocity.z).toBe(0)
    expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(1.25)
  })
})

describe('phase-13 acceptance — mob → player contact damage', () => {
  // AC: モブが攻撃できる (mob -> player contact damage).
  // First contact within attack range returns the mob's attackDamage and arms the
  // per-entity attackCooldownRemaining (= HOSTILE_ATTACK_COOLDOWN_SECS). An immediate
  // second call (no update() to tick the cooldown down) returns 0 — the cooldown is
  // an ACCUMULATED per-entity field, not a last-attack timestamp.
  it('first contact returns attackDamage, immediate second contact returns 0 (cooldown)', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          // Zombie at origin; player at distance 1 (< attackRange 1.6).
          yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
          const player: Position = { x: 1, y: 64, z: 0 }

          const first = yield* entityManager.getPlayerContactDamage(player)
          expect(first).toBe(ZOMBIE_ATTACK_DAMAGE)

          // No update() between calls: cooldown was set but not ticked down → 0.
          const second = yield* entityManager.getPlayerContactDamage(player)
          expect(second).toBe(0)
        }),
        EntityManagerLive,
      ),
    ))

  // AC: cooldown is an ACCUMULATED per-entity field decremented by deltaTime in
  // update(), not a wall-clock timestamp. After the first hit arms it to
  // HOSTILE_ATTACK_COOLDOWN_SECS (=1), running enough update() ticks to elapse >= 1 s
  // re-arms contact damage. Player stays at distance 1 (< attackRange 1.6) so the mob
  // resolves to Attack (velocity 0) and the idle/attack branch ticks the cooldown down.
  // isNight=true so daylight-burn never fires and the zombie stays at full health.
  it('contact-damage cooldown is decremented by update() deltaTime and re-arms after >= HOSTILE_ATTACK_COOLDOWN_SECS', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
          const player: Position = { x: 1, y: 64, z: 0 }

          // First contact: deals damage and arms cooldown = 1 s.
          expect(yield* entityManager.getPlayerContactDamage(player)).toBe(ZOMBIE_ATTACK_DAMAGE)
          // Immediate re-check (no update): still on cooldown → 0.
          expect(yield* entityManager.getPlayerContactDamage(player)).toBe(0)

          // Two 0.5 s update ticks → 1.0 s elapsed, exactly meeting the 1 s cooldown
          // (clamped to 0). isNight=true to suppress daylight burn.
          yield* entityManager.update(DeltaTimeSecs.make(0.5), player, true)
          // Halfway through the cooldown (0.5 s elapsed): still suppressed.
          expect(yield* entityManager.getPlayerContactDamage(player)).toBe(0)

          yield* entityManager.update(DeltaTimeSecs.make(0.5), player, true)
          // Cooldown fully elapsed (>= 1 s): contact damage re-arms.
          expect(yield* entityManager.getPlayerContactDamage(player)).toBe(ZOMBIE_ATTACK_DAMAGE)
        }),
        EntityManagerLive,
      ),
    ))

  // A hostile mob outside attack range deals no contact damage.
  it('hostile out of attack range → 0 contact damage', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
          const damage = yield* entityManager.getPlayerContactDamage({ x: 100, y: 64, z: 0 })
          expect(damage).toBe(0)
        }),
        EntityManagerLive,
      ),
    ))
})

describe('phase-13 acceptance — despawn distance (AC スポーン距離)', () => {
  // AC: スポーン距離 — mobs beyond DESPAWN_DISTANCE (=64, spawner-config.ts) from the
  // player are culled. despawnFarEntities(playerPosition, maxDistance) returns the
  // removed count (entity-manager.ts:372-399, shouldDespawnEntity uses
  // distanceToPlayerSq > maxDistance²). A within-range entity is preserved.
  it('entity beyond DESPAWN_DISTANCE is despawned (removedCount===1, getCount===0)', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          // Player at origin; zombie at x=65 (> DESPAWN_DISTANCE 64).
          yield* entityManager.addEntity(EntityType.Zombie, { x: DESPAWN_DISTANCE + 1, y: 64, z: 0 })
          const player: Position = { x: 0, y: 64, z: 0 }

          const removed = yield* entityManager.despawnFarEntities(player, DESPAWN_DISTANCE)
          expect(removed).toBe(1)
          expect(yield* entityManager.getCount()).toBe(0)
        }),
        EntityManagerLive,
      ),
    ))

  it('entity within DESPAWN_DISTANCE is NOT despawned (removedCount===0, survives)', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          // Zombie at x=63 (< DESPAWN_DISTANCE 64) stays.
          const id = yield* entityManager.addEntity(EntityType.Zombie, { x: DESPAWN_DISTANCE - 1, y: 64, z: 0 })
          const player: Position = { x: 0, y: 64, z: 0 }

          const removed = yield* entityManager.despawnFarEntities(player, DESPAWN_DISTANCE)
          expect(removed).toBe(0)
          expect(yield* entityManager.getCount()).toBe(1)
          expect(Option.isSome(yield* entityManager.getEntity(id))).toBe(true)
        }),
        EntityManagerLive,
      ),
    ))
})

describe('phase-13 acceptance — death drops', () => {
  // AC: モブが死亡するとドロップする (drops on death).
  // A lethal applyDamage returns Option.some(ReadonlyArray<EntityDrop>) carrying the
  // mob's configured drops, and removes the entity. A non-lethal hit returns Option.none().
  it('lethal applyDamage returns Option.some(drops) and removes the entity', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          const id = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

          // Zombie maxHealth 20; 9999 is lethal.
          const result = yield* entityManager.applyDamage(id, 9999)
          expect(Option.isSome(result)).toBe(true)

          const drops = Option.getOrThrow(result)
          // Exact return shape: ReadonlyArray<{ blockType, count }>.
          expect(Array.isArray(drops)).toBe(true)
          expect(drops).toEqual([{ blockType: 'ROTTEN_FLESH', count: 1 }])

          // Lethal hit removes the entity.
          const count = yield* entityManager.getCount()
          expect(count).toBe(0)
        }),
        EntityManagerLive,
      ),
    ))

  // A non-lethal hit returns the non-drop case (Option.none) and the entity survives.
  it('non-lethal applyDamage returns Option.none() and entity survives with reduced health', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          const id = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

          // Zombie maxHealth 20; 5 is non-lethal.
          const result = yield* entityManager.applyDamage(id, 5)
          expect(Option.isNone(result)).toBe(true)

          const entityOpt = yield* entityManager.getEntity(id)
          expect(Option.isSome(entityOpt)).toBe(true)
          expect(Option.getOrThrow(entityOpt).health).toBe(15)
          const count = yield* entityManager.getCount()
          expect(count).toBe(1)
        }),
        EntityManagerLive,
      ),
    ))
})

describe('phase-13 acceptance — night daylight-burn through update() (Task 4)', () => {
  // Daylight-burn cadence (entity-manager.ts:205): daytimeBurningActive = !isNight && tick % 20 === 0,
  // burnDamage = 1 for hostile mobs. A 20-maxHealth zombie therefore loses ~1 hp every
  // 20 ticks and reaches 0 after ~400 ticks. Assert MONOTONIC decrease across a span
  // crossing several multiples of 20 (with margin), NOT an exact tick boundary.
  it('daylight (isNight=false): zombie health decreases monotonically over many ticks', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          const id = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

          // Player far away so AI never reaches Chase/Attack — isolate burn damage.
          const playerFar: Position = { x: 10000, y: 64, z: 10000 }

          // 200 ticks crosses ten 20-tick burn boundaries → ~10 hp of burn, comfortably
          // within the 20 hp pool (no removal yet), so the entity stays present and we
          // can read its monotonically-decreasing health.
          let previousHealth = 20
          let observedDecrease = false
          yield* Effect.forEach(
            Arr.makeBy(200, (i) => i),
            () =>
              Effect.gen(function* () {
                yield* entityManager.update(DeltaTimeSecs.make(0.016), playerFar, false)
                const entityOpt = yield* entityManager.getEntity(id)
                expect(Option.isSome(entityOpt)).toBe(true)
                const health = Option.getOrThrow(entityOpt).health
                // Monotonic: never increases.
                expect(health).toBeLessThanOrEqual(previousHealth)
                if (health < previousHealth) observedDecrease = true
                previousHealth = health
              }),
            { concurrency: 1 },
          )

          // Margin assertions (not an exact boundary): burn fired, health dropped, but
          // the entity has not yet been removed within 200 ticks (needs ~400).
          expect(observedDecrease).toBe(true)
          expect(previousHealth).toBeLessThan(20)
          expect(previousHealth).toBeGreaterThan(0)

          // CADENCE assertion: burn is 1 hp per 20-tick boundary, so over 200 ticks the
          // zombie loses ~ticks/20 = 10 hp → final ≈ maxHealth - 10 = 10. The [8,12]
          // band tolerates the non-exact-boundary phrasing while still catching a
          // 1-per-TICK burn regression (which would zero out / remove the entity well
          // before tick 200) — that path would leave previousHealth far below 8.
          expect(previousHealth).toBeGreaterThanOrEqual(8)
          expect(previousHealth).toBeLessThanOrEqual(12)
        }),
        EntityManagerLive,
      ),
    ))

  it('night (isNight=true): zombie health does NOT decrease and is not removed', () =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const entityManager = yield* EntityManager
          const id = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
          const playerFar: Position = { x: 10000, y: 64, z: 10000 }

          // Same 200-tick span at night: no daylight burn, so health stays at full.
          yield* Effect.forEach(
            Arr.makeBy(200, (i) => i),
            () => entityManager.update(DeltaTimeSecs.make(0.016), playerFar, true),
            { concurrency: 1 },
          )

          const entityOpt = yield* entityManager.getEntity(id)
          expect(Option.isSome(entityOpt)).toBe(true)
          expect(Option.getOrThrow(entityOpt).health).toBe(20)
          const count = yield* entityManager.getCount()
          expect(count).toBe(1)
        }),
        EntityManagerLive,
      ),
    ))
})
