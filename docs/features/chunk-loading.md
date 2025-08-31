# Chunk Loading System

The chunk loading system is a performance-critical feature responsible for dynamically loading and unloading sections of the world, known as chunks, based on the player's position. This creates the illusion of an infinite world while keeping memory usage and the number of active entities manageable.

## Core Components

-   **`Chunk`**: An entity that represents a vertical section of the world (typically 16x16 blocks wide and extending the full world height). It stores its coordinates, `x` and `z`. These entities act as markers for which parts of the world are currently active.
-   **`Position`**: The player's `Position` component is used as the central point for determining which chunks should be loaded.
-   **`TerrainBlock`**: The blocks that constitute the terrain within a chunk. These are created and removed by the chunk loading system.

## Core System: `chunkLoadingSystem`

The logic is managed by the `chunkLoadingSystem` (`src/systems/chunk-loading.ts`).

### How It Works

The system runs continuously in the game loop and performs the following steps:

1.  **Get Player Position**: The system first finds the player entity and reads its `Position` component.
2.  **Determine Current Chunk**: It calculates which chunk the player is currently in based on their `(x, z)` coordinates.
3.  **Identify Required Chunks**: It defines a `renderDistance` (e.g., 8 chunks in every direction). It then creates a set of all chunk coordinates that *should* be loaded around the player.
4.  **Query Existing Chunks**: The system queries the `World` for all entities that currently have a `Chunk` component.
5.  **Compare and Diff**: It compares the set of required chunks with the set of currently loaded chunks.
    -   **Chunks to Load**: Any chunk in the "required" set but not in the "loaded" set needs to be generated.
    -   **Chunks to Unload**: Any chunk in the "loaded" set but not in the "required" set is now out of range and needs to be removed.
6.  **Unload Chunks**: For each chunk to be unloaded:
    -   The system finds all `TerrainBlock` entities that are located within the boundaries of that chunk.
    -   It removes all of these block entities from the `World`.
    -   Finally, it removes the `Chunk` marker entity itself.
7.  **Load Chunks**: For each chunk to be loaded:
    -   It creates a new `Chunk` marker entity to track the newly loaded area.
    -   It then invokes the world generation logic (see [World Generation](./generation.md)) for the specific coordinates of this new chunk, creating all the necessary `TerrainBlock` entities.

This continuous process ensures that the world seamlessly streams in and out of existence around the player as they move.
