# Phase 03: Game Loop + Simple World - Complete Requirements Specification

**Generated**: 2026-02-24
**Timeline**: 6 days (conservative)
**Confidence Score**: 87/100
**Status**: Ready for /execute

---

## Executive Summary

**Goal**: Implement a functional game loop with player entity, flat world terrain, and camera follow system using Effect-TS patterns and DDD architecture.

**Key Deliverables**:
- Player and World domain models with service-specific Refs
- Queue-based game loop with proper Effect composition
- Flat terrain generation (single plane, no chunks)
- Camera follow with smooth interpolation
- 70% test coverage with strong integration tests

**Architecture**: DDD Lite + Effect-TS + Three.js
**Pattern**: Service-specific Refs (not monolithic GameState)

---

## Changes from Initial Feedback

### Critical Issues Addressed
1. **✅ Added Error Domain Definitions**: PlayerError, WorldError, GameStateError (Day 1)
2. **✅ Specified Game Loop Architecture**: Queue-based pattern with Effect.Queue (Day 2)
3. **✅ Clarified Directory Structure**: All new services in src/application/ (Days 2-3)
4. **✅ Adjusted Test Coverage**: 70% target with integration test focus (Day 6)

### Warnings Addressed
1. **✅ Defined Service Ref State Contracts**: PlayerState, WorldState, TimingState
2. **✅ Specified WorldRendererService Interface**: Clear synchronization contract
3. **✅ Added Camera Interpolation Math**: Lerp formula with tuning parameters
4. **✅ Added ClockService Definition**: Effect.Clock wrapper service
5. **✅ Defined Error Handling Strategy**: Game loop recovery wrapper
6. **✅ Added Integration Test Strategy**: Mock patterns and test scenarios

---

## Current State

**Phase 02 Completion**: Visual Foundation
- ✅ Three.js rendering infrastructure
- ✅ Block domain model and BlockRegistry
- ✅ Basic scene with 5 static blocks
- ✅ FPS counter with delta time
- ✅ Object pooling (Vector3Pool, QuaternionPool)
- ⚠️ Simple requestAnimationFrame loop (not Effect-based)

**Technical Stack**:
- TypeScript 5.9.3 + Effect 3.19.19 + Three.js 0.170.0
- Vite 7.3.1 + Vitest 3.2.4
- DDD Lite architecture with Context.GenericTag pattern
- Ref-based state management (not STM)

**Architecture Pattern**:
```
Domain Layer (src/domain/)
  → Application Layer (src/application/)
    → Infrastructure Layer (src/infrastructure/three/)
      → Presentation Layer (src/presentation/)
```

---

## Functional Requirements

### FR-001: Player Entity System (Mandatory)
**Priority**: Critical
**Day**: 1
**Complexity**: Low-Medium

**Requirements**:
- FR-001.1: Define Player entity with Schema validation
  - Position (x, y, z coordinates)
  - Velocity (x, y, z vector)
  - Rotation (quaternion)
  - PlayerId (branded type)

- FR-001.2: Implement PlayerService with Ref-based state
  - `create(id, position)` - Initialize player
  - `updatePosition(id, position)` - Update position
  - `getPosition(id)` - Get current position
  - `getVelocity(id)` - Get current velocity

- FR-001.3: Define PlayerError error type
  - `PlayerNotFoundError` when player doesn't exist
  - `InvalidPositionError` for out-of-bounds positions

**Acceptance Criteria**:
- ✅ Player entity can be created and retrieved
- ✅ Position updates are reflected in Ref state
- ✅ Error handling follows existing BlockRegistry pattern

**Test Coverage**: 85%+ (entity + service + error cases)

---

### FR-002: World Aggregate System (Mandatory)
**Priority**: Critical
**Day**: 1-2
**Complexity**: Medium

**Requirements**:
- FR-002.1: Define World aggregate root
  - WorldId (branded type)
  - Block storage (simple Map<string, BlockType>)
  - Coordinate system (x, y, z → string key)

- FR-002.2: Implement WorldService with Ref-based state
  - `create(id)` - Initialize empty world
  - `addBlock(worldId, position, blockType)` - Place block
  - `removeBlock(worldId, position)` - Remove block
  - `getBlock(worldId, position)` - Get block at position
  - `getBlocksInArea(worldId, boundingBox)` - Get area of blocks

- FR-002.3: Define WorldError error type
  - `WorldNotFoundError` when world doesn't exist
  - `BlockPlacementError` for invalid placements

**Acceptance Criteria**:
- ✅ Blocks can be added/removed from world
- ✅ Block queries return correct results
- ✅ Simple Map storage works for Phase 3 scale

**Test Coverage**: 85%+ (aggregate + service + error cases)

---

### FR-003: Game Loop System (Mandatory)
**Priority**: Critical
**Day**: 2-3
**Complexity**: High

**Requirements**:
- FR-003.1: Implement Queue-based game loop pattern
  - Use `Effect.Queue<FrameCommand>` for frame updates
  - Bridge requestAnimationFrame with Effect.Queue
  - Process commands in Effect.fork fiber
  - Target: 60 FPS (16.67ms frame time)

- FR-003.2: Define GameLoopService interface
  - `start()` - Begin game loop
  - `stop()` - Stop game loop and cleanup
  - `enqueueCommand(cmd)` - Add frame command

- FR-003.3: Implement error recovery wrapper
  - Catch errors in frame processing
  - Log errors without crashing loop
  - Continue to next frame on error

- FR-003.4: Add ClockService definition
  - Wrap `Effect.Clock.currentTimeMillis`
  - Provide mockable time source for tests

**Queue Pattern Specification**:
```typescript
interface FrameCommand {
  readonly _tag: 'UpdatePlayerPosition' | 'UpdateWorld' | 'Render'
  readonly deltaTime: number
  readonly payload: unknown
}

// Bridge pattern:
requestAnimationFrame(() => {
  Effect.runPromise(Queue.offer(frameQueue, currentTime))
})

// Processing fiber:
Effect.fork(
  Effect.forever(
    Effect.gen(function* () {
      const cmd = yield* Queue.take(frameQueue)
      yield* processCommand(cmd)
    })
  )
)
```

**Acceptance Criteria**:
- ✅ Game loop runs at ~60 FPS
- ✅ Effect composition preserved (no Effect.runSync in hot path)
- ✅ Errors don't crash the loop
- ✅ Loop can be started and stopped cleanly

**Test Coverage**: 70%+ (mock time source, command processing)

---

### FR-004: GameState Coordination Service (Mandatory)
**Priority**: High
**Day**: 2-3
**Complexity**: Medium

**Requirements**:
- FR-004.1: Implement GameStateService for coordination
  - **NOT a monolithic state Ref**
  - Service-specific Refs: PlayerService.Ref, WorldService.Ref, TimingState.Ref
  - Coordination methods only

- FR-004.2: Define TimingState Ref
  - `lastFrameTime: number`
  - `deltaTime: number`
  - `frameCount: number`

- FR-004.3: Implement coordination methods
  - `update(deltaTime)` - Trigger all service updates
  - `getTime()` - Get timing state snapshot
  - `getPlayerPosition()` - Delegate to PlayerService
  - `getWorldBlocks()` - Delegate to WorldService

**State Distribution**:
```
PlayerService → Ref<PlayerState>
WorldService → Ref<WorldState>
TimingState → Ref<TimingState> (in GameStateService)
```

**Acceptance Criteria**:
- ✅ Each service manages its own Ref
- ✅ GameStateService coordinates, not owns state
- ✅ Timing state tracked accurately

**Test Coverage**: 80%+ (coordination logic)

---

### FR-005: Flat Terrain Generation (Mandatory)
**Priority**: High
**Day**: 3
**Complexity**: Low-Medium

**Requirements**:
- FR-005.1: Create TerrainService in src/application/terrain/
  - `generateFlatWorld(worldId, size)` - Generate flat plane
  - Fill y=0 plane with blocks (e.g., 20x20 grid)
  - Use GRASS or DIRT block types

- FR-005.2: No chunk system in Phase 3
  - Simple coordinate iteration
  - Direct WorldService.addBlock calls
  - Chunk system deferred to Phase 6

- FR-005.3: Terrain is static for Phase 3
  - Generated once at startup
  - No dynamic loading/unloading
  - No procedural generation yet

**Acceptance Criteria**:
- ✅ Flat terrain appears at y=0
- ✅ All blocks are visible in scene
- ✅ Performance acceptable for 400 blocks (20x20)

**Test Coverage**: 85%+ (terrain generation deterministic)

---

### FR-006: World Rendering Integration (Mandatory)
**Priority**: High
**Day**: 3-4
**Complexity**: Medium-High

**Requirements**:
- FR-006.1: Create WorldRendererService in src/infrastructure/three/
  - `syncWorld(worldId, scene)` - Synchronize world state to scene
  - `updateBlockMesh(position, blockType, scene)` - Update single block mesh
  - `removeBlockMesh(position, scene)` - Remove block mesh

- FR-006.2: Define synchronization strategy
  - Read blocks from WorldService.Ref
  - Create Three.js meshes using BlockMeshService
  - Add meshes to scene via SceneService
  - Cache created meshes for updates

- FR-006.3: Performance considerations
  - Don't recreate meshes every frame
  - Only update changed blocks
  - Use existing BlockMeshService (don't duplicate)

**Interface**:
```typescript
interface WorldRendererService {
  readonly syncWorld: (
    worldId: WorldId,
    scene: THREE.Scene
  ) => Effect.Effect<void, WorldError>

  readonly updateBlock: (
    position: Position,
    blockType: BlockType,
    scene: THREE.Scene
  ) => Effect.Effect<void, never>

  readonly removeBlock: (
    position: Position,
    scene: THREE.Scene
  ) => Effect.Effect<void, never>
}
```

**Acceptance Criteria**:
- ✅ World blocks appear in Three.js scene
- ✅ Block changes reflect in rendering
- ✅ No memory leaks (mesh cleanup works)

**Test Coverage**: 75%+ (integration with Three.js mocks)

---

### FR-007: Camera Follow System (Mandatory)
**Priority**: High
**Day**: 4
**Complexity**: Medium

**Requirements**:
- FR-007.1: Extend PerspectiveCameraService with follow methods
  - `setPosition(camera, position)` - Set camera position
  - `lookAt(camera, target)` - Point camera at target
  - `smoothFollow(camera, target, offset, lerpFactor)` - Smooth interpolation

- FR-007.2: Implement Lerp interpolation
  ```typescript
  // Lerp formula:
  camera.position.x += (target.x - camera.position.x) * lerpFactor
  camera.position.y += (target.y - camera.position.y) * lerpFactor
  camera.position.z += (target.z - camera.position.z) * lerpFactor

  // Recommended lerpFactor: 0.1 (smooth but responsive)
  ```

- FR-007.3: Camera offset configuration
  - Default offset: { x: 0, y: 5, z: 10 } (third-person view)
  - Look at player position
  - Update every frame

**Acceptance Criteria**:
- ✅ Camera follows player smoothly
- ✅ No jitter or lag in camera movement
- ✅ Configurable offset and lerp factor

**Test Coverage**: 75%+ (interpolation math, Three.js mocks)

---

### FR-008: Main Integration (Mandatory)
**Priority**: High
**Day**: 5
**Complexity**: High

**Requirements**:
- FR-008.1: Refactor src/main.ts to use new architecture
  - Remove old requestAnimationFrame loop
  - Use GameLoopService instead
  - Wire up all services in Layer.mergeAll

- FR-008.2: Service initialization sequence
  1. Create PlayerService
  2. Create WorldService
  3. Generate flat terrain
  4. Create WorldRendererService
  5. Start GameLoopService
  6. Initialize camera follow

- FR-008.3: Preserve existing functionality
  - FPS counter continues to work
  - Object pooling remains in place
  - Lighting setup unchanged

**Acceptance Criteria**:
- ✅ All services integrated in main.ts
- ✅ Game loop starts and runs
- ✅ Player moves automatically (test code)
- ✅ Camera follows player
- ✅ Flat terrain visible

**Test Coverage**: Integration tests (browser testing)

---

### FR-009: Test Coverage (Mandatory)
**Priority**: High
**Day**: 6
**Complexity**: Medium

**Requirements**:
- FR-009.1: Achieve 70% test coverage (adjusted from 80%)
  - Domain entities: 85%+ (Player, World)
  - Services: 70%+ (PlayerService, WorldService, GameLoopService)
  - Integration: 75%+ (WorldRenderer, Camera)

- FR-009.2: Test file structure
  - `src/domain/player.test.ts`
  - `src/domain/world.test.ts`
  - `src/application/game-loop.test.ts`
  - `src/application/game-state.test.ts`
  - `src/infrastructure/three/world-renderer.test.ts`
  - `src/infrastructure/three/camera/perspective.test.ts` (extended)

- FR-009.3: Integration test strategy
  - Mock Effect.Clock for time-dependent tests
  - Use existing test/helpers/three-mocks.ts for Three.js
  - Test game loop with limited iterations (3-5 frames)

**Acceptance Criteria**:
- ✅ All test files created
- ✅ 70%+ coverage achieved
- ✅ Integration tests pass
- ✅ No test flakiness

**Test Coverage Target**: 70%+ (realistic for 6-day timeline)

---

### FR-010: Error Handling (Mandatory)
**Priority**: Medium
**Day**: 1-2
**Complexity**: Low

**Requirements**:
- FR-010.1: Define error types in src/domain/errors.ts
  ```typescript
  export class PlayerError extends Error {
    readonly _tag = 'PlayerError'
    readonly playerId: PlayerId
    readonly reason: string
  }

  export class WorldError extends Error {
    readonly _tag = 'WorldError'
    readonly worldId: WorldId
    readonly reason: string
  }

  export class GameLoopError extends Error {
    readonly _tag = 'GameLoopError'
    readonly reason: string
  }
  ```

- FR-010.2: Game loop error recovery
  - Wrap command processing in Effect.catchAll
  - Log error and continue to next frame
  - Don't let single frame error crash loop

**Acceptance Criteria**:
- ✅ All error types defined
- ✅ Errors are typed and catchable
- ✅ Game loop recovers from errors

**Test Coverage**: 85%+ (error cases)

---

## Non-Functional Requirements

### NFR-001: Performance (Mandatory)
**Target**: 60 FPS with 400 blocks (20x20 flat terrain)

**Requirements**:
- Frame time < 16.67ms
- No garbage collection pauses
- Smooth camera interpolation

**Metrics**:
- FPS counter shows 58-62 FPS
- Frame time variance < 5ms
- No visible stuttering

---

### NFR-002: Maintainability (Mandatory)
**Requirements**:
- Follow existing Effect-TS patterns
- Service-specific Refs (not monolithic)
- Clear separation of concerns (Domain/App/Infra)
- 70%+ test coverage

---

### NFR-003: Scalability (Optional)
**Note**: Phase 3 uses simple approach, scalability deferred to Phase 6

**Phase 3 Approach**:
- Simple Map storage (no chunks)
- Naive mesh creation (no optimization)
- Single flat plane (no culling)

---

## Technical Specifications

### Design Policies

#### Policy 1: Service-Specific Refs
**Decision**: Each service manages its own Ref, not monolithic GameState Ref

**Rationale**:
- Follows existing BlockRegistry pattern
- Better testability (services can be tested independently)
- Aligns with Single Responsibility Principle
- Easier evolution to Phase 4+ (Physics, Input)

**Implementation**:
```typescript
// PlayerService
const playerStateRef = yield* Ref.make<PlayerStateMap>({})

// WorldService
const worldStateRef = yield* Ref.make<WorldStateMap>({})

// GameStateService (coordination only)
const timingStateRef = yield* Ref.make<TimingState>({
  lastFrameTime: 0,
  deltaTime: 0,
  frameCount: 0
})
```

---

#### Policy 2: Queue-Based Game Loop
**Decision**: Use Effect.Queue to bridge requestAnimationFrame with Effect

**Rationale**:
- Preserves Effect composition (no Effect.runSync in hot path)
- Testable (can mock queue)
- Aligns with Effect-TS reactive patterns
- Frame-accurate timing from requestAnimationFrame

**Implementation**:
```typescript
// Bridge: requestAnimationFrame → Effect.Queue
const frameQueue = yield* Queue.bounded<FrameCommand>(60)

const bridgeLoop = () => {
  const now = performance.now()
  Effect.runPromise(
    Queue.offer(frameQueue, {
      _tag: 'Render',
      deltaTime: 0,
      payload: now
    })
  )
  requestAnimationFrame(bridgeLoop)
}

// Processing: Effect.Queue → Game Logic
const processingFiber = yield* Effect.fork(
  Effect.forever(
    Effect.gen(function* () {
      const cmd = yield* Queue.take(frameQueue)
      yield* processFrameCommand(cmd).pipe(
        Effect.catchAll((error) => Effect.logError(error))
      )
    })
  )
)
```

---

#### Policy 3: Directory Structure
**Decision**: Create src/application/ for game coordination services

**Structure**:
```
src/
├── application/              # NEW: Application Layer
│   ├── game-loop.ts         # GameLoopService
│   ├── game-state.ts        # GameStateService
│   ├── terrain/             # NEW: Terrain generation
│   │   ├── flat.ts         # Flat terrain service
│   │   └── index.ts
│   └── index.ts
├── domain/
│   ├── player.ts            # NEW: Player entity + service
│   ├── world.ts             # NEW: World aggregate + service
│   ├── errors.ts            # EXTENDED: Add PlayerError, WorldError
│   └── index.ts
├── infrastructure/
│   └── three/
│       ├── world-renderer.ts # NEW: WorldRendererService
│       ├── camera/
│       │   └── perspective.ts # EXTENDED: Add smoothFollow
│       └── index.ts
├── presentation/
│   └── fps-counter.ts       # Existing (preserve)
└── main.ts                  # EXTENDED: Integrate all services
```

**Rationale**:
- Clear separation: Domain → Application → Infrastructure
- Follows DDD Lite principles
- Application layer coordinates, doesn't own state

---

#### Policy 4: Test Strategy
**Decision**: 70% coverage with integration test focus

**Rationale**:
- 80%+ unrealistic for 6-day timeline with new architecture
- 70% with strong integration tests provides better value
- Integration tests catch more bugs than unit tests alone

**Test Distribution**:
- Domain entities: 85%+ (pure logic, easy to test)
- Services: 70%+ (Ref management, some complexity)
- Integration: 75%+ (Three.js mocks, game loop)
- Error cases: 85%+ (comprehensive error handling)

---

### Impact Scope

**New Files**: 9 files
- src/domain/player.ts
- src/domain/world.ts
- src/application/game-loop.ts
- src/application/game-state.ts
- src/application/terrain/flat.ts
- src/infrastructure/three/world-renderer.ts
- src/domain/errors.ts (extended)
- src/infrastructure/three/camera/perspective.ts (extended)
- src/main.ts (refactored)

**Modified Files**: 2 files
- src/domain/errors.ts
- src/main.ts

**Test Files**: 6 new test files

---

### Design Decisions

#### Decision 1: Camera Extension vs New Service
**Choice**: Extend existing PerspectiveCameraService

**Alternatives Considered**:
1. ✅ **Extend PerspectiveCameraService** (CHOSEN)
   - Pros: Keeps camera logic centralized, simpler
   - Cons: Service becomes larger

2. ❌ Create separate CameraControllerService
   - Pros: Better separation of concerns
   - Cons: More services, more complexity

**Rationale**: Simplicity wins for Phase 3; can refactor later if needed

---

#### Decision 2: Terrain Approach
**Choice**: Single flat plane, no chunks

**Alternatives Considered**:
1. ✅ **Single flat plane** (CHOSEN)
   - Pros: Simple, fast to implement
   - Cons: Doesn't prepare for Phase 6 chunks

2. ❌ Basic chunk structure
   - Pros: Prepares for Phase 6
   - Cons: Adds 2-3 days to timeline

**Rationale**: Phase 6 will introduce chunks properly; keep Phase 3 simple

---

#### Decision 3: State Management
**Choice**: Service-specific Refs

**Alternatives Considered**:
1. ✅ **Service-specific Refs** (CHOSEN)
   - Pros: Testable, follows existing patterns, SRP
   - Cons: Coordination complexity

2. ❌ Monolithic GameState Ref
   - Pros: Easy to snapshot/save
   - Cons: Violates SRP, hard to test services independently

**Rationale**: Aligns with existing BlockRegistry pattern and DDD principles

---

## Constraints

### Technical Constraints
1. **Effect-TS Version**: Must use Effect 3.19.19
2. **Three.js Version**: Must use Three.js 0.170.0
3. **TypeScript Version**: Must use TypeScript 5.9.3
4. **No STM**: Use Ref only (STM introduced in later phases)
5. **No Chunks**: Simple Map storage only (Phase 6 introduces chunks)

### Operational Constraints
1. **Timeline**: 6 days maximum
2. **Test Coverage**: 70% minimum (realistic target)
3. **Performance**: 60 FPS target with 400 blocks
4. **Browser Support**: Chrome, Firefox, Safari (latest)

---

## Test Requirements

### Unit Tests
- **Player Entity**: Creation, position updates, validation (85%+ coverage)
- **World Aggregate**: Block operations, coordinate mapping (85%+ coverage)
- **Services**: Ref management, error handling (70%+ coverage)
- **Error Types**: All error cases covered (85%+ coverage)

### Integration Tests
- **Game Loop**: Frame processing, queue pattern, error recovery (75%+ coverage)
- **WorldRenderer**: World→Scene synchronization, mesh updates (75%+ coverage)
- **Camera Follow**: Interpolation, smooth following (75%+ coverage)

### Browser Tests
- **FPS Counter**: Verify 60 FPS target
- **Visual Output**: Flat terrain visible, camera follows player
- **Performance**: No stuttering, smooth animation

---

## Outstanding Issues

### Resolved Issues
1. ✅ **Error Domain Definitions**: PlayerError, WorldError, GameLoopError added
2. ✅ **Game Loop Architecture**: Queue-based pattern specified
3. ✅ **Directory Structure**: src/application/ confirmed
4. ✅ **Test Coverage**: Adjusted to 70% (realistic)
5. ✅ **State Contracts**: PlayerState, WorldState, TimingState defined
6. ✅ **ClockService**: Added to requirements
7. ✅ **Integration Test Strategy**: Mock patterns defined

### Remaining Considerations
1. **Performance Validation**: Need browser testing to verify 60 FPS (Day 5)
2. **Player Movement**: Phase 3 uses automated test movement (no user input until Phase 4)
3. **Physics Integration**: cannon-es in dependencies but not used in Phase 3

---

## Task Breakdown

### Dependency Graph
```
Day 1: Player & World Domain (Foundation)
  ↓
Day 2: Game Loop & State (Coordination)
  ↓
Day 3: Terrain & Rendering (Visual Output)
  ↓
Day 4: Camera Follow (User Experience)
  ↓
Day 5: Integration (System Cohesion)
  ↓
Day 6: Testing & Polish (Quality Assurance)
```

### Phase 1: Player & World Domain (Day 1) - 8-10 hours

**Files**:
- src/domain/player.ts (NEW)
- src/domain/world.ts (NEW)
- src/domain/errors.ts (EXTENDED)
- src/domain/player.test.ts (NEW)
- src/domain/world.test.ts (NEW)

**Overview**:
- Define PlayerError, WorldError in errors.ts
- Create Player entity with Schema validation
- Implement PlayerService with Ref-based state
- Create World aggregate with Map storage
- Implement WorldService with Ref-based state
- Write comprehensive tests for both entities

**Dependencies**: None (foundation layer)

**Acceptance Criteria**:
- ✅ Player and World entities defined
- ✅ Services follow BlockRegistry pattern
- ✅ Error types comprehensive
- ✅ Tests pass with 85%+ coverage

---

### Phase 2: Game Loop & State (Day 2) - 10-12 hours

**Files**:
- src/application/game-loop.ts (NEW)
- src/application/game-state.ts (NEW)
- src/shared/clock-service.ts (NEW, optional)
- src/application/game-loop.test.ts (NEW)
- src/application/game-state.test.ts (NEW)

**Overview**:
- Create src/application/ directory
- Implement Queue-based game loop pattern
- Define FrameCommand types
- Implement GameLoopService with Queue + Fiber
- Create GameStateService for coordination
- Add ClockService wrapper (or use Effect.Clock directly)
- Write tests with mocked time source

**Dependencies**: Day 1 complete (needs Player/World services)

**Acceptance Criteria**:
- ✅ Game loop runs at ~60 FPS
- ✅ Queue pattern implemented correctly
- ✅ Effect composition preserved
- ✅ Error recovery works
- ✅ Tests pass with 70%+ coverage

---

### Phase 3: Terrain & Rendering (Day 3) - 10-14 hours

**Files**:
- src/application/terrain/flat.ts (NEW)
- src/application/terrain/index.ts (NEW)
- src/infrastructure/three/world-renderer.ts (NEW)
- src/infrastructure/three/world-renderer.test.ts (NEW)

**Overview**:
- Create TerrainService for flat terrain generation
- Generate 20x20 flat plane at y=0
- Implement WorldRendererService
- Define World→Scene synchronization strategy
- Integrate with existing BlockMeshService
- Write integration tests with Three.js mocks

**Dependencies**: Days 1-2 complete (needs World and GameLoop)

**Acceptance Criteria**:
- ✅ Flat terrain generated at startup
- ✅ Blocks appear in Three.js scene
- ✅ WorldRenderer syncs state to scene
- ✅ Tests pass with 75%+ coverage

---

### Phase 4: Camera Follow (Day 4) - 7-9 hours

**Files**:
- src/infrastructure/three/camera/perspective.ts (EXTENDED)
- src/infrastructure/three/camera/perspective.test.ts (EXTENDED)

**Overview**:
- Extend PerspectiveCameraService with follow methods
- Implement setPosition, lookAt, smoothFollow
- Add Lerp interpolation logic
- Integrate with GameStateService
- Update camera every frame
- Write tests with Three.js mocks

**Dependencies**: Days 1-3 complete (needs Player position)

**Acceptance Criteria**:
- ✅ Camera follows player smoothly
- ✅ Lerp interpolation works
- ✅ Configurable offset and lerp factor
- ✅ Tests pass with 75%+ coverage

---

### Phase 5: Integration (Day 5) - 8-12 hours

**Files**:
- src/main.ts (REFACTORED)
- src/application/index.ts (NEW, exports)

**Overview**:
- Refactor main.ts to use new architecture
- Remove old requestAnimationFrame loop
- Wire up all services in Layer.mergeAll
- Initialize player with automated movement (test code)
- Generate flat terrain
- Start game loop
- Set up camera follow
- Browser testing and performance validation
- Verify 60 FPS target

**Dependencies**: Days 1-4 complete (all services ready)

**Acceptance Criteria**:
- ✅ All services integrated
- ✅ Game loop runs correctly
- ✅ Player moves automatically (test code)
- ✅ Camera follows player
- ✅ Flat terrain visible
- ✅ 58-62 FPS in browser
- ✅ No stuttering or lag

---

### Phase 6: Testing & Polish (Day 6) - 10-14 hours

**Files**:
- All test files (COMPLETED)
- docs/explanations/game-mechanics/core-features/game-loop-system.md (OPTIONAL)

**Overview**:
- Complete test coverage to 70%+
- Run all tests and verify passing
- Integration tests for game loop timing
- Integration tests for state transitions
- Integration tests for rendering
- Final acceptance criteria verification
- Performance profiling
- Code cleanup and documentation

**Dependencies**: Days 1-5 complete

**Acceptance Criteria**:
- ✅ 70%+ test coverage achieved
- ✅ All tests passing
- ✅ No flaky tests
- ✅ All Phase 3 acceptance criteria met
- ✅ Code is clean and documented

---

## Execute Handoff

### Key Decisions for Implementation
1. **Use Queue-based game loop** (not Effect.gen with while loop)
2. **Service-specific Refs** (not monolithic GameState)
3. **Create src/application/ directory** for coordination services
4. **Extend PerspectiveCameraService** (not separate controller)
5. **Single flat plane terrain** (no chunks until Phase 6)
6. **70% test coverage** (realistic for timeline)

### Reference Files
- **Pattern to Follow**: src/domain/blockRegistry.ts (Ref-based service)
- **Test Pattern**: src/domain/block.test.ts, src/presentation/fps-counter.test.ts
- **Architecture Guide**: docs/explanations/architecture/ddd-architecture.md
- **Phase Spec**: phase/03-game-loop.md

### Constraints to Enforce
1. **No breaking changes** to existing services (BlockRegistry, FPSCounter, etc.)
2. **Preserve existing functionality** in main.ts (FPS counter, object pooling, lighting)
3. **Follow Effect-TS patterns** strictly (Context.GenericTag, Layer.effect, Ref)
4. **No STM usage** (use Ref only)
5. **No chunk system** (deferred to Phase 6)

### Testing Requirements
1. **Mock Effect.Clock** for time-dependent tests
2. **Use test/helpers/three-mocks.ts** for Three.js integration
3. **Test game loop with limited iterations** (3-5 frames)
4. **Browser testing** for performance validation (60 FPS)

---

## Self-Feedback

### Confidence Score: 87/100

**Calculation**:
- Requirement Clarity: 95/100 (comprehensive, detailed specs)
- Technical Feasibility: 90/100 (proven patterns, realistic timeline)
- Stakeholder Alignment: 90/100 (all user choices incorporated)
- Feedback Incorporation: 95/100 (all critical issues addressed)

**Weighted Average**: (95×0.3) + (90×0.25) + (90×0.2) + (95×0.25) = 92.5 → Adjusted to 87/100 for integration risk

---

### Feedback Addressed

#### Critical Issues (All Addressed)
1. ✅ **Error Domain Definitions**
   - **Issue**: Missing PlayerError, WorldError
   - **Resolution**: Added to FR-010 with comprehensive error types
   - **Impact**: Error handling now complete

2. ✅ **Game Loop Architecture**
   - **Issue**: Queue pattern not specified
   - **Resolution**: Detailed in FR-003 with code example
   - **Impact**: Clear implementation path

3. ✅ **Directory Structure**
   - **Issue**: Ambiguity between src/rendering/ and src/application/
   - **Resolution**: All new services go in src/application/ (Policy 3)
   - **Impact**: Consistent architecture

4. ✅ **Test Coverage**
   - **Issue**: 80%+ unrealistic
   - **Resolution**: Adjusted to 70% with strong integration tests (FR-009)
   - **Impact**: Realistic timeline

#### Warnings (All Addressed)
1. ✅ **Service Ref State Contracts**
   - **Resolution**: PlayerState, WorldState, TimingState defined (FR-004)

2. ✅ **WorldRendererService**
   - **Resolution**: Interface and strategy defined (FR-006)

3. ✅ **Camera Interpolation**
   - **Resolution**: Lerp formula with parameters specified (FR-007)

4. ✅ **ClockService**
   - **Resolution**: Added to requirements (FR-003.4)

5. ✅ **Error Handling**
   - **Resolution**: Game loop recovery wrapper defined (FR-003.3)

6. ✅ **Integration Test Strategy**
   - **Resolution**: Mock patterns and scenarios defined (FR-009.3)

---

### Remaining Issues

#### Low Priority (Can Address During Implementation)
1. **Physics Integration**: cannon-es in dependencies but not used in Phase 3 (deferred to Phase 4)
2. **Player Input**: Phase 3 uses automated test movement (Phase 4 adds InputService)
3. **Performance Profiling**: Day 5 browser testing will validate 60 FPS target
4. **Mesh Optimization**: Simple approach for Phase 3 (Phase 6 adds greedy meshing)

#### No Remaining Blockers
All critical and warning issues from feedback have been addressed. Requirements are ready for /execute.

---

## Summary

This requirements specification provides a complete, actionable plan for Phase 3 implementation with:

- **Clear Acceptance Criteria**: All deliverables are testable and verifiable
- **Realistic Timeline**: 6 days with appropriate buffer for complexity
- **Proven Patterns**: Follows existing Effect-TS and DDD architecture
- **Comprehensive Testing**: 70%+ coverage with integration test focus
- **All Feedback Incorporated**: Critical issues and warnings resolved

**Ready for Execution**: ✅

**Next Step**: Use `/execute` command to begin implementation

---

**Generated by**: Claude Code
**Methodology**: /define-full with feedback loop
**Confidence**: 87/100
**Date**: 2026-02-24
