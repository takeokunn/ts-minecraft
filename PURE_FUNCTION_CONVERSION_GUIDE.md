# Pure Function Conversion Guide for TypeScript Minecraft

This guide documents the conversion of impure functions to pure functions using Effect-TS patterns in the TypeScript Minecraft project with DDD architecture.

## Overview of Changes Made

### 1. Identified and Fixed Impure Patterns

#### Console.log Statements
**Before:**
```typescript
console.log('🏗️ World Editor opened')
console.log(`Placing ${blockType} at (${position.x}, ${position.y}, ${position.z})`)
console.warn('Configuration validation failed:', error)
```

**After:**
```typescript
import { Logger } from '@shared/utils/logging'

yield* Logger.info('World Editor opened', 'WorldEditor')
yield* Logger.debug('Block placement', 'WorldEditor', { blockType, position })
yield* Logger.error('Configuration validation failed', 'Config', error)
```

#### Random Number Generation
**Before:**
```typescript
const seed = Math.random().toString(36).substring(7)
const timestamp = Date.now()
```

**After:**
```typescript
import { Effect, Random, Clock } from 'effect'

const generateSeed = Effect.map(
  Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER), 
  (n) => n.toString(36)
)
const timestamp = yield* Clock.currentTimeMillis
```

#### Performance Measurement
**Before:**
```typescript
const startTime = performance.now()
// ... operations
const duration = performance.now() - startTime
```

**After:**
```typescript
import { Clock } from 'effect'

const startTime = yield* Clock.currentTimeNanos
// ... operations  
const endTime = yield* Clock.currentTimeNanos
const duration = Number(endTime - startTime) / 1_000_000 // Convert to milliseconds
```

#### Mutable State
**Before:**
```typescript
let config = initialConfig
function updateConfig(newConfig) {
  Object.assign(config, newConfig)
  return config
}
```

**After:**
```typescript
import { Ref } from 'effect'

export const createConfigRef = (): Effect.Effect<Ref.Ref<ApplicationConfiguration>, ConfigValidationError, never> =>
  Effect.gen(function* () {
    const initialConfig = yield* createConfiguration()
    return yield* Ref.make(initialConfig)
  })

export const updateConfig = (configRef: Ref.Ref<ApplicationConfiguration>, newConfig: Partial<ApplicationConfiguration>) =>
  Ref.update(configRef, (current) => ({ ...current, ...newConfig }))
```

### 2. Key Conversion Patterns Applied

#### Pattern 1: Replace Direct Side Effects with Effect Wrappers

**Random Generation:**
```typescript
// Before: impure
const generateId = () => `id_${Math.random().toString(36).substring(2, 9)}`

// After: pure with Effect
const generateId = Effect.map(
  Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER),
  (n) => `id_${n.toString(36)}`
)
```

**Time Operations:**
```typescript
// Before: impure
const createTimestamp = () => Date.now()

// After: pure with Effect
const createTimestamp = Clock.currentTimeMillis
```

#### Pattern 2: Mutable State to Immutable Ref

**State Management:**
```typescript
// Before: mutable class
class ConfigManager {
  private config: Config
  
  updateConfig(updates: Partial<Config>) {
    this.config = { ...this.config, ...updates }
  }
}

// After: immutable with Ref
const createConfigManager = () =>
  Effect.gen(function* () {
    const configRef = yield* Ref.make(initialConfig)
    
    const updateConfig = (updates: Partial<Config>) =>
      Ref.update(configRef, (current) => ({ ...current, ...updates }))
    
    const getConfig = () => Ref.get(configRef)
    
    return { updateConfig, getConfig }
  })
```

#### Pattern 3: Console Logging to Structured Logging

**Logging Service Usage:**
```typescript
// Before: direct console calls
console.log('Operation started')
console.error('Failed with:', error)

// After: structured Effect logging
yield* Logger.info('Operation started', 'ComponentName')
yield* Logger.error('Operation failed', 'ComponentName', error, { operationId })
```

#### Pattern 4: Error Handling with Effect

**Error Management:**
```typescript
// Before: throw/try-catch
function validateData(data: unknown) {
  if (!data) throw new Error('No data provided')
  return data as ValidData
}

// After: Effect-based error handling
const validateData = (data: unknown): Effect.Effect<ValidData, ValidationError, never> =>
  data 
    ? Effect.succeed(data as ValidData)
    : Effect.fail(new ValidationError({ message: 'No data provided' }))
```

### 3. Files Modified

1. **Game Controller** (`src/presentation/controllers/game.controller.ts`)
   - Replaced `Math.random()` with `Random.nextIntBetween`
   - Replaced `Date.now()` with `Clock.currentTimeMillis`

2. **Mesh Generation Service** (`src/domain/services/mesh-generation.service.ts`)
   - Replaced `performance.now()` with `Clock.currentTimeNanos`
   - Added proper timing calculations

3. **Configuration Utils** (`src/config/config-utils.ts`)
   - Converted mutable configuration to `Ref`-based state management
   - Replaced console logging with Effect logging
   - Made all functions pure with proper Effect types

4. **Logging Service** (`src/shared/utils/logging.ts`)
   - Fixed `performance.now()` usage in performance measurement helpers
   - Made timestamp creation pure with `Clock.currentTimeMillis`

5. **World Editor** (`src/presentation/cli/world-editor.ts`)
   - Replaced all `console.log` statements with structured logging
   - Fixed `Date.now()` usage with `Clock.currentTimeMillis`

### 4. Effect Dependencies Added

The following Effect dependencies were added where needed:

- `Clock.Clock` - for time operations
- `Random.Random` - for random generation  
- `never` - for pure operations with no dependencies

### 5. Benefits of the Conversion

1. **Testability**: All functions are now pure and easily testable
2. **Composability**: Functions can be safely composed using Effect combinators
3. **Error Handling**: Proper error handling with typed errors
4. **Resource Safety**: Automatic resource management through Effect
5. **Concurrency**: Safe concurrent execution with Effect fibers
6. **Logging**: Structured, configurable logging instead of console output
7. **Deterministic**: Random operations are controlled and reproducible in tests

### 6. Usage Examples

#### Using the Updated Services

```typescript
import { Effect, Layer } from 'effect'
import { GameController } from '@presentation/controllers/game.controller'
import { Logger } from '@shared/utils/logging'

// Initialize a game world
const initializeGame = Effect.gen(function* () {
  const gameController = yield* GameController
  yield* gameController.initializeWorld('test-seed')
  yield* Logger.info('Game initialized successfully', 'GameApp')
})

// Run the effect with required services
const program = Effect.provide(initializeGame, GameControllerLive)
Effect.runPromise(program)
```

#### Configuration Management

```typescript
import { initializeConfiguration, getConfig, isDebugEnabled } from '@config/config-utils'

const configExample = Effect.gen(function* () {
  const configRef = yield* initializeConfiguration()
  const appConfig = yield* getConfig(configRef, 'app')
  const debugMode = yield* isDebugEnabled(configRef)
  
  yield* Logger.info('Configuration loaded', 'ConfigManager', { 
    environment: appConfig.environment, 
    debugMode 
  })
})
```

### 7. Migration Strategy for Remaining Code

For any remaining impure patterns in the codebase:

1. **Identify**: Look for `console.log`, `Math.random()`, `Date.now()`, `performance.now()`, direct mutations
2. **Wrap**: Use appropriate Effect services (`Logger`, `Clock`, `Random`, `Ref`)
3. **Type**: Update function signatures to reflect Effect dependencies
4. **Test**: Ensure functions can be tested in isolation
5. **Compose**: Use Effect combinators for combining operations

### 8. Testing Pure Functions

```typescript
import { Effect } from 'effect'
import { TestClock, TestRandom } from 'effect/Test'

test('pure random generation', () => {
  const program = generateId
  
  const result = Effect.provide(
    program,
    Layer.merge(TestRandom.deterministic, TestClock.layer)
  )
  
  // Result is now deterministic and testable
  expect(Effect.runSync(result)).toMatch(/^id_[a-z0-9]+$/)
})
```

This conversion ensures that the codebase follows functional programming principles while maintaining all existing functionality with improved reliability, testability, and composability.