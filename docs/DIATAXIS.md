# Diátaxis Framework

## Overview

This document defines the **Diátaxis Framework** for the TypeScript Minecraft Clone project documentation.

`★ Insight ─────────────────────────────────────`
**Diátaxis Principle**: Documentation is organized by user intent into four orthogonal categories that should not be mixed. Each document belongs to exactly one category, and content should never be duplicated - instead, documents should reference each other.

**The Four Categories**:
- **Tutorials**: Learning-oriented lessons that build knowledge progressively
- **How-To Guides**: Problem-oriented practical instructions for specific goals
- **Explanations**: Understanding-oriented context and design rationale
- **Reference**: Information-oriented technical specifications and facts
`─────────────────────────────────────────────────`

## Framework Structure

```
docs/
├── INDEX.md                          # Main entry point (Single Source of Truth)
├── DIATAXIS.md                      # This framework specification
├── tutorials/                        # Learning-oriented lessons
│   ├── README.md
│   ├── getting-started/              # First-time users
│   ├── effect-ts-fundamentals/       # Core Effect-TS concepts
│   └── basic-game-development/       # Game development basics
├── how-to/                          # Problem-oriented guides
│   ├── README.md
│   ├── development/                  # Development workflows
│   ├── testing/                      # Testing procedures
│   ├── troubleshooting/              # Common issues
│   └── deployment/                  # Deployment procedures
├── explanations/                    # Understanding-oriented content
│   ├── README.md
│   ├── architecture/                 # System architecture
│   ├── design-patterns/              # Design patterns
│   └── game-mechanics/              # Game design decisions
└── reference/                       # Information-oriented specs
    ├── README.md
    ├── api/                         # API documentation
    ├── configuration/                # Configuration files
    ├── cli/                         # Command reference
    ├── game-systems/                # System specifications
    └── effect-ts-types/              # Type definitions
```

## Content Categorization Rules

### Tutorials
**Purpose**: Teach users progressively from beginner to advanced

**Characteristics**:
- Sequential, lesson-based structure
- Hands-on exercises with expected outcomes
- Assumes no prior knowledge
- Builds understanding step-by-step
- Minimal prerequisites

**Examples**:
- Getting Started Guide
- Effect-TS Fundamentals
- Basic Game Development Tutorial
- Building Your First Block

**Location**: `docs/tutorials/`

### How-To Guides
**Purpose**: Solve specific problems for users with some knowledge

**Characteristics**:
- Goal-oriented (How do I...?)
- Assumes user knows basics
- Prerequisites clearly stated
- Practical, actionable steps
- Minimal explanation of "why"

**Examples**:
- Set Up Development Environment
- Implement a New Game System
- Run Property-Based Tests
- Deploy to Production

**Location**: `docs/how-to/`

### Explanations
**Purpose**: Provide context and design rationale

**Characteristics**:
- Explores concepts and relationships
- Answers "why" questions
- Provides historical context
- Explains trade-offs and decisions
- Reference-free (doesn't tell you how to do anything)

**Examples**:
- Why We Use Effect-TS
- Architecture Overview
- DDD vs ECS Trade-offs
- Performance Design Philosophy

**Location**: `docs/explanations/`

### Reference
**Purpose**: Provide technical specifications and facts

**Characteristics**:
- Information-only (no opinions or explanations)
- Alphabetical or logical ordering
- Minimal prose
- API documentation
- Configuration specifications

**Examples**:
- API Reference
- Configuration Options
- Type Definitions
- Command Line Flags

**Location**: `docs/reference/`

## Content Placement Guidelines

| Content Type | Category | Location |
|-------------|----------|----------|
| Step-by-step learning path | Tutorial | `docs/tutorials/` |
| How to achieve X | How-To | `docs/how-to/` |
| Why X was designed this way | Explanation | `docs/explanations/` |
| API documentation | Reference | `docs/reference/api/` |
| Configuration details | Reference | `docs/reference/configuration/` |
| Common errors and fixes | How-To/Reference | `docs/how-to/troubleshooting/` |

### Common Misplacements to Avoid

| Misplaced In | Should Be In |
|---------------|--------------|
| Tutorial content in reference | Tutorial |
| Explanations in how-to guides | Explanation |
| How-to steps in explanations | How-To |
| Reference content in tutorials | Reference |

## Cross-Reference Patterns

### Tutorial → Explanation
```markdown
For more information on why this architecture was chosen, see [Architecture Overview](../explanations/architecture/overview.md).
```

### How-To → Reference
```markdown
For complete API documentation, see [Block System API](../reference/api/block-system.md).
```

### Explanation → Tutorial
```markdown
To see this pattern in practice, follow the [Basic Block Tutorial](../tutorials/basic-game-development/blocks.md).
```

### Reference → How-To
```markdown
For practical usage examples, see [Implementing Block Systems](../how-to/development/block-systems.md).
```

## Content Quality Guidelines

### Tutorial Quality Checklist
- [ ] Clear learning objectives stated upfront
- [ ] Prerequisites listed explicitly
- [ ] Step-by-step instructions with expected outcomes
- [ ] Hands-on exercises or examples
- [ ] Next steps suggested

### How-To Guide Quality Checklist
- [ ] Clear, action-oriented title
- [ ] Prerequisites listed
- [ ] Step-by-step instructions
- [ ] Expected outcomes defined
- [ ] Troubleshooting section (optional)

### Explanation Quality Checklist
- [ ] Answers "why" not "how"
- [ ] Provides context and background
- [ ] Explores trade-offs and alternatives
- [ ] References related content
- [ ] No step-by-step instructions

### Reference Quality Checklist
- [ ] Alphabetical or logical ordering
- [ ] Complete and accurate
- [ ] Minimal prose
- [ ] Cross-references to related content
- [ ] Examples only when clarifying (not instructional)

## Maintenance Guidelines

### For New Documentation

1. **Single Source of Truth**: All documentation goes in `docs/`
2. **Diátaxis Compliance**: Follow the four categories above
3. **Root Minimalism**: Only keep essential files in project root
4. **Cross-References**: Link between categories rather than duplicating content

### What Belongs in Project Root

- **README.md**: Essential project overview
- **ROADMAP.md**: High-level project plan
- LICENSE, package.json, etc.: Project configuration

### What Does NOT Belong in docs/

- Progress reports
- Analysis reports
- Implementation plans
- Status reports
- Internal templates (use `.github/` or CONTRIBUTING.md)
- Standalone examples (integrate into tutorials/reference)

## Success Criteria

The Diátaxis framework is successful when:
- Each document belongs to exactly one category
- Content is not duplicated across categories
- Users can quickly find content based on their intent
- Cross-references properly connect related content
- All content quality checklists pass for existing documents
- Project root contains only essential files

---

**Version**: 2.0
**Last Updated**: 2026-02-23
**Framework**: Diátaxis by Daniele Procida
