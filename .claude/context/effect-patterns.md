# Effect-TS Patterns

## Service
```typescript
export const Service = Context.GenericTag<ServiceInterface>("@minecraft/Service")

export const ServiceLive = Layer.effect(
  Service,
  Effect.gen(function* () {
    return Service.of({
      method: () => Effect.succeed(result)
    })
  })
)
```

## Schema
```typescript
// Data
export const Data = Schema.Struct({
  field: Schema.String,
  number: Schema.Number.pipe(Schema.between(0, 100))
})

// Error
export const Error = Schema.TaggedError("Error")({
  detail: Schema.String
})
```

## Effect.gen
```typescript
export const process = (input: Input) =>
  Effect.gen(function* () {
    const service = yield* Service
    const result = yield* service.method(input)

    if (result.error) {
      yield* Effect.fail(Error.create({ detail: result.error }))
    }

    return result.value
  })
```

## Layer
```typescript
export const AppLayer = Layer.mergeAll(
  ConfigLayer,
  ServiceLive,
  RepositoryLive
)

// Run
pipe(
  mainProgram,
  Effect.provide(AppLayer),
  Effect.runPromise
)
```

## Match
```typescript
Match.value(action).pipe(
  Match.tag("Move", ({ position }) => movePlayer(position)),
  Match.tag("Attack", ({ target }) => attack(target)),
  Match.exhaustive
)
```

## Test
```typescript
describe("Service", () => {
  it("should work", () =>
    Effect.gen(function* () {
      const service = yield* Service
      const result = yield* service.method()
      expect(result).toEqual(expected)
    }).pipe(
      Effect.provide(TestLayer),
      Effect.runPromise
    ))
})
```