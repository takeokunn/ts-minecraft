import { Layer } from 'effect'

// ===== Domain Services Layer =====
import {
  CraftingIntegrationService,
  StackingService,
  TransferService,
  ValidationService,
  makeCraftingIntegrationService,
  makeStackingService,
  makeTransferService,
  makeValidationService,
} from '@domain/inventory/domain_service'
import { ItemRegistryServiceLayer } from '@infrastructure/inventory/service'

// ===== Factory Layer =====
import { ContainerFactoryLayer } from '@domain/inventory/aggregate/container/factory'
import { InventoryFactoryLayer as InventoryAggregateFactoryLayer } from '@domain/inventory/aggregate/inventory/factory'
import { ItemStackFactoryLayer } from '@domain/inventory/aggregate/item_stack/factory'
import { ItemFactoryLayer } from '@domain/inventory/factory/item_factory/factory'

// ===== Repository Layer =====
import {
  DefaultInventoryRepositoryConfig,
  createInventoryRepositoryLayer,
} from '@infrastructure/inventory/repository/layers'

/**
 * Inventory Repository Layer (Default Configuration)
 *
 * Application 層で Domain のリポジトリ実装を選択し注入する。
 */
export const InventoryRepositoryLayer = createInventoryRepositoryLayer(DefaultInventoryRepositoryConfig)

/**
 * Inventory Domain Services Layer
 *
 * 全てのInventoryドメインサービスを統合したレイヤー。
 * 複数集約にまたがるビジネスロジックを提供。
 */
export const InventoryDomainServicesLayer = Layer.mergeAll(
  ItemRegistryServiceLayer,
  Layer.effect(TransferService, makeTransferService),
  Layer.effect(StackingService, makeStackingService),
  Layer.effect(ValidationService, makeValidationService),
  Layer.effect(CraftingIntegrationService, makeCraftingIntegrationService)
)

/**
 * Inventory Factory Layer
 *
 * 全てのInventoryファクトリーを統合したレイヤー。
 * 複雑な集約・エンティティの構築を担当。
 */
export const InventoryFactoryLayer = Layer.mergeAll(
  InventoryAggregateFactoryLayer,
  ContainerFactoryLayer,
  ItemStackFactoryLayer,
  ItemFactoryLayer
)

/**
 * Inventory Domain Layer
 *
 * ドメインサービス群、ファクトリー群、リポジトリ群を統合したレイヤー。
 * 純粋なドメインロジックを Application 層から組み立てる。
 */
export const InventoryDomainLive = Layer.mergeAll(
  InventoryDomainServicesLayer,
  InventoryFactoryLayer,
  InventoryRepositoryLayer
)
