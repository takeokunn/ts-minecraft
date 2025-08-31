# Collision System

The collision system is responsible for moving entities with velocity and resolving any collisions with the terrain. It ensures that entities cannot pass through solid blocks and correctly interact with the ground.

## Core Components

The collision detection and resolution process involves the following components:

-   **`Position`**: The entity's current `(x, y, z)` coordinates. This component is updated by the collision system after movement and collision resolution.
-   **`Velocity`**: The entity's current velocity. This is read to determine the intended movement for the current frame.
-   **`Collider`**: Defines the entity's Axis-Aligned Bounding Box (AABB) with its `width`, `height`, and `depth`. This is used to detect intersections with terrain blocks.
-   **`Player`**: The `Player` component's `isGrounded` flag is updated by this system based on the collision results.

## Core System: `collisionSystem`

The entire logic is encapsulated in the `collisionSystem` (`src/systems/collision.ts`).

### How It Works

The system executes the following steps for each entity with `Position`, `Velocity`, and `Collider` components:

1.  **Query**: It queries the `World` for all relevant entities.
2.  **Calculate New Position**: It calculates the potential next position by adding the current velocity to the current position.
3.  **Broad-Phase Collision Check**:
    -   It determines the AABB of the entity at its *potential* new position.
    -   It queries the `World` for all nearby `TerrainBlock` entities that could possibly intersect with this AABB. This is a crucial optimization to avoid checking against every block in the world.
4.  **Narrow-Phase Collision Resolution (Axis by Axis)**:
    -   The system resolves collisions separately for each axis (X, Y, Z). This is a common and effective technique to handle sliding along walls and floors correctly.
    -   **For each axis**:
        -   It checks if the entity's AABB, moved only along that axis, intersects with any of the nearby terrain blocks.
        -   If an intersection occurs, the entity's velocity on that axis is set to `0`, and its position is adjusted to be just outside the block it collided with.
        -   If a collision occurs on the **Y-axis** while the entity was moving downwards, the `isGrounded` flag on the `Player` component is set to `true`.
5.  **Update Components**: After resolving collisions on all three axes, the system updates the entity's `Position` and `Player` components in the `World` with the final, corrected values.

## Execution Order

The `collisionSystem` runs **after** the `physicsSystem`. This is essential because:

1.  `playerControlSystem` and `physicsSystem` first determine the final "intended" velocity for the frame (including input and gravity).
2.  `collisionSystem` then takes this final velocity and acts as the arbiter of movement, ensuring the entity adheres to the physical boundaries of the world.

This ordering guarantees that collision detection is always performed on the most up-to-date state of an entity's motion.
