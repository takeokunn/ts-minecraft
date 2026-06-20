import { DeltaTimeSecs } from '@ts-minecraft/core'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { describe, expect, it } from 'vitest'
import { prepareEntityAIFrame } from '../../application/mob/entity-manager-ai-frame'
import { shouldEndermanBecomeProvoked } from '../../application/mob/entity-manager-ai-enderman'
import { AIState } from '../../domain/mob/state-machine'
import { makeEntityFrameContext, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerAIFrame', () => {
  it('derives breeding and fire damage for a hostile mob frame', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-frame-hostile'),
      type: EntityType.Zombie,
      health: 20,
      fireSecsRemaining: 1,
      fireDamageAccumulatorSecs: 0.75,
      loveTicksRemaining: 40,
      breedCooldownRemaining: 10,
      ageTicks: 100,
    })

    const frame = prepareEntityAIFrame(
      entity,
      entity.entityId,
      makeEntityFrameContext({ deltaTime: DeltaTimeSecs.make(1), daytimeBurningActive: true }),
    )

    expect(frame.burning).toBe(true)
    expect(frame.fireTick.damage).toBe(1)
    expect(frame.burnDamage).toBe(2)
    expect(frame.nextHealth).toBe(18)
    expect(frame.breedingChanged).toBe(true)
    expect(frame.tickedBreeding).toEqual({
      loveTicksRemaining: 20,
      breedCooldownRemaining: 0,
      ageTicks: 120,
    })
  })

  it('promotes a looked-at Enderman into a provoked chase frame', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-frame-enderman'),
      type: EntityType.Enderman,
      position: { x: 8, y: 64, z: 0 },
      aiState: AIState.Idle,
      isProvoked: false,
    })

    const frame = prepareEntityAIFrame(
      entity,
      entity.entityId,
      makeEntityFrameContext({
        deltaTime: DeltaTimeSecs.make(1),
        playerPosition: { x: 0, y: 64, z: 0 },
        playerLookOrigin: { x: 0, y: 65.6, z: 0 },
        playerLookDirection: { x: 8, y: 0.5, z: 0 },
      }),
    )

    expect(frame.isProvoked).toBe(true)
    expect(frame.nextState).toBe(AIState.Chase)
  })

  it('keeps Endermen unprovoked when no look direction is available', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-frame-unprovoked-enderman'),
      type: EntityType.Enderman,
      position: { x: 8, y: 64, z: 0 },
      aiState: AIState.Idle,
      isProvoked: false,
    })

    const context = makeEntityFrameContext({
      playerPosition: { x: 0, y: 64, z: 0 },
      playerLookOrigin: { x: 0, y: 65.6, z: 0 },
    })
    const frame = prepareEntityAIFrame(entity, entity.entityId, context)

    expect(shouldEndermanBecomeProvoked({
      isEnderman: true,
      isProvoked: false,
      playerLookOrigin: context.playerLookOrigin,
      playerLookDirection: context.playerLookDirection,
      playerLookBlocked: context.playerLookBlocked,
      endermanPosition: entity.position,
      detectionRange: entity.detectionRange,
    })).toBe(false)
    expect(frame.isProvoked).toBe(false)
  })
})
