# TypeScript Minecraft Clone - Documentation Index

## Single Source of Truth

This `docs/` directory serves as the **Single Source of Truth** for all project documentation. All other files should reference this location rather than duplicating content.

## About This Documentation

This documentation follows the **Diátaxis Framework**, which organizes content by user intent into four orthogonal categories:

- **Tutorials** - Learning-oriented lessons that build knowledge progressively
- **How-To Guides** - Problem-oriented practical instructions for specific goals
- **Explanations** - Understanding-oriented context and design rationale
- **Reference** - Information-oriented technical specifications and facts

Each document belongs to exactly one category. Content is never duplicated across categories; instead, documents reference each other.

For the framework specification, see [Diátaxis Framework](./DIATAXIS.md).

## Project Overview

**TypeScript Minecraft Clone**: Effect-TS + DDD + ECS Functional Minecraft Clone

### Core Goals

- **Performance**: 60 FPS / <2GB memory
- **Quality**: 80%+ test coverage
- **Architecture**: Pure functional, event-driven, DDD/ECS

### Technical Constraints

- **No Classes**: Effect-TS Service/Layer patterns for functional design
- **Variable Constraints**: No `var`, `let`, `any`, or `async` (use `const` and `Effect.gen`)
- **Type Safety**: Effect.gen and Schema.Struct required
- **Runtime Validation**: Schema validation required for all external data
- **Error Handling**: No exceptions - use Effect types for error representation

## Documentation Structure

### 📚 Tutorials

Step-by-step lessons for learning and skill development

- [Getting Started](./tutorials/getting-started/README.md) - First-time user guide
- [Effect-TS Fundamentals](./tutorials/effect-ts-fundamentals/README.md) - Core concepts
- [Basic Game Development](./tutorials/basic-game-development/README.md) - Game development basics

### 🔧 How-To Guides

Practical guides for solving specific problems

- [Development](./how-to/development/README.md) - Development workflows
  - [Environment Setup](./tutorials/basic-game-development/environment-setup.md)
  - [Development Conventions](./how-to/development/development-conventions.md)
  - [GitHub Issue Management](./how-to/development/github-issue-management.md)
- [Testing](./how-to/testing/README.md) - Testing procedures
  - [Testing Guide](./how-to/testing/testing-guide.md)
  - [Property-Based Testing](./how-to/testing/pbt-implementation-examples.md)
- [Troubleshooting](./how-to/troubleshooting/README.md) - Common issues
- [Deployment](./how-to/deployment/README.md) - Deployment procedures

### 💡 Explanations

Context, background, and design rationale

- [Architecture](./explanations/architecture/README.md) - System architecture
  - [Architecture Overview](./explanations/architecture/architecture-overview.md)
  - [Performance Guidelines](./explanations/architecture/performance-guidelines.md)
  - [Data Flow](./explanations/architecture/data-flow-diagram.md)
- [Design Patterns](./explanations/design-patterns/README.md) - Design patterns
  - [Service Patterns](./explanations/design-patterns/service-patterns.md)
  - [Error Handling](./explanations/design-patterns/error-handling-patterns.md)
  - [Functional Programming](./explanations/design-patterns/functional-programming-philosophy.md)
- [Game Mechanics](./explanations/game-mechanics/README.md) - Game design decisions
  - [Core Features](./explanations/game-mechanics/core-features/overview.md)
  - [Block System](./explanations/game-mechanics/core-features/block-system.md)
  - [Physics System](./explanations/game-mechanics/core-features/physics-system.md)

### 📖 Reference

Technical specifications and API documentation

- [API Reference](./reference/api/README.md) - API documentation
  - [Effect-TS APIs](./reference/api/effect-ts-effect-api.md)
  - [Domain APIs](./reference/api/domain-apis.md)
  - [Infrastructure APIs](./reference/api/infrastructure-api-reference.md)
- [Configuration](./reference/configuration/README.md) - Configuration files
  - [TypeScript Config](./reference/configuration/typescript-config.md)
  - [Vite Config](./reference/configuration/vite-config.md)
  - [Vitest Config](./reference/configuration/vitest-config.md)
- [CLI Commands](./reference/cli/README.md) - Command reference
  - [Development Commands](./reference/cli/development-commands.md)
  - [Testing Commands](./reference/cli/testing-commands.md)
- [Game Systems](./reference/game-systems/README.md) - System specifications
  - [Block System API](./reference/game-systems/game-block-api.md)
  - [Player API](./reference/game-systems/game-player-api.md)
  - [World API](./reference/game-systems/game-world-api.md)
- [Effect-TS Types](./reference/effect-ts-types/type-reference.md) - Type definitions

## Quick Links

### For Developers

1. **Setup**: [Environment Setup](./tutorials/basic-game-development/environment-setup.md)
2. **Conventions**: [Development Conventions](./how-to/development/development-conventions.md)
3. **Type System**: [Effect-TS Type System](./tutorials/effect-ts-fundamentals/effect-ts-type-system.md)
4. **Patterns**: [Effect-TS Patterns](./tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
5. **Type Reference**: [Brand Types & Schema](./reference/effect-ts-types/type-reference.md)
6. **Testing**: [Testing Guide](./how-to/testing/testing-guide.md)

### For AI Agents

1. **Issue Workflow**: [GitHub Issue Management](./how-to/development/github-issue-management.md)
2. **Entry Points**: [Entry Points](./how-to/development/entry-points.md)
3. **Migration**: [Effect-TS Migration](./how-to/migration/effect-ts-migration.md)
4. **Service Pattern**: [Service Patterns](./explanations/design-patterns/service-patterns.md)
5. **Type Safety**: [Type Safety Patterns](./tutorials/design-patterns/type-safety-patterns.md)
6. **Common Errors**: [Common Errors](./how-to/troubleshooting/common-errors.md)

## Issue-Driven Development

### AI Task Implementation Flow

1. **Issue Review**: GitHub Issue in `.github/ISSUE_TEMPLATE/ai-task.yml` format
2. **Implementation Plan**: 8-step implementation process (Step 1-8)
3. **Code Generation**: Effect-TS Service/Layer/Schema patterns
4. **Automatic Verification**: `pnpm typecheck && pnpm check && pnpm test && pnpm build`
5. **Error Resolution**: Follow troubleshooting procedures

### Reference Priority

1. **GitHub Issue**: Specific implementation steps and completion criteria
2. **docs/**: Detailed specifications and implementation patterns
3. **src/shared/**: Implemented pattern examples
4. **ROADMAP.md**: Overall project context

## Command Reference

### Development

```bash
pnpm dev        # Start development server
pnpm build      # Production build
pnpm preview    # Build preview
```

### Quality Assurance

```bash
pnpm typecheck  # Type checking
pnpm check      # Comprehensive code quality check
pnpm test       # Vitest tests
pnpm coverage   # Coverage report generation
```

### Documentation

```bash
# View documentation
cat docs/INDEX.md                 # This index
cat docs/tutorials/README.md      # Tutorials list
cat docs/how-to/README.md         # How-to guides list
cat docs/reference/README.md      # Reference list
```

## Contribution Guidelines

1. **Documentation Updates**: All documentation changes must be in `docs/`
2. **No Duplication**: Never duplicate content; always reference `docs/`
3. **Diátaxis Compliance**: Follow Diátaxis framework categorization
4. **Consistency**: Follow established patterns and conventions
5. **Verification**: Ensure all code examples compile and tests pass

For contribution guidelines, see [Diátaxis Framework](./DIATAXIS.md).

## Navigation

- **[← Project Root](../README.md)**
- **[→ Tutorials](./tutorials/README.md)**
- **[→ How-To Guides](./how-to/README.md)**
- **[→ Explanations](./explanations/README.md)**
- **[→ Reference](./reference/README.md)**
- **[→ Diátaxis Framework](./DIATAXIS.md)**
