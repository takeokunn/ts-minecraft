import type { Position } from '@ts-minecraft/core'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { hashEntityId } from '../../domain/mob/entity-utils'
import { tickDragonPhase } from '../../domain/mob/ender-dragon/dragon-phase'
import { RETURN_PORTAL_POSITION, type DragonDeathEvent } from '../../domain/mob/ender-dragon/dragon-death'
import { tickDragonDeathSequence } from './dragon-death-service'

// Result of advancing one EnderDragon for a single tick. `next` is the (possibly identical)
// entity to store back; `remove` requests removal (death sequence Complete); `events` are
// the death events the app layer must apply (block placement / XP / removal) — the entity
// layer itself never touches world blocks or player XP (DDD boundary).
export type DragonTickResult = {
  readonly next: ManagedEntity
  readonly remove: boolean
  readonly events: ReadonlyArray<DragonDeathEvent>
}

const NO_EVENTS: ReadonlyArray<DragonDeathEvent> = []

// Deterministic [0,1) roll derived from the entity id + tick (no Math.random — banned and
// non-reproducible). Mirrors the hashEntityId + tick pattern used by the AI frame.
const dragonRandomValue = (entityId: EntityId, tick: number): number =>
  ((hashEntityId(entityId) + tick * 31) % 1000) / 1000

const advanceDeathSequence = (
  entity: ManagedEntity,
  tick: number,
): DragonTickResult => {
  const sequence = tickDragonDeathSequence({ progress: entity.dragonDeathProgress ?? 0 }, tick, entity.position)
  const remove = sequence.events.some((event) => event.type === 'Complete')
  return {
    next: { ...entity, dragonDeathProgress: sequence.progress },
    remove,
    events: sequence.events,
  }
}

const advanceAlivePhase = (
  entity: ManagedEntity,
  entityId: EntityId,
  tick: number,
  playerPosition: Position | null,
): DragonTickResult => {
  // dragonPhase is non-null for a live dragon (set at spawn); guard defensively.
  if (entity.dragonPhase === null) return { next: entity, remove: false, events: NO_EVENTS }

  const step = tickDragonPhase(entity.dragonPhase, {
    dragonPosition: entity.position,
    dragonHealth: entity.health,
    playerPosition,
    portalPosition: RETURN_PORTAL_POSITION,
    randomValue: dragonRandomValue(entityId, tick),
    tick,
  })

  // Crystal healing seam: computeCrystalHealing(crystalPositions, ...) would apply here once
  // END_CRYSTAL block positions are cheaply available to the entity layer. They are not today
  // (entities cannot read world blocks), so healing is intentionally left unwired.

  return {
    next: {
      ...entity,
      dragonPhase: step.nextState,
      velocity: step.intent.newVelocity,
    },
    remove: false,
    events: NO_EVENTS,
  }
}

// Advance one entity if it is the Ender Dragon; otherwise return it unchanged. Death sequence
// (health 0) takes priority over the flight FSM.
export const tickDragonEntity = (
  entity: ManagedEntity,
  entityId: EntityId,
  tick: number,
  playerPosition: Position | null,
): DragonTickResult => {
  if (entity.type !== EntityType.EnderDragon) return { next: entity, remove: false, events: NO_EVENTS }
  if (entity.dragonDeathProgress !== null) return advanceDeathSequence(entity, tick)
  return advanceAlivePhase(entity, entityId, tick, playerPosition)
}
