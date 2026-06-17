import { TELEPORT_ATTEMPTS } from '../../domain/mob/enderman-teleport'
import { hashEntityId } from '../../domain/mob/entity-utils'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

const makeDeterministicRoll = (entity: ManagedEntity, salt: number): number =>
  ((hashEntityId(entity.entityId) + Math.floor(entity.health * 31) + salt * 997) % 1000) / 1000

export const makeTeleportAttempts = (entity: ManagedEntity, salt: number): ReadonlyArray<number> => {
  const rolls: number[] = []
  rolls.length = TELEPORT_ATTEMPTS * 2
  for (let index = 0; index < rolls.length; index++) {
    rolls[index] = makeDeterministicRoll(entity, salt + index + 1)
  }
  return rolls
}

export const makeEndermanTeleportRolls = (hash: number, tick: number): ReadonlyArray<number> => {
  const rolls: number[] = []
  rolls.length = TELEPORT_ATTEMPTS * 2
  for (let index = 0; index < rolls.length; index++) {
    rolls[index] = ((hash + tick * 131 + index * 977) % 1000) / 1000
  }
  return rolls
}
