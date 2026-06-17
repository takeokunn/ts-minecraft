import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
import { GAME_TICKS_PER_SEC } from '@ts-minecraft/core'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { tickBreedingTimers } from '../../domain/mob/breeding'
import { hashEntityId } from '../../domain/mob/entity-utils'
import { WANDER_PHASE_TICK_STEP } from '../../domain/mob/entity-manager-utils'
import {
  AIState,
  distanceToPlayerSq,
  resolveAIState,
} from '../../domain/mob/state-machine'
import { tickEntityFire, type FireTick } from './entity-manager-fire'
import { shouldEndermanBecomeProvoked } from './entity-manager-ai-enderman'

export type EntityFrameContext = {
  readonly tick: number
  readonly deltaTime: DeltaTimeSecs
  readonly playerPosition: Position
  readonly playerLookOrigin: Position
  readonly playerLookDirection: Vector3 | undefined
  readonly playerLookBlocked: ((position: Position) => boolean) | undefined
  readonly daytimeBurningActive: boolean
}

export type EntityAIFrame = {
  readonly hash: number
  readonly randomWanderRoll: number
  readonly isProvoked: boolean
  readonly nextState: AIState
  readonly nextAttackCooldown: number
  readonly tickedBreeding: ReturnType<typeof tickBreedingTimers>
  readonly breedingChanged: boolean
  readonly burning: boolean
  readonly fireTick: FireTick
  readonly burnDamage: number
  readonly nextHealth: number
}

export const prepareEntityAIFrame = (
  entity: ManagedEntity,
  entityId: EntityId,
  ctx: EntityFrameContext,
): EntityAIFrame => {
  const {
    tick,
    deltaTime,
    playerPosition,
    playerLookOrigin,
    playerLookDirection,
    playerLookBlocked,
    daytimeBurningActive,
  } = ctx

  const hash = hashEntityId(entityId)
  const distSq = distanceToPlayerSq(entity.position, playerPosition)
  const distance = Math.sqrt(distSq)
  const randomWanderRoll = ((hash + tick * WANDER_PHASE_TICK_STEP) % 1000) / 1000

  const isEnderman = entity.type === EntityType.Enderman
  const isNowProvoked = shouldEndermanBecomeProvoked({
    isEnderman,
    isProvoked: entity.isProvoked,
    playerLookOrigin,
    playerLookDirection,
    playerLookBlocked,
    endermanPosition: entity.position,
    detectionRange: entity.detectionRange,
  })
  const isProvoked = entity.isProvoked || isNowProvoked
  const playerInDetectionRange = distSq <= entity.detectionRange * entity.detectionRange
  const canSeePlayer = isEnderman ? isProvoked && playerInDetectionRange : playerInDetectionRange

  const nextState = resolveAIState(entity.aiState, {
    behavior: entity.behavior,
    distanceToPlayer: distance,
    canSeePlayer,
    healthRatio: entity.health / entity.maxHealth,
    randomWanderRoll,
    attackRange: entity.attackRange,
    detectionRange: entity.detectionRange,
    fleeHealthThreshold: entity.fleeHealthThreshold,
  })

  const nextAttackCooldown = Math.max(0, entity.attackCooldownRemaining - deltaTime)
  const ticksElapsed = deltaTime * GAME_TICKS_PER_SEC
  const tickedBreeding = tickBreedingTimers({
    loveTicksRemaining: entity.loveTicksRemaining,
    breedCooldownRemaining: entity.breedCooldownRemaining,
    ageTicks: entity.ageTicks,
  }, ticksElapsed)
  const breedingChanged =
    tickedBreeding.loveTicksRemaining !== entity.loveTicksRemaining
    || tickedBreeding.breedCooldownRemaining !== entity.breedCooldownRemaining
    || tickedBreeding.ageTicks !== entity.ageTicks

  const burning = daytimeBurningActive && entity.behavior === 'hostile'
  const fireTick = tickEntityFire(entity, deltaTime)
  const burnDamage = (burning ? 1 : 0) + fireTick.damage
  const nextHealth = Math.max(0, entity.health - burnDamage)

  return {
    hash,
    randomWanderRoll,
    isProvoked,
    nextState,
    nextAttackCooldown,
    tickedBreeding,
    breedingChanged,
    burning,
    fireTick,
    burnDamage,
    nextHealth,
  }
}
