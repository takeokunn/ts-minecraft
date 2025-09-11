# Effect-TS Patterns and Best Practices

## Core Patterns Used in This Codebase

### 1. Service Definition Pattern

```typescript
// Service interface with Context.Tag
export class WorldService extends Context.GenericTag('WorldService')<
  WorldService,
  {
    readonly getChunk: (coords: ChunkCoordinates) => Effect.Effect<Chunk, ChunkNotLoadedError>
    readonly setBlock: (pos: Position, block: BlockType) => Effect.Effect<void>
  }
>() {}

// Service implementation with Layer
export const WorldServiceLive = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    // Initialize resources
    const state = yield* Ref.make(initialState)

    return WorldService.of({
      getChunk: (coords) =>
        Effect.gen(function* () {
          // Implementation
        }),
      setBlock: (pos, block) =>
        Effect.gen(function* () {
          // Implementation
        }),
    })
  }),
)
```

### 2. Value Objects with Data.Class

```typescript
import { Data } from 'effect'
import * as S from 'effect/Schema'

export class Position extends Data.Class<{
  readonly x: number
  readonly y: number
  readonly z: number
}> {
  static readonly schema = S.Struct({
    x: S.Number.pipe(S.finite()),
    y: S.Number.pipe(S.between(0, 255)),
    z: S.Number.pipe(S.finite()),
  })

  // Pure methods that return new instances
  translate(dx: number, dy: number, dz: number): Position {
    return new Position({
      x: this.x + dx,
      y: this.y + dy,
      z: this.z + dz,
    })
  }
}
```

### 3. Branded Types for Domain Safety

```typescript
import { Brand } from 'effect'

// Define branded type
export type EntityId = string & Brand.Brand<'EntityId'>
export const EntityId = Brand.nominal<EntityId>()

// Schema with branding
export const EntityIdSchema = S.String.pipe(
  S.brand('EntityId'),
  S.annotations({
    title: 'EntityId',
    description: 'Unique identifier for an entity',
  }),
)

// Usage
const id = EntityId('entity-123') // Type-safe
```

### 4. Error Handling with Tagged Errors

```typescript
import { Data } from 'effect'

export class EntityNotFoundError extends Data.TaggedError('EntityNotFoundError')<{
  readonly entityId: EntityId
  readonly operation: string
}> {}

// Usage in Effects
const operation = Effect.gen(function* () {
  const entity = yield* getEntity(id)
  // ...
}).pipe(
  Effect.catchTag('EntityNotFoundError', (error) => Effect.succeed(defaultEntity)),
  Effect.catchAll((error) => Effect.logError(error).pipe(Effect.andThen(Effect.fail(error)))),
)
```

### 5. ECS System Pattern

```typescript
export const physicsSystem = Effect.gen(function* () {
  const world = yield* World
  const clock = yield* Clock
  const deltaTime = yield* Ref.get(clock.deltaTime)

  if (deltaTime <= 0) {
    return // Early return for invalid state
  }

  const { entities, components } = yield* world.querySoA(physicsQuery)

  yield* Effect.forEach(
    entities,
    (entityId, i) =>
      Effect.gen(function* () {
        const position = components.position[i]
        const velocity = components.velocity[i]

        // Update logic
        const newPosition = updatePosition(position, velocity, deltaTime)

        yield* world.updateComponent(entityId, 'position', newPosition)
      }),
    { concurrency: 'inherit', discard: true },
  )
})
```

### 6. Resource Management

```typescript
// Scoped resources with acquireRelease
export const ResourceLive = Layer.scoped(
  ResourceService,
  Effect.gen(function* () {
    const resource = yield* Effect.acquireRelease(
      Effect.sync(() => createResource()),
      (resource) => Effect.sync(() => resource.cleanup()),
    )

    return ResourceService.of({
      use: () => Effect.sync(() => resource.doSomething()),
    })
  }),
)
```

### 7. Parallel Processing

```typescript
// Parallel execution of independent operations
const results = yield * Effect.all([operation1, operation2, operation3], { concurrency: 'unbounded' })

// Parallel with error handling
const results =
  yield *
  Effect.allWith(operations, {
    concurrency: 'unbounded',
    mode: 'either', // Collect both successes and failures
  })
```

### 8. State Management with Ref

```typescript
// Creating mutable state
const stateRef = yield * Ref.make(initialValue)

// Reading state
const currentValue = yield * Ref.get(stateRef)

// Updating state
yield * Ref.set(stateRef, newValue)
yield * Ref.update(stateRef, (old) => transform(old))
yield * Ref.modify(stateRef, (old) => [returnValue, newState])
```

### 9. Queues for Communication

```typescript
// Create queue
const queue = yield * Queue.unbounded<Message>()

// Producer
yield * queue.offer(message)

// Consumer
const message = yield * Queue.take(queue)

// Process messages in loop
yield * Queue.take(queue).pipe(Effect.flatMap(processMessage), Effect.forever, Effect.forkScoped)
```

### 10. Testing Patterns

```typescript
import { describe, it, assert } from '@effect/vitest'

describe('MyFeature', () => {
  it.effect('should work correctly', () =>
    Effect.gen(function* () {
      // Arrange
      const testService = TestService.of({
        method: () => Effect.succeed(mockValue),
      })

      // Act
      const result = yield* operation.pipe(Effect.provide(Layer.succeed(TestService, testService)))

      // Assert
      assert.equal(result, expected)
    }),
  )
})
```

## Common Pitfalls and Solutions

### ❌ Pitfall: Using async/await

```typescript
// Wrong
async function loadData() {
  const data = await fetch('/api')
  return data.json()
}
```

### ✅ Solution: Use Effect

```typescript
// Correct
const loadData = Effect.tryPromise({
  try: () => fetch('/api').then((r) => r.json()),
  catch: (error) => new NetworkError({ error }),
})
```

### ❌ Pitfall: Direct mutations

```typescript
// Wrong
array.push(item)
object.property = value
```

### ✅ Solution: Immutable updates

```typescript
// Correct
const newArray = [...array, item]
const newObject = { ...object, property: value }
```

### ❌ Pitfall: Throwing exceptions

```typescript
// Wrong
if (!valid) {
  throw new Error('Invalid')
}
```

### ✅ Solution: Use Effect.fail

```typescript
// Correct
if (!valid) {
  return Effect.fail(new ValidationError())
}
```

### ❌ Pitfall: Missing error handling

```typescript
// Wrong
const result = yield * riskyOperation
```

### ✅ Solution: Handle errors explicitly

```typescript
// Correct
const result = yield * riskyOperation.pipe(Effect.catchTag('SpecificError', handleError), Effect.catchAll(handleUnexpectedError))
```

## Performance Optimizations

1. **Use SoA (Structure of Arrays) for ECS queries**
   - Better cache locality
   - Reduced memory fragmentation

2. **Batch operations**
   - Use `Effect.all` for parallel execution
   - Group similar operations

3. **Lazy evaluation**
   - Use `Effect.suspend` for deferred computation
   - Stream processing for large datasets

4. **Resource pooling**
   - Reuse objects instead of creating new ones
   - Use object pools for frequently created/destroyed entities

## Debugging Tips

```typescript
// Add tracing
Effect.withSpan('operation-name')

// Debug logging
Effect.tap((value) => Effect.log('Debug:', value))

// Conditional debugging
Effect.when(
  () => process.env.NODE_ENV === 'development',
  () => Effect.log('Debug info'),
)

// Time measurement
Effect.timed.pipe(Effect.tap(([duration, result]) => Effect.log(`Operation took ${duration}ms`)))
```

## Migration Guide

### From Promises to Effects

```typescript
// Before
const promise = asyncOperation().then(transform).catch(handleError)

// After
const effect = Effect.tryPromise({
  try: () => asyncOperation(),
  catch: (e) => new OperationError({ error: e }),
}).pipe(Effect.map(transform), Effect.catchAll(handleError))
```

### From Classes to Data.Class

```typescript
// Before
class Position {
  constructor(
    public x: number,
    public y: number,
  ) {}
  move(dx: number, dy: number) {
    this.x += dx
    this.y += dy
  }
}

// After
class Position extends Data.Class<{
  readonly x: number
  readonly y: number
}> {
  move(dx: number, dy: number): Position {
    return new Position({
      x: this.x + dx,
      y: this.y + dy,
    })
  }
}
```

## Resources

- [Effect-TS Documentation](https://effect.website/)
- [Effect-TS GitHub](https://github.com/Effect-TS/effect)
- [Effect-TS Discord](https://discord.gg/effect-ts)
- [Schema Documentation](https://effect.website/docs/schema/introduction)
