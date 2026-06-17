import type { Position } from '@ts-minecraft/core'
import { computeEndermanTeleportTarget, shouldEndermanTeleport } from '../../domain/mob/enderman-teleport'
import { EntityType } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { makeTeleportAttempts } from './entity-manager-teleport'

export type DamagedManagedEntityState = Readonly<{
  readonly position: Position
  readonly isProvoked: boolean
}>

const resolveEndermanTeleportTarget = (entity: ManagedEntity, nextHealth: number): Position | null => {
  if (entity.type !== EntityType.Enderman) return null
  if (!shouldEndermanTeleport(true, 0, 0)) return null

  return computeEndermanTeleportTarget(
    entity.position,
    entity.position,
    makeTeleportAttempts(entity, Math.floor(nextHealth)),
  )
}

export const resolveDamagedManagedEntityState = (
  entity: ManagedEntity,
  nextHealth: number,
): DamagedManagedEntityState => {
  const teleportTarget = resolveEndermanTeleportTarget(entity, nextHealth)

  return {
    position: teleportTarget ?? entity.position,
    isProvoked: entity.type === EntityType.Enderman ? true : entity.isProvoked,
  }
}
