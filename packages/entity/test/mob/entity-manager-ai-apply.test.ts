import { DeltaTimeSecs, zero } from '@ts-minecraft/core'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { describe, expect, it } from 'vitest'
import { applyEntityAIFrame } from '../../application/mob/entity-manager-ai-apply'
import { prepareEntityAIFrame } from '../../application/mob/entity-manager-ai-frame'
import { shouldReuseEntityAIFrame } from '../../application/mob/entity-manager-ai-reuse'
import { makeEntityFrameContext, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerAIApply', () => {
  it('reuses idle or attack frames only when the entity is unchanged', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-reuse-idle'),
      type: EntityType.Sheep,
      aiState: AIState.Idle,
      velocity: zero,
      wanderDirection: zero,
    })
    const context = makeEntityFrameContext()
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    expect(shouldReuseEntityAIFrame(entity, frame)).toBe(true)
    expect(applyEntityAIFrame(entity, context, frame)).toBe(entity)
  })

  it('rejects reuse when the attack cooldown changes', () => {
    const entity = makeTestManagedEntity({
      type: EntityType.Sheep,
      aiState: AIState.Idle,
      attackCooldownRemaining: 3,
      velocity: zero,
      wanderDirection: zero,
    })
    const context = makeEntityFrameContext()
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    expect(shouldReuseEntityAIFrame(entity, frame)).toBe(false)
  })

  it('applies knockback as a bounded cooldown update', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-knockback'),
      type: EntityType.Zombie,
      knockbackSecsRemaining: 0.4,
      health: 12,
      attackCooldownRemaining: 3,
    })
    const context = makeEntityFrameContext({ deltaTime: DeltaTimeSecs.make(0.1) })
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    const next = applyEntityAIFrame(entity, context, frame)

    expect(next.knockbackSecsRemaining).toBeCloseTo(0.3)
    expect(next.health).toBe(frame.nextHealth)
    expect(next.attackCooldownRemaining).toBe(frame.nextAttackCooldown)
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
    const context = makeEntityFrameContext({
      playerPosition: { x: 0, y: 64, z: 0 },
      playerLookOrigin: { x: 0, y: 66.1, z: 0 },
    })
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    const next = applyEntityAIFrame(entity, context, frame)

    expect(next.position).not.toEqual(entity.position)
    expect(next.velocity).toEqual({ x: 0, y: 0.5, z: 0 })
    expect(next.aiState).toBe(AIState.Chase)
    expect(next.stuckTicks).toBe(0)
  })
})
