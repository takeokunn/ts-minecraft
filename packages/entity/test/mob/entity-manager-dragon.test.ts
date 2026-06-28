import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, HashMap, Option, Ref } from 'effect'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import type { Entity } from '@ts-minecraft/entity/domain/mob/entity'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'
import type { DragonDeathEvent } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-death'
import { DragonPhase } from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-phase'
import { tickDragonEntity } from '../../application/mob/entity-manager-dragon'
import { runDragonUpdate } from '../../application/mob/entity-manager-dragon-update'
import { damageManagedEntity } from '../../application/mob/entity-manager-damage'
import { makeTestManagedEntity } from './test-utils'

const PLAYER = { x: 0, y: 64, z: 0 }
const dragonId = EntityId.make('dragon-1')

const makeDragon = (overrides: Partial<ManagedEntity> = {}): ManagedEntity =>
  makeTestManagedEntity({ type: EntityType.EnderDragon, entityId: dragonId, position: { x: 10, y: 80, z: 10 }, ...overrides })

describe('tickDragonEntity', () => {
  it('leaves non-dragon entities untouched and emits no events', () => {
    const zombie = makeTestManagedEntity({ type: EntityType.Zombie, entityId: EntityId.make('z1') })
    const result = tickDragonEntity(zombie, zombie.entityId, 5, PLAYER)
    expect(result.next).toBe(zombie)
    expect(result.remove).toBe(false)
    expect(result.events).toHaveLength(0)
  })

  it('applies the flight FSM velocity to a live dragon (overrides generic wander)', () => {
    const dragon = makeDragon({ velocity: { x: 0, y: 0, z: 0 } })
    const result = tickDragonEntity(dragon, dragonId, 1, PLAYER)
    // Circling produces a non-zero flight velocity.
    const v = result.next.velocity
    expect(v.x * v.x + v.y * v.y + v.z * v.z).toBeGreaterThan(0)
    expect(result.next.dragonPhase?.phase).toBe(DragonPhase.Circling)
    expect(result.remove).toBe(false)
    expect(result.events).toHaveLength(0)
  })

  it('emits Dying events while in the death sequence and removes on Complete', () => {
    const dragon = makeDragon({ health: 0, dragonDeathProgress: 0 })
    const first = tickDragonEntity(dragon, dragonId, 10, PLAYER)
    expect(first.events.map((e) => e.type)).toContain('Dying')
    expect(first.next.dragonDeathProgress).toBe(1)
    expect(first.remove).toBe(false)

    // Jump to the final tick: the sequence completes and requests removal.
    const atEnd = makeDragon({ health: 0, dragonDeathProgress: 200 })
    const last = tickDragonEntity(atEnd, dragonId, 10, PLAYER)
    expect(last.events.some((e: DragonDeathEvent) => e.type === 'Complete')).toBe(true)
    expect(last.remove).toBe(true)
  })

  it('derives randomValue deterministically (same id+tick → identical step)', () => {
    const dragon = makeDragon()
    const a = tickDragonEntity(dragon, dragonId, 7, PLAYER)
    const b = tickDragonEntity(dragon, dragonId, 7, PLAYER)
    expect(a.next.velocity).toEqual(b.next.velocity)
  })
})

describe('damageManagedEntity (dragon death sequence start)', () => {
  it('starts the death sequence instead of removing the dragon at 0 HP', () => {
    const dragon = makeDragon({ health: 5 })
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), dragonId, dragon)
    const [drops, updated] = damageManagedEntity(entities, dragonId, 5)
    expect(Option.isNone(drops)).toBe(true)
    const after = Option.getOrNull(HashMap.get(updated, dragonId))
    expect(after).not.toBeNull()
    expect(after?.health).toBe(0)
    expect(after?.dragonDeathProgress).toBe(0)
    expect(after?.dragonPhase?.phase).toBe(DragonPhase.DeathSequence)
  })

  it('ignores further damage once the dragon is mid-death-sequence', () => {
    const dragon = makeDragon({ health: 0, dragonDeathProgress: 50 })
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), dragonId, dragon)
    const [drops, updated] = damageManagedEntity(entities, dragonId, 100)
    expect(Option.isNone(drops)).toBe(true)
    expect(updated).toBe(entities)
  })

  it('still removes a normal mob at 0 HP (regression)', () => {
    const zombie = makeTestManagedEntity({ type: EntityType.Zombie, entityId: EntityId.make('z9'), health: 4 })
    const entities = HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), zombie.entityId, zombie)
    const [drops, updated] = damageManagedEntity(entities, zombie.entityId, 4)
    expect(Option.isSome(drops)).toBe(true)
    expect(HashMap.has(updated, zombie.entityId)).toBe(false)
  })
})

describe('runDragonUpdate', () => {
  const harness = (entity: ManagedEntity) =>
    Effect.gen(function* () {
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entity.entityId, entity))
      const cacheRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.some([]))
      const structureRef = yield* Ref.make(0)
      const eventsRef = yield* Ref.make<ReadonlyArray<DragonDeathEvent>>([])
      yield* runDragonUpdate(entitiesRef, cacheRef, structureRef, eventsRef, 1, PLAYER)
      return {
        entities: yield* Ref.get(entitiesRef),
        cache: yield* Ref.get(cacheRef),
        structure: yield* Ref.get(structureRef),
        events: yield* Ref.get(eventsRef),
      }
    })

  it('advances a live dragon and invalidates the cache without bumping structure version', () =>
    Effect.gen(function* () {
      const out = yield* harness(makeDragon({ velocity: { x: 0, y: 0, z: 0 } }))
      const after = Option.getOrNull(HashMap.get(out.entities, dragonId))
      expect(after?.velocity.x === 0 && after?.velocity.y === 0 && after?.velocity.z === 0).toBe(false)
      expect(Option.isNone(out.cache)).toBe(true)
      expect(out.structure).toBe(0)
      expect(out.events).toHaveLength(0)
    }).pipe(Effect.runPromise))

  it('removes the dragon and bumps structure version on Complete, queuing the events', () =>
    Effect.gen(function* () {
      const out = yield* harness(makeDragon({ health: 0, dragonDeathProgress: 200 }))
      expect(HashMap.has(out.entities, dragonId)).toBe(false)
      expect(out.structure).toBe(1)
      expect(out.events.some((e) => e.type === 'Complete')).toBe(true)
    }).pipe(Effect.runPromise))

  it('queues egg + portal events at their trigger ticks', () =>
    Effect.gen(function* () {
      const egg = yield* harness(makeDragon({ health: 0, dragonDeathProgress: 120 }))
      expect(egg.events.some((e) => e.type === 'DragonEggSpawn')).toBe(true)
      const portal = yield* harness(makeDragon({ health: 0, dragonDeathProgress: 140 }))
      expect(portal.events.some((e) => e.type === 'ReturnPortalActivate')).toBe(true)
    }).pipe(Effect.runPromise))

  it('ignores worlds with no dragon (no events, no cache change)', () =>
    Effect.gen(function* () {
      const zombie = makeTestManagedEntity({ type: EntityType.Zombie, entityId: EntityId.make('z2') })
      const out = yield* harness(zombie)
      expect(out.events).toHaveLength(0)
      expect(Option.isSome(out.cache)).toBe(true)
    }).pipe(Effect.runPromise))
})
