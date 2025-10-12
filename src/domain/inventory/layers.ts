import { Layer } from 'effect'
import { createInventoryDomainServicesLayer } from './domain_service/layer'
import { ContainerFactoryLayer } from './aggregate/container/factory'
import { InventoryFactoryLayer as InventoryAggregateFactoryLayer } from './aggregate/inventory/factory'
import { ItemStackFactoryLayer } from './aggregate/item_stack/factory'
import { ItemFactoryLayer } from './factory/item_factory/factory'

export const InventoryFactoryLayer = Layer.mergeAll(
  InventoryAggregateFactoryLayer,
  ContainerFactoryLayer,
  ItemStackFactoryLayer,
  ItemFactoryLayer
)

export interface InventoryDomainServicesDependencies {
  readonly itemRegistry: Layer.Layer<any>
  readonly transfer: Layer.Layer<any>
  readonly stacking: Layer.Layer<any>
  readonly validation: Layer.Layer<any>
  readonly craftingIntegration: Layer.Layer<any>
}

export interface InventoryDomainLayerOptions {
  readonly services: InventoryDomainServicesDependencies
  readonly repository: Layer.Layer<any>
}

export const createInventoryDomainLayer = (options: InventoryDomainLayerOptions) =>
  Layer.mergeAll(
    createInventoryDomainServicesLayer({
      itemRegistry: options.services.itemRegistry,
      transfer: options.services.transfer,
      stacking: options.services.stacking,
      validation: options.services.validation,
      craftingIntegration: options.services.craftingIntegration,
    }),
    InventoryFactoryLayer,
    options.repository
  )
