# Camera Systems

The camera's behavior is managed by two distinct systems, each with a clear responsibility. This design creates a clean separation of concerns between handling player input and updating the rendering engine.

1.  **`cameraControlSystem`**: Handles **input -> state**.
2.  **`cameraSystem`**: Handles **state -> rendering engine**.

---

## `cameraControlSystem`

-   **Responsibility**: To update the player's `CameraState` component based on user mouse input.
-   **Source**: `src/systems/camera-control.ts`
-   **Process**:
    1.  It polls for mouse movement (`movementX`, `movementY`) via the `InputService`.
    2.  It calculates the new rotation values for yaw (left/right) and pitch (up/down).
    3.  It applies constraints, clamping the pitch between -90 and +90 degrees to prevent the camera from flipping over.
    4.  It updates the player entity's `CameraState` component with the new `yaw` and `pitch` values.

This system ensures that the ECS `CameraState` component is always the single source of truth for the player's intended perspective.

## `cameraSystem`

-   **Responsibility**: To synchronize the Three.js camera's position and orientation with the player entity's `Position` and `CameraState` components.
-   **Source**: `src/systems/camera.ts`
-   **Process**:
    1.  It queries the `World` for the player entity that has `Position` and `CameraState` components.
    2.  It retrieves the main `THREE.Camera` object from the `RenderContext` service.
    3.  It sets the camera's position based on the player's `Position` component, typically adding a small offset on the y-axis for eye level.
    4.  It sets the camera's rotation (using Euler angles) based on the `yaw` and `pitch` values from the `CameraState` component.

## Execution Order

The system scheduler ensures a critical execution order:

`cameraControlSystem` -> ... (e.g., `playerMovementSystem`, `physicsSystem`, `collisionSystem`) ... -> `cameraSystem`

1.  `cameraControlSystem` runs early in the frame to capture the player's input and update the `CameraState`.
2.  Other game logic systems run, calculating the player's final, collision-resolved `Position` for the frame.
3.  `cameraSystem` runs near the end of the frame. This guarantees it uses the most up-to-date player position and camera rotation to update the Three.js camera just before the `renderer` draws the scene.

This division ensures that game logic (input handling) remains decoupled from the rendering engine, improving testability and modularity.