import { Effect } from 'effect'

// Port interface: presentation/perf-hud.ts polls chunk count via this interface
// instead of depending on @ts-minecraft/terrain directly.
// The caller (packages/app) provides an adapter that wraps ChunkManagerService.
export interface ChunkCountProvider {
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<unknown>, never>
}
