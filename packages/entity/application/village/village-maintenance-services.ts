import { type Effect } from 'effect'
import { type Position } from '@ts-minecraft/core'
import { type EntityId } from '../../domain/mob/entity'
import { type EntityType } from '../../domain/mob/entity'
import { type Entity } from '../../domain/mob/entity'
import { type VillageService } from './village-service'
import { type VillagePlacementServices } from './village-placement-services'

export type VillageMaintenanceServices = {
  readonly blockService: VillagePlacementServices['blockService']
  readonly chunkManagerService: VillagePlacementServices['chunkManagerService']
  readonly villageService: Pick<VillageService, 'getVillages' | 'update'>
  // Villager mob sync: activated villages materialize their domain villagers
  // as real entities so the player sees (and right-click-trades with) them.
  readonly entityManager: {
    readonly getEntities: () => Effect.Effect<ReadonlyArray<Entity>, never>
    readonly addEntity: (type: EntityType, position: Position) => Effect.Effect<EntityId, never>
  }
}
