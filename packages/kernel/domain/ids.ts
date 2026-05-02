import { Schema } from 'effect'

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>
export const WorldId = {
  make: (s: string): WorldId => Schema.decodeUnknownSync(WorldIdSchema)(s),
}

export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>
export const PlayerId = {
  make: (s: string): PlayerId => Schema.decodeUnknownSync(PlayerIdSchema)(s),
}

export const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'))
export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>
export const BlockId = {
  make: (s: string): BlockId => Schema.decodeUnknownSync(BlockIdSchema)(s),
}

export const PhysicsBodyIdSchema = Schema.String.pipe(Schema.brand('PhysicsBodyId'))
export type PhysicsBodyId = Schema.Schema.Type<typeof PhysicsBodyIdSchema>
export const PhysicsBodyId = {
  make: (s: string): PhysicsBodyId => Schema.decodeUnknownSync(PhysicsBodyIdSchema)(s),
}

export const ChunkIdSchema = Schema.String.pipe(Schema.brand('ChunkId'))
export type ChunkId = Schema.Schema.Type<typeof ChunkIdSchema>
export const ChunkId = {
  make: (s: string): ChunkId => Schema.decodeUnknownSync(ChunkIdSchema)(s),
}

export const RecipeIdSchema = Schema.String.pipe(Schema.brand('RecipeId'))
export type RecipeId = Schema.Schema.Type<typeof RecipeIdSchema>
export const RecipeId = {
  make: (s: string): RecipeId => Schema.decodeUnknownSync(RecipeIdSchema)(s),
}
