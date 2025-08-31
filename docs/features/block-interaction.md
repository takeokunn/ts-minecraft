# Block Interaction System

The block interaction system allows the player to place and destroy blocks in the world. It connects player input with the world modification logic.

## Core Components

This system primarily interacts with the player entity and the blocks being targeted.

-   **`Target`**: A component attached to the player entity. It stores information about the block the player is currently looking at, including:
    -   `id`: The `EntityId` of the targeted block.
    -   `position`: The coordinates of the targeted block.
    -   `face`: A vector representing the face of the block that was hit by the raycast (e.g., `[0, 1, 0]` for the top face).
-   **`InputState`**: The player's input component, specifically the `place` and `destroy` (left/right click) flags.
-   **`Hotbar`**: The player's hotbar component, which holds the `slots` of available block types and the `selectedSlot`. This is used to determine which type of block to place.
-   **`TerrainBlock`**: A tag component that identifies an entity as a solid, interactable block in the world.
-   **`Renderable`**: A component on block entities that defines their appearance.

## Core Systems

The functionality is split between two systems that run in sequence:

1.  **`raycastSystem` (`src/systems/raycast.ts`)**
    -   **Responsibility**: To determine what block the player is looking at.
    -   **Process**:
        1.  It gets the camera's current position and direction from the `Camera` service.
        2.  It performs a raycast into the scene using the rendering engine's capabilities (abstracted via the `Renderer` service or a similar mechanism).
        3.  If the ray intersects with a `TerrainBlock`, the system creates a `Target` component containing the block's entity ID and the intersection details.
        4.  It attaches this `Target` component to the player entity. If no block is targeted, it removes any existing `Target` component.

2.  **`blockInteractionSystem` (`src/systems/block-interaction.ts`)**
    -   **Responsibility**: To act on the player's input to place or destroy the targeted block.
    -   **Process**:
        1.  **Query**: It queries for the player entity that has both an `InputState` and a `Target` component. If no such entity exists (i.e., the player isn't targeting anything), the system does nothing.
        2.  **Check Input**: It checks the `place` and `destroy` flags in the `InputState`.
        3.  **Destroy Block**: If the `destroy` action is triggered, it tells the `World` to remove the entity whose ID is stored in the `Target.id`.
        4.  **Place Block**: If the `place` action is triggered:
            -   It reads the currently selected `BlockType` from the player's `Hotbar` component.
            -   It calculates the new block's position by adding the `Target.face` vector to the `Target.position`.
            -   It tells the `World` to create a new entity with `Position`, `TerrainBlock`, and `Renderable` components at the calculated position.

## Execution Order

The execution order is critical for responsiveness:

`raycastSystem` -> `blockInteractionSystem`

This ensures that on the same frame a player looks at a block, the `Target` component is updated, and any subsequent interaction logic can immediately act upon that fresh target information. Both systems run after the player's position and camera have been updated for the frame.