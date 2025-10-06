import { Clock, Effect, Schema } from 'effect'

// =============================================================================
// Base Domain Event
// =============================================================================

/**
 * ドメインイベント基底型
 * 全てのインベントリドメインイベントの共通構造
 */
export const BaseDomainEventSchema = Schema.Struct({
  eventId: Schema.String.pipe(
    Schema.pattern(/^evt_[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/),
    Schema.annotations({
      description: 'Unique event identifier (UUID format)',
      examples: ['evt_550e8400-e29b-41d4-a716-446655440000'],
    })
  ),
  aggregateId: Schema.String.pipe(
    Schema.annotations({
      description: 'Identifier of the aggregate that generated this event',
    })
  ),
  aggregateVersion: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Version of the aggregate after this event',
    })
  ),
  timestamp: Schema.Number.pipe(
    Schema.annotations({
      description: 'Event occurrence timestamp (Unix milliseconds)',
    })
  ),
  correlationId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Correlation ID for tracking related events',
      })
    )
  ),
  causationId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'ID of the command or event that caused this event',
      })
    )
  ),
})

export type BaseDomainEvent = Schema.Schema.Type<typeof BaseDomainEventSchema>

// =============================================================================
// Inventory Aggregate Events
// =============================================================================

/**
 * インベントリ作成イベント
 * 新しいインベントリが作成された時に発生
 */
export const InventoryCreatedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('InventoryCreated'),
  inventoryId: Schema.String,
  playerId: Schema.String,
  inventoryType: Schema.String,
  totalSlots: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Total number of slots in the inventory',
    })
  ),
  createdBy: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Entity or system that created the inventory',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'InventoryCreatedEvent',
    description: 'Event emitted when a new inventory is created',
  })
)

export type InventoryCreatedEvent = Schema.Schema.Type<typeof InventoryCreatedEventSchema>

/**
 * インベントリ削除イベント
 * インベントリが削除された時に発生
 */
export const InventoryDeletedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('InventoryDeleted'),
  inventoryId: Schema.String,
  playerId: Schema.String,
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for inventory deletion',
    })
  ),
  itemsDropped: Schema.Array(
    Schema.Struct({
      itemId: Schema.String,
      quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
      location: Schema.optional(Schema.String),
    })
  ).pipe(
    Schema.annotations({
      description: 'Items that were dropped when inventory was deleted',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'InventoryDeletedEvent',
    description: 'Event emitted when an inventory is deleted',
  })
)

export type InventoryDeletedEvent = Schema.Schema.Type<typeof InventoryDeletedEventSchema>

/**
 * インベントリサイズ変更イベント
 * インベントリのサイズが変更された時に発生
 */
export const InventoryResizedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('InventoryResized'),
  inventoryId: Schema.String,
  oldSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  newSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  affectedSlots: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(
    Schema.annotations({
      description: 'Slot numbers that were affected by the resize',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'InventoryResizedEvent',
    description: 'Event emitted when inventory size changes',
  })
)

export type InventoryResizedEvent = Schema.Schema.Type<typeof InventoryResizedEventSchema>

// =============================================================================
// Item Stack Events
// =============================================================================

/**
 * アイテム追加イベント
 * インベントリにアイテムが追加された時に発生
 */
export const ItemAddedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemAdded'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  previousQuantity: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Previous quantity in the slot (0 if slot was empty)',
    })
  ),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    }).pipe(
      Schema.annotations({
        description: 'Item metadata such as enchantments, durability, etc.',
      })
    )
  ),
  source: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Source of the item addition (crafting, pickup, transfer, etc.)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemAddedEvent',
    description: 'Event emitted when items are added to an inventory slot',
  })
)

export type ItemAddedEvent = Schema.Schema.Type<typeof ItemAddedEventSchema>

/**
 * アイテム削除イベント
 * インベントリからアイテムが削除された時に発生
 */
export const ItemRemovedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemRemoved'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  remainingQuantity: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Remaining quantity in the slot after removal',
    })
  ),
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for item removal (consumption, drop, transfer, etc.)',
    })
  ),
  destination: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Destination of the removed items',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemRemovedEvent',
    description: 'Event emitted when items are removed from an inventory slot',
  })
)

export type ItemRemovedEvent = Schema.Schema.Type<typeof ItemRemovedEventSchema>

/**
 * アイテム移動イベント
 * インベントリ内でアイテムが移動された時に発生
 */
export const ItemMovedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemMoved'),
  inventoryId: Schema.String,
  fromSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  toSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  swapped: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether items in destination slot were swapped back',
    })
  ),
  swappedItem: Schema.optional(
    Schema.Struct({
      itemId: Schema.String,
      quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    }).pipe(
      Schema.annotations({
        description: 'Item that was swapped back to source slot',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemMovedEvent',
    description: 'Event emitted when items are moved within an inventory',
  })
)

export type ItemMovedEvent = Schema.Schema.Type<typeof ItemMovedEventSchema>

/**
 * アイテムスタック分割イベント
 * アイテムスタックが分割された時に発生
 */
export const ItemStackSplitEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemStackSplit'),
  inventoryId: Schema.String,
  sourceSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  targetSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  originalQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  splitQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  remainingQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
}).pipe(
  Schema.annotations({
    title: 'ItemStackSplitEvent',
    description: 'Event emitted when an item stack is split between slots',
  })
)

export type ItemStackSplitEvent = Schema.Schema.Type<typeof ItemStackSplitEventSchema>

/**
 * アイテムスタック結合イベント
 * 複数のアイテムスタックが結合された時に発生
 */
export const ItemStackMergedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemStackMerged'),
  inventoryId: Schema.String,
  sourceSlots: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(
    Schema.minItems(2),
    Schema.annotations({
      description: 'Source slot numbers that were merged',
    })
  ),
  targetSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  totalQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  sourceQuantities: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.positive())).pipe(
    Schema.annotations({
      description: 'Original quantities from each source slot',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemStackMergedEvent',
    description: 'Event emitted when multiple item stacks are merged',
  })
)

export type ItemStackMergedEvent = Schema.Schema.Type<typeof ItemStackMergedEventSchema>

// =============================================================================
// Item Transfer Events
// =============================================================================

/**
 * アイテム転送開始イベント
 * インベントリ間でのアイテム転送が開始された時に発生
 */
export const ItemTransferStartedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemTransferStarted'),
  transferId: Schema.String.pipe(
    Schema.annotations({
      description: 'Unique identifier for this transfer operation',
    })
  ),
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  itemId: Schema.String,
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  sourceSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  targetSlot: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  initiatedBy: Schema.String.pipe(
    Schema.annotations({
      description: 'Player or system that initiated the transfer',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemTransferStartedEvent',
    description: 'Event emitted when an item transfer between inventories begins',
  })
)

export type ItemTransferStartedEvent = Schema.Schema.Type<typeof ItemTransferStartedEventSchema>

/**
 * アイテム転送完了イベント
 * インベントリ間でのアイテム転送が完了した時に発生
 */
export const ItemTransferCompletedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemTransferCompleted'),
  transferId: Schema.String,
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  itemId: Schema.String,
  transferredQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  sourceSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  targetSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  duration: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({
      description: 'Transfer duration in milliseconds',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemTransferCompletedEvent',
    description: 'Event emitted when an item transfer between inventories completes',
  })
)

export type ItemTransferCompletedEvent = Schema.Schema.Type<typeof ItemTransferCompletedEventSchema>

/**
 * アイテム転送失敗イベント
 * インベントリ間でのアイテム転送が失敗した時に発生
 */
export const ItemTransferFailedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemTransferFailed'),
  transferId: Schema.String,
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  itemId: Schema.String,
  requestedQuantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for transfer failure',
    })
  ),
  errorCode: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Machine-readable error code',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemTransferFailedEvent',
    description: 'Event emitted when an item transfer between inventories fails',
  })
)

export type ItemTransferFailedEvent = Schema.Schema.Type<typeof ItemTransferFailedEventSchema>

// =============================================================================
// Item State Change Events
// =============================================================================

/**
 * アイテム耐久度変更イベント
 * アイテムの耐久度が変更された時に発生
 */
export const ItemDurabilityChangedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemDurabilityChanged'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  previousDurability: Schema.Number.pipe(Schema.between(0, 1)),
  newDurability: Schema.Number.pipe(Schema.between(0, 1)),
  damage: Schema.Number.pipe(
    Schema.annotations({
      description: 'Amount of damage dealt (positive) or repaired (negative)',
    })
  ),
  cause: Schema.String.pipe(
    Schema.annotations({
      description: 'Cause of durability change (usage, repair, etc.)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemDurabilityChangedEvent',
    description: 'Event emitted when item durability changes',
  })
)

export type ItemDurabilityChangedEvent = Schema.Schema.Type<typeof ItemDurabilityChangedEventSchema>

/**
 * アイテム破損イベント
 * アイテムが完全に破損した時に発生
 */
export const ItemBrokenEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemBroken'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  finalDurability: Schema.Number.pipe(Schema.between(0, 1)),
  cause: Schema.String,
  replacement: Schema.optional(
    Schema.Struct({
      itemId: Schema.String,
      quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    }).pipe(
      Schema.annotations({
        description: 'Item that replaced the broken item, if any',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemBrokenEvent',
    description: 'Event emitted when an item breaks completely',
  })
)

export type ItemBrokenEvent = Schema.Schema.Type<typeof ItemBrokenEventSchema>

/**
 * アイテムエンチャント追加イベント
 * アイテムにエンチャントが追加された時に発生
 */
export const ItemEnchantedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('ItemEnchanted'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  itemId: Schema.String,
  enchantmentId: Schema.String,
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  previousLevel: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 5))),
  cost: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Experience or material cost for enchantment',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'ItemEnchantedEvent',
    description: 'Event emitted when an item receives an enchantment',
  })
)

export type ItemEnchantedEvent = Schema.Schema.Type<typeof ItemEnchantedEventSchema>

// =============================================================================
// Inventory State Events
// =============================================================================

/**
 * インベントリロックイベント
 * インベントリがロックされた時に発生
 */
export const InventoryLockedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('InventoryLocked'),
  inventoryId: Schema.String,
  lockedBy: Schema.String,
  reason: Schema.String,
  lockType: Schema.Literal('READ_ONLY', 'FULL_LOCK', 'ADMIN_LOCK').pipe(
    Schema.annotations({
      description: 'Type of lock applied to the inventory',
    })
  ),
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({
        description: 'Lock duration in milliseconds (undefined for permanent)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'InventoryLockedEvent',
    description: 'Event emitted when an inventory is locked',
  })
)

export type InventoryLockedEvent = Schema.Schema.Type<typeof InventoryLockedEventSchema>

/**
 * インベントリアンロックイベント
 * インベントリのロックが解除された時に発生
 */
export const InventoryUnlockedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('InventoryUnlocked'),
  inventoryId: Schema.String,
  unlockedBy: Schema.String,
  previousLockType: Schema.Literal('READ_ONLY', 'FULL_LOCK', 'ADMIN_LOCK'),
  lockDuration: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({
      description: 'Total duration the inventory was locked (milliseconds)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'InventoryUnlockedEvent',
    description: 'Event emitted when an inventory lock is released',
  })
)

export type InventoryUnlockedEvent = Schema.Schema.Type<typeof InventoryUnlockedEventSchema>

// =============================================================================
// Integration Events (Cross-Domain)
// =============================================================================

/**
 * プレイヤーインベントリ同期イベント
 * プレイヤーのインベントリが他のシステムと同期された時に発生
 */
export const PlayerInventorySyncedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('PlayerInventorySynced'),
  playerId: Schema.String,
  inventoryId: Schema.String,
  syncTarget: Schema.String.pipe(
    Schema.annotations({
      description: 'Target system that was synchronized with (database, cache, etc.)',
    })
  ),
  changedSlots: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(
    Schema.annotations({
      description: 'Slot numbers that were synchronized',
    })
  ),
  syncType: Schema.Literal('FULL', 'INCREMENTAL', 'FORCED').pipe(
    Schema.annotations({
      description: 'Type of synchronization performed',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'PlayerInventorySyncedEvent',
    description: 'Event emitted when player inventory is synchronized with external systems',
  })
)

export type PlayerInventorySyncedEvent = Schema.Schema.Type<typeof PlayerInventorySyncedEventSchema>

/**
 * インベントリバックアップイベント
 * インベントリのバックアップが作成された時に発生
 */
export const InventoryBackupCreatedEventSchema = Schema.Struct({
  ...BaseDomainEventSchema.fields,
  _tag: Schema.Literal('InventoryBackupCreated'),
  inventoryId: Schema.String,
  backupId: Schema.String,
  backupLocation: Schema.String,
  backupType: Schema.Literal('MANUAL', 'SCHEDULED', 'PRE_OPERATION', 'RECOVERY').pipe(
    Schema.annotations({
      description: 'Type of backup operation',
    })
  ),
  dataSize: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({
      description: 'Size of backup data in bytes',
    })
  ),
  checksum: Schema.String.pipe(
    Schema.annotations({
      description: 'Checksum for backup integrity verification',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'InventoryBackupCreatedEvent',
    description: 'Event emitted when an inventory backup is created',
  })
)

export type InventoryBackupCreatedEvent = Schema.Schema.Type<typeof InventoryBackupCreatedEventSchema>

// =============================================================================
// Union Type for All Domain Events
// =============================================================================

/**
 * 全てのインベントリドメインイベントのUnion型
 */
export type InventoryDomainEvent =
  | InventoryCreatedEvent
  | InventoryDeletedEvent
  | InventoryResizedEvent
  | ItemAddedEvent
  | ItemRemovedEvent
  | ItemMovedEvent
  | ItemStackSplitEvent
  | ItemStackMergedEvent
  | ItemTransferStartedEvent
  | ItemTransferCompletedEvent
  | ItemTransferFailedEvent
  | ItemDurabilityChangedEvent
  | ItemBrokenEvent
  | ItemEnchantedEvent
  | InventoryLockedEvent
  | InventoryUnlockedEvent
  | PlayerInventorySyncedEvent
  | InventoryBackupCreatedEvent

// =============================================================================
// Event Factory Functions
// =============================================================================

/**
 * 共通イベントプロパティを生成
 */
const createBaseEvent = (
  aggregateId: string,
  aggregateVersion: number
): Effect.Effect<Omit<BaseDomainEvent, 'eventId'>> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return {
      aggregateId,
      aggregateVersion,
      timestamp,
    }
  })

/**
 * ユニークなイベントIDを生成
 */
const generateEventId = (): string => {
  // UUIDv4の簡易実装（本来はuuidライブラリを使用）
  return `evt_${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 6)}-4${Math.random().toString(16).substring(2, 5)}-${Math.random().toString(16).substring(2, 5)}-${Math.random().toString(16).substring(2, 14)}`
}

/**
 * インベントリ作成イベントを生成
 */
export const createInventoryCreatedEvent = (params: {
  inventoryId: string
  playerId: string
  inventoryType: string
  totalSlots: number
  createdBy?: string
  aggregateVersion: number
}): InventoryCreatedEvent => ({
  ...createBaseEvent(params.inventoryId, params.aggregateVersion),
  eventId: generateEventId(),
  _tag: 'InventoryCreated',
  inventoryId: params.inventoryId,
  playerId: params.playerId,
  inventoryType: params.inventoryType,
  totalSlots: params.totalSlots,
  createdBy: params.createdBy,
})

/**
 * アイテム追加イベントを生成
 */
export const createItemAddedEvent = (params: {
  inventoryId: string
  slotNumber: number
  itemId: string
  quantity: number
  previousQuantity: number
  metadata?: Record<string, unknown>
  source?: string
  aggregateVersion: number
}): ItemAddedEvent => ({
  ...createBaseEvent(params.inventoryId, params.aggregateVersion),
  eventId: generateEventId(),
  _tag: 'ItemAdded',
  inventoryId: params.inventoryId,
  slotNumber: params.slotNumber,
  itemId: params.itemId,
  quantity: params.quantity,
  previousQuantity: params.previousQuantity,
  metadata: params.metadata,
  source: params.source,
})

/**
 * アイテム削除イベントを生成
 */
export const createItemRemovedEvent = (params: {
  inventoryId: string
  slotNumber: number
  itemId: string
  quantity: number
  remainingQuantity: number
  reason: string
  destination?: string
  aggregateVersion: number
}): ItemRemovedEvent => ({
  ...createBaseEvent(params.inventoryId, params.aggregateVersion),
  eventId: generateEventId(),
  _tag: 'ItemRemoved',
  inventoryId: params.inventoryId,
  slotNumber: params.slotNumber,
  itemId: params.itemId,
  quantity: params.quantity,
  remainingQuantity: params.remainingQuantity,
  reason: params.reason,
  destination: params.destination,
})

/**
 * アイテム転送開始イベントを生成
 */
export const createItemTransferStartedEvent = (params: {
  transferId: string
  sourceInventoryId: string
  targetInventoryId: string
  itemId: string
  quantity: number
  sourceSlot: number
  targetSlot?: number
  initiatedBy: string
  aggregateVersion: number
}): ItemTransferStartedEvent => ({
  ...createBaseEvent(params.sourceInventoryId, params.aggregateVersion),
  eventId: generateEventId(),
  _tag: 'ItemTransferStarted',
  transferId: params.transferId,
  sourceInventoryId: params.sourceInventoryId,
  targetInventoryId: params.targetInventoryId,
  itemId: params.itemId,
  quantity: params.quantity,
  sourceSlot: params.sourceSlot,
  targetSlot: params.targetSlot,
  initiatedBy: params.initiatedBy,
})

// =============================================================================
// Event Pattern Matching Utilities
// =============================================================================

/**
 * イベントタイプによる型ガード関数
 */
export const isInventoryCreatedEvent = (event: InventoryDomainEvent): event is InventoryCreatedEvent =>
  event._tag === 'InventoryCreated'

export const isItemAddedEvent = (event: InventoryDomainEvent): event is ItemAddedEvent => event._tag === 'ItemAdded'

export const isItemRemovedEvent = (event: InventoryDomainEvent): event is ItemRemovedEvent =>
  event._tag === 'ItemRemoved'

export const isItemMovedEvent = (event: InventoryDomainEvent): event is ItemMovedEvent => event._tag === 'ItemMoved'

export const isItemTransferStartedEvent = (event: InventoryDomainEvent): event is ItemTransferStartedEvent =>
  event._tag === 'ItemTransferStarted'

export const isItemTransferCompletedEvent = (event: InventoryDomainEvent): event is ItemTransferCompletedEvent =>
  event._tag === 'ItemTransferCompleted'

export const isItemTransferFailedEvent = (event: InventoryDomainEvent): event is ItemTransferFailedEvent =>
  event._tag === 'ItemTransferFailed'

export const isInventoryLockedEvent = (event: InventoryDomainEvent): event is InventoryLockedEvent =>
  event._tag === 'InventoryLocked'

export const isInventoryUnlockedEvent = (event: InventoryDomainEvent): event is InventoryUnlockedEvent =>
  event._tag === 'InventoryUnlocked'

// =============================================================================
// Event Validation Schemas
// =============================================================================

/**
 * ドメインイベント用の統一スキーマ
 */
export const InventoryDomainEventSchema = Schema.Union(
  InventoryCreatedEventSchema,
  InventoryDeletedEventSchema,
  InventoryResizedEventSchema,
  ItemAddedEventSchema,
  ItemRemovedEventSchema,
  ItemMovedEventSchema,
  ItemStackSplitEventSchema,
  ItemStackMergedEventSchema,
  ItemTransferStartedEventSchema,
  ItemTransferCompletedEventSchema,
  ItemTransferFailedEventSchema,
  ItemDurabilityChangedEventSchema,
  ItemBrokenEventSchema,
  ItemEnchantedEventSchema,
  InventoryLockedEventSchema,
  InventoryUnlockedEventSchema,
  PlayerInventorySyncedEventSchema,
  InventoryBackupCreatedEventSchema
).pipe(
  Schema.annotations({
    title: 'InventoryDomainEvent',
    description: 'Union of all inventory domain events',
  })
)

/**
 * イベントのバリデーション関数
 */
export const validateInventoryDomainEvent = Schema.decodeUnknown(InventoryDomainEventSchema)
export const isValidInventoryDomainEvent = Schema.is(InventoryDomainEventSchema)
