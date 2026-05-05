declare const FurnaceError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "FurnaceError";
} & Readonly<A>;
export declare class FurnaceError extends FurnaceError_base<{
    readonly operation: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
export {};
//# sourceMappingURL=errors.d.ts.map