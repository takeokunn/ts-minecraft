declare const PlayerError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "PlayerError";
} & Readonly<A>;
export declare class PlayerError extends PlayerError_base<{
    readonly playerId: string;
    readonly reason: string;
}> {
    get message(): string;
}
declare const CameraError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "CameraError";
} & Readonly<A>;
export declare class CameraError extends CameraError_base<{
    readonly cause?: unknown;
}> {
    get message(): string;
}
export {};
//# sourceMappingURL=errors.d.ts.map