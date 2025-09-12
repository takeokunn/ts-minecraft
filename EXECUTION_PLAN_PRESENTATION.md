# Presentation Layer Refactoring Execution Plan

## Overview
Complete refactoring of the presentation layer to achieve:
- 100% Effect-TS compliance
- Proper naming conventions
- Complete test coverage (100%)
- Removal of all unused/deprecated code
- No classes (already achieved ✅)

## Phase 1: Critical Bug Fixes (Immediate)
**Can be executed in parallel by sub-agents**

### Task 1.1: Fix Invalid Import Error
- **File**: `src/presentation/cli/debugger.ts`
- **Line**: 21
- **Issue**: `import { World } from '@presentation/entities'` (directory doesn't exist)
- **Fix**: Change to `import { World } from '@domain/entities'`
- **Priority**: CRITICAL
- **Estimated Time**: 5 minutes

### Task 1.2: Remove Unused PerformanceProfiler Export
- **File**: `src/presentation/cli/performance-profiler.ts`
- **Check**: Verify if `PerformanceProfiler` constant is used elsewhere
- **Action**: If unused, remove export and update all imports to use `createPerformanceProfiler`
- **Priority**: HIGH
- **Estimated Time**: 15 minutes

## Phase 2: Naming Convention Fixes
**Can be executed in parallel by sub-agents**

### Task 2.1: Rename View Model Files
- **Files to rename**:
  - `src/presentation/view-models/game-state.vm.ts` → `game-state.view-model.ts`
  - `src/presentation/view-models/player-status.vm.ts` → `player-status.view-model.ts`
  - `src/presentation/view-models/world-info.vm.ts` → `world-info.view-model.ts`
- **Update imports**: Update all files importing these modules
- **Priority**: MEDIUM
- **Estimated Time**: 20 minutes

## Phase 3: Effect-TS Compliance
**Can be executed in parallel by sub-agents**

### Task 3.1: Standardize Debug Controller Syntax
- **File**: `src/presentation/controllers/debug.controller.ts`
- **Lines**: 24-112
- **Issue**: Mixed old `yield* $(...)` and new `yield*` syntax
- **Fix**: Convert to consistent modern Effect-TS syntax
- **Priority**: MEDIUM
- **Estimated Time**: 30 minutes

### Task 3.2: Convert Config to Effect-TS
- **File**: `src/presentation/cli/config.ts`
- **Functions to convert**:
  - `getDevToolsConfig()` → Return `Effect<DevToolsConfig, ConfigError, never>`
  - `loadDevToolsConfig()` → Return `Effect<Partial<DevToolsConfig>, ConfigError, never>`
  - `setDevToolsConfig()` → Return `Effect<void, ConfigError, never>`
- **Priority**: MEDIUM
- **Estimated Time**: 45 minutes

### Task 3.3: Wrap Browser APIs in Effect
- **Files**: All view models
- **APIs to wrap**:
  - `performance.memory` access
  - `localStorage` operations
  - `Date.now()` calls
- **Create**: `src/presentation/services/browser-api.service.ts`
- **Priority**: LOW
- **Estimated Time**: 1 hour

## Phase 4: Test Implementation
**Sequential execution recommended for consistency**

### Task 4.1: Create Test Infrastructure
- **Create**: `src/presentation/__tests__/setup.ts`
- **Configure**: Test utilities and mocks for Effect-TS
- **Priority**: HIGH
- **Estimated Time**: 30 minutes

### Task 4.2: Controller Tests
- **Create tests for**:
  - `src/presentation/controllers/__tests__/game.controller.test.ts`
  - `src/presentation/controllers/__tests__/ui.controller.test.ts`
  - `src/presentation/controllers/__tests__/debug.controller.test.ts`
- **Coverage target**: 100%
- **Priority**: HIGH
- **Estimated Time**: 2 hours

### Task 4.3: View Model Tests
- **Create tests for**:
  - `src/presentation/view-models/__tests__/game-state.view-model.test.ts`
  - `src/presentation/view-models/__tests__/player-status.view-model.test.ts`
  - `src/presentation/view-models/__tests__/world-info.view-model.test.ts`
- **Coverage target**: 100%
- **Priority**: HIGH
- **Estimated Time**: 2 hours

### Task 4.4: CLI Tools Tests
- **Create tests for each CLI tool**:
  - `debugger.test.ts`
  - `performance-profiler.test.ts`
  - `dev-console.test.ts`
  - `entity-inspector.test.ts`
  - `world-editor.test.ts`
  - `network-inspector.test.ts`
  - `hot-reload.test.ts`
  - `state-debugger.test.ts`
  - `command-palette.test.ts`
  - `dev-tools-manager.test.ts`
  - `config.test.ts`
- **Coverage target**: 100%
- **Priority**: MEDIUM
- **Estimated Time**: 4 hours

### Task 4.5: Integration Tests
- **Create**: `src/presentation/__tests__/integration/`
- **Tests**:
  - Controller integration with application layer
  - View model data flow
  - CLI tools coordination
- **Priority**: MEDIUM
- **Estimated Time**: 2 hours

## Phase 5: Code Cleanup
**Can be executed in parallel after Phase 1-3**

### Task 5.1: Remove Unused Exports
- **Analyze**: All exports from `src/presentation/index.ts`
- **Check**: Usage in other layers
- **Remove**: Unused exports
- **Priority**: LOW
- **Estimated Time**: 30 minutes

### Task 5.2: Remove Dead Code
- **Scan**: All presentation files for unused functions/types
- **Remove**: Dead code paths
- **Priority**: LOW
- **Estimated Time**: 1 hour

## Phase 6: Vitest Configuration

### Task 6.1: Create Vitest Config
- **Create**: `vitest.presentation.config.ts`
```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    name: 'presentation',
    include: ['src/presentation/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/presentation/**/*.ts'],
      exclude: [
        'src/presentation/**/*.test.ts',
        'src/presentation/**/__tests__/**',
        'src/presentation/**/index.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    environment: 'jsdom',
    setupFiles: ['./src/presentation/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@presentation': resolve(__dirname, './src/presentation'),
      '@application': resolve(__dirname, './src/application'),
      '@domain': resolve(__dirname, './src/domain'),
      '@infrastructure': resolve(__dirname, './src/infrastructure'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
})
```

## Parallel Execution Strategy

### Group A (Bug Fixes & Naming)
- Task 1.1: Fix invalid import
- Task 1.2: Remove unused export
- Task 2.1: Rename view model files

### Group B (Effect-TS Compliance)
- Task 3.1: Debug controller syntax
- Task 3.2: Config Effect conversion
- Task 3.3: Browser API wrapping

### Group C (Testing - Sequential)
- Task 4.1-4.5: All test implementation

### Group D (Cleanup)
- Task 5.1: Remove unused exports
- Task 5.2: Remove dead code

## Success Metrics
- ✅ No TypeScript errors
- ✅ 100% test coverage
- ✅ All files follow naming conventions
- ✅ All code is Effect-TS compliant
- ✅ No unused exports or dead code
- ✅ No classes (already achieved)

## Estimated Total Time
- Phase 1: 20 minutes
- Phase 2: 20 minutes
- Phase 3: 2.25 hours
- Phase 4: 10.5 hours
- Phase 5: 1.5 hours
- Phase 6: 30 minutes

**Total: ~15 hours** (can be reduced to ~8 hours with parallel execution)

## Commands to Run After Completion
```bash
# Type checking
npm run typecheck

# Run tests with coverage
npm run test:presentation -- --coverage

# Lint check
npm run lint

# Build verification
npm run build
```

## Notes
- All tasks maintain backward compatibility where possible
- Focus on functional programming patterns
- Ensure proper error handling with Effect-TS
- Document any breaking changes