# Block Interaction System

The block interaction system allows the player to place and destroy blocks in the world. It connects player input with the world modification logic, acting as a bridge between the player's intent and the game state.

## Core Components

This system primarily interacts with the player entity, which is expected to have the following components:

-   **`Player`**: A tag component identifying the entity as the player.
-   **`InputState`**: Contains the current state of player inputs, specifically the `place` and `destroy` flags which are checked by this system.
-   **`Hotbar`**: Holds the inventory slots available to the player, determining which type of block to place based on `slots` and `selectedSlot`.
-   **`Target`**: Attached to the player by the `updateTargetSystem`. It reliably contains the `entityId` of the targeted block, its position, and the face normal that was hit. The presence of this component indicates the player is looking at a block.
-   **`Collider`**: The player's collider, used to prevent placing blocks inside the player's own bounding box.
-   **`Position`**: The player's position, also used for the collision check during block placement.

## Core System: `blockInteractionSystem`

-   **Responsibility**: To act on the player's input to place or destroy the targeted block.
-   **Source**: `src/systems/block-interaction.ts`
-   **Process**:
    1.  **Query**: It uses `world.querySingle` to find the single player entity that has all the required components (`InputState`, `Target`, `Hotbar`, etc.). If the player isn't targeting a block (i.e., the `Target` component is absent), the system does nothing for that frame.
    2.  **Check Input**: It checks the `destroy` and `place` boolean flags in the `InputState` component.
    3.  **Destroy Block**: If the `destroy` action is triggered:
        -   It reads the `entityId` of the target block directly from the `Target.id`.
        -   It instructs the `World` to remove the entity with that ID.
        -   It notifies the `GameState` service to record the destroyed block's position, ensuring this change can be saved.
    4.  **Place Block**: If the `place` action is triggered:
        -   It calculates the new block's position by adding the `Target.face` vector (the normal of the targeted face) to the `Target.position`.
        -   It performs an AABB collision check to ensure the new block won't be placed inside the player's own `Collider`.
        -   It reads the currently selected `BlockType` from the player's `Hotbar`.
        -   It calls the **`createBlock` archetype** (from `domain/archetypes.ts`) to create the new block entity with all necessary components (`Position`, `Block`, `Collider`).
        -   It notifies the `GameState` service to record the newly placed block's position and type for save purposes.

## Execution Order

The system scheduler ensures the following execution order:

`updateTargetSystem` -> **`blockInteractionSystem`**

This order is crucial. The `updateTargetSystem` first determines what the player is looking at and attaches or updates the `Target` component. Then, in the same frame, the `blockInteractionSystem` can immediately act upon that fresh and reliable target information.
