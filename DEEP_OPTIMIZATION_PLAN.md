# Deep Optimization Plan

Goal: stabilize frame time at 60 FPS, eliminate GC spikes, and keep the TypeScript build clean after each change.

## Phase 1: Hot-Path Audit and Allocation Removal

- [ ] Inspect per-frame frame stages for `Effect` overhead in synchronous paths.
- [ ] Remove avoidable allocations in frame hot paths.
- [ ] Prefer direct branches and in-place mutation over callback-heavy composition where safe.
- [ ] Typecheck after each small optimization.

## Phase 2: Chunk Storage Layout

- [ ] Audit chunk/block storage for object-heavy structures.
- [ ] Identify typed-array or bit-packing opportunities.
- [ ] Preserve correctness and serialization behavior while reducing memory traffic.
- [ ] Typecheck after each storage change.

## Phase 3: Rendering Pipeline Optimization

- [ ] Review culling before meshing or draw submission.
- [ ] Add or tighten frustum and visibility culling where missing.
- [ ] Evaluate greedy meshing and mesh update frequency for avoidable work.
- [ ] Typecheck after each rendering change.

## Final Verification

- [ ] Run a full TypeScript typecheck.
- [ ] Summarize the expected performance impact of each phase.
- [ ] Note any remaining bottlenecks that should be tackled next.
