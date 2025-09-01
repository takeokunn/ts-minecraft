import { PerspectiveCamera, WebGLRenderer } from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { CameraState, Position } from '@/domain/components';
import { clampPitch } from '@/domain/camera-logic';

// --- Type Definitions ---

export type ThreeCamera = {
  readonly camera: PerspectiveCamera;
  readonly controls: PointerLockControls;
};

// --- Constants ---

/**
 * The vertical offset of the camera from the player's position, representing eye level.
 */
export const PLAYER_EYE_HEIGHT = 1.6;

// --- Functions ---

/**
 * Creates and initializes a Three.js camera and PointerLockControls.
 * @param canvas The HTML element to attach the controls to.
 * @returns A `ThreeCamera` object containing the camera and controls.
 */
export function createThreeCamera(canvas: HTMLElement): ThreeCamera {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const controls = new PointerLockControls(camera, canvas);
  // Set the rotation order to avoid gimbal lock issues, as the camera is nested
  // inside a parent object for yaw control.
  controls.getObject().rotation.order = 'YXZ';
  return { camera, controls };
}

/**
 * Synchronizes the Three.js camera's position and rotation with the player's component state.
 */
export function syncCameraToComponent(
  threeCamera: ThreeCamera,
  position: Position,
  cameraState: CameraState,
): void {
  const controlsObject = threeCamera.controls.getObject();
  controlsObject.position.set(position.x, position.y + PLAYER_EYE_HEIGHT, position.z);
  controlsObject.rotation.y = cameraState.yaw;
  threeCamera.camera.rotation.x = cameraState.pitch;
}

/**
 * Moves the camera horizontally (right or left).
 */
export function moveCameraRight(threeCamera: ThreeCamera, delta: number): void {
  threeCamera.controls.moveRight(delta);
}

/**
 * Rotates the camera's pitch (up/down), clamping the value to prevent flipping.
 */
export function rotateCameraPitch(threeCamera: ThreeCamera, delta: number): void {
  if (Number.isNaN(delta)) {
    return;
  }
  const camera = threeCamera.camera;
  const newPitch = camera.rotation.x + delta;
  camera.rotation.x = clampPitch(newPitch);
}

/**
 * Rotates the camera's yaw (left/right).
 */
export function rotateCameraYaw(threeCamera: ThreeCamera, delta: number): void {
  // In PointerLockControls, yaw is controlled by rotating the parent object.
  threeCamera.controls.getObject().rotation.y += delta;
}

/**
 * Retrieves the current yaw of the camera.
 */
export function getCameraYaw(threeCamera: ThreeCamera): number {
  return threeCamera.controls.getObject().rotation.y;
}

/**
 * Retrieves the current pitch of the camera.
 */
export function getCameraPitch(threeCamera: ThreeCamera): number {
  return threeCamera.camera.rotation.x;
}

/**
 * Handles window resize events to update the camera's aspect ratio and the renderer's size.
 */
export function handleCameraResize(threeCamera: ThreeCamera, renderer: WebGLRenderer): void {
  threeCamera.camera.aspect = window.innerWidth / window.innerHeight;
  threeCamera.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Locks the mouse pointer for camera control.
 */
export function lockMouse(threeCamera: ThreeCamera): void {
  threeCamera.controls.lock();
}

/**
 * Unlocks the mouse pointer.
 */
export function unlockMouse(threeCamera: ThreeCamera): void {
  threeCamera.controls.unlock();
}