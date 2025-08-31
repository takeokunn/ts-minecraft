# Camera System

The camera system is responsible for synchronizing the in-game camera's position and orientation with the player's entity state. It ensures that what the player sees accurately reflects their position and perspective within the game world.

This functionality is a bridge between the Entity Component System (ECS) world and the rendering engine (Three.js).

## Core Components

The camera's behavior is primarily driven by the state of the player entity, using the following components:

-   **`Position`**: The `(x, y, z)` coordinates of the player entity in the world. The camera's position is derived directly from this.
-   **`CameraState`**: Stores the rotational state of the camera.
    -   `pitch`: The vertical rotation (looking up and down).
    -   `yaw`: The horizontal rotation (looking left and right).

## Core System: `playerControlSystem`

Unlike other features, camera logic is not handled in a dedicated `cameraSystem`. Instead, it is tightly coupled with player input and is managed directly within the `playerControlSystem` (`src/systems/player.ts`).

### How It Works

1.  **Input Polling**: The system polls for mouse movement via the `Input` service.
2.  **Camera Service Interaction**: It then uses the abstract `Camera` service to update the camera's rotation.
    -   `cameraService.moveRight(-mouseState.dx * 0.002)`: Updates the yaw.
    -   `cameraService.rotatePitch(-mouseState.dy * 0.002)`: Updates the pitch.
3.  **State Synchronization**: After updating the camera in the rendering engine via the service, the system retrieves the final, clamped rotation values (`yaw` and `pitch`) back from the `Camera` service.
4.  **Component Update**: It updates the player entity's `CameraState` component with these new rotation values. This ensures that the ECS state is always in sync with what is being rendered, which is crucial for features like saving the game.

## Abstracting the Engine

The `playerControlSystem` does not directly interact with Three.js. Instead, it communicates through the `Camera` service (`src/runtime/services.ts`), an abstraction that decouples the game logic from the specific rendering engine implementation.

-   **Interface**: `Camera` defines a contract for camera operations (`moveRight`, `rotatePitch`, `getYaw`, `getPitch`).
-   **Implementation**: `CameraLive` (`src/infrastructure/renderer-three.ts`) provides the concrete implementation for Three.js, translating the service calls into manipulations of `PointerLockControls`.

This separation of concerns makes the system more modular and easier to test, and it would simplify any future migration to a different rendering engine.