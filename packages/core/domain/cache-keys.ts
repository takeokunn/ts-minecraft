import { Schema } from 'effect'

// "x,z" format; branded to prevent arbitrary strings as cache keys.
export const ChunkCacheKeySchema = Schema.String.pipe(Schema.brand('ChunkCacheKey'))
export type ChunkCacheKey = Schema.Schema.Type<typeof ChunkCacheKeySchema>
export const ChunkCacheKey = {
  make: (coordOrKey: { x: number; z: number } | string): ChunkCacheKey =>
    Schema.decodeUnknownSync(ChunkCacheKeySchema)(
      typeof coordOrKey === 'string' ? coordOrKey : `${coordOrKey.x},${coordOrKey.z}`,
    ),
}

// Branded to prevent mixing texture URLs with arbitrary strings.
export const TextureUrlSchema = Schema.String.pipe(Schema.brand('TextureUrl'))
export type TextureUrl = Schema.Schema.Type<typeof TextureUrlSchema>
export const TextureUrl = {
  make: (url: string): TextureUrl => Schema.decodeUnknownSync(TextureUrlSchema)(url),
}

// "material-<type>-<value>" format; branded to prevent arbitrary strings as cache keys.
export const MaterialCacheKeySchema = Schema.String.pipe(Schema.brand('MaterialCacheKey'))
export type MaterialCacheKey = Schema.Schema.Type<typeof MaterialCacheKeySchema>
export const MaterialCacheKey = {
  make: (colorOrUrl: string | number): MaterialCacheKey =>
    Schema.decodeUnknownSync(MaterialCacheKeySchema)(`material-${typeof colorOrUrl}-${colorOrUrl}`),
}
