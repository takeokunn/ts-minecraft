/**
 * @fileoverview Inventory Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { Layer } from 'effect'
import { ContainerManagerApplicationServiceLive } from './container_manager'
import { InventoryDomainLive } from './domain-layer'
import { InventoryManagerApplicationServiceLive } from './inventory_manager'
import { TransactionManagerApplicationServiceLive } from './transaction_manager'

/**
 * 全アプリケーションサービスの統合Layer
 */
export const InventoryApplicationServicesLayer = Layer.mergeAll(
  InventoryManagerApplicationServiceLive,
  ContainerManagerApplicationServiceLive,
  TransactionManagerApplicationServiceLive
)

/**
 * Inventory Application Layer
 * - Application Service: InventoryManagerApplicationServiceLive, ContainerManagerServiceLive, TransactionManagerServiceLive
 * - 依存: InventoryDomainLive (Repository層 + Domain Service層 + Factory層)
 */
export const InventoryApplicationLive = InventoryApplicationServicesLayer.pipe(Layer.provide(InventoryDomainLive))
