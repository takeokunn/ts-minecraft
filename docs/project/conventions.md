# Project Conventions

This document outlines the coding styles, conventions, and patterns used throughout the project. Adhering to these guidelines ensures consistency, readability, and maintainability of the codebase.

## Code Formatting

Code formatting is automated using **BiomeJS** to ensure a uniform style across the entire codebase.

-   **Indent Style**: Space
-   **Indent Width**: 2 spaces
-   **Quote Style**: Single quotes (`'`)
-   **Trailing Commas**: Always add trailing commas (`all`).
-   **Semicolons**: Do not use semicolons at the end of statements.

Developers should run the format command before committing changes:

```bash
npm run format
```

## Linting

Code quality and potential errors are checked using **Oxlint**. The linter helps catch common mistakes and enforce best practices.

To run the linter, use the following command:

```bash
npm run lint
```

## Naming Conventions

-   **Files**: Use kebab-case (e.g., `block-interaction.ts`).
-   **Variables & Functions**: Use camelCase (e.g., `playerControlSystem`).
-   **Classes & Types**: Use PascalCase (e.g., `Position`, `EntityId`).
-   **Components (ECS)**: コンポーネントは `Schema.Class` を継承して定義し、`registerComponent` ヘルパーでラップする必要があります。これにより、`World` が内部的にコンポーネントを管理できるようになります。ファイル名は `components.ts` に集約します。

    ```typescript
    // src/domain/components.ts
    export const Position = registerComponent(
      class Position extends Component("Position")({
        x: Schema.Number,
        y: Schema.Number,
        z: Schema.Number,
      }) {},
    );
    export type Position = InstanceType<typeof Position>;
    ```

-   **Systems (ECS)**: システムは `Effect<void, never, World>` 型の `Effect` プログラムとして実装します。ファイル名はケバブケース（例: `player-control.ts`）とし、`systems` ディレクトリに配置します。

-   **System Definitions**: 各システムの依存関係と実行順序は、`systems/index.ts` 内で `SystemNode` のリストとして定義します。

    ```typescript
    // src/systems/index.ts
    const systems: SystemNode[] = [
      {
        name: "playerControl",
        system: playerControlSystem,
      },
      {
        name: "physics",
        system: physicsSystem,
        after: ["playerControl"], // playerControlSystem の後に実行
      },
    ];
    ```

## Commit Messages

While not strictly enforced by a tool, this project follows the [**Conventional Commits**](https://www.conventionalcommits.org/) specification. This convention provides a clear and descriptive commit history, making it easier to understand changes and automate release notes.

Each commit message consists of a **header**, a **body**, and a **footer**.

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

-   **Type**: Must be one of the following:
    -   `feat`: A new feature.
    -   `fix`: A bug fix.
    -   `docs`: Documentation only changes.
    -   `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc).
    -   `refactor`: A code change that neither fixes a bug nor adds a feature.
    -   `perf`: A code change that improves performance.
    -   `test`: Adding missing tests or correcting existing tests.
    -   `chore`: Changes to the build process or auxiliary tools and libraries.

**Example:**

```
feat(player): implement jump and sprint mechanics

- Adds a JUMP_FORCE constant to control jump height.
- Modifies the playerControlSystem to increase velocity when the sprint key is held.
```

## Architectural Principles

The project is built upon a strict **Entity Component System (ECS)** architecture, deeply integrated with the **Effect-TS** library.

-   **Data-Oriented Design**: Logic (Systems) and data (Components) are kept separate. Components should be pure data containers with no methods.
-   **Immutability**: State should be treated as immutable wherever possible. Components defined with `@effect/schema` are `readonly` by default.
-   **Functional Approach**: Systems are implemented as `Effect` programs. This allows for declarative, composable, and type-safe asynchronous and concurrent code.
-   **Dependency Injection**: Dependencies (like `World`, `Input`, `Renderer`) are managed by Effect's `Context` and `Layer`, promoting loose coupling and testability. For more details, see the [Dependency Injection](./architecture/di.md) documentation.

By following these conventions, we aim to create a codebase that is not only functional and performant but also a pleasure to work with.
