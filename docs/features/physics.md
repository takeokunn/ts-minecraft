# Physics System

The physics system is responsible for applying universal forces to entities, most notably gravity. It is a simple system that ensures entities behave in a physically plausible way over time.

## Core Components

The physics simulation acts upon entities that possess the following components:

-   **`Velocity`**: Represents the current velocity of an entity. The physics system primarily modifies the `dy` (vertical) component of this.
-   **`Gravity`**: A component that contains a `value` indicating the strength of the gravitational force to be applied. Entities without this component are ignored by the gravity calculation.
-   **`Player`**: The `Player` component is also queried to check its `isGrounded` status. Gravity is not applied if the player is currently on the ground.

## Core System: `physicsSystem`

The logic is contained entirely within the `physicsSystem` (`src/systems/physics.ts`).

### How It Works

The system's execution flow is straightforward:

1.  **Query**: The system queries the `World` for all entities that have a `Velocity`, `Gravity`, and `Player` component.
    -   *Note: Currently, this system is tightly coupled to the player entity. A more generic implementation would query for entities with `Velocity` and `Gravity`, and separately check for a `Player` component or a more generic `Grounded` component if other entities were to be affected by gravity.*
2.  **Check Ground State**: For each entity found, it checks the `player.isGrounded` flag.
3.  **Apply Gravity**: If `isGrounded` is `false`, the system updates the entity's `Velocity` component by subtracting the `gravity.value` from the current `dy`.

    ```typescript
    // Simplified logic from physicsSystem
    const newDy = velocity.dy - gravity.value;
    world.updateComponent(id, new Velocity({ ...velocity, dy: newDy }));
    ```

## Relationship with Other Systems

The `physicsSystem` runs **after** the `playerControlSystem` but **before** the `collisionSystem`. This execution order is critical:

1.  `playerControlSystem`: Determines the player's *intent* to move (including jumping, which sets an initial upward `dy` velocity).
2.  **`physicsSystem`**: Modifies the `dy` velocity based on gravity.
3.  `collisionSystem`: Takes the final, gravity-adjusted velocity and attempts to move the entity, resolving any collisions with the terrain. The `collisionSystem` is also responsible for setting the `isGrounded` flag to `true` if a downward collision is detected.

This clear separation of concerns ensures that each system has a single, well-defined responsibility, making the overall simulation easier to understand and debug.
