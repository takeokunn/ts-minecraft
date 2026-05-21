declare const InventoryError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "InventoryError";
} & Readonly<A>;
export declare class InventoryError extends InventoryError_base<{
    readonly operation: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
declare const RecipeError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "RecipeError";
} & Readonly<A>;
export declare class RecipeError extends RecipeError_base<{
    readonly operation: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
export {};
//# sourceMappingURL=errors.d.ts.map