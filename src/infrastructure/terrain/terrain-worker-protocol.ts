import { Schema } from 'effect'

export const TerrainWorkerRequestSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  seed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  chunkX: Schema.Number.pipe(Schema.int()),
  chunkZ: Schema.Number.pipe(Schema.int()),
  seaLevel: Schema.Number.pipe(Schema.int()),
  lakeLevel: Schema.Number.pipe(Schema.int()),
})
export type TerrainWorkerRequest = Schema.Schema.Type<typeof TerrainWorkerRequestSchema>

export const TerrainWorkerResponseSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  blocks: Schema.instanceOf(Uint8Array),
})
export type TerrainWorkerResponse = Schema.Schema.Type<typeof TerrainWorkerResponseSchema>
