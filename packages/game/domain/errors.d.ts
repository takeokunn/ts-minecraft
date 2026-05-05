declare const WorldError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "WorldError";
} & Readonly<A>;
export declare class WorldError extends WorldError_base<{
    readonly worldId: string;
    readonly reason: string;
    readonly position?: readonly [number, number, number];
}> {
    get message(): string;
}
declare const GameLoopError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "GameLoopError";
} & Readonly<A>;
export declare class GameLoopError extends GameLoopError_base<{
    readonly reason: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
declare const SettingsError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "SettingsError";
} & Readonly<A>;
export declare class SettingsError extends SettingsError_base<{
    readonly operation: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
declare const StartupError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "StartupError";
} & Readonly<A>;
export declare class StartupError extends StartupError_base<{
    readonly reason: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
declare const GameStateError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "GameStateError";
} & Readonly<A>;
export declare class GameStateError extends GameStateError_base<{
    readonly operation: string;
    readonly reason: string;
    readonly cause?: unknown;
}> {
    get message(): string;
}
export {};
//# sourceMappingURL=errors.d.ts.map