import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { describe, expect, it, vi } from 'vitest'
import { tryApplyEndermanTeleport } from '../../application/mob/entity-manager-ai-enderman-teleport'
import { prepareEntityAIFrame } from '../../application/mob/entity-manager-ai-frame'
import { makeEntityFrameContext, makeTestManagedEntity } from './test-utils'

vi.mock('../../application/mob/entity-manager-teleport', () => ({
  makeEndermanTeleportRolls: () => [0.25, 0.5, 0.75] as const,
}))

vi.mock('../../domain/mob/enderman-teleport', () => ({
  computeEndermanTeleportTarget: () => ({ x: 21, y: 65, z: -9 }),
  shouldEndermanTeleport: () => true,
}))

describe('entity/entityManagerAIEndermanTeleport', () => {
  it('returns null for non-Endermen', () => {
    const entity = makeTestManagedEntity({
      type: EntityType.Sheep,
      aiState: AIState.Idle,
    })
    const context = makeEntityFrameContext()
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    expect(tryApplyEndermanTeleport(entity, context, frame)).toBeNull()
  })

  it('applies the mocked teleport target for chasing Endermen', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-enderman-teleport-helper'),
      type: EntityType.Enderman,
      position: { x: 8, y: 64, z: 0 },
      velocity: { x: 1, y: 0.5, z: 1 },
      aiState: AIState.Chase,
      isProvoked: true,
      stuckTicks: 41,
    })
    const context = makeEntityFrameContext({
      playerPosition: { x: 0, y: 64, z: 0 },
      playerLookOrigin: { x: 0, y: 66.1, z: 0 },
    })
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    expect(tryApplyEndermanTeleport(entity, context, frame)).toEqual({
      ...entity,
      ...frame.tickedBreeding,
      health: frame.nextHealth,
      position: { x: 21, y: 65, z: -9 },
      velocity: { x: 0, y: 0.5, z: 0 },
      aiState: frame.nextState,
      isProvoked: frame.isProvoked,
      attackCooldownRemaining: frame.nextAttackCooldown,
      fireSecsRemaining: frame.fireTick.fireSecsRemaining,
      fireDamageAccumulatorSecs: frame.fireTick.fireDamageAccumulatorSecs,
      stuckTicks: 0,
    })
  })
})
