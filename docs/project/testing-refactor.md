# Testing Philosophy (Post-Refactor)

This document outlines the testing strategy adopted after the major functional refactoring. The goal is to ensure the codebase is robust, maintainable, and free of flaky tests.

## Core Principles

1.  **Purely Functional Systems**: All game logic is implemented as pure functions. A `System` is a function that takes the current `World` state and returns a new, modified `World` state. This makes testing deterministic and simple: provide an input state and assert that the output state is correct. There are no complex mocks or stubs of class instances.

2.  **Strict Typing, No `any`**: The entire codebase uses a strict TypeScript configuration. The `@effect/schema` library is used to define all data structures (Components, World state, etc.), ensuring that all data is well-defined and validated. This eliminates an entire class of bugs at compile time.

3.  **Property-Based Testing (PBT) First**: Property-based testing is the primary method for testing game logic. We use `fast-check` integrated with `vitest`. Instead of writing individual examples, we define properties that should hold true for all possible inputs. `fast-check` then generates hundreds of random inputs to try to falsify these properties.

    *   **Benefits**:
        *   **High Confidence**: Tests cover a vast input space, including edge cases we might not think of.
        *   **Declarative**: We specify *what* the code should do, not just test one example of it.
        *   **Robustness**: Excellent for testing mathematical or physics-based logic (e.g., collisions, movement, camera control) and complex state transitions.

4.  **Unit Tests for Simple Cases**: Traditional unit tests (`it` blocks) are still used for:
    *   Simple, non-variant cases (e.g., "does an empty world get created correctly?").
    *   Verifying specific, known edge cases that PBT might have difficulty discovering.

5.  **Integration Testing at the Seams**: The `main.ts` entry point, which composes the entire application, is tested with an integration test. This test mocks the major modules (rendering, input, world) and verifies that they are all created and connected correctly when the application starts.

## How to Write a New Test

When adding a new system or function:

1.  **Start with Properties**: Think about the invariants of your function. What should always be true, regardless of the input?
    *   Example for `clampPitch(p)`: "The result should always be between -PI/2 and PI/2".
    *   Example for `physicsSystem`: "The new position should equal `old_position + velocity * dt`".

2.  **Define Arbitraries**: Create `fast-check` arbitraries (`fc.record`, `fc.float`, etc.) that generate valid inputs for your function. For component and archetype data, we use `@effect/schema/Arbitrary` to automatically generate arbitraries from the schemas, ensuring tests are always in sync with data structures.

3.  **Write the `test.prop` block**: Use `vitest`'s `test.prop` to define the property.

4.  **Check for Immutability**: For any function that modifies a data structure (like the `World`), a key property to test is that the *original* data structure was not mutated. The function should always return a new copy.

This approach ensures that as the game's complexity grows, the quality and reliability of the codebase remain high.