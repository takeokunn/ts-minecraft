import { Context, Effect, Layer } from 'effect'
import { ContainerRepository } from './container_repository'
import { InventoryRepository } from './inventory_repository'
import { ItemDefinitionRepository } from './item_definition_repository'

/**
 * 統合Inventory Repository
 * ドメイン層が利用するリポジトリ契約の集合を表現するコンテキスト
 */
export interface UnifiedInventoryRepository {
  readonly inventory: InventoryRepository
  readonly itemDefinition: ItemDefinitionRepository
  readonly container: ContainerRepository
}

export const UnifiedInventoryRepository = Context.GenericTag<UnifiedInventoryRepository>(
  '@minecraft/domain/inventory/repository/UnifiedInventoryRepository'
)

/**
 * 指定されたLayerを統合してUnifiedInventoryRepositoryを提供するヘルパー
 * 具体的な実装Layerはアプリケーション/インフラ層から注入する
 */
export const createUnifiedInventoryRepository = (
  inventoryLayer: Layer.Layer<InventoryRepository>,
  itemDefinitionLayer: Layer.Layer<ItemDefinitionRepository>,
  containerLayer: Layer.Layer<ContainerRepository>
) =>
  Layer.effect(
    UnifiedInventoryRepository,
    Effect.gen(function* () {
      const inventoryRepo = yield* InventoryRepository
      const itemDefinitionRepo = yield* ItemDefinitionRepository
      const containerRepo = yield* ContainerRepository

      return UnifiedInventoryRepository.of({
        inventory: inventoryRepo,
        itemDefinition: itemDefinitionRepo,
        container: containerRepo,
      })
    })
  ).pipe(Layer.provide(inventoryLayer), Layer.provide(itemDefinitionLayer), Layer.provide(containerLayer))
