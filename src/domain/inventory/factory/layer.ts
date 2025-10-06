import { Layer } from 'effect'
import { ContainerFactoryAllLayer } from './container_factory'
import { InventoryFactoryAllLayer } from './inventory_factory'
import { ItemFactoryAllLayer } from './item_factory'

/**
 * 全Inventory関連ファクトリーサービスを統合したレイヤー
 * アプリケーション層でInventoryドメインの全ファクトリーを一括利用可能
 *
 * @description
 * このレイヤーを提供することで、以下の全てのファクトリーサービスが利用可能になります：
 * - InventoryFactory: プレイヤーインベントリー管理
 * - InventoryBuilderFactory: インベントリービルダー
 * - ItemFactory: アイテム生成・管理
 * - ItemBuilderFactory: アイテムビルダー
 * - ContainerFactory: コンテナ生成・管理
 * - ContainerBuilderFactory: コンテナビルダー
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   // 全ファクトリーが利用可能
 *   const playerInventory = yield* InventoryFactoryHelpers.createPlayer('player1')
 *   const diamondSword = yield* ItemFactoryHelpers.createWeapon('diamond_sword')
 *   const chest = yield* ContainerFactoryHelpers.createChest('chest1')
 * }).pipe(Effect.provide(InventoryFactorySystemLayer))
 * ```
 */
export const InventoryFactorySystemLayer = Layer.mergeAll(
  InventoryFactoryAllLayer,
  ItemFactoryAllLayer,
  ContainerFactoryAllLayer
)
