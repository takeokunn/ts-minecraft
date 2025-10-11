import { Effect, Schema } from 'effect'
import { BlockIdSchema, type BlockId } from '../aggregate/chunk'
import { ChunkIdSchema, type ChunkId } from '../value_object/chunk_id'
import { ChunkPositionSchema, type ChunkPosition } from '../value_object/chunk_position'

/**
 * チャンク関連イベント（Event Sourcingパターン）
 */

// ChunkCreatedEvent
export const ChunkCreatedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkCreatedEvent'),
  chunkId: ChunkIdSchema,
  position: ChunkPositionSchema,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ChunkCreatedEvent = Schema.Schema.Type<typeof ChunkCreatedEventSchema>

// ChunkLoadedEvent
export const ChunkLoadedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkLoadedEvent'),
  chunkId: ChunkIdSchema,
  position: ChunkPositionSchema,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ChunkLoadedEvent = Schema.Schema.Type<typeof ChunkLoadedEventSchema>

// ChunkUnloadedEvent
export const ChunkUnloadedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkUnloadedEvent'),
  chunkId: ChunkIdSchema,
  position: ChunkPositionSchema,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ChunkUnloadedEvent = Schema.Schema.Type<typeof ChunkUnloadedEventSchema>

// ChunkModifiedEvent
export const ChunkModifiedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkModifiedEvent'),
  chunkId: ChunkIdSchema,
  position: ChunkPositionSchema,
  modifiedBlocks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ChunkModifiedEvent = Schema.Schema.Type<typeof ChunkModifiedEventSchema>

// BlockChangedEvent
export const BlockChangedEventSchema = Schema.Struct({
  _tag: Schema.Literal('BlockChangedEvent'),
  chunkId: ChunkIdSchema,
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
  oldBlockId: BlockIdSchema,
  newBlockId: BlockIdSchema,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type BlockChangedEvent = Schema.Schema.Type<typeof BlockChangedEventSchema>

// ChunkSavedEvent
export const ChunkSavedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkSavedEvent'),
  chunkId: ChunkIdSchema,
  position: ChunkPositionSchema,
  dataSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ChunkSavedEvent = Schema.Schema.Type<typeof ChunkSavedEventSchema>

// ChunkCorruptedEvent
export const ChunkCorruptedEventSchema = Schema.Struct({
  _tag: Schema.Literal('ChunkCorruptedEvent'),
  chunkId: ChunkIdSchema,
  position: ChunkPositionSchema,
  error: Schema.String,
  timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ChunkCorruptedEvent = Schema.Schema.Type<typeof ChunkCorruptedEventSchema>

/**
 * すべてのチャンクイベントの型Union
 */
export const ChunkEventSchema = Schema.Union(
  ChunkCreatedEventSchema,
  ChunkLoadedEventSchema,
  ChunkUnloadedEventSchema,
  ChunkModifiedEventSchema,
  BlockChangedEventSchema,
  ChunkSavedEventSchema,
  ChunkCorruptedEventSchema
)
export type ChunkEvent = Schema.Schema.Type<typeof ChunkEventSchema>

// Factory関数
export const createChunkCreatedEvent = (
  chunkId: ChunkId,
  position: ChunkPosition,
  timestamp: number
): Effect.Effect<ChunkCreatedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(ChunkCreatedEventSchema)({
    _tag: 'ChunkCreatedEvent' as const,
    chunkId,
    position,
    timestamp,
  })

export const createChunkLoadedEvent = (
  chunkId: ChunkId,
  position: ChunkPosition,
  timestamp: number
): Effect.Effect<ChunkLoadedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(ChunkLoadedEventSchema)({
    _tag: 'ChunkLoadedEvent' as const,
    chunkId,
    position,
    timestamp,
  })

export const createChunkUnloadedEvent = (
  chunkId: ChunkId,
  position: ChunkPosition,
  timestamp: number
): Effect.Effect<ChunkUnloadedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(ChunkUnloadedEventSchema)({
    _tag: 'ChunkUnloadedEvent' as const,
    chunkId,
    position,
    timestamp,
  })

export const createChunkModifiedEvent = (
  chunkId: ChunkId,
  position: ChunkPosition,
  modifiedBlocks: number,
  timestamp: number
): Effect.Effect<ChunkModifiedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(ChunkModifiedEventSchema)({
    _tag: 'ChunkModifiedEvent' as const,
    chunkId,
    position,
    modifiedBlocks,
    timestamp,
  })

export const createBlockChangedEvent = (
  chunkId: ChunkId,
  x: number,
  y: number,
  z: number,
  oldBlockId: BlockId,
  newBlockId: BlockId,
  timestamp: number
): Effect.Effect<BlockChangedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(BlockChangedEventSchema)({
    _tag: 'BlockChangedEvent' as const,
    chunkId,
    x,
    y,
    z,
    oldBlockId,
    newBlockId,
    timestamp,
  })

export const createChunkSavedEvent = (
  chunkId: ChunkId,
  position: ChunkPosition,
  dataSize: number,
  timestamp: number
): Effect.Effect<ChunkSavedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(ChunkSavedEventSchema)({
    _tag: 'ChunkSavedEvent' as const,
    chunkId,
    position,
    dataSize,
    timestamp,
  })

export const createChunkCorruptedEvent = (
  chunkId: ChunkId,
  position: ChunkPosition,
  error: string,
  timestamp: number
): Effect.Effect<ChunkCorruptedEvent, Schema.ParseResult.ParseError> =>
  Schema.decode(ChunkCorruptedEventSchema)({
    _tag: 'ChunkCorruptedEvent' as const,
    chunkId,
    position,
    error,
    timestamp,
  })
