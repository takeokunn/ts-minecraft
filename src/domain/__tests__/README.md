# Domain Layer Tests

This directory contains comprehensive tests for the domain layer, organized by category to ensure proper separation of concerns and maintainable test structure.

## Test Organization

### Directory Structure
```
__tests__/
├── value-objects/     # Tests for domain value objects
├── entities/          # Tests for domain entities  
├── services/          # Tests for domain services
├── errors/            # Tests for domain error handling
└── README.md          # This documentation
```

### Test Categories

#### Value Objects (`value-objects/`)
Tests for immutable domain value objects that represent concepts with no identity.
- Position, Vector3D, Quaternion tests
- Block type validation tests
- Coordinate system validation tests
- Mathematical operations and transformations

#### Entities (`entities/`) 
Tests for domain entities with identity and lifecycle.
- Entity creation and destruction
- Component management
- Entity validation and integrity
- Entity equality and comparison

#### Services (`services/`)
Tests for domain services that encapsulate business logic.
- Entity domain service operations
- Terrain generation algorithms
- Mesh generation services
- Cross-cutting domain operations

#### Errors (`errors/`)
Tests for domain error handling and validation.
- Error creation and validation
- Error classification and severity
- Recovery strategy testing
- Schema validation for errors

## Testing Patterns

### Effect-TS Integration
All tests use Effect-TS patterns for:
- Asynchronous operations with `Effect.runPromise`
- Error handling with `Effect.either`
- Dependency injection with test layers
- Resource management and cleanup

### Test Structure
Each test file follows this pattern:
```typescript
import { describe, it, expect } from 'vitest'
import { Effect, TestContext, Layer } from 'effect'

describe('ComponentName', () => {
  const TestLayer = Layer.merge(DependencyLive, TestContext.TestContext)
  
  describe('feature group', () => {
    it('should behave correctly', () =>
      Effect.gen(function* () {
        // Test implementation using Effect-TS patterns
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })
})
```

### Test Utilities
Common test utilities should be created in:
- Test data factories for consistent test data
- Mock service implementations
- Test layer compositions
- Assertion helpers for domain-specific validations

## Running Tests

```bash
# Run all domain tests
npm test src/domain/__tests__

# Run specific category
npm test src/domain/__tests__/value-objects
npm test src/domain/__tests__/services

# Run with coverage
npm run test:coverage src/domain/__tests__
```

## Test Guidelines

### Best Practices
1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clarity**: Test names should clearly describe the expected behavior
3. **Coverage**: Aim for high coverage of domain logic and edge cases
4. **Performance**: Keep tests fast by mocking external dependencies
5. **Maintainability**: Use descriptive assertions and avoid test duplication

### Domain-Specific Testing
1. **Value Object Tests**: Focus on immutability, validation, and mathematical operations
2. **Entity Tests**: Test identity, lifecycle, and invariant preservation
3. **Service Tests**: Verify business rules, error handling, and integration points
4. **Error Tests**: Validate error schemas, classification, and recovery strategies

### Effect-TS Testing
1. Use `Effect.runPromise` for executing effects in tests
2. Use `Effect.either` to test error cases
3. Provide test layers for dependency injection
4. Use `TestContext` for environment-specific testing

## Examples

See the example test files in each subdirectory for detailed patterns and implementations:
- `value-objects/position.test.ts` - Value object testing patterns
- `entities/entity.test.ts` - Entity testing patterns  
- `services/entity-domain.service.test.ts` - Service testing with dependency injection
- `errors/unified-errors.test.ts` - Error handling and validation tests