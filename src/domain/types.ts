import * as S from 'effect/Schema'
import * as fc from 'effect/FastCheck'
import { EntityId } from './entity'
import { PlacedBlockSchema } from './block'
import { ChunkX, ChunkZ } from './common'

const Float32ArraySchema = S.transform(S.Array(S.Number), S.instanceOf(Float32Array), {
  decode: (arr) => new Float32Array(arr),
  encode: (f32arr) => Array.from(f32arr),
}).pipe(S.arbitrary(() => fc.float32Array()))

const Uint32ArraySchema = S.transform(S.Array(S.Number), S.instanceOf(Uint32Array), {
  decode: (arr) => new Uint32Array(arr),
  encode: (u32arr) => Array.from(u32arr),
}).pipe(S.arbitrary(() => fc.uint32Array()))

export type SoAResult<C extends Record<string, S.Schema<any, any>>> = {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: { readonly [K in keyof C]: Array<S.Schema.Type<C[K]>> }
}

export const ChunkMeshSchema = S.Struct({
  positions: Float32ArraySchema,
  normals: Float32ArraySchema,
  uvs: Float32ArraySchema,
  indices: Uint32ArraySchema,
}).pipe(
  S.arbitrary((_) =>
    fc.record({
      positions: _(Float32ArraySchema),
      normals: _(Float32ArraySchema),
      uvs: _(Float32ArraySchema),
      indices: _(Uint32ArraySchema),
    }),
  ),
)
export type ChunkMesh = S.Schema.Type<typeof ChunkMeshSchema>

export const ChunkGenerationResultSchema = S.Struct({
  type: S.Literal('chunkGenerated'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
  mesh: ChunkMeshSchema,
  blocks: S.Array(PlacedBlockSchema),
}).pipe(
  S.arbitrary((_) =>
    fc.record({
      type: fc.constant('chunkGenerated' as const),
      chunkX: _(ChunkX),
      chunkZ: _(ChunkZ),
      mesh: _(ChunkMeshSchema),
      blocks: fc.array(_(PlacedBlockSchema)),
    }),
  ),
)
export type ChunkGenerationResult = S.Schema.Type<typeof ChunkGenerationResultSchema>

export const ComputationTaskSchema = S.Struct({
  type: S.Literal('generateChunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
})
export type ComputationTask = S.Schema.Type<typeof ComputationTaskSchema>

export const UpsertChunkRenderCommandSchema = S.Struct({
  type: S.Literal('upsertChunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
  mesh: ChunkMeshSchema,
  blocks: S.Array(PlacedBlockSchema),
}).pipe(
  S.arbitrary((_) =>
    fc.record({
      type: fc.constant('upsertChunk' as const),
      chunkX: _(ChunkX),
      chunkZ: _(ChunkZ),
      mesh: _(ChunkMeshSchema),
      blocks: fc.array(_(PlacedBlockSchema)),
    }),
  ),
)
export type UpsertChunkRenderCommand = S.Schema.Type<typeof UpsertChunkRenderCommandSchema>

export const RemoveChunkRenderCommandSchema = S.Struct({
  type: S.Literal('removeChunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
})
export type RemoveChunkRenderCommand = S.Schema.Type<typeof RemoveChunkRenderCommandSchema>

export const RenderCommandSchema = S.Union(UpsertChunkRenderCommandSchema, RemoveChunkRenderCommandSchema).pipe(
  S.arbitrary((_) => fc.oneof(_(UpsertChunkRenderCommandSchema), _(RemoveChunkRenderCommandSchema))),
)
export type RenderCommand = S.Schema.Type<typeof RenderCommandSchema>