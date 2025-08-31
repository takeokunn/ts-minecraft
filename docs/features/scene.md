# Scene Management System

The scene management system is the critical link between the abstract, data-oriented ECS world and the visual representation rendered by Three.js. Its primary responsibility is to efficiently synchronize the state of renderable entities in the ECS with corresponding objects in the Three.js scene.

## Core Components

-   **`Renderable`**: Any entity with this component is considered visible. It contains:
    -   `blockType`: The type of block (e.g., `grass`, `dirt`), which determines the material/texture to be used.
    -   `geometry`: The type of mesh to display (currently "box" for all blocks).
-   **`Position`**: The `(x, y, z)` coordinates of the entity, used to place the object in the Three.js scene.

## Core System: `sceneSystem`

-   **Source**: `src/systems/scene.ts`

To achieve the high performance required to render a world made of thousands of blocks, this system is built around **Instanced Rendering**.

### Instanced Rendering

Instead of creating a separate `THREE.Mesh` for every single block (which would be extremely inefficient and lead to thousands of draw calls), the system groups all blocks of the same `blockType` into a single `THREE.InstancedMesh`.

An `InstancedMesh` allows the GPU to render thousands of objects with the same geometry and material in a single draw call, each with a different transformation (position, rotation, scale). This is the key optimization that makes rendering a large voxel world feasible on the web.

### How It Works

1.  **Initialization & Mesh Management**:
    -   The system maintains a registry (`Map`) of `InstancedMesh` objects, one for each `BlockType`.
    -   When a new type of block needs to be rendered for the first time, the system requests the appropriate material from the `MaterialManager` service and creates a new `InstancedMesh` for it. This mesh is then added to the main Three.js scene.
2.  **Efficient Querying (SoA)**:
    -   On each frame, the system performs a highly efficient **Structure of Arrays (SoA)** query (`world.querySoA`) to get all entities with `Position` and `Renderable` components. This query returns component data as contiguous arrays (e.g., one array for all x-coordinates, one for all y-coordinates), which is very cache-friendly for the CPU.
3.  **Matrix Updates**:
    -   The system iterates through the queried entities. For each entity, it constructs a `THREE.Matrix4` transformation matrix based on its `Position`.
    -   It then sets this matrix on the appropriate `InstancedMesh` (based on the block's `blockType`) at the next available instance index.
4.  **Instance Count & ID Mapping**:
    -   The system keeps track of how many instances of each block type are being rendered. After processing all entities, it updates the `count` property of each `InstancedMesh` to tell the renderer how many instances to draw.
    -   Crucially, it also stores a mapping from the `[blockType, instanceId]` to the `EntityId` in the `RenderContext` service. This map is later used by the `raycastSystem` to quickly identify which entity the mouse is pointing at.
5.  **Resetting and Synchronization**:
    -   At the beginning of each frame, the `count` for each `InstancedMesh` is reset to zero, and the system rebuilds the entire set of transformations. This stateless, "from-scratch" approach each frame simplifies the logic for handling added or removed blocks, as no complex diffing is required.

This process ensures that the Three.js scene is an exact visual replica of the ECS state, updated with maximum efficiency on every single frame.
