declare const StorageError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "StorageError";
} & Readonly<A>;
export declare class StorageError extends StorageError_base<{
    readonly operation: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
export {};
//# sourceMappingURL=errors.d.ts.map