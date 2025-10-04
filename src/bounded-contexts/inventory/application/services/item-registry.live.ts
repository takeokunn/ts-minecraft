import { Effect, Layer } from 'effect'
import { ItemRegistry, makeItemRegistryService } from '@mc/bc-inventory/domain/item-registry'

/**
 * ItemRegistry の標準実装。
 * ドメイン層は純粋関数と定義のみを保持し、副作用と Layer 定義はアプリケーション層に配置する。
 */
export const ItemRegistryLive = Layer.effect(ItemRegistry, Effect.sync(makeItemRegistryService))

export const ItemRegistryLayer = ItemRegistryLive
