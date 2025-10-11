/**
 * @fileoverview Container集約の型定義（チェスト、かまど等の基底）
 * DDD原則に基づく集約境界とビジネスルール
 */

import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { unsafeCoerce } from 'effect/Function'
import type { ItemId, PlayerId } from '../../types'

// ===== Brand Types =====

export const ContainerIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^container_[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/),
  Schema.brand('ContainerId')
)
export type ContainerId = Schema.Schema.Type<typeof ContainerIdSchema>

export const ContainerSlotIndexSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('ContainerSlotIndex')
)
export type ContainerSlotIndex = Schema.Schema.Type<typeof ContainerSlotIndexSchema>

// ===== makeUnsafe Functions =====

export const makeUnsafeContainerId = (value: string): ContainerId => unsafeCoerce<string, ContainerId>(value)

export const makeUnsafeContainerSlotIndex = (value: number): ContainerSlotIndex =>
  unsafeCoerce<number, ContainerSlotIndex>(value)

// ===== Enums and Literals =====

export const ContainerTypeSchema = Schema.Literal(
  'chest',
  'double_chest',
  'furnace',
  'blast_furnace',
  'smoker',
  'brewing_stand',
  'enchanting_table',
  'anvil',
  'crafting_table',
  'shulker_box',
  'ender_chest',
  'hopper',
  'dispenser',
  'dropper'
)
export type ContainerType = Schema.Schema.Type<typeof ContainerTypeSchema>

export const ContainerAccessLevelSchema = Schema.Literal('public', 'private', 'restricted', 'admin_only')
export type ContainerAccessLevel = Schema.Schema.Type<typeof ContainerAccessLevelSchema>

// ===== Value Objects =====

export const WorldPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  dimension: Schema.String.pipe(Schema.nonEmptyString()),
})
export type WorldPosition = Schema.Schema.Type<typeof WorldPositionSchema>

export const ContainerSlotSchema = Schema.Union(
  Schema.Null,
  Schema.Struct({
    itemStack: Schema.suspend(() => import('../item_stack/index').then((m) => m.ItemStackEntitySchema)),
    locked: Schema.optional(Schema.Boolean),
    metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
  })
)
export type ContainerSlot = Schema.Schema.Type<typeof ContainerSlotSchema>

export const ContainerConfigurationSchema = Schema.Struct({
  maxSlots: Schema.Number.pipe(Schema.int(), Schema.positive()),
  allowedItemTypes: Schema.optional(
    Schema.Array(Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)))
  ),
  restrictedItemTypes: Schema.optional(
    Schema.Array(Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)))
  ),
  slotFilters: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Array(Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema))),
    })
  ),
  autoSort: Schema.optional(Schema.Boolean),
  hopperInteraction: Schema.optional(Schema.Boolean),
  redstoneControlled: Schema.optional(Schema.Boolean),
})
export type ContainerConfiguration = Schema.Schema.Type<typeof ContainerConfigurationSchema>

export const ContainerPermissionSchema = Schema.Struct({
  playerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  canView: Schema.Boolean,
  canInsert: Schema.Boolean,
  canExtract: Schema.Boolean,
  canModify: Schema.Boolean,
  expiresAt: Schema.optional(Schema.DateTimeUtc),
})
export type ContainerPermission = Schema.Schema.Type<typeof ContainerPermissionSchema>

// ===== Aggregate Root =====

export const ContainerAggregateSchema = Schema.Struct({
  // 集約ルート識別子
  id: ContainerIdSchema,
  type: ContainerTypeSchema,
  ownerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),

  // 位置情報
  position: WorldPositionSchema,

  // コンテナ設定
  configuration: ContainerConfigurationSchema,
  accessLevel: ContainerAccessLevelSchema,

  // スロット管理
  slots: Schema.Array(ContainerSlotSchema),

  // アクセス許可
  permissions: Schema.Array(ContainerPermissionSchema),

  // 状態管理
  isOpen: Schema.Boolean,
  currentViewers: Schema.Array(Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema))),

  // 集約メタデータ
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Schema.DateTimeUtc,
  lastModified: Schema.DateTimeUtc,
  lastAccessed: Schema.optional(Schema.DateTimeUtc),

  // ドメインイベント（未コミット）
  uncommittedEvents: Schema.Array(Schema.suspend(() => ContainerDomainEventSchema)),
})

export type ContainerAggregate = Schema.Schema.Type<typeof ContainerAggregateSchema>

// ===== Domain Events =====

export const ContainerOpenedEventSchema = Schema.Struct({
  type: Schema.Literal('ContainerOpened'),
  aggregateId: ContainerIdSchema,
  playerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  containerType: ContainerTypeSchema,
  position: WorldPositionSchema,
  timestamp: Schema.DateTimeUtc,
})

export const ContainerClosedEventSchema = Schema.Struct({
  type: Schema.Literal('ContainerClosed'),
  aggregateId: ContainerIdSchema,
  playerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  containerType: ContainerTypeSchema,
  sessionDuration: Schema.Number.pipe(Schema.positive()),
  timestamp: Schema.DateTimeUtc,
})

export const ItemPlacedInContainerEventSchema = Schema.Struct({
  type: Schema.Literal('ItemPlacedInContainer'),
  aggregateId: ContainerIdSchema,
  playerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  slotIndex: ContainerSlotIndexSchema,
  itemId: Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)),
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  itemStackId: Schema.suspend(() => import('../item_stack/index').then((m) => m.ItemStackIdSchema)),
  timestamp: Schema.DateTimeUtc,
})

export const ItemRemovedFromContainerEventSchema = Schema.Struct({
  type: Schema.Literal('ItemRemovedFromContainer'),
  aggregateId: ContainerIdSchema,
  playerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  slotIndex: ContainerSlotIndexSchema,
  itemId: Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema)),
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  itemStackId: Schema.suspend(() => import('../item_stack/index').then((m) => m.ItemStackIdSchema)),
  timestamp: Schema.DateTimeUtc,
  reason: Schema.Literal('extracted', 'consumed', 'hopper', 'automation'),
})

export const ContainerSortedEventSchema = Schema.Struct({
  type: Schema.Literal('ContainerSorted'),
  aggregateId: ContainerIdSchema,
  playerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  sortType: Schema.Literal('alphabetical', 'quantity', 'type', 'custom'),
  affectedSlots: Schema.Array(ContainerSlotIndexSchema),
  timestamp: Schema.DateTimeUtc,
})

export const ContainerPermissionGrantedEventSchema = Schema.Struct({
  type: Schema.Literal('ContainerPermissionGranted'),
  aggregateId: ContainerIdSchema,
  ownerId: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  grantedTo: Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema)),
  permission: ContainerPermissionSchema,
  timestamp: Schema.DateTimeUtc,
})

export const ContainerDomainEventSchema = Schema.Union(
  ContainerOpenedEventSchema,
  ContainerClosedEventSchema,
  ItemPlacedInContainerEventSchema,
  ItemRemovedFromContainerEventSchema,
  ContainerSortedEventSchema,
  ContainerPermissionGrantedEventSchema
)

export type ContainerOpenedEvent = Schema.Schema.Type<typeof ContainerOpenedEventSchema>
export type ContainerClosedEvent = Schema.Schema.Type<typeof ContainerClosedEventSchema>
export type ItemPlacedInContainerEvent = Schema.Schema.Type<typeof ItemPlacedInContainerEventSchema>
export type ItemRemovedFromContainerEvent = Schema.Schema.Type<typeof ItemRemovedFromContainerEventSchema>
export type ContainerSortedEvent = Schema.Schema.Type<typeof ContainerSortedEventSchema>
export type ContainerPermissionGrantedEvent = Schema.Schema.Type<typeof ContainerPermissionGrantedEventSchema>
export type ContainerDomainEvent = Schema.Schema.Type<typeof ContainerDomainEventSchema>

// ===== Constants =====

export const CONTAINER_CONSTANTS = {
  CHEST_SLOTS: 27,
  DOUBLE_CHEST_SLOTS: 54,
  FURNACE_SLOTS: 3,
  BREWING_STAND_SLOTS: 4,
  HOPPER_SLOTS: 5,
  SHULKER_BOX_SLOTS: 27,
  DISPENSER_SLOTS: 9,
  DROPPER_SLOTS: 9,
  MAX_VIEWERS: 10,
  DEFAULT_VERSION: 1,
  SESSION_TIMEOUT_MS: 300000, // 5分
  PERMISSION_CACHE_DURATION_MS: 60000, // 1分
} as const

export const CONTAINER_SLOT_CONFIGURATIONS = {
  chest: { maxSlots: CONTAINER_CONSTANTS.CHEST_SLOTS, specialSlots: [] },
  double_chest: { maxSlots: CONTAINER_CONSTANTS.DOUBLE_CHEST_SLOTS, specialSlots: [] },
  furnace: {
    maxSlots: CONTAINER_CONSTANTS.FURNACE_SLOTS,
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'fuel' },
      { index: 2, type: 'output' },
    ],
  },
  blast_furnace: {
    maxSlots: CONTAINER_CONSTANTS.FURNACE_SLOTS,
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'fuel' },
      { index: 2, type: 'output' },
    ],
  },
  smoker: {
    maxSlots: CONTAINER_CONSTANTS.FURNACE_SLOTS,
    specialSlots: [
      { index: 0, type: 'input' },
      { index: 1, type: 'fuel' },
      { index: 2, type: 'output' },
    ],
  },
  brewing_stand: {
    maxSlots: CONTAINER_CONSTANTS.BREWING_STAND_SLOTS,
    specialSlots: [
      { index: 0, type: 'ingredient' },
      { index: 1, type: 'potion' },
      { index: 2, type: 'potion' },
      { index: 3, type: 'potion' },
    ],
  },
  hopper: { maxSlots: CONTAINER_CONSTANTS.HOPPER_SLOTS, specialSlots: [] },
  shulker_box: { maxSlots: CONTAINER_CONSTANTS.SHULKER_BOX_SLOTS, specialSlots: [] },
  dispenser: { maxSlots: CONTAINER_CONSTANTS.DISPENSER_SLOTS, specialSlots: [] },
  dropper: { maxSlots: CONTAINER_CONSTANTS.DROPPER_SLOTS, specialSlots: [] },
} as const

// ===== Error Types =====

export const ContainerErrorSchema = Schema.TaggedError('ContainerError', {
  reason: Schema.Literal(
    'CONTAINER_NOT_FOUND',
    'ACCESS_DENIED',
    'SLOT_OCCUPIED',
    'SLOT_EMPTY',
    'INVALID_SLOT_INDEX',
    'CONTAINER_FULL',
    'INVALID_ITEM_TYPE',
    'PERMISSION_EXPIRED',
    'TOO_MANY_VIEWERS',
    'CONTAINER_LOCKED',
    'INVALID_CONFIGURATION'
  ),
  message: Schema.String,
  containerId: Schema.optional(ContainerIdSchema),
  playerId: Schema.optional(Schema.suspend(() => import('../../types/index').then((m) => m.PlayerIdSchema))),
  slotIndex: Schema.optional(ContainerSlotIndexSchema),
  itemId: Schema.optional(Schema.suspend(() => import('../../types/index').then((m) => m.ItemIdSchema))),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
})

export type ContainerError = Schema.Schema.Type<typeof ContainerErrorSchema>

export const ContainerError = {
  ...makeErrorFactory(ContainerErrorSchema),

  accessDenied: (containerId: ContainerId, playerId: PlayerId): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'ACCESS_DENIED',
      message: `プレイヤー${playerId}はコンテナ${containerId}にアクセスできません`,
      containerId,
      playerId,
    }),

  slotOccupied: (containerId: ContainerId, slotIndex: ContainerSlotIndex): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'SLOT_OCCUPIED',
      message: `スロット${slotIndex}は既に占有されています`,
      containerId,
      slotIndex,
    }),

  slotEmpty: (containerId: ContainerId, slotIndex: ContainerSlotIndex): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'SLOT_EMPTY',
      message: `スロット${slotIndex}は空です`,
      containerId,
      slotIndex,
    }),

  containerFull: (containerId: ContainerId): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'CONTAINER_FULL',
      message: `コンテナ${containerId}は満杯です`,
      containerId,
    }),

  invalidSlotIndex: (containerId: ContainerId, slotIndex: number): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'INVALID_SLOT_INDEX',
      message: `不正なスロットインデックス: ${slotIndex}`,
      containerId,
      slotIndex: makeUnsafeContainerSlotIndex(slotIndex),
    }),

  tooManyViewers: (containerId: ContainerId): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'TOO_MANY_VIEWERS',
      message: `コンテナ${containerId}の視聴者数が上限に達しています`,
      containerId,
    }),

  invalidItemType: (containerId: ContainerId, itemId: ItemId): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'INVALID_ITEM_TYPE',
      message: `アイテム${itemId}はこのコンテナに配置できません`,
      containerId,
      itemId,
    }),

  permissionExpired: (containerId: ContainerId, playerId: PlayerId): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'PERMISSION_EXPIRED',
      message: `プレイヤー${playerId}のコンテナ${containerId}へのアクセス権限が期限切れです`,
      containerId,
      playerId,
    }),

  containerLocked: (containerId: ContainerId): ContainerError =>
    ContainerErrorSchema.make({
      reason: 'CONTAINER_LOCKED',
      message: `コンテナ${containerId}はロックされています`,
      containerId,
    }),
} as const
