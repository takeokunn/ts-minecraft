# Deep Optimization Plan

Goal: stabilize frame time at 60 FPS, eliminate GC spikes, and keep the TypeScript build clean after each change.

## Phase 1: Hot-Path Audit and Allocation Removal

- [x] Inspect per-frame frame stages for `Effect` overhead in synchronous paths.
- [x] Remove avoidable allocations in verified renderer sync/update hot paths.
- [x] Prefer direct branches and in-place mutation over callback-heavy composition where safe. Applied in `BlockMeshService.disposeMesh`.
- [x] Flatten renderer scene-clear disposal loops to avoid a branch-local helper closure.
- [x] Typecheck after each small optimization.

## Phase 2: Chunk Storage Layout

- [x] Audit chunk/block storage for object-heavy structures.
- [x] Confirm the main chunk block storage already uses typed arrays and zero-allocation batch access.
- [x] Identify only remaining typed-array or bit-packing opportunities that are not already covered. Remaining copy-on-write buffer cloning is limited to `ChunkService.setBlock`, which is test-facing; runtime mutation already uses `setBlockInChunk`.
- [x] Preserve correctness and serialization behavior while reducing memory traffic.
- [x] Typecheck after each storage change.

## Phase 3: Rendering Pipeline Optimization

- [x] Review culling before meshing or draw submission. Existing chunk-level frustum culling is already present in `WorldRendererService`.
- [x] Add or tighten frustum and visibility culling where missing. No missing gap found in the current renderer path; manual AABB culling is already in place.
- [x] Evaluate greedy meshing and mesh update frequency for avoidable work. Greedy meshing is already present in the meshing pipeline.
- [x] Typecheck after each rendering change.

## Final Verification

- [x] Run a full TypeScript typecheck.
- [x] Summarize the expected performance impact of each phase.
- [x] Note any remaining bottlenecks that should be tackled next.
