import { Layer } from 'effect'
import { ItemRegistryService, makeItemRegistryService } from '@domain/inventory/domain_service/item_registry'

export const ItemRegistryServiceLayer = Layer.effect(ItemRegistryService, makeItemRegistryService)
