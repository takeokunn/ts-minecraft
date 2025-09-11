import * as S from "/schema/Schema"
import { Int } from '../../domain/value-objects/common'
import { BlockTypeSchema } from '../../domain/block-types'

export const PlacedBlock = S.Struct({
  position: S.Tuple(Int, Int, Int),
  blockType: BlockTypeSchema,
})
export type PlacedBlock = S.Schema.Type<typeof PlacedBlock>

export const GenerationParams = S.Struct({
  type: S.Literal('generateChunk'),
  chunkX: Int,
  chunkZ: Int,
  seeds: S.Struct({
    world: S.Number,
    biome: S.Number,
    trees: S.Number,
  }),
  amplitude: S.Number,
  editedBlocks: S.Struct({
    destroyed: S.Array(S.String),
    placed: S.Record({ key: S.String, value: PlacedBlock }),
  }),
})
export type GenerationParams = S.Schema.Type<typeof GenerationParams>

export const IncomingMessage = GenerationParams
export type IncomingMessage = S.Schema.Type<typeof IncomingMessage>

export const ChunkGenerationResult = S.Struct({
  type: S.Literal('chunkGenerated'),
  blocks: S.Array(PlacedBlock),
  mesh: S.Struct({
    positions: S.Any,
    normals: S.Any,
    uvs: S.Any,
    indices: S.Any,
  }),
  chunkX: Int,
  chunkZ: Int,
})
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResult>

export const WorkerError = S.Struct({
  type: S.Literal('error'),
  error: S.String,
})
export type WorkerError = S.Schema.Type<typeof WorkerError>

export const OutgoingMessage = S.Union(ChunkGenerationResult, WorkerError)
export type OutgoingMessage = S.Schema.Type<typeof OutgoingMessage>
