import { Clock, Effect, Schema } from 'effect'

// =============================================================================
// Base Query Types
// =============================================================================

/**
 * ベースクエリ型
 * 全てのCQRSクエリの共通構造
 */
export const BaseQuerySchema = Schema.Struct({
  queryId: Schema.String.pipe(
    Schema.pattern(/^qry_[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/),
    Schema.annotations({
      description: 'Unique query identifier (UUID format)',
      examples: ['qry_550e8400-e29b-41d4-a716-446655440000'],
    })
  ),
  timestamp: Schema.Number.pipe(
    Schema.annotations({
      description: 'Query creation timestamp (Unix milliseconds)',
    })
  ),
  userId: Schema.String.pipe(
    Schema.annotations({
      description: 'User who issued the query',
    })
  ),
  correlationId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Correlation ID for tracking related queries',
      })
    )
  ),
  timeout: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({
        description: 'Query timeout in milliseconds',
      })
    )
  ),
})

export type BaseQuery = Schema.Schema.Type<typeof BaseQuerySchema>

// =============================================================================
// Query Filter Types
// =============================================================================

/**
 * ソート順序
 */
export const SortOrderSchema = Schema.Literal('ASC', 'DESC').pipe(
  Schema.annotations({
    description: 'Sort order for query results',
  })
)

export type SortOrder = Schema.Schema.Type<typeof SortOrderSchema>

/**
 * ページネーション設定
 */
export const PaginationSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Page number (1-based)',
    })
  ),
  size: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 1000),
    Schema.annotations({
      description: 'Number of items per page (1-1000)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Pagination',
    description: 'Pagination settings for query results',
  })
)

export type Pagination = Schema.Schema.Type<typeof PaginationSchema>

/**
 * ソート設定
 */
export const SortConfigSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.annotations({
      description: 'Field name to sort by',
    })
  ),
  order: SortOrderSchema,
}).pipe(
  Schema.annotations({
    title: 'SortConfig',
    description: 'Sort configuration for query results',
  })
)

export type SortConfig = Schema.Schema.Type<typeof SortConfigSchema>

/**
 * アイテムフィルター
 */
export const ItemFilterSchema = Schema.Struct({
  itemId: Schema.optional(Schema.String),
  itemIds: Schema.optional(Schema.Array(Schema.String)),
  quality: Schema.optional(Schema.String),
  qualities: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  hasEnchantments: Schema.optional(Schema.Boolean),
  minQuantity: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  maxQuantity: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  minDurability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  maxDurability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  isDamaged: Schema.optional(Schema.Boolean),
  isStackable: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'ItemFilter',
    description: 'Filter criteria for item queries',
  })
)

export type ItemFilter = Schema.Schema.Type<typeof ItemFilterSchema>

// =============================================================================
// Inventory Queries
// =============================================================================

/**
 * インベントリ取得クエリ
 * 特定のインベントリを取得する
 */
export const GetInventoryQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('GetInventory'),
  inventoryId: Schema.String,
  includeItems: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include item details in the response',
    })
  ),
  includeMetadata: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include item metadata in the response',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'GetInventoryQuery',
    description: 'Query to retrieve a specific inventory',
  })
)

export type GetInventoryQuery = Schema.Schema.Type<typeof GetInventoryQuerySchema>

/**
 * プレイヤーインベントリ取得クエリ
 * 特定のプレイヤーのインベントリを取得する
 */
export const GetPlayerInventoryQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('GetPlayerInventory'),
  playerId: Schema.String,
  inventoryType: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Specific inventory type to retrieve (all if not specified)',
      })
    )
  ),
  includeItems: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include item details in the response',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'GetPlayerInventoryQuery',
    description: 'Query to retrieve player inventories',
  })
)

export type GetPlayerInventoryQuery = Schema.Schema.Type<typeof GetPlayerInventoryQuerySchema>

/**
 * インベントリ一覧取得クエリ
 * 複数のインベントリを検索・取得する
 */
export const ListInventoriesQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('ListInventories'),
  filter: Schema.optional(
    Schema.Struct({
      playerIds: Schema.optional(Schema.Array(Schema.String)),
      inventoryTypes: Schema.optional(Schema.Array(Schema.String)),
      minSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
      maxSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
      isLocked: Schema.optional(Schema.Boolean),
      createdAfter: Schema.optional(Schema.Number),
      createdBefore: Schema.optional(Schema.Number),
    })
  ),
  pagination: Schema.optional(PaginationSchema),
  sort: Schema.optional(Schema.Array(SortConfigSchema)),
}).pipe(
  Schema.annotations({
    title: 'ListInventoriesQuery',
    description: 'Query to list and filter inventories',
  })
)

export type ListInventoriesQuery = Schema.Schema.Type<typeof ListInventoriesQuerySchema>

// =============================================================================
// Item Queries
// =============================================================================

/**
 * アイテム検索クエリ
 * インベントリ内のアイテムを検索する
 */
export const FindItemsQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('FindItems'),
  inventoryId: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Specific inventory to search in (all accessible if not specified)',
      })
    )
  ),
  filter: ItemFilterSchema,
  includeLocation: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include slot location in results',
    })
  ),
  includeMetadata: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include item metadata in results',
    })
  ),
  pagination: Schema.optional(PaginationSchema),
  sort: Schema.optional(Schema.Array(SortConfigSchema)),
}).pipe(
  Schema.annotations({
    title: 'FindItemsQuery',
    description: 'Query to find items matching specific criteria',
  })
)

export type FindItemsQuery = Schema.Schema.Type<typeof FindItemsQuerySchema>

/**
 * アイテム数量カウントクエリ
 * 特定のアイテムの総数を取得する
 */
export const CountItemsQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('CountItems'),
  inventoryId: Schema.optional(Schema.String),
  itemId: Schema.String,
  includeMetadata: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to group by metadata variations',
    })
  ),
  groupByDurability: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to group by durability ranges',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'CountItemsQuery',
    description: 'Query to count items of a specific type',
  })
)

export type CountItemsQuery = Schema.Schema.Type<typeof CountItemsQuerySchema>

/**
 * アイテム利用可能性チェッククエリ
 * 特定の数量のアイテムが利用可能かチェックする
 */
export const CheckItemAvailabilityQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('CheckItemAvailability'),
  inventoryId: Schema.String,
  requirements: Schema.Array(
    Schema.Struct({
      itemId: Schema.String,
      quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
      metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Any })),
      minDurability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
    })
  ).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
    Schema.annotations({
      description: 'List of item requirements to check',
    })
  ),
  reserveItems: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to reserve the items if available',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'CheckItemAvailabilityQuery',
    description: 'Query to check if required items are available',
  })
)

export type CheckItemAvailabilityQuery = Schema.Schema.Type<typeof CheckItemAvailabilityQuerySchema>

// =============================================================================
// Slot Queries
// =============================================================================

/**
 * スロット情報取得クエリ
 * 特定のスロットの詳細情報を取得する
 */
export const GetSlotInfoQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('GetSlotInfo'),
  inventoryId: Schema.String,
  slotNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  includeRestrictions: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include slot restrictions information',
    })
  ),
  includeHistory: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include recent slot modification history',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'GetSlotInfoQuery',
    description: 'Query to get detailed information about a specific slot',
  })
)

export type GetSlotInfoQuery = Schema.Schema.Type<typeof GetSlotInfoQuerySchema>

/**
 * 空きスロット検索クエリ
 * 利用可能な空きスロットを検索する
 */
export const FindEmptySlotsQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('FindEmptySlots'),
  inventoryId: Schema.String,
  slotType: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Specific slot type to search for (all if not specified)',
      })
    )
  ),
  maxResults: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1, 64),
      Schema.annotations({
        description: 'Maximum number of empty slots to return',
      })
    )
  ),
  includeRestricted: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include restricted slots in results',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'FindEmptySlotsQuery',
    description: 'Query to find available empty slots',
  })
)

export type FindEmptySlotsQuery = Schema.Schema.Type<typeof FindEmptySlotsQuerySchema>

/**
 * スロット使用率クエリ
 * インベントリのスロット使用率を取得する
 */
export const GetSlotUtilizationQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('GetSlotUtilization'),
  inventoryId: Schema.String,
  groupBySlotType: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to group utilization by slot type',
    })
  ),
  includeItemTypes: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include breakdown by item types',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'GetSlotUtilizationQuery',
    description: 'Query to get inventory slot utilization statistics',
  })
)

export type GetSlotUtilizationQuery = Schema.Schema.Type<typeof GetSlotUtilizationQuerySchema>

// =============================================================================
// Analytics and Statistics Queries
// =============================================================================

/**
 * インベントリ統計取得クエリ
 * インベントリの統計情報を取得する
 */
export const GetInventoryStatsQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('GetInventoryStats'),
  inventoryIds: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.maxItems(100),
      Schema.annotations({
        description: 'Specific inventories to analyze (all accessible if not specified)',
      })
    )
  ),
  timeRange: Schema.optional(
    Schema.Struct({
      startTime: Schema.Number,
      endTime: Schema.Number,
    }).pipe(
      Schema.annotations({
        description: 'Time range for historical statistics',
      })
    )
  ),
  includeItemDistribution: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include item type distribution',
    })
  ),
  includeCapacityAnalysis: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include capacity utilization analysis',
    })
  ),
  includeValueAnalysis: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to include item value analysis',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'GetInventoryStatsQuery',
    description: 'Query to get comprehensive inventory statistics',
  })
)

export type GetInventoryStatsQuery = Schema.Schema.Type<typeof GetInventoryStatsQuerySchema>

/**
 * アイテム使用履歴クエリ
 * アイテムの使用・移動履歴を取得する
 */
export const GetItemHistoryQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('GetItemHistory'),
  inventoryId: Schema.optional(Schema.String),
  itemId: Schema.optional(Schema.String),
  slotNumber: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  actionTypes: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({
        description: 'Specific action types to include (all if not specified)',
      })
    )
  ),
  timeRange: Schema.optional(
    Schema.Struct({
      startTime: Schema.Number,
      endTime: Schema.Number,
    })
  ),
  pagination: Schema.optional(PaginationSchema),
  sort: Schema.optional(Schema.Array(SortConfigSchema)),
}).pipe(
  Schema.annotations({
    title: 'GetItemHistoryQuery',
    description: 'Query to get item modification history',
  })
)

export type GetItemHistoryQuery = Schema.Schema.Type<typeof GetItemHistoryQuerySchema>

// =============================================================================
// Validation and Verification Queries
// =============================================================================

/**
 * インベントリ整合性チェッククエリ
 * インベントリの整合性を検証する
 */
export const VerifyInventoryIntegrityQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('VerifyInventoryIntegrity'),
  inventoryId: Schema.String,
  checkTypes: Schema.Array(
    Schema.Literal(
      'SLOT_CONSISTENCY',
      'ITEM_VALIDITY',
      'STACK_LIMITS',
      'DURABILITY_RANGES',
      'ENCHANTMENT_COMPATIBILITY',
      'METADATA_INTEGRITY'
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Types of integrity checks to perform',
    })
  ),
  autoFix: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Whether to automatically fix minor issues',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'VerifyInventoryIntegrityQuery',
    description: 'Query to verify inventory data integrity',
  })
)

export type VerifyInventoryIntegrityQuery = Schema.Schema.Type<typeof VerifyInventoryIntegrityQuerySchema>

/**
 * 権限チェッククエリ
 * ユーザーの特定操作権限を確認する
 */
export const CheckPermissionsQuerySchema = Schema.Struct({
  ...BaseQuerySchema.fields,
  _tag: Schema.Literal('CheckPermissions'),
  inventoryId: Schema.String,
  actions: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.maxItems(20),
    Schema.annotations({
      description: 'Actions to check permissions for',
    })
  ),
  targetSlots: Schema.optional(
    Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())).pipe(
      Schema.annotations({
        description: 'Specific slots to check permissions for',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'CheckPermissionsQuery',
    description: 'Query to check user permissions for inventory operations',
  })
)

export type CheckPermissionsQuery = Schema.Schema.Type<typeof CheckPermissionsQuerySchema>

// =============================================================================
// Union Type for All Queries
// =============================================================================

/**
 * 全てのインベントリクエリのUnion型
 */
export type InventoryQuery =
  | GetInventoryQuery
  | GetPlayerInventoryQuery
  | ListInventoriesQuery
  | FindItemsQuery
  | CountItemsQuery
  | CheckItemAvailabilityQuery
  | GetSlotInfoQuery
  | FindEmptySlotsQuery
  | GetSlotUtilizationQuery
  | GetInventoryStatsQuery
  | GetItemHistoryQuery
  | VerifyInventoryIntegrityQuery
  | CheckPermissionsQuery

// =============================================================================
// Query Result Types
// =============================================================================

/**
 * ページネーション付き結果
 */
export const PaginatedResultSchema = <T>(itemSchema: Schema.Schema<T>) =>
  Schema.Struct({
    items: Schema.Array(itemSchema),
    pagination: Schema.Struct({
      page: Schema.Number.pipe(Schema.int(), Schema.positive()),
      size: Schema.Number.pipe(Schema.int(), Schema.positive()),
      totalItems: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      totalPages: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      hasNext: Schema.Boolean,
      hasPrevious: Schema.Boolean,
    }),
  }).pipe(
    Schema.annotations({
      title: 'PaginatedResult',
      description: 'Paginated query result container',
    })
  )

/**
 * クエリ実行結果の基底型
 */
export const QueryResultSchema = Schema.Struct({
  queryId: Schema.String,
  executionTime: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({
      description: 'Query execution time in milliseconds',
    })
  ),
  success: Schema.Boolean,
  timestamp: Schema.Number,
})

export type QueryResult = Schema.Schema.Type<typeof QueryResultSchema>

// =============================================================================
// Query Factory Functions
// =============================================================================

/**
 * 共通クエリプロパティを生成
 */
const createBaseQuery = (userId: string): Effect.Effect<Omit<BaseQuery, 'queryId'>> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return {
      timestamp,
      userId,
    }
  })

/**
 * ユニークなクエリIDを生成
 */
const generateQueryId = (): string => {
  // UUIDv4の簡易実装（本来はuuidライブラリを使用）
  return `qry_${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 6)}-4${Math.random().toString(16).substring(2, 5)}-${Math.random().toString(16).substring(2, 5)}-${Math.random().toString(16).substring(2, 14)}`
}

/**
 * インベントリ取得クエリを生成
 */
export const createGetInventoryQuery = (params: {
  inventoryId: string
  includeItems?: boolean
  includeMetadata?: boolean
  userId: string
}): GetInventoryQuery => ({
  ...createBaseQuery(params.userId),
  queryId: generateQueryId(),
  _tag: 'GetInventory',
  inventoryId: params.inventoryId,
  includeItems: params.includeItems ?? true,
  includeMetadata: params.includeMetadata ?? false,
})

/**
 * アイテム数量カウントクエリを生成
 */
export const createCountItemsQuery = (params: {
  inventoryId?: string
  itemId: string
  includeMetadata?: boolean
  groupByDurability?: boolean
  userId: string
}): CountItemsQuery => ({
  ...createBaseQuery(params.userId),
  queryId: generateQueryId(),
  _tag: 'CountItems',
  inventoryId: params.inventoryId,
  itemId: params.itemId,
  includeMetadata: params.includeMetadata ?? false,
  groupByDurability: params.groupByDurability ?? false,
})

/**
 * アイテム検索クエリを生成
 */
export const createFindItemsQuery = (params: {
  inventoryId?: string
  filter: ItemFilter
  includeLocation?: boolean
  includeMetadata?: boolean
  pagination?: Pagination
  sort?: SortConfig[]
  userId: string
}): FindItemsQuery => ({
  ...createBaseQuery(params.userId),
  queryId: generateQueryId(),
  _tag: 'FindItems',
  inventoryId: params.inventoryId,
  filter: params.filter,
  includeLocation: params.includeLocation ?? true,
  includeMetadata: params.includeMetadata ?? false,
  pagination: params.pagination,
  sort: params.sort,
})

/**
 * 空きスロット検索クエリを生成
 */
export const createFindEmptySlotsQuery = (params: {
  inventoryId: string
  slotType?: string
  maxResults?: number
  includeRestricted?: boolean
  userId: string
}): FindEmptySlotsQuery => ({
  ...createBaseQuery(params.userId),
  queryId: generateQueryId(),
  _tag: 'FindEmptySlots',
  inventoryId: params.inventoryId,
  slotType: params.slotType,
  maxResults: params.maxResults,
  includeRestricted: params.includeRestricted ?? false,
})

// =============================================================================
// Query Pattern Matching Utilities
// =============================================================================

/**
 * クエリタイプによる型ガード関数
 */
export const isGetInventoryQuery = (query: InventoryQuery): query is GetInventoryQuery => query._tag === 'GetInventory'

export const isGetPlayerInventoryQuery = (query: InventoryQuery): query is GetPlayerInventoryQuery =>
  query._tag === 'GetPlayerInventory'

export const isFindItemsQuery = (query: InventoryQuery): query is FindItemsQuery => query._tag === 'FindItems'

export const isCountItemsQuery = (query: InventoryQuery): query is CountItemsQuery => query._tag === 'CountItems'

export const isCheckItemAvailabilityQuery = (query: InventoryQuery): query is CheckItemAvailabilityQuery =>
  query._tag === 'CheckItemAvailability'

export const isFindEmptySlotsQuery = (query: InventoryQuery): query is FindEmptySlotsQuery =>
  query._tag === 'FindEmptySlots'

export const isGetInventoryStatsQuery = (query: InventoryQuery): query is GetInventoryStatsQuery =>
  query._tag === 'GetInventoryStats'

export const isVerifyInventoryIntegrityQuery = (query: InventoryQuery): query is VerifyInventoryIntegrityQuery =>
  query._tag === 'VerifyInventoryIntegrity'

// =============================================================================
// Query Validation Schemas
// =============================================================================

/**
 * インベントリクエリ用の統一スキーマ
 */
export const InventoryQuerySchema = Schema.Union(
  GetInventoryQuerySchema,
  GetPlayerInventoryQuerySchema,
  ListInventoriesQuerySchema,
  FindItemsQuerySchema,
  CountItemsQuerySchema,
  CheckItemAvailabilityQuerySchema,
  GetSlotInfoQuerySchema,
  FindEmptySlotsQuerySchema,
  GetSlotUtilizationQuerySchema,
  GetInventoryStatsQuerySchema,
  GetItemHistoryQuerySchema,
  VerifyInventoryIntegrityQuerySchema,
  CheckPermissionsQuerySchema
).pipe(
  Schema.annotations({
    title: 'InventoryQuery',
    description: 'Union of all inventory queries',
  })
)

/**
 * クエリのバリデーション関数
 */
export const validateInventoryQuery = Schema.decodeUnknown(InventoryQuerySchema)
export const isValidInventoryQuery = Schema.is(InventoryQuerySchema)
