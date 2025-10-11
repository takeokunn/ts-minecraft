/**
 * InventoryFactory - DDD Factory Pattern Interface
 *
 * Effect-TS関数型ファクトリーパターンによるInventory生成システム
 * Blockドメインのファクトリーパターンを参考に、純粋関数のみで実装
 */

import { JsonRecordSchema } from '@shared/schema/json'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Context, Effect, Schema } from 'effect'
import type { Inventory, ItemStack, PlayerId } from '../../types'

// Inventory Factory固有のエラー型（Schema.TaggedErrorパターン）
export const InventoryCreationErrorSchema = Schema.TaggedError('InventoryCreationError', {
  reason: Schema.String,
  invalidFields: Schema.Array(Schema.String),
  context: JsonRecordSchema.pipe(Schema.optional),
})
export type InventoryCreationError = Schema.Schema.Type<typeof InventoryCreationErrorSchema>
export const InventoryCreationError = makeErrorFactory(InventoryCreationErrorSchema)

export const InventoryValidationErrorSchema = Schema.TaggedError('InventoryValidationError', {
  reason: Schema.String,
  missingFields: Schema.Array(Schema.String),
  context: JsonRecordSchema.pipe(Schema.optional),
})
export type InventoryValidationError = Schema.Schema.Type<typeof InventoryValidationErrorSchema>
export const InventoryValidationError = makeErrorFactory(InventoryValidationErrorSchema)

export const InventoryMergeErrorSchema = Schema.TaggedError('InventoryMergeError', {
  reason: Schema.String,
  conflictingFields: Schema.Array(Schema.String),
  context: JsonRecordSchema.pipe(Schema.optional),
})
export type InventoryMergeError = Schema.Schema.Type<typeof InventoryMergeErrorSchema>
export const InventoryMergeError = makeErrorFactory(InventoryMergeErrorSchema)

// インベントリータイプ（DDD Value Object）
export type InventoryType = 'player' | 'creative' | 'survival' | 'spectator' | 'adventure'

// 型ガード関数（Schema未定義のため暫定的に使用）
export const asInventoryType = (value: string): InventoryType => value as InventoryType

// インベントリー設定（DDD Value Object）
export interface InventoryConfig {
  readonly playerId: PlayerId
  readonly type: InventoryType
  readonly slotCount: number
  readonly enableHotbar: boolean
  readonly enableArmor: boolean
  readonly enableOffhand: boolean
  readonly startingItems?: ReadonlyArray<ItemStack>
  readonly permissions?: InventoryPermissions
}

// インベントリー権限（DDD Value Object）
export interface InventoryPermissions {
  readonly canAddItems: boolean
  readonly canRemoveItems: boolean
  readonly canModifyArmor: boolean
  readonly canUseHotbar: boolean
  readonly canUseOffhand: boolean
  readonly allowedItemTypes?: ReadonlyArray<string>
  readonly bannedItemTypes?: ReadonlyArray<string>
}

// デフォルト権限（関数型定数）
export const defaultPermissions: InventoryPermissions = {
  canAddItems: true,
  canRemoveItems: true,
  canModifyArmor: true,
  canUseHotbar: true,
  canUseOffhand: true,
} as const

// Inventory Factory インターフェース（DDD Factory Pattern）
export interface InventoryFactory {
  // 基本生成（Pure Function Pattern）
  readonly createEmpty: (
    config: Pick<InventoryConfig, 'playerId' | 'type'>
  ) => Effect.Effect<Inventory, InventoryCreationError>

  // タイプ別生成（Category-based Factory Pattern）
  readonly createPlayerInventory: (playerId: PlayerId) => Effect.Effect<Inventory, InventoryCreationError>
  readonly createCreativeInventory: (playerId: PlayerId) => Effect.Effect<Inventory, InventoryCreationError>
  readonly createSurvivalInventory: (playerId: PlayerId) => Effect.Effect<Inventory, InventoryCreationError>

  // 設定ベース生成（Configuration-based Factory Pattern）
  readonly createWithConfig: (config: InventoryConfig) => Effect.Effect<Inventory, InventoryCreationError>

  // アイテム付き生成（Pre-populated Factory Pattern）
  readonly createWithItems: (
    config: Pick<InventoryConfig, 'playerId' | 'type'>,
    items: ReadonlyArray<ItemStack>
  ) => Effect.Effect<Inventory, InventoryCreationError>

  // 既存からコピー（Clone Factory Pattern）
  readonly cloneInventory: (
    source: Inventory,
    newPlayerId: PlayerId
  ) => Effect.Effect<Inventory, InventoryCreationError>

  // インベントリーマージ（Merge Factory Pattern）
  readonly mergeInventories: (primary: Inventory, secondary: Inventory) => Effect.Effect<Inventory, InventoryMergeError>

  // 検証（Validation Factory Pattern）
  readonly validateInventory: (inventory: Inventory) => Effect.Effect<void, InventoryValidationError>

  // 最適化（Optimization Factory Pattern）
  readonly optimizeInventory: (inventory: Inventory) => Effect.Effect<Inventory, InventoryCreationError>
}

// Context.GenericTag による依存性注入パターン
export const InventoryFactory = Context.GenericTag<InventoryFactory>('@minecraft/domain/inventory/InventoryFactory')

// Factory Builder 設定型（Builder Pattern Support）
export interface InventoryBuilderConfig {
  readonly playerId?: PlayerId
  readonly type?: InventoryType
  readonly slotCount?: number
  readonly enableHotbar?: boolean
  readonly enableArmor?: boolean
  readonly enableOffhand?: boolean
  readonly startingItems?: ReadonlyArray<ItemStack>
  readonly permissions?: Partial<InventoryPermissions>
}

// Factory Builder インターフェース（Fluent API Pattern）
export interface InventoryBuilder {
  readonly withPlayerId: (playerId: PlayerId) => InventoryBuilder
  readonly withType: (type: InventoryType) => InventoryBuilder
  readonly withSlotCount: (count: number) => InventoryBuilder
  readonly withHotbar: (enabled: boolean) => InventoryBuilder
  readonly withArmor: (enabled: boolean) => InventoryBuilder
  readonly withOffhand: (enabled: boolean) => InventoryBuilder
  readonly withStartingItems: (items: ReadonlyArray<ItemStack>) => InventoryBuilder
  readonly withPermissions: (permissions: Partial<InventoryPermissions>) => InventoryBuilder
  readonly addStartingItem: (item: ItemStack) => InventoryBuilder
  readonly build: () => Effect.Effect<Inventory, InventoryCreationError>
  readonly validate: () => Effect.Effect<void, InventoryValidationError>
  readonly reset: () => InventoryBuilder
}

// Builder Factory インターフェース（Factory of Factories Pattern）
export interface InventoryBuilderFactory {
  readonly create: () => InventoryBuilder
  readonly fromInventory: (inventory: Inventory) => InventoryBuilder
  readonly fromConfig: (config: InventoryBuilderConfig) => InventoryBuilder
  readonly createWithDefaults: (type: InventoryType) => Effect.Effect<InventoryBuilder, InventoryCreationError>
}

export const InventoryBuilderFactory = Context.GenericTag<InventoryBuilderFactory>(
  '@minecraft/domain/inventory/InventoryBuilderFactory'
)
