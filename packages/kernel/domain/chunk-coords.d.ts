import { Effect, Option, Schema } from 'effect';
declare const BlockIndexError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "BlockIndexError";
} & Readonly<A>;
export declare class BlockIndexError extends BlockIndexError_base<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
}> {
}
export declare const CHUNK_SIZE = 16;
export declare const CHUNK_HEIGHT = 256;
export declare const ChunkCoordSchema: Schema.Struct<{
    x: Schema.filter<typeof Schema.Number>;
    z: Schema.filter<typeof Schema.Number>;
}>;
export type ChunkCoord = Schema.Schema.Type<typeof ChunkCoordSchema>;
export declare const blockIndex: (x: number, y: number, z: number) => Option.Option<number>;
export declare const blockIndexUnsafe: (x: number, y: number, z: number) => number;
export declare const toBlockIndex: (x: number, y: number, z: number) => Effect.Effect<number, BlockIndexError>;
export {};
//# sourceMappingURL=chunk-coords.d.ts.map