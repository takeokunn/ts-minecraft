import { Schema } from 'effect'

import { ChunkIdSchema } from '../value_object/chunk_id'
import { ChunkPositionSchema } from '../value_object/chunk_position'
import { ChunkDataSchema } from '../aggregate/chunk_data'

/**
 * チャンクコマンド メタデータ
 */
export const ChunkCommandMetadataSchema = Schema.Struct({
  commandId: Schema.String.pipe(Schema.uuid()),
  issuedAt: Schema.Number.pipe(Schema.nonNegative()),
  actorId: Schema.String,
})

export type ChunkCommandMetadata = Schema.Schema.Type<typeof ChunkCommandMetadataSchema>

/**
 * チャンクコマンドの共通フィールド
 */
export const ChunkCommandBaseSchema = Schema.Struct({
  ...ChunkCommandMetadataSchema.fields,
})

export type ChunkCommandBase = Schema.Schema.Type<typeof ChunkCommandBaseSchema>

export const ChunkCommandTagSchema = Schema.Union(
  Schema.Literal('LoadChunk'),
  Schema.Literal('SaveChunk'),
  Schema.Literal('UnloadChunk')
)

export type ChunkCommandTag = Schema.Schema.Type<typeof ChunkCommandTagSchema>

export const LoadChunkCommandSchema = Schema.Struct({
  ...ChunkCommandBaseSchema.fields,
  _tag: Schema.Literal('LoadChunk'),
  position: ChunkPositionSchema,
})

export type LoadChunkCommand = Schema.Schema.Type<typeof LoadChunkCommandSchema>

export const SaveChunkCommandSchema = Schema.Struct({
  ...ChunkCommandBaseSchema.fields,
  _tag: Schema.Literal('SaveChunk'),
  chunk: ChunkDataSchema,
})

export type SaveChunkCommand = Schema.Schema.Type<typeof SaveChunkCommandSchema>

export const UnloadChunkCommandSchema = Schema.Struct({
  ...ChunkCommandBaseSchema.fields,
  _tag: Schema.Literal('UnloadChunk'),
  chunkId: ChunkIdSchema,
})

export type UnloadChunkCommand = Schema.Schema.Type<typeof UnloadChunkCommandSchema>

export const ChunkCommandSchemas = {
  LoadChunk: LoadChunkCommandSchema,
  SaveChunk: SaveChunkCommandSchema,
  UnloadChunk: UnloadChunkCommandSchema,
} as const

export const ChunkCommandSchema = Schema.Union(
  LoadChunkCommandSchema,
  SaveChunkCommandSchema,
  UnloadChunkCommandSchema
)

export type ChunkCommand = Schema.Schema.Type<typeof ChunkCommandSchema>

export const validateChunkCommand = Schema.decodeUnknown(ChunkCommandSchema)
export const isChunkCommand = Schema.is(ChunkCommandSchema)
