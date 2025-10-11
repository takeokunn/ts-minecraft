import { Schema } from 'effect'

import { ChunkIdSchema } from '../value_object/chunk_id'
import { ChunkPositionSchema } from '../value_object/chunk_position'

export const ChunkQueryMetadataSchema = Schema.Struct({
  queryId: Schema.String.pipe(Schema.uuid()),
  requestedAt: Schema.Number.pipe(Schema.nonNegative()),
  requesterId: Schema.String,
})

export type ChunkQueryMetadata = Schema.Schema.Type<typeof ChunkQueryMetadataSchema>

export const ChunkQueryBaseSchema = Schema.Struct({
  ...ChunkQueryMetadataSchema.fields,
})

export type ChunkQueryBase = Schema.Schema.Type<typeof ChunkQueryBaseSchema>

export const ChunkRegionSchema = Schema.Struct({
  minX: Schema.Number,
  maxX: Schema.Number,
  minZ: Schema.Number,
  maxZ: Schema.Number,
})

export type ChunkRegion = Schema.Schema.Type<typeof ChunkRegionSchema>

export const ChunkQueryTagSchema = Schema.Union(
  Schema.Literal('GetChunkById'),
  Schema.Literal('GetChunkByPosition'),
  Schema.Literal('ListChunksInRegion'),
  Schema.Literal('GetChunkStatistics')
)

export type ChunkQueryTag = Schema.Schema.Type<typeof ChunkQueryTagSchema>

export const GetChunkByIdQuerySchema = Schema.Struct({
  ...ChunkQueryBaseSchema.fields,
  _tag: Schema.Literal('GetChunkById'),
  chunkId: ChunkIdSchema,
})

export type GetChunkByIdQuery = Schema.Schema.Type<typeof GetChunkByIdQuerySchema>

export const GetChunkByPositionQuerySchema = Schema.Struct({
  ...ChunkQueryBaseSchema.fields,
  _tag: Schema.Literal('GetChunkByPosition'),
  position: ChunkPositionSchema,
})

export type GetChunkByPositionQuery = Schema.Schema.Type<typeof GetChunkByPositionQuerySchema>

export const ListChunksInRegionQuerySchema = Schema.Struct({
  ...ChunkQueryBaseSchema.fields,
  _tag: Schema.Literal('ListChunksInRegion'),
  region: ChunkRegionSchema,
})

export type ListChunksInRegionQuery = Schema.Schema.Type<typeof ListChunksInRegionQuerySchema>

export const GetChunkStatisticsQuerySchema = Schema.Struct({
  ...ChunkQueryBaseSchema.fields,
  _tag: Schema.Literal('GetChunkStatistics'),
})

export type GetChunkStatisticsQuery = Schema.Schema.Type<typeof GetChunkStatisticsQuerySchema>

export const ChunkQuerySchemas = {
  GetChunkById: GetChunkByIdQuerySchema,
  GetChunkByPosition: GetChunkByPositionQuerySchema,
  ListChunksInRegion: ListChunksInRegionQuerySchema,
  GetChunkStatistics: GetChunkStatisticsQuerySchema,
} as const

export const ChunkQuerySchema = Schema.Union(
  GetChunkByIdQuerySchema,
  GetChunkByPositionQuerySchema,
  ListChunksInRegionQuerySchema,
  GetChunkStatisticsQuerySchema
)

export type ChunkQuery = Schema.Schema.Type<typeof ChunkQuerySchema>

export const validateChunkQuery = Schema.decodeUnknown(ChunkQuerySchema)
export const isChunkQuery = Schema.is(ChunkQuerySchema)
