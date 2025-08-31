# Chunk Loading System

The chunk loading system is a performance-critical feature responsible for dynamically loading and unloading sections of the world, known as chunks, based on the player's position. This creates the illusion of an infinite world while keeping memory usage and the number of active entities manageable.

## Core Components & Concepts

-   **Chunk**: A conceptual vertical section of the world, typically 16x256x16 blocks. The system creates `Chunk` entities to act as markers for which parts of the world are currently active and loaded in memory. Each `Chunk` entity stores its grid coordinates, `x` and `z`.
-   **`Position`**: The player's `Position` component is the focal point used to determine which chunks should be loaded.
-   **`Block`**: The component identifying terrain blocks. These entities are created and destroyed en masse by the chunk loading system.

## Core System: `chunkLoadingSystem`

The logic is managed by the `chunkLoadingSystem` (`src/systems/chunk-loading.ts`).

### How It Works

The system runs continuously in the game loop and performs the following steps:

1.  **Get Player Position**: The system first finds the player entity and reads its `Position` component.
2.  **Determine Current Chunk**: It calculates which chunk the player is currently inside based on their `(x, z)` coordinates (e.g., `floor(x / 16)`).
3.  **Identify Required Chunks**: It defines a `renderDistance` (e.g., 8 chunks in every direction). It then creates a set of all chunk coordinates that *should* be loaded in a square around the player's current chunk.
4.  **Query Existing Chunks**: The system queries the `World` for all entities that currently have a `Chunk` component, creating a set of currently loaded chunks.
5.  **Calculate Difference**: It compares the "required" set with the "loaded" set to determine two things:
    -   **Chunks to Load**: Chunks that are in the "required" set but not yet in the "loaded" set.
    -   **Chunks to Unload**: Chunks that are in the "loaded" set but no longer in the "required" set (because the player has moved away).
6.  **Unload Chunks**: For each chunk marked for unloading:
    -   The system finds all `Block` entities located within the boundaries of that chunk.
    -   It removes all of these block entities from the `World`.
    -   Finally, it removes the `Chunk` marker entity itself.
7.  **Load Chunks**: For each chunk marked for loading:
    -   It creates a new `Chunk` marker entity to track the newly loaded area.
    -   It then invokes the **`generationSystem`** (see [World Generation](./generation.md)), passing the coordinates of the new chunk. The `generationSystem` is responsible for creating all the necessary `Block` entities for that chunk's terrain.

This continuous process ensures that the world seamlessly streams in and out of existence around the player as they move, providing a smooth and scalable gameplay experience.