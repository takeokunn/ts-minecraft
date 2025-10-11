import { Clock, Effect, Schema } from 'effect'
import { JsonRecordSchema } from '@shared/schema/json'
import type { JsonRecord } from '@shared/schema/json'

// =============================================================================
// Base Command Types
// =============================================================================

/**
 * ベースコマンド型
 * 全てのCQRSコマンドの共通構造
 */
export const BaseCommandSchema = Schema.Struct({
  commandId: Schema.String.pipe(
    Schema.pattern(/^cmd_[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/),
    Schema.annotations({
      description: 'Unique command identifier (UUID format)',
      examples: ['cmd_550e8400-e29b-41d4-a716-446655440000'],
    })
  ),
  timestamp: Schema.Number.pipe(
    Schema.annotations({
      description: 'Command creation timestamp (Unix milliseconds)',
    })
  ),
  userId: Schema.String.pipe(
    Schema.annotations({
      description: 'User who issued the command',
    })
  ),
  correlationId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Correlation ID for tracking related commands',
      })
    )
  ),
  metadata: Schema.optional(
    JsonRecordSchema.pipe(
      Schema.annotations({
        description: 'Additional command metadata',
      })
    )
  ),
})

export type BaseCommand = Schema.Schema.Type<typeof BaseCommandSchema>

// =============================================================================
// Inventory Management Commands
// =============================================================================

/**
 * インベントリ作成コマンド
 * 新しいインベントリを作成する
 */
export const CreateInventoryCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('CreateInventory'),
  inventoryId: Schema.String,
  playerId: Schema.String,
  inventoryType: Schema.String,
  initialSize: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Initial number of slots in the inventory',
    })
  ),
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }).pipe(
      Schema.annotations({
        description: 'World position for container inventories',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'CreateInventoryCommand',
    description: 'Command to create a new inventory',
  })
)

export type CreateInventoryCommand = Schema.Schema.Type<typeof CreateInventoryCommandSchema>

/**
 * インベントリ削除コマンド
 * 既存のインベントリを削除する
 */
export const DeleteInventoryCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('DeleteInventory'),
  inventoryId: Schema.String,
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for inventory deletion',
    })
  ),
  dropItems: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to drop items when deleting inventory',
    })
  ),
  dropLocation: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    }).pipe(
      Schema.annotations({
        description: 'Location to drop items if dropItems is true',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'DeleteInventoryCommand',
    description: 'Command to delete an existing inventory',
  })
)

export type DeleteInventoryCommand = Schema.Schema.Type<typeof DeleteInventoryCommandSchema>

/**
 * インベントリサイズ変更コマンド
 * インベントリのサイズを変更する
 */
export const ResizeInventoryCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('ResizeInventory'),
  inventoryId: Schema.String,
  newSize: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'New number of slots for the inventory',
    })
  ),
  preserveItems: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to preserve items when reducing size',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ResizeInventoryCommand',
    description: 'Command to resize an inventory',
  })
)

export type ResizeInventoryCommand = Schema.Schema.Type<typeof ResizeInventoryCommandSchema>

// =============================================================================
// Item Manipulation Commands
// =============================================================================

/**
 * アイテム追加コマンド
 * インベントリにアイテムを追加する
 */
export const AddItemCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('AddItem'),
  inventoryId: Schema.String,
  itemId: Schema.String,
  quantity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Number of items to add',
    })
  ),
  targetSlot: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.nonNegative(),
      Schema.annotations({
        description: 'Specific slot to add items to (auto-assign if not specified)',
      })
    )
  ),
  metadata: Schema.optional(
    JsonRecordSchema.pipe(
      Schema.annotations({
        description: 'Item metadata such as enchantments, durability, etc.',
      })
    )
  ),
  allowPartial: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to allow partial addition if inventory is nearly full',
    })
  ),
  source: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Source of the item addition (crafting, pickup, etc.)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'AddItemCommand',
    description: 'Command to add items to an inventory',
  })
)

export type AddItemCommand = Schema.Schema.Type<typeof AddItemCommandSchema>

/**
 * アイテム削除コマンド
 * インベントリからアイテムを削除する
 */
export const RemoveItemCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('RemoveItem'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Slot number to remove items from',
    })
  ),
  quantity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Number of items to remove',
    })
  ),
  itemId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Expected item ID for validation (optional)',
      })
    )
  ),
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for item removal',
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
    title: 'RemoveItemCommand',
    description: 'Command to remove items from an inventory',
  })
)

export type RemoveItemCommand = Schema.Schema.Type<typeof RemoveItemCommandSchema>

/**
 * アイテム移動コマンド
 * インベントリ内でアイテムを移動する
 */
export const MoveItemCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('MoveItem'),
  inventoryId: Schema.String,
  fromSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Source slot number',
    })
  ),
  toSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Target slot number',
    })
  ),
  quantity: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Number of items to move (all items if not specified)',
      })
    )
  ),
  allowSwap: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to allow swapping if target slot is occupied',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'MoveItemCommand',
    description: 'Command to move items within an inventory',
  })
)

export type MoveItemCommand = Schema.Schema.Type<typeof MoveItemCommandSchema>

/**
 * アイテムスタック分割コマンド
 * アイテムスタックを複数のスタックに分割する
 */
export const SplitItemStackCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('SplitItemStack'),
  inventoryId: Schema.String,
  sourceSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Slot containing the stack to split',
    })
  ),
  targetSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Target slot for the split portion',
    })
  ),
  splitQuantity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Number of items to move to target slot',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'SplitItemStackCommand',
    description: 'Command to split an item stack between slots',
  })
)

export type SplitItemStackCommand = Schema.Schema.Type<typeof SplitItemStackCommandSchema>

/**
 * アイテムスタック結合コマンド
 * 複数のアイテムスタックを一つに結合する
 */
export const MergeItemStacksCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('MergeItemStacks'),
  inventoryId: Schema.String,
  sourceSlots: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Source slot numbers to merge from',
    })
  ),
  targetSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Target slot to merge items into',
    })
  ),
  itemId: Schema.String.pipe(
    Schema.annotations({
      description: 'Item ID to merge (must match across all slots)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'MergeItemStacksCommand',
    description: 'Command to merge multiple item stacks into one',
  })
)

export type MergeItemStacksCommand = Schema.Schema.Type<typeof MergeItemStacksCommandSchema>

// =============================================================================
// Item Transfer Commands
// =============================================================================

/**
 * アイテム転送コマンド
 * インベントリ間でアイテムを転送する
 */
export const TransferItemCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('TransferItem'),
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  sourceSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({
      description: 'Source slot number',
    })
  ),
  targetSlot: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.nonNegative(),
      Schema.annotations({
        description: 'Target slot number (auto-assign if not specified)',
      })
    )
  ),
  quantity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Number of items to transfer',
    })
  ),
  allowPartial: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to allow partial transfer if target is nearly full',
    })
  ),
  validatePermissions: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to validate transfer permissions',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'TransferItemCommand',
    description: 'Command to transfer items between inventories',
  })
)

export type TransferItemCommand = Schema.Schema.Type<typeof TransferItemCommandSchema>

/**
 * 一括アイテム転送コマンド
 * 複数のアイテムを一度に転送する
 */
export const BulkTransferCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('BulkTransfer'),
  sourceInventoryId: Schema.String,
  targetInventoryId: Schema.String,
  transfers: Schema.Array(
    Schema.Struct({
      sourceSlot: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      targetSlot: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
      quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
      itemId: Schema.optional(Schema.String),
    })
  ).pipe(
    Schema.minItems(1),
    Schema.maxItems(64), // 制限を設ける
    Schema.annotations({
      description: 'List of transfer operations to perform',
    })
  ),
  atomic: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether all transfers must succeed or none (atomic operation)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'BulkTransferCommand',
    description: 'Command to transfer multiple items in a single operation',
  })
)

export type BulkTransferCommand = Schema.Schema.Type<typeof BulkTransferCommandSchema>

// =============================================================================
// Item State Change Commands
// =============================================================================

/**
 * アイテム耐久度更新コマンド
 * アイテムの耐久度を更新する
 */
export const UpdateItemDurabilityCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('UpdateItemDurability'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  durabilityChange: Schema.Number.pipe(
    Schema.annotations({
      description: 'Change in durability (negative for damage, positive for repair)',
    })
  ),
  cause: Schema.String.pipe(
    Schema.annotations({
      description: 'Cause of durability change',
    })
  ),
  preventBreaking: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to prevent item from breaking (stop at 1 durability)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'UpdateItemDurabilityCommand',
    description: 'Command to update item durability',
  })
)

export type UpdateItemDurabilityCommand = Schema.Schema.Type<typeof UpdateItemDurabilityCommandSchema>

/**
 * アイテムエンチャント追加コマンド
 * アイテムにエンチャントを追加する
 */
export const EnchantItemCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('EnchantItem'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  enchantmentId: Schema.String,
  level: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 5),
    Schema.annotations({
      description: 'Enchantment level (1-5)',
    })
  ),
  cost: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Experience or material cost',
      })
    )
  ),
  overwrite: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to overwrite existing enchantment of same type',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'EnchantItemCommand',
    description: 'Command to add enchantment to an item',
  })
)

export type EnchantItemCommand = Schema.Schema.Type<typeof EnchantItemCommandSchema>

/**
 * アイテムメタデータ更新コマンド
 * アイテムのメタデータを更新する
 */
export const UpdateItemMetadataCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('UpdateItemMetadata'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  metadata: JsonRecordSchema.pipe(
    Schema.annotations({
      description: 'New metadata to apply to the item',
    })
  ),
  mergeMode: Schema.Literal('replace', 'merge', 'patch').pipe(
    Schema.annotations({
      description: 'How to apply the metadata: replace all, merge with existing, or patch specific fields',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'UpdateItemMetadataCommand',
    description: 'Command to update item metadata',
  })
)

export type UpdateItemMetadataCommand = Schema.Schema.Type<typeof UpdateItemMetadataCommandSchema>

// =============================================================================
// Inventory State Commands
// =============================================================================

/**
 * インベントリロックコマンド
 * インベントリをロックする
 */
export const LockInventoryCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('LockInventory'),
  inventoryId: Schema.String,
  lockType: Schema.Literal('READ_ONLY', 'FULL_LOCK', 'ADMIN_LOCK').pipe(
    Schema.annotations({
      description: 'Type of lock to apply',
    })
  ),
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for locking the inventory',
    })
  ),
  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({
        description: 'Lock duration in milliseconds (permanent if not specified)',
      })
    )
  ),
  bypassPermissions: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to bypass normal permission checks',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'LockInventoryCommand',
    description: 'Command to lock an inventory',
  })
)

export type LockInventoryCommand = Schema.Schema.Type<typeof LockInventoryCommandSchema>

/**
 * インベントリアンロックコマンド
 * インベントリのロックを解除する
 */
export const UnlockInventoryCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('UnlockInventory'),
  inventoryId: Schema.String,
  reason: Schema.String.pipe(
    Schema.annotations({
      description: 'Reason for unlocking the inventory',
    })
  ),
  force: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to force unlock regardless of lock type',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'UnlockInventoryCommand',
    description: 'Command to unlock an inventory',
  })
)

export type UnlockInventoryCommand = Schema.Schema.Type<typeof UnlockInventoryCommandSchema>

/**
 * インベントリ同期コマンド
 * インベントリを外部システムと同期する
 */
export const SyncInventoryCommandSchema = Schema.Struct({
  ...BaseCommandSchema.fields,
  _tag: Schema.Literal('SyncInventory'),
  inventoryId: Schema.String,
  syncTarget: Schema.String.pipe(
    Schema.annotations({
      description: 'Target system to sync with (database, cache, etc.)',
    })
  ),
  syncType: Schema.Literal('FULL', 'INCREMENTAL', 'FORCED').pipe(
    Schema.annotations({
      description: 'Type of synchronization to perform',
    })
  ),
  conflictResolution: Schema.Literal('LOCAL_WINS', 'REMOTE_WINS', 'TIMESTAMP', 'USER_CHOICE').pipe(
    Schema.annotations({
      description: 'How to resolve conflicts during sync',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'SyncInventoryCommand',
    description: 'Command to synchronize inventory with external systems',
  })
)

export type SyncInventoryCommand = Schema.Schema.Type<typeof SyncInventoryCommandSchema>

// =============================================================================
// Union Type for All Commands
// =============================================================================

/**
 * 全てのインベントリコマンドのUnion型
 */
export type InventoryCommand =
  | CreateInventoryCommand
  | DeleteInventoryCommand
  | ResizeInventoryCommand
  | AddItemCommand
  | RemoveItemCommand
  | MoveItemCommand
  | SplitItemStackCommand
  | MergeItemStacksCommand
  | TransferItemCommand
  | BulkTransferCommand
  | UpdateItemDurabilityCommand
  | EnchantItemCommand
  | UpdateItemMetadataCommand
  | LockInventoryCommand
  | UnlockInventoryCommand
  | SyncInventoryCommand

// =============================================================================
// Command Factory Functions
// =============================================================================

/**
 * 共通コマンドプロパティを生成
 */
const createBaseCommand = (userId: string): Effect.Effect<Omit<BaseCommand, 'commandId'>> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return {
      timestamp,
      userId,
    }
  })

/**
 * ユニークなコマンドIDを生成
 */
const generateCommandId = (): string => {
  // UUIDv4の簡易実装（本来はuuidライブラリを使用）
  return `cmd_${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 6)}-4${Math.random().toString(16).substring(2, 5)}-${Math.random().toString(16).substring(2, 5)}-${Math.random().toString(16).substring(2, 14)}`
}

/**
 * アイテム追加コマンドを生成
 */
export const createAddItemCommand = (params: {
  inventoryId: string
  itemId: string
  quantity: number
  targetSlot?: number
  metadata?: JsonRecord
  allowPartial?: boolean
  source?: string
  userId: string
}): AddItemCommand => ({
  ...createBaseCommand(params.userId),
  commandId: generateCommandId(),
  _tag: 'AddItem',
  inventoryId: params.inventoryId,
  itemId: params.itemId,
  quantity: params.quantity,
  targetSlot: params.targetSlot,
  metadata: params.metadata,
  allowPartial: params.allowPartial ?? true,
  source: params.source,
})

/**
 * アイテム削除コマンドを生成
 */
export const createRemoveItemCommand = (params: {
  inventoryId: string
  slotNumber: number
  quantity: number
  itemId?: string
  reason: string
  destination?: string
  userId: string
}): RemoveItemCommand => ({
  ...createBaseCommand(params.userId),
  commandId: generateCommandId(),
  _tag: 'RemoveItem',
  inventoryId: params.inventoryId,
  slotNumber: params.slotNumber,
  quantity: params.quantity,
  itemId: params.itemId,
  reason: params.reason,
  destination: params.destination,
})

/**
 * アイテム転送コマンドを生成
 */
export const createTransferItemCommand = (params: {
  sourceInventoryId: string
  targetInventoryId: string
  sourceSlot: number
  targetSlot?: number
  quantity: number
  allowPartial?: boolean
  validatePermissions?: boolean
  userId: string
}): TransferItemCommand => ({
  ...createBaseCommand(params.userId),
  commandId: generateCommandId(),
  _tag: 'TransferItem',
  sourceInventoryId: params.sourceInventoryId,
  targetInventoryId: params.targetInventoryId,
  sourceSlot: params.sourceSlot,
  targetSlot: params.targetSlot,
  quantity: params.quantity,
  allowPartial: params.allowPartial ?? true,
  validatePermissions: params.validatePermissions ?? true,
})

/**
 * アイテム移動コマンドを生成
 */
export const createMoveItemCommand = (params: {
  inventoryId: string
  fromSlot: number
  toSlot: number
  quantity?: number
  allowSwap?: boolean
  userId: string
}): MoveItemCommand => ({
  ...createBaseCommand(params.userId),
  commandId: generateCommandId(),
  _tag: 'MoveItem',
  inventoryId: params.inventoryId,
  fromSlot: params.fromSlot,
  toSlot: params.toSlot,
  quantity: params.quantity,
  allowSwap: params.allowSwap ?? false,
})

// =============================================================================
// Command Pattern Matching Utilities
// =============================================================================

/**
 * コマンドタイプによる型ガード関数
 */
export const isCreateInventoryCommand = (command: InventoryCommand): command is CreateInventoryCommand =>
  command._tag === 'CreateInventory'

export const isAddItemCommand = (command: InventoryCommand): command is AddItemCommand => command._tag === 'AddItem'

export const isRemoveItemCommand = (command: InventoryCommand): command is RemoveItemCommand =>
  command._tag === 'RemoveItem'

export const isMoveItemCommand = (command: InventoryCommand): command is MoveItemCommand => command._tag === 'MoveItem'

export const isTransferItemCommand = (command: InventoryCommand): command is TransferItemCommand =>
  command._tag === 'TransferItem'

export const isBulkTransferCommand = (command: InventoryCommand): command is BulkTransferCommand =>
  command._tag === 'BulkTransfer'

export const isLockInventoryCommand = (command: InventoryCommand): command is LockInventoryCommand =>
  command._tag === 'LockInventory'

export const isUnlockInventoryCommand = (command: InventoryCommand): command is UnlockInventoryCommand =>
  command._tag === 'UnlockInventory'

// =============================================================================
// Command Validation Schemas
// =============================================================================

/**
 * インベントリコマンド用の統一スキーマ
 */
export const InventoryCommandSchema = Schema.Union(
  CreateInventoryCommandSchema,
  DeleteInventoryCommandSchema,
  ResizeInventoryCommandSchema,
  AddItemCommandSchema,
  RemoveItemCommandSchema,
  MoveItemCommandSchema,
  SplitItemStackCommandSchema,
  MergeItemStacksCommandSchema,
  TransferItemCommandSchema,
  BulkTransferCommandSchema,
  UpdateItemDurabilityCommandSchema,
  EnchantItemCommandSchema,
  UpdateItemMetadataCommandSchema,
  LockInventoryCommandSchema,
  UnlockInventoryCommandSchema,
  SyncInventoryCommandSchema
).pipe(
  Schema.annotations({
    title: 'InventoryCommand',
    description: 'Union of all inventory commands',
  })
)

/**
 * コマンドのバリデーション関数
 */
export const validateInventoryCommand = Schema.decodeUnknown(InventoryCommandSchema)
export const isValidInventoryCommand = Schema.is(InventoryCommandSchema)
