import { Schema } from 'effect'

import { BlockIdSchema } from '../../shared/entities/block_id'
import { ChunkDataSchema } from '../aggregate/chunk_data'
import { ChunkIdSchema } from '../value_object/chunk_id'
import { ChunkPositionSchema } from '../value_object/chunk_position'

/**
 * チャンクイベントのメタデータ（イベントID・バージョン等）
 */
export const ChunkEventContextSchema = Schema.Struct({
  userId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
  correlationId: Schema.optional(Schema.String),
})

export type ChunkEventContext = Schema.Schema.Type<typeof ChunkEventContextSchema>

export const ChunkEventMetadataSchema = Schema.Struct({
  eventId: Schema.String.pipe(Schema.uuid()),
  aggregateId: ChunkIdSchema,
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  timestamp: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  metadata: Schema.optional(ChunkEventContextSchema),
})

export type ChunkEventMetadata = Schema.Schema.Type<typeof ChunkEventMetadataSchema>

export const ChunkEventTypeSchema = Schema.Union(
  Schema.Literal('ChunkCreated'),
  Schema.Literal('ChunkLoaded'),
  Schema.Literal('ChunkUnloaded'),
  Schema.Literal('ChunkModified'),
  Schema.Literal('ChunkSaved'),
  Schema.Literal('ChunkDeleted'),
  Schema.Literal('BlockChanged'),
  Schema.Literal('ChunkOptimized'),
  Schema.Literal('ChunkValidated'),
  Schema.Literal('ChunkCorrupted')
)

export type ChunkEventType = Schema.Schema.Type<typeof ChunkEventTypeSchema>

/**
 * チャンクイベントの共通ベース（payloadは未整形）
 */
export const ChunkEventBaseSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: ChunkEventTypeSchema,
  payload: Schema.Unknown,
})

export type BaseChunkEvent = Schema.Schema.Type<typeof ChunkEventBaseSchema>

export const ChunkCreatedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkCreated'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    initialData: ChunkDataSchema,
    source: Schema.Union(Schema.Literal('generated'), Schema.Literal('loaded'), Schema.Literal('imported')),
  }),
})

export type ChunkCreatedEvent = Schema.Schema.Type<typeof ChunkCreatedEventSchema>

export const ChunkLoadedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkLoaded'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    loadTime: Schema.Number.pipe(Schema.nonNegative()),
    cacheHit: Schema.Boolean,
    dataSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
})

export type ChunkLoadedEvent = Schema.Schema.Type<typeof ChunkLoadedEventSchema>

export const ChunkUnloadedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkUnloaded'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    reason: Schema.Union(
      Schema.Literal('memory_pressure'),
      Schema.Literal('distance'),
      Schema.Literal('manual'),
      Schema.Literal('shutdown')
    ),
    wasDirty: Schema.Boolean,
  }),
})

export type ChunkUnloadedEvent = Schema.Schema.Type<typeof ChunkUnloadedEventSchema>

export const ChunkModifiedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkModified'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    changeSet: Schema.Struct({
      blocks: Schema.Array(
        Schema.Struct({
          x: Schema.Number.pipe(Schema.int()),
          y: Schema.Number.pipe(Schema.int()),
          z: Schema.Number.pipe(Schema.int()),
          previousBlockId: BlockIdSchema,
          newBlockId: BlockIdSchema,
        })
      ),
    }),
    reason: Schema.String,
  }),
})

export type ChunkModifiedEvent = Schema.Schema.Type<typeof ChunkModifiedEventSchema>

export const ChunkSavedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkSaved'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    saveTime: Schema.Number.pipe(Schema.nonNegative()),
    dataSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    compressionRatio: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
  }),
})

export type ChunkSavedEvent = Schema.Schema.Type<typeof ChunkSavedEventSchema>

export const ChunkDeletedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkDeleted'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    reason: Schema.Union(Schema.Literal('manual'), Schema.Literal('cleanup'), Schema.Literal('corruption')),
    backupCreated: Schema.Boolean,
  }),
})

export type ChunkDeletedEvent = Schema.Schema.Type<typeof ChunkDeletedEventSchema>

export const BlockChangedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('BlockChanged'),
  payload: Schema.Struct({
    chunkPosition: ChunkPositionSchema,
    blockPosition: Schema.Struct({
      x: Schema.Number.pipe(Schema.int()),
      y: Schema.Number.pipe(Schema.int()),
      z: Schema.Number.pipe(Schema.int()),
    }),
    previousBlockId: BlockIdSchema,
    newBlockId: BlockIdSchema,
    tool: Schema.optional(Schema.String),
    player: Schema.optional(Schema.String),
  }),
})

export type BlockChangedEvent = Schema.Schema.Type<typeof BlockChangedEventSchema>

export const ChunkOptimizedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkOptimized'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    optimizationType: Schema.Union(
      Schema.Literal('compression'),
      Schema.Literal('defragmentation'),
      Schema.Literal('cache_optimization')
    ),
    beforeSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    afterSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    timeTaken: Schema.Number.pipe(Schema.nonNegative()),
  }),
})

export type ChunkOptimizedEvent = Schema.Schema.Type<typeof ChunkOptimizedEventSchema>

export const ChunkValidatedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkValidated'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    validationResult: Schema.Union(Schema.Literal('passed'), Schema.Literal('failed')),
    issues: Schema.optional(Schema.Array(Schema.String)),
    checksum: Schema.String,
  }),
})

export type ChunkValidatedEvent = Schema.Schema.Type<typeof ChunkValidatedEventSchema>

export const ChunkCorruptedEventSchema = Schema.Struct({
  ...ChunkEventMetadataSchema.fields,
  eventType: Schema.Literal('ChunkCorrupted'),
  payload: Schema.Struct({
    position: ChunkPositionSchema,
    corruptionType: Schema.Union(
      Schema.Literal('checksum_mismatch'),
      Schema.Literal('invalid_data'),
      Schema.Literal('missing_blocks')
    ),
    expectedChecksum: Schema.optional(Schema.String),
    actualChecksum: Schema.optional(Schema.String),
    recoverable: Schema.Boolean,
  }),
})

export type ChunkCorruptedEvent = Schema.Schema.Type<typeof ChunkCorruptedEventSchema>

export const ChunkEventSchema = Schema.Union(
  ChunkCreatedEventSchema,
  ChunkLoadedEventSchema,
  ChunkUnloadedEventSchema,
  ChunkModifiedEventSchema,
  ChunkSavedEventSchema,
  ChunkDeletedEventSchema,
  BlockChangedEventSchema,
  ChunkOptimizedEventSchema,
  ChunkValidatedEventSchema,
  ChunkCorruptedEventSchema
)

export type ChunkEvent = Schema.Schema.Type<typeof ChunkEventSchema>

export const ChunkEventSchemas = {
  ChunkCreated: ChunkCreatedEventSchema,
  ChunkLoaded: ChunkLoadedEventSchema,
  ChunkUnloaded: ChunkUnloadedEventSchema,
  ChunkModified: ChunkModifiedEventSchema,
  ChunkSaved: ChunkSavedEventSchema,
  ChunkDeleted: ChunkDeletedEventSchema,
  BlockChanged: BlockChangedEventSchema,
  ChunkOptimized: ChunkOptimizedEventSchema,
  ChunkValidated: ChunkValidatedEventSchema,
  ChunkCorrupted: ChunkCorruptedEventSchema,
} as const

export const validateChunkEvent = Schema.decodeUnknown(ChunkEventSchema)
export const isChunkEvent = Schema.is(ChunkEventSchema)
