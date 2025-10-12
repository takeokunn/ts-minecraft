import { createEquipmentDomainLayer } from '@domain/equipment/layers'
import { InMemoryEquipmentRepository } from '@infrastructure/equipment/repository'

/**
 * Equipment Domain Layer (Default Composition)
 *
 * Application 層でドメイン依存を組み立て、インフラ実装を注入する。
 */
export const EquipmentDomainLive = createEquipmentDomainLayer(InMemoryEquipmentRepository)
