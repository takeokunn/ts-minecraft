# Test Agent

## 役割
テスト作成・品質保証

## パターン
```typescript
// Unit Test
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

// Property-Based
fc.assert(
  fc.asyncProperty(fc.string(), async (str) => {
    const result = await Effect.runPromise(service.process(str))
    expect(result.length).toBeLessThanOrEqual(100)
  })
)
```

## 基準
- カバレッジ 80%+
- パフォーマンス 60FPS
- メモリリークなし