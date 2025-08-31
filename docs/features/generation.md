# World Generation System

The world generation system is responsible for creating the initial terrain of the game world. It uses procedural generation techniques to create a varied and interesting landscape for the player to explore.

## Core Components

Generated terrain entities are composed of the following components:

-   **`Position`**: The `(x, y, z)` coordinates of the block in the world.
-   **`TerrainBlock`**: A tag component that marks the entity as a solid part of the terrain, making it collidable and interactable.
-   **`Renderable`**: A component that defines the block's appearance, including its `blockType` (e.g., `grass`, `dirt`, `stone`).

## Core System: `generationSystem`

The entire world generation process is handled by the `generationSystem` (`src/systems/generation.ts`). This system runs once at the beginning of the game when a new world is created.

### How It Works

The generation process follows these main steps:

1.  **Configuration**: The system defines constants for the world's dimensions, such as `WORLD_WIDTH`, `WORLD_DEPTH`, and `WORLD_HEIGHT`.
2.  **Noise Generation**: It initializes a simplex noise generator using a seed. This ensures that the same seed will always produce the identical world, allowing for reproducible landscapes.
3.  **Iterative Block Placement**: The system iterates through each `(x, z)` coordinate within the world's horizontal boundaries.
    -   **Height Calculation**: For each `(x, z)` pair, it samples the simplex noise function. The output of the noise function is mapped to a terrain height (`y`). This creates the smooth, rolling hills and valleys of the landscape.
    -   **Block Type Determination**: Based on the calculated height (`y`), the system determines the type of block to place.
        -   The top layer is typically `grass`.
        -   A few layers beneath the grass are `dirt`.
        -   All layers below the dirt are `stone`.
    -   **Entity Creation**: The system creates entities in the `World` for each vertical column of blocks, from the bottom of the world up to the calculated height `y`. Each entity is given the appropriate `Position`, `TerrainBlock`, and `Renderable` components.

## Chunking and Performance

While the current `generationSystem` generates the entire world at once, this approach is not scalable for larger, "infinite" worlds. In a more advanced setup, this logic would be integrated with the **Chunk Loading** system.

Instead of generating everything upfront, the generation logic would be invoked by the `chunk-loading` system whenever a new, unexplored chunk enters the player's vicinity. The noise generator would ensure that adjacent chunks are generated seamlessly, creating the illusion of a continuous, infinite world.
