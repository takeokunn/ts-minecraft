/**
 * ContainerFactory - DDD Factory Pattern Interface for Container Systems
 *
 * Effect-TS関数型ファクトリーパターンによるContainer生成システム
 * Chest、Furnace、Hopper等のMinecraftコンテナシステムを管理
 */

import type { JsonRecord } from '@shared/schema/json'
import { JsonRecordSchema } from '@shared/schema/json'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Context, Effect, Schema } from 'effect'
import type { ItemId, ItemStack } from '../../types'

// Container Factory固有のエラー型（Schema.TaggedErrorパターン）
export const ContainerCreationErrorSchema = Schema.TaggedError('ContainerCreationError', {
  reason: Schema.String,
  invalidFields: Schema.Array(Schema.String),
  context: JsonRecordSchema.pipe(Schema.optional),
})
export type ContainerCreationError = Schema.Schema.Type<typeof ContainerCreationErrorSchema>
export const ContainerCreationError = makeErrorFactory(ContainerCreationErrorSchema)

export const ContainerValidationErrorSchema = Schema.TaggedError('ContainerValidationError', {
  reason: Schema.String,
  missingFields: Schema.Array(Schema.String),
  context: JsonRecordSchema.pipe(Schema.optional),
})
export type ContainerValidationError = Schema.Schema.Type<typeof ContainerValidationErrorSchema>
export const ContainerValidationError = makeErrorFactory(ContainerValidationErrorSchema)

export const ContainerOperationErrorSchema = Schema.TaggedError('ContainerOperationError', {
  reason: Schema.String,
  operation: Schema.String,
  context: JsonRecordSchema.pipe(Schema.optional),
})
export type ContainerOperationError = Schema.Schema.Type<typeof ContainerOperationErrorSchema>
export const ContainerOperationError = makeErrorFactory(ContainerOperationErrorSchema)

// コンテナタイプ（DDD Value Object）
export type ContainerType =
  | 'chest'
  | 'large_chest'
  | 'ender_chest'
  | 'shulker_box'
  | 'furnace'
  | 'blast_furnace'
  | 'smoker'
  | 'brewing_stand'
  | 'hopper'
  | 'dropper'
  | 'dispenser'
  | 'barrel'
  | 'crafting_table'
  | 'enchanting_table'
  | 'anvil'
  | 'grindstone'
  | 'stonecutter'
  | 'smithing_table'
  | 'cartography_table'
  | 'fletching_table'
  | 'loom'

// 型ガード関数（Schema未定義のため暫定的に使用）
export const asContainerType = (value: string): ContainerType => value as ContainerType

// コンテナアクセス権限（DDD Value Object）
export interface ContainerPermissions {
  readonly canInsert: boolean
  readonly canExtract: boolean
  readonly canView: boolean
  readonly canBreak: boolean
  readonly restrictedToOwner: boolean
  readonly allowedPlayers?: ReadonlyArray<string>
  readonly bannedPlayers?: ReadonlyArray<string>
  readonly allowedItemTypes?: ReadonlyArray<string>
  readonly bannedItemTypes?: ReadonlyArray<string>
}

// コンテナスロット定義（DDD Value Object）
export interface ContainerSlot {
  readonly index: number
  readonly type: 'input' | 'output' | 'fuel' | 'ingredient' | 'result' | 'storage'
  readonly item: ItemStack | null
  readonly acceptsItemType?: (itemId: ItemId) => boolean
  readonly maxStackSize?: number
}

// コンテナ状態（DDD Aggregate）
export interface Container {
  readonly id: string
  readonly type: ContainerType
  readonly name?: string
  readonly slots: ReadonlyArray<ContainerSlot>
  readonly totalSlots: number
  readonly permissions: ContainerPermissions
  readonly metadata?: JsonRecord
  readonly position?: { x: number; y: number; z: number }
  readonly owner?: string
  readonly isOpen: boolean
  readonly isLocked: boolean
  readonly lockKey?: string
}

// コンテナ設定（DDD Value Object）
export interface ContainerConfig {
  readonly id: string
  readonly type: ContainerType
  readonly name?: string
  readonly totalSlots?: number
  readonly permissions?: Partial<ContainerPermissions>
  readonly initialItems?: ReadonlyArray<{ slotIndex: number; item: ItemStack }>
  readonly metadata?: JsonRecord
  readonly position?: { x: number; y: number; z: number }
  readonly owner?: string
  readonly isLocked?: boolean
  readonly lockKey?: string
}

// デフォルトコンテナ権限（関数型定数）
export const defaultContainerPermissions: ContainerPermissions = {
  canInsert: true,
  canExtract: true,
  canView: true,
  canBreak: true,
  restrictedToOwner: false,
} as const

// Container Factory インターフェース（DDD Factory Pattern）
export interface ContainerFactory {
  // 基本生成（Pure Function Pattern）
  readonly createEmpty: (id: string, type: ContainerType) => Effect.Effect<Container, ContainerCreationError>

  // タイプ別生成（Category-based Factory Pattern）
  readonly createChest: (id: string, size?: 'small' | 'large') => Effect.Effect<Container, ContainerCreationError>

  readonly createFurnace: (
    id: string,
    variant?: 'furnace' | 'blast_furnace' | 'smoker'
  ) => Effect.Effect<Container, ContainerCreationError>

  readonly createHopper: (id: string) => Effect.Effect<Container, ContainerCreationError>

  readonly createBrewingStand: (id: string) => Effect.Effect<Container, ContainerCreationError>

  readonly createCraftingTable: (id: string) => Effect.Effect<Container, ContainerCreationError>

  readonly createShulkerBox: (id: string, color?: string) => Effect.Effect<Container, ContainerCreationError>

  // 設定ベース生成（Configuration-based Factory Pattern）
  readonly createWithConfig: (config: ContainerConfig) => Effect.Effect<Container, ContainerCreationError>

  // アイテム付き生成（Pre-populated Factory Pattern）
  readonly createWithItems: (
    id: string,
    type: ContainerType,
    items: ReadonlyArray<{ slotIndex: number; item: ItemStack }>
  ) => Effect.Effect<Container, ContainerCreationError>

  // コンテナ操作（Container Operations Pattern）
  readonly insertItem: (
    container: Container,
    item: ItemStack,
    slotIndex?: number
  ) => Effect.Effect<Container, ContainerOperationError>

  readonly extractItem: (
    container: Container,
    slotIndex: number,
    amount?: number
  ) => Effect.Effect<readonly [Container, ItemStack | null], ContainerOperationError>

  readonly moveItem: (
    container: Container,
    fromSlot: number,
    toSlot: number
  ) => Effect.Effect<Container, ContainerOperationError>

  readonly clearContainer: (container: Container) => Effect.Effect<Container, ContainerOperationError>

  // 検証・最適化（Validation Pattern）
  readonly validateContainer: (container: Container) => Effect.Effect<void, ContainerValidationError>
  readonly optimizeContainer: (container: Container) => Effect.Effect<Container, ContainerCreationError>

  // コンテナ情報（Information Pattern）
  readonly getEmptySlots: (container: Container) => ReadonlyArray<number>
  readonly getOccupiedSlots: (container: Container) => ReadonlyArray<number>
  readonly getSlotByType: (container: Container, type: ContainerSlot['type']) => ReadonlyArray<ContainerSlot>
  readonly canInsertItem: (container: Container, item: ItemStack, slotIndex?: number) => boolean
}

// Context.GenericTag による依存性注入パターン
export const ContainerFactory = Context.GenericTag<ContainerFactory>('@minecraft/domain/inventory/ContainerFactory')

// Container Builder 設定型（Builder Pattern Support）
export interface ContainerBuilderConfig {
  readonly id?: string
  readonly type?: ContainerType
  readonly name?: string
  readonly totalSlots?: number
  readonly permissions?: Partial<ContainerPermissions>
  readonly initialItems?: ReadonlyArray<{ slotIndex: number; item: ItemStack }>
  readonly metadata?: JsonRecord
  readonly position?: { x: number; y: number; z: number }
  readonly owner?: string
  readonly isLocked?: boolean
  readonly lockKey?: string
}

// Container Builder インターフェース（Fluent API Pattern）
export interface ContainerBuilder {
  readonly withId: (id: string) => ContainerBuilder
  readonly withType: (type: ContainerType) => ContainerBuilder
  readonly withName: (name: string) => ContainerBuilder
  readonly withSlotCount: (count: number) => ContainerBuilder
  readonly withPermissions: (permissions: Partial<ContainerPermissions>) => ContainerBuilder
  readonly withPosition: (x: number, y: number, z: number) => ContainerBuilder
  readonly withOwner: (owner: string) => ContainerBuilder
  readonly withLock: (isLocked: boolean, lockKey?: string) => ContainerBuilder
  readonly withMetadata: (metadata: JsonRecord) => ContainerBuilder
  readonly addItem: (slotIndex: number, item: ItemStack) => ContainerBuilder
  readonly addItems: (items: ReadonlyArray<{ slotIndex: number; item: ItemStack }>) => ContainerBuilder
  readonly build: () => Effect.Effect<Container, ContainerCreationError>
  readonly validate: () => Effect.Effect<void, ContainerValidationError>
  readonly reset: () => ContainerBuilder
}

// Builder Factory インターフェース（Factory of Factories Pattern）
export interface ContainerBuilderFactory {
  readonly create: () => ContainerBuilder
  readonly fromContainer: (container: Container) => ContainerBuilder
  readonly fromConfig: (config: ContainerBuilderConfig) => ContainerBuilder
  readonly createWithDefaults: (type: ContainerType) => Effect.Effect<ContainerBuilder, ContainerCreationError>
}

export const ContainerBuilderFactory = Context.GenericTag<ContainerBuilderFactory>(
  '@minecraft/domain/inventory/ContainerBuilderFactory'
)

// コンテナタイプ別仕様（DDD Specification Pattern）
export interface ContainerTypeSpec {
  readonly type: ContainerType
  readonly defaultSlotCount: number
  readonly allowedSlotTypes: ReadonlyArray<ContainerSlot['type']>
  readonly specialSlots?: ReadonlyArray<{
    index: number
    type: ContainerSlot['type']
    acceptsItemType?: (itemId: ItemId) => boolean
  }>
  readonly hasCustomLogic: boolean
  readonly processingTime?: number // for furnaces, brewing stands
}

// コンテナタイプ仕様のマップ
export const containerTypeSpecs: Record<ContainerType, ContainerTypeSpec> = {
  chest: {
    type: 'chest',
    defaultSlotCount: 27,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: false,
  },
  large_chest: {
    type: 'large_chest',
    defaultSlotCount: 54,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: false,
  },
  ender_chest: {
    type: 'ender_chest',
    defaultSlotCount: 27,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: true,
  },
  shulker_box: {
    type: 'shulker_box',
    defaultSlotCount: 27,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: true,
  },
  furnace: {
    type: 'furnace',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'fuel', 'output'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'fuel' },
      { index: 2, type: 'output' },
    ],
    hasCustomLogic: true,
    processingTime: 200, // 10 seconds in ticks
  },
  blast_furnace: {
    type: 'blast_furnace',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'fuel', 'output'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'fuel' },
      { index: 2, type: 'output' },
    ],
    hasCustomLogic: true,
    processingTime: 100, // 5 seconds in ticks
  },
  smoker: {
    type: 'smoker',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'fuel', 'output'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'fuel' },
      { index: 2, type: 'output' },
    ],
    hasCustomLogic: true,
    processingTime: 100, // 5 seconds in ticks
  },
  brewing_stand: {
    type: 'brewing_stand',
    defaultSlotCount: 4,
    allowedSlotTypes: ['ingredient', 'input', 'fuel'],
    specialSlots: [
      { index: 0, type: 'ingredient' },
      { index: 1, type: 'input' },
      { index: 2, type: 'input' },
      { index: 3, type: 'fuel' },
    ],
    hasCustomLogic: true,
    processingTime: 400, // 20 seconds in ticks
  },
  hopper: {
    type: 'hopper',
    defaultSlotCount: 5,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: true,
  },
  dropper: {
    type: 'dropper',
    defaultSlotCount: 9,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: true,
  },
  dispenser: {
    type: 'dispenser',
    defaultSlotCount: 9,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: true,
  },
  barrel: {
    type: 'barrel',
    defaultSlotCount: 27,
    allowedSlotTypes: ['storage'],
    hasCustomLogic: false,
  },
  crafting_table: {
    type: 'crafting_table',
    defaultSlotCount: 10,
    allowedSlotTypes: ['input', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'input' },
      { index: 2, type: 'input' },
      { index: 3, type: 'input' },
      { index: 4, type: 'input' },
      { index: 5, type: 'input' },
      { index: 6, type: 'input' },
      { index: 7, type: 'input' },
      { index: 8, type: 'input' },
      { index: 9, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  enchanting_table: {
    type: 'enchanting_table',
    defaultSlotCount: 2,
    allowedSlotTypes: ['input', 'ingredient'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'ingredient' },
    ],
    hasCustomLogic: true,
  },
  anvil: {
    type: 'anvil',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'ingredient', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'ingredient' },
      { index: 2, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  grindstone: {
    type: 'grindstone',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'input' },
      { index: 2, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  stonecutter: {
    type: 'stonecutter',
    defaultSlotCount: 2,
    allowedSlotTypes: ['input', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  smithing_table: {
    type: 'smithing_table',
    defaultSlotCount: 4,
    allowedSlotTypes: ['input', 'ingredient', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'ingredient' },
      { index: 2, type: 'ingredient' },
      { index: 3, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  cartography_table: {
    type: 'cartography_table',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'ingredient', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'ingredient' },
      { index: 2, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  fletching_table: {
    type: 'fletching_table',
    defaultSlotCount: 3,
    allowedSlotTypes: ['input', 'ingredient', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'ingredient' },
      { index: 2, type: 'result' },
    ],
    hasCustomLogic: true,
  },
  loom: {
    type: 'loom',
    defaultSlotCount: 4,
    allowedSlotTypes: ['input', 'ingredient', 'result'],
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'ingredient' },
      { index: 2, type: 'ingredient' },
      { index: 3, type: 'result' },
    ],
    hasCustomLogic: true,
  },
}
