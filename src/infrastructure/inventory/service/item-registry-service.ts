import { ItemRegistryService, makeItemRegistryService } from '@domain/inventory/domain_service/item_registry'
import { Layer } from 'effect'

export const ItemRegistryServiceLayer = Layer.effect(ItemRegistryService, makeItemRegistryService)
