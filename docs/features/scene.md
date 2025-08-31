# Scene Management System

The scene management system is the critical link between the abstract, data-oriented ECS world and the visual representation rendered by Three.js. Its primary responsibility is to efficiently synchronize the state of `Renderable` entities in the ECS with corresponding objects in the Three.js scene.

## Core Components

-   **`Renderable`**: Any entity with this component is considered visible to the scene management system. It contains:
    -   `geometry`: The type of mesh to display (e.g., "box").
    -   `blockType`: The type of block, which determines the material/texture to be used.
-   **`Position`**: The `(x, y, z)` coordinates of the entity, used to place the object in the Three.js scene.

## Core System: `sceneSystem`

The logic is contained within the `sceneSystem` (`src/systems/scene.ts`). To achieve high performance, this system uses **Instanced Static Meshes**.

### Instanced Rendering

Instead of creating a separate `THREE.Mesh` for every single block (which would be extremely inefficient), the system groups all blocks of the same `blockType` into a single `THREE.InstancedMesh`.

An `InstancedMesh` is a single draw call that can render thousands of identical geometries with different positions, rotations, and scales. This is the key optimization that makes rendering a large voxel world feasible.

### How It Works

1.  **Initialization**: When the system first runs, it creates an `InstancedMesh` for each possible `BlockType`. These meshes are initially empty.
2.  **Query**: On each frame, the system queries the `World` for all entities that have both a `Renderable` and a `Position` component.
3.  **Grouping**: It groups these entities by their `blockType`.
4.  **Matrix Updates**: For each group:
    -   It iterates through the entities in the group.
    -   For each entity, it creates a `THREE.Matrix4` that represents its position (and any rotation or scale).
    -   It sets this transformation matrix on the corresponding `InstancedMesh` at a specific index.
5.  **Count Update**: After setting all the matrices, it updates the `count` property of the `InstancedMesh`. This tells the renderer how many instances to actually draw for that frame.
6.  **Handling Added/Removed Blocks**: The system needs to intelligently track which blocks have been added or removed since the last frame to update the `InstancedMesh` correctly. A common approach is to maintain a map between the `EntityId` and its corresponding `instanceId` within the `InstancedMesh`.

This process ensures that the Three.js scene is an exact visual replica of the ECS state, updated efficiently on every single frame.