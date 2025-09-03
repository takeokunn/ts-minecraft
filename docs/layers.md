# Layers

## Infrastructure Layers

The core idea is to abstract all side-effectful operations (rendering, input, workers, etc.) behind Effect `Layer`s. This allows the application logic (systems) to be completely pure and testable.

Each infrastructure service will be defined by a `Tag` and implemented as a `Layer`.

### Example: Renderer Service

**1. Define the Service and Tag**

```typescript
// src/infrastructure/renderer-three/context.ts
import { Tag } from 'effect'
import { RenderCommand } from '@/domain/types'

export interface Renderer {
  readonly queue: (command: RenderCommand) => Effect.Effect<void>
  readonly onFrame: (callback: (delta: number) => Effect.Effect<void>) => Effect.Effect<void>
}

export const Renderer = Tag<Renderer>()
```

**2. Implement the Live Layer**

```typescript
// src/infrastructure/renderer-three/index.ts
import { Layer } from 'effect'
import { Renderer } from './context'
import { createThreeJSRenderer } from './three-renderer' // hypothetical

export const RendererLive = Layer.succeed(
  Renderer,
  Renderer.of({
    queue: (command) =>
      Effect.sync(() => {
        // ... actual Three.js implementation
      }),
    onFrame: (callback) =>
      Effect.sync(() => {
        // ... add to render loop
      }),
  }),
)
```

### List of Proposed Layers

- **`RendererLive`**: Manages the Three.js rendering context, command queue, and render loop.
- **`InputLive`**: Handles browser events for keyboard and mouse, providing a reactive stream of input state.
- **`ComputationWorkerLive`**: Manages the lifecycle of the computation worker and communication with it.
- **`MaterialManagerLive`**: Manages textures and materials.
- **`RaycastLive`**: Provides raycasting services.
- **`SpatialGridLive`**: Manages the spatial grid for efficient collision detection.
- **`ClockLive`**: Provides a reliable source of time and delta time.
- **`ConfigLive`**: Provides application configuration.
