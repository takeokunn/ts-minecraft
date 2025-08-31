# Update Target System

This document specifies the `updateTargetSystem`, which is responsible for identifying the object in the player's line of sight and recording that information in a `Target` component.

## 1. Design Philosophy: Separation of Concerns

This feature is designed with a strong emphasis on the **separation of concerns**:

-   **`RaycastService` (Infrastructure Layer)**: Knows *how* to perform a raycast against the scene using a specific rendering engine like Three.js. It abstracts away the low-level details of the renderer.
-   **`updateTargetSystem` (System Layer)**: Knows *why* a raycast is needed. It calls the `RaycastService` to get the result and updates the player's `Target` component.
-   **`blockInteractionSystem` (System Layer)**: Reads the `Target` component and performs an *action*, such as placing or destroying a block.

This design ensures that the game logic (`updateTargetSystem`) remains completely decoupled from the details of the rendering engine.

## 2. `updateTargetSystem` Responsibilities

The responsibility of the `updateTargetSystem` is narrowly focused on querying the world state and recording the result as a different state.

1.  **Invoke Raycast**: It calls the `RaycastService` to get the result of a raycast originating from the center of the camera.
2.  **If a Target is Found**:
    -   The `RaycastService` returns information about the intersection, including the `instanceId` of the mesh that was hit. Using the map stored in the `RenderContext`, it translates this `instanceId` back to a specific `EntityId`.
    -   The system then attaches (or updates) a `Target` component on the player entity. This component contains the target block's `EntityId`, its `Position`, and the normal vector of the face that the ray hit.
    -   It also updates a `TargetHighlight` state within the `RenderContext`, which the `renderer` uses to draw a visual highlight (e.g., an outline) around the targeted block.
3.  **If No Target is Found**:
    -   It removes the `Target` component from the player entity.
    -   It clears the `TargetHighlight` state in the `RenderContext` to remove any visual highlight from the scene.

## 3. Data Flow

`Input` -> `cameraControlSystem` -> `CameraState` -> `RaycastService` -> **`updateTargetSystem`** -> `Target`

1.  The `cameraControlSystem` updates the camera's orientation in the `CameraState` component.
2.  The `RaycastService`, when called, internally uses the current camera state (via the Three.js context) to perform the raycast.
3.  The `updateTargetSystem` invokes the `RaycastService`.
4.  The `updateTargetSystem` takes the returned result and attaches a `Target` component to the player entity.
5.  Subsequent systems, like the `blockInteractionSystem`, can then read this `Target` component to execute actions based on what the player is looking at.
