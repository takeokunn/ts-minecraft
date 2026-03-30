## Performance / Effect-TS audit note

Repo-wide scan completed for the current performance pass.

- Hot paths reviewed: `src/frame-handler.ts`, `src/application/game-loop/index.ts`, `src/application/chunk/chunk-manager-service.ts`, `src/infrastructure/three/world-renderer.ts`, `src/infrastructure/three/meshing/greedy-meshing.ts`, `src/infrastructure/three/meshing/chunk-mesh.ts`.
- Remaining high-value startup hotspot addressed by overlapping atlas construction with meshing worker-pool startup in `src/infrastructure/three/meshing/chunk-mesh.ts`.
- Frame-loop reduction applied by removing false parallelism from the entity update path, village simulation, biome classification, and terrain noise work once time-of-day is known.
- Scene sync now batches chunk mesh add/remove operations in `src/infrastructure/three/world-renderer.ts` while limiting fan-out in chunk loading to the same 4-fiber cap as the semaphore.
- Measured FPS threshold e2e in the current tree averaged 36.0 FPS (samples 37.2, 50.7, 20.0; threshold 12).
- Effect-TS consistency checked across raw event listeners, timing callbacks, and effect bridges in `src/main.ts` and `src/presentation/*`.
- Verification passed: unit tests, FPS threshold e2e, and production build.
- Remaining warnings are pre-existing lint warnings and a build chunk-size warning; no blocking perf regression remained after the audit.
