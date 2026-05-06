import { Effect, Scope } from 'effect';
import type { ChunkCountProvider } from '../application/chunk-count-port';
export type PerfHudSnapshot = Readonly<{
    fps: number;
    p50Ms: number;
    p99Ms: number;
    drawCalls: number;
    chunkCount: number;
    workerQueueDepth: number;
    samples: ReadonlyArray<number>;
}>;
export interface PerfHudInterface {
    readonly recordFrame: (dtSecs: number) => Effect.Effect<void, never>;
    readonly setWorkerQueueDepth: (n: number) => Effect.Effect<void, never>;
    readonly setChunkCount: (n: number) => Effect.Effect<void, never>;
    readonly setDrawCalls: (n: number) => Effect.Effect<void, never>;
}
declare const PerfHudService_base: Effect.Service.Class<PerfHudService, "@minecraft/infrastructure/perf/PerfHudService", {
    readonly scoped: Effect.Effect<PerfHudInterface, never, Scope.Scope>;
}>;
export declare class PerfHudService extends PerfHudService_base {
}
export declare const installPerfHudCounters: (perfHud: PerfHudService, chunkManager: ChunkCountProvider, queueDepthSource: () => number) => Effect.Effect<void, never, Scope.Scope>;
export {};
//# sourceMappingURL=perf-hud.d.ts.map
