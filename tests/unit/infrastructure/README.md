# Infrastructure Layer Tests

This directory contains tests for the infrastructure layer of the ts-minecraft project.

## Directory Structure

```
tests/unit/infrastructure/
├── adapters/           # Tests for infrastructure adapters
├── repositories/       # Tests for data repositories
├── layers/            # Tests for Effect layers and compositions
├── services/          # Tests for infrastructure services
├── storage/           # Tests for storage implementations
├── gpu/               # Tests for GPU-related functionality
├── workers/           # Tests for Web Workers
├── performance/       # Tests for performance monitoring and optimization
├── monitoring/        # Tests for system monitoring
└── README.md          # This file
```

## Running Tests

### Run all infrastructure tests:
```bash
npm run test:infrastructure
```

### Run with coverage:
```bash
npm run test:infrastructure:coverage
```

### Run in watch mode:
```bash
npm run test:infrastructure -- --watch
```

## Test Configuration

- **Config File**: `vitest.infrastructure.config.ts`
- **Setup File**: `tests/setup/infrastructure.setup.ts`
- **Coverage Threshold**: 100% for all metrics
- **Test Environment**: jsdom with comprehensive mocks

## Mocked Services

The infrastructure test setup includes mocks for:

- **WebGL/WebGPU**: Complete WebGL and WebGPU context mocking
- **Web Workers**: Worker constructor and messaging
- **WebSocket**: WebSocket API for network testing
- **Performance APIs**: Performance monitoring and measurement
- **Canvas APIs**: 2D and WebGL canvas contexts
- **Browser APIs**: ResizeObserver, IntersectionObserver, requestAnimationFrame

## Effect-TS Testing Patterns

### Basic Effect Testing
```typescript
import { expectEffect } from '../../../setup/infrastructure.setup'

// Test successful effects
const result = await expectEffect.toSucceed(Effect.succeed(42))
expect(result).toBe(42)

// Test failing effects
await expectEffect.toFail(Effect.fail(new Error('test')))

// Test effects with specific errors
await expectEffect.toFailWith(
  Effect.fail('error'),
  'error'
)
```

### Performance Testing
```typescript
import { measureEffectPerformance } from '../../../setup/infrastructure.setup'

const { result, duration } = await measureEffectPerformance(
  heavyEffect,
  'operation-name'
)
```

### Layer Testing
```typescript
import { testLayer, withTestLayer } from '../../../setup/infrastructure.setup'

// Build and test layers
const layer = await runEffect(testLayer(MyLayer))

// Use layers in tests
const result = await runEffect(
  withTestLayer(MyLayer, myEffect)
)
```

## Best Practices

1. **Mock Infrastructure**: Always use the provided mocks for browser APIs
2. **Effect Patterns**: Use `expectEffect` helpers for consistent testing
3. **Performance**: Use `measureEffectPerformance` for performance-critical code
4. **Cleanup**: Tests automatically clean up mocks and timers
5. **Coverage**: Aim for 100% coverage on all infrastructure components
6. **Isolation**: Each test should be independent and not rely on side effects

## Common Test Patterns

### Testing Adapters
```typescript
describe('MyAdapter', () => {
  it('should adapt external API correctly', async () => {
    const adapter = createMyAdapter()
    const result = await expectEffect.toSucceed(
      adapter.performOperation('input')
    )
    expect(result).toEqual(expectedOutput)
  })
})
```

### Testing Repositories
```typescript
describe('MyRepository', () => {
  it('should store and retrieve data', async () => {
    const repo = createMyRepository()
    await expectEffect.toSucceed(repo.save(data))
    const retrieved = await expectEffect.toSucceed(repo.get(id))
    expect(retrieved).toEqual(data)
  })
})
```

### Testing Services
```typescript
describe('MyService', () => {
  it('should process requests correctly', async () => {
    const service = createMyService()
    const result = await expectEffect.toSucceed(
      service.processRequest(request)
    )
    expect(result).toMatchObject(expectedResponse)
  })
})
```