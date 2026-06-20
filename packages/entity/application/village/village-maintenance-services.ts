import { type VillageService } from './village-service'
import { type VillagePlacementServices } from './village-placement-services'

export type VillageMaintenanceServices = {
  readonly blockService: VillagePlacementServices['blockService']
  readonly chunkManagerService: VillagePlacementServices['chunkManagerService']
  readonly villageService: Pick<VillageService, 'getVillages' | 'update'>
}
