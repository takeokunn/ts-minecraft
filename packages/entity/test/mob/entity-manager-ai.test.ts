import { describe, expect, it } from 'vitest'
import { MutableRef } from 'effect'
import { DeltaTimeSecs, zero } from '@ts-minecraft/core'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { processEntityAI } from '../../application/mob/entity-manager-ai'
import type { EntityFrameContext } from '../../application/mob/entity-manager-ai-frame'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { makeEntityFrameContext, makeTestManagedEntity } from './test-utils'

const makeRefs = () => ({
  dirtyRef: MutableRef.make(false),
  fireDamageRef: MutableRef.make(false),
  hasCreeperRef: MutableRef.make(false),
  hasShearedSheepRef: MutableRef.make(false),
})

const process = (entity: ManagedEntity, context: EntityFrameContext = makeEntityFrameContext()) => {
  const refs = makeRefs()
  const next = processEntityAI(
    entity,
    entity.entityId,
    context,
    refs.dirtyRef,
    refs.fireDamageRef,
    refs.hasCreeperRef,
    refs.hasShearedSheepRef,
  )

  return { next, refs }
}

describe('entity/entityManagerAI', () => {
  it('marks sheared sheep during AI processing', () => {
    const entity = makeTestManagedEntity({
      type: EntityType.Sheep,
      woolRegrowthTicks: 10,
    })

    const { refs } = process(entity)

    expect(MutableRef.get(refs.hasShearedSheepRef)).toBe(true)
  })

  it('applies accumulated fire damage without extinguishing the entity', () => {
    const entity = makeTestManagedEntity({
      fireSecsRemaining: 1,
      fireDamageAccumulatorSecs: 0.999,
      health: 20,
    })

    const { next, refs } = process(entity, makeEntityFrameContext({ deltaTime: DeltaTimeSecs.make(0.001) }))

    expect(next.fireSecsRemaining).toBeCloseTo(0.999)
    expect(next.fireDamageAccumulatorSecs).toBeCloseTo(0)
    expect(next.health).toBe(19)
    expect(MutableRef.get(refs.fireDamageRef)).toBe(true)
  })

  it('clears fire state when burning expires exactly on this tick', () => {
    const entity = makeTestManagedEntity({
      fireSecsRemaining: 0.001,
      fireDamageAccumulatorSecs: 0.5,
    })

    const { next } = process(entity, makeEntityFrameContext({ deltaTime: DeltaTimeSecs.make(0.001) }))

    expect(next.fireSecsRemaining).toBe(0)
    expect(next.fireDamageAccumulatorSecs).toBe(0)
  })

  it('teleports a stuck chasing Enderman and preserves vertical velocity', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-teleporting-enderman'),
      type: EntityType.Enderman,
      position: { x: 8, y: 64, z: 0 },
      velocity: { x: 1, y: 0.5, z: 1 },
      aiState: AIState.Chase,
      isProvoked: true,
      stuckTicks: 41,
      wanderDirection: zero,
    })

    const { next } = process(
      entity,
      makeEntityFrameContext({
        tick: 1,
        playerPosition: { x: 0, y: 64, z: 0 },
        playerLookOrigin: { x: 0, y: 66.1, z: 0 },
      }),
    )

    expect(next.position).not.toEqual(entity.position)
    expect(next.velocity).toEqual({ x: 0, y: 0.5, z: 0 })
    expect(next.aiState).toBe(AIState.Chase)
    expect(next.stuckTicks).toBe(0)
  })
})
