# AI Agent Development Guide for TypeScript Minecraft

## 🎯 Quick Reference

### Essential Commands
```bash
pnpm install         # Install dependencies
pnpm dev            # Start dev server
pnpm test           # Run tests
pnpm run tsc        # Type check
pnpm lint           # Lint code
pnpm format         # Format code
```

## 🏗 Architecture Overview

### Domain-Driven Design Structure

```
src/
├── domain/          # Core business logic (pure, no side effects)
│   ├── values/     # Value objects (EntityId, Position, BlockType)
│   ├── entities/   # Entity definitions
│   ├── components/ # ECS component schemas
│   ├── errors.ts   # Domain error types
│   └── world.ts    # World model
├── infrastructure/ # External dependencies
│   ├── renderer-three/  # Three.js integration
│   ├── input-browser.ts # Browser input handling
│   └── world.ts        # World state implementation
├── systems/        # Game logic systems
│   ├── physics.ts      # Physics simulation
│   ├── collision.ts    # Collision detection
│   └── player-movement.ts # Player controls
├── runtime/        # Application runtime
│   ├── services.ts # Service definitions
│   └── loop.ts     # Game loop
└── workers/        # Web Workers
    ├── terrain-generation.ts
    └── mesh-generation.ts
```

## 🔑 Key Patterns for AI Agents

### 1. Effect-TS Pattern (ALWAYS USE THIS)

```typescript
// ✅ CORRECT - Using Effect
import { Effect, pipe } from 'effect'

export const loadChunk = (coords: ChunkCoordinates) =>
  Effect.gen(function* () {
    const world = yield* World
    const chunk = yield* world.getChunk(coords)
    return chunk
  })

// ❌ WRONG - Using async/await
export async function loadChunk(coords: ChunkCoordinates) {
  // Never use async/await!
}
```

### 2. Service Definition Pattern

```typescript
import { Context, Effect, Layer } from 'effect'

// Define service interface
export class MyService extends Context.GenericTag('MyService')<
  MyService,
  {
    readonly doSomething: (input: string) => Effect.Effect<void>
    readonly getData: () => Effect.Effect<string>
  }
>() {}

// Implement service layer
export const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    // Initialize resources
    const resource = yield* initResource()
    
    return MyService.of({
      doSomething: (input) => Effect.sync(() => console.log(input)),
      getData: () => Effect.succeed("data"),
    })
  })
)
```

### 3. Branded Types Pattern

```typescript
import { Brand } from 'effect'

// Define branded type
export type EntityId = string & Brand.Brand<'EntityId'>
export const EntityId = Brand.nominal<EntityId>()

// Use in code
const id = EntityId('entity-123')  // Type-safe ID

// Validate at runtime
const validateId = (value: unknown): EntityId => {
  if (typeof value !== 'string') throw new Error('Invalid ID')
  return EntityId(value)
}
```

### 4. Data Class Pattern (Immutable Objects)

```typescript
import { Data } from 'effect'
import * as S from 'effect/Schema'

export class Position extends Data.Class<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {
  static readonly schema = S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
  })
  
  translate(dx: number, dy: number, dz: number): Position {
    return new Position({
      x: this.x + dx,
      y: this.y + dy,
      z: this.z + dz,
    })
  }
}
```

### 5. ECS System Pattern

```typescript
export const physicsSystem = Effect.gen(function* () {
  const world = yield* World
  const clock = yield* Clock
  const deltaTime = yield* Ref.get(clock.deltaTime)
  
  const { entities, components } = yield* world.querySoA(physicsQuery)
  
  yield* Effect.forEach(
    entities,
    (entityId, i) => Effect.gen(function* () {
      const position = components.position[i]
      const velocity = components.velocity[i]
      
      // Update position based on velocity
      const newPosition = position.translate(
        velocity.dx * deltaTime,
        velocity.dy * deltaTime,
        velocity.dz * deltaTime
      )
      
      yield* world.updateComponent(entityId, 'position', newPosition)
    }),
    { concurrency: 'inherit' }
  )
})
```

## 📋 Common Tasks

### Adding a New Component

1. Define schema in `src/domain/components/`:
```typescript
export class Health extends Data.Class<{
  readonly current: number
  readonly max: number
}> {
  static readonly schema = S.Struct({
    current: S.Number.pipe(S.nonNegative()),
    max: S.Number.pipe(S.positive()),
  })
}
```

2. Add to component registry
3. Update relevant queries
4. Create/update systems

### Adding a New System

1. Create in `src/systems/`:
```typescript
export const healthSystem = Effect.gen(function* () {
  const world = yield* World
  // System logic
})
```

2. Add to game loop in `src/main.ts`

### Adding a New Service

1. Define in `src/runtime/services.ts`:
```typescript
export class AudioService extends Context.GenericTag('AudioService')<
  AudioService,
  { playSound: (name: string) => Effect.Effect<void> }
>() {}
```

2. Implement in `src/infrastructure/`:
```typescript
export const AudioServiceLive = Layer.effect(
  AudioService,
  Effect.gen(function* () {
    // Implementation
  })
)
```

## ⚠️ Critical Rules

### NEVER DO THIS:
```typescript
// ❌ async/await
async function bad() { await promise }

// ❌ Classes with methods
class Bad {
  method() { } // NO!
}

// ❌ Mutations
object.property = value // NO!
array.push(item) // NO!

// ❌ any type
let x: any = 123 // NO!

// ❌ Direct throws
throw new Error() // Use Effect.fail()

// ❌ Direct try/catch
try { } catch { } // Use Effect.catchAll()
```

### ALWAYS DO THIS:
```typescript
// ✅ Effect for async
Effect.gen(function* () { })

// ✅ Data.Class for objects
class Good extends Data.Class<{ value: number }> {}

// ✅ Immutable updates
const newObj = { ...oldObj, property: value }
const newArr = [...oldArr, item]

// ✅ unknown with validation
const validate = (x: unknown) => S.decodeUnknown(Schema)(x)

// ✅ Effect.fail for errors
Effect.fail(new MyError())

// ✅ Effect.catchAll for error handling
effect.pipe(Effect.catchAll(handler))
```

## 🧪 Testing Requirements

### Test Structure
```typescript
import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'

describe('MyFeature', () => {
  it.effect('should work', () =>
    Effect.gen(function* () {
      // Test logic
      assert.equal(result, expected)
    }).pipe(Effect.provide(TestLayer))
  )
})
```

### Test Services
```typescript
const TestService = Layer.succeed(
  MyService,
  MyService.of({
    method: () => Effect.succeed(mockValue)
  })
)
```

## 🚀 Performance Guidelines

1. **Use SoA queries** for cache efficiency:
```typescript
const { entities, components } = yield* world.querySoA(query)
```

2. **Batch operations**:
```typescript
Effect.all(operations, { concurrency: 'unbounded' })
```

3. **Use workers** for heavy computation:
```typescript
yield* worker.postTask({ type: 'generateTerrain' })
```

4. **Spatial indexing** for collision detection

## 📚 Resources

- [Effect-TS Docs](https://effect.website/)
- [Three.js Docs](https://threejs.org/docs/)
- [ECS Pattern](./ecs.md)
- [Project Conventions](./conventions.md)

## 🔍 Debugging

```typescript
// Use Effect's tracing
Effect.withSpan('operation-name')

// Debug logging
Effect.logDebug('message')

// Tap for side effects
pipe(
  effect,
  Effect.tap((value) => Effect.log('Value:', value))
)
```

## 💡 Tips for AI Agents

1. **Check existing patterns first** - Look at similar code
2. **Use semantic search** - Find relevant examples
3. **Test incrementally** - Run tests after each change
4. **Type check often** - Use `pnpm tsc`
5. **Follow conventions** - Check `docs/conventions.md`
6. **Ask for clarification** - When requirements are unclear
7. **Document decisions** - Explain why you chose a pattern

## 🚫 Common Pitfalls

1. **Mixing Effect with Promises** - Never use `.then()` with Effect
2. **Forgetting to yield*** - Always yield Effect operations
3. **Wrong service provision** - Ensure all services are provided
4. **Mutable operations** - Always create new objects
5. **Missing error handling** - Always handle Effect errors
6. **Direct DOM access** - Use service abstractions
7. **Global state** - Use Context and services instead

## 📝 Commit Message Format

```
feat: add new feature
fix: fix bug
refactor: improve code structure
test: add/update tests
docs: update documentation
chore: maintenance tasks
```

## 🎯 Success Criteria

- ✅ All tests pass (`pnpm test`)
- ✅ TypeScript compiles (`pnpm tsc`)
- ✅ 100% test coverage
- ✅ No linting errors (`pnpm lint`)
- ✅ Follows Effect-TS patterns
- ✅ Immutable data structures
- ✅ Proper error handling
- ✅ Well-documented code