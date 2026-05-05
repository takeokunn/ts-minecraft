import { Effect, Schema } from 'effect';
export declare const TerrainWorkerRequestSchema: Schema.Struct<{
    id: Schema.filter<Schema.filter<typeof Schema.Number>>;
    chunk: Schema.Struct<{
        x: Schema.filter<typeof Schema.Number>;
        z: Schema.filter<typeof Schema.Number>;
    }>;
    seaLevel: Schema.filter<typeof Schema.Number>;
    lakeLevel: Schema.filter<typeof Schema.Number>;
    seed: Schema.filter<typeof Schema.Number>;
}>;
export type TerrainWorkerRequest = Schema.Schema.Type<typeof TerrainWorkerRequestSchema>;
export declare const TerrainWorkerSuccessSchema: Schema.Struct<{
    id: Schema.filter<Schema.filter<typeof Schema.Number>>;
    kind: Schema.Literal<["success"]>;
    blocks: Schema.instanceOf<Uint8Array<ArrayBuffer>>;
    skyLight: Schema.instanceOf<Uint8Array<ArrayBuffer>>;
    blockLight: Schema.instanceOf<Uint8Array<ArrayBuffer>>;
}>;
export type TerrainWorkerSuccess = Schema.Schema.Type<typeof TerrainWorkerSuccessSchema>;
export declare const TerrainWorkerFailureSchema: Schema.Struct<{
    id: Schema.filter<Schema.filter<typeof Schema.Number>>;
    kind: Schema.Literal<["failure"]>;
    error: typeof Schema.String;
}>;
export type TerrainWorkerFailure = Schema.Schema.Type<typeof TerrainWorkerFailureSchema>;
export declare const TerrainWorkerResponseSchema: Schema.Union<[Schema.Struct<{
    id: Schema.filter<Schema.filter<typeof Schema.Number>>;
    kind: Schema.Literal<["success"]>;
    blocks: Schema.instanceOf<Uint8Array<ArrayBuffer>>;
    skyLight: Schema.instanceOf<Uint8Array<ArrayBuffer>>;
    blockLight: Schema.instanceOf<Uint8Array<ArrayBuffer>>;
}>, Schema.Struct<{
    id: Schema.filter<Schema.filter<typeof Schema.Number>>;
    kind: Schema.Literal<["failure"]>;
    error: typeof Schema.String;
}>]>;
export type TerrainWorkerResponse = Schema.Schema.Type<typeof TerrainWorkerResponseSchema>;
export declare const decodeRequest: (u: unknown, overrideOptions?: import("effect/SchemaAST").ParseOptions) => Effect.Effect<{
    readonly id: number;
    readonly seed: number;
    readonly seaLevel: number;
    readonly lakeLevel: number;
    readonly chunk: {
        readonly x: number;
        readonly z: number;
    };
}, import("effect/ParseResult").ParseError, never>;
export declare const decodeResponse: (u: unknown, overrideOptions?: import("effect/SchemaAST").ParseOptions) => Effect.Effect<{
    readonly id: number;
    readonly kind: "success";
    readonly blocks: Uint8Array<ArrayBuffer>;
    readonly skyLight: Uint8Array<ArrayBuffer>;
    readonly blockLight: Uint8Array<ArrayBuffer>;
} | {
    readonly id: number;
    readonly kind: "failure";
    readonly error: string;
}, import("effect/ParseResult").ParseError, never>;
export declare const decodeRequestSync: (u: unknown, overrideOptions?: import("effect/SchemaAST").ParseOptions) => {
    readonly id: number;
    readonly seed: number;
    readonly seaLevel: number;
    readonly lakeLevel: number;
    readonly chunk: {
        readonly x: number;
        readonly z: number;
    };
};
export type DecodeError = Effect.Effect.Error<ReturnType<typeof decodeResponse>>;
//# sourceMappingURL=terrain-worker-protocol.d.ts.map