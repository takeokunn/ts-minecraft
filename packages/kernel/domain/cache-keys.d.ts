import { Schema } from 'effect';
export declare const ChunkCacheKeySchema: Schema.brand<typeof Schema.String, "ChunkCacheKey">;
export type ChunkCacheKey = Schema.Schema.Type<typeof ChunkCacheKeySchema>;
export declare const ChunkCacheKey: {
    make: (coordOrKey: {
        x: number;
        z: number;
    } | string) => ChunkCacheKey;
};
export declare const TextureUrlSchema: Schema.brand<typeof Schema.String, "TextureUrl">;
export type TextureUrl = Schema.Schema.Type<typeof TextureUrlSchema>;
export declare const TextureUrl: {
    make: (url: string) => TextureUrl;
};
export declare const MaterialCacheKeySchema: Schema.brand<typeof Schema.String, "MaterialCacheKey">;
export type MaterialCacheKey = Schema.Schema.Type<typeof MaterialCacheKeySchema>;
export declare const MaterialCacheKey: {
    make: (colorOrUrl: string | number) => MaterialCacheKey;
};
//# sourceMappingURL=cache-keys.d.ts.map