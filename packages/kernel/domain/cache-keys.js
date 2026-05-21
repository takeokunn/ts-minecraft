import { Schema } from 'effect';
// "x,z" format; branded to prevent arbitrary strings as cache keys.
export const ChunkCacheKeySchema = Schema.String.pipe(Schema.brand('ChunkCacheKey'));
export const ChunkCacheKey = {
    make: (coordOrKey) => Schema.decodeUnknownSync(ChunkCacheKeySchema)(typeof coordOrKey === 'string' ? coordOrKey : `${coordOrKey.x},${coordOrKey.z}`),
};
// Branded to prevent mixing texture URLs with arbitrary strings.
export const TextureUrlSchema = Schema.String.pipe(Schema.brand('TextureUrl'));
export const TextureUrl = {
    make: (url) => Schema.decodeUnknownSync(TextureUrlSchema)(url),
};
// "material-<type>-<value>" format; branded to prevent arbitrary strings as cache keys.
export const MaterialCacheKeySchema = Schema.String.pipe(Schema.brand('MaterialCacheKey'));
export const MaterialCacheKey = {
    make: (colorOrUrl) => Schema.decodeUnknownSync(MaterialCacheKeySchema)(`material-${typeof colorOrUrl}-${colorOrUrl}`),
};
//# sourceMappingURL=../../../dist/packages/kernel/domain/cache-keys.js.map