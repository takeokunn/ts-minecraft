import type { DeltaTimeSecs, Position, Vector3 } from '@ts-minecraft/core'
import { GAME_TICKS_PER_SEC } from '@ts-minecraft/core'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { tickBreedingTimers } from '../../domain/mob/breeding'
import { UNDEAD_MOBS } from '../../domain/mob/mob-categories'
import { hashEntityId } from '../../domain/mob/entity-utils'
import { WANDER_PHASE_TICK_STEP } from '../../domain/mob/entity-manager-utils'
import {
  AIState,
  distanceToPlayerSq,
  resolveAIState,
} from '../../domain/mob/state-machine'
import { tickEntityFire, type FireTick } from './entity-manager-fire'
import { shouldEndermanBecomeProvoked } from './entity-manager-ai-enderman'

// Sky-exposure probe pushed by the app layer (entities cannot read world
// blocks). null → every undead burns, matching the pre-probe behavior.
let skyExposureProbe: ((x: number, y: number, z: number) => boolean) | null = null
export const setSkyExposureProbe = (probe: ((x: number, y: number, z: number) => boolean) | null): void => {
  skyExposureProbe = probe
}

export type EntityFrameContext = {
  readonly tick: number
  readonly deltaTime: DeltaTimeSecs
  readonly playerPosition: Position
  // Co-op: other players' positions (entity host only). Detection and chase
  // target the NEAREST player so mobs don't ignore everyone but the host.
  // Enderman stare-aggro stays local-camera based — only the local player's
  // look direction is known.
  readonly remotePlayerPositions?: ReadonlyArray<Position>
  readonly playerLookOrigin: Position
  readonly playerLookDirection: Vector3 | undefined
  readonly playerLookBlocked: ((position: Position) => boolean) | undefined
  readonly daytimeBurningActive: boolean
}

// The closest player to this entity (local player plus any co-op remotes) —
// the position hostile detection and chase steering should target.
export const nearestPlayerPosition = (
  entityPosition: Position,
  playerPosition: Position,
  remotePlayerPositions: ReadonlyArray<Position> | undefined,
): Position => {
  if (remotePlayerPositions === undefined || remotePlayerPositions.length === 0) return playerPosition
  let nearest = playerPosition
  let nearestDistSq = distanceToPlayerSq(entityPosition, playerPosition)
  for (const remotePosition of remotePlayerPositions) {
    const remoteDistSq = distanceToPlayerSq(entityPosition, remotePosition)
    if (remoteDistSq < nearestDistSq) {
      nearestDistSq = remoteDistSq
      nearest = remotePosition
    }
  }
  return nearest
}

export type EntityAIFrame = {
  readonly hash: number
  readonly targetPlayerPosition: Position
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
  const targetPlayerPosition = nearestPlayerPosition(entity.position, playerPosition, ctx.remotePlayerPositions)
  const distSq = distanceToPlayerSq(entity.position, targetPlayerPosition)
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

  // Vanilla: only undead hostiles burn in daylight — creepers/spiders/
  // endermen/witches survive the day.
  // Shade/water exemption: the app layer probes sky exposure at the mob's head
  // (unset probe → burn, the pre-probe behavior).
  const exposedToSky = skyExposureProbe === null
    || skyExposureProbe(entity.position.x, entity.position.y + 1, entity.position.z)
  const burning = daytimeBurningActive && exposedToSky && UNDEAD_MOBS.has(entity.type)
  const fireTick = tickEntityFire(entity, deltaTime)
  const burnDamage = (burning ? 1 : 0) + fireTick.damage
  const nextHealth = Math.max(0, entity.health - burnDamage)

  return {
    hash,
    targetPlayerPosition,
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
