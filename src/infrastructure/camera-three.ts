import { PerspectiveCamera, WebGLRenderer } from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ThreeCamera } from '@/domain/types';
import { CameraState, Position } from '@/domain/components';

export const PLAYER_EYE_HEIGHT = 1.6;

export function createThreeCamera(canvas: HTMLElement): ThreeCamera {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const controls = new PointerLockControls(camera, canvas);
  return {
    camera,
    controls,
  };
}

export function syncCameraToComponent(
  threeCamera: ThreeCamera,
  position: Position,
  cameraState: CameraState,
): void {
  const controlsObject = threeCamera.controls.getObject();
  controlsObject.position.set(position.x, position.y + PLAYER_EYE_HEIGHT, position.z);
  controlsObject.rotation.order = 'YXZ';
  controlsObject.rotation.y = cameraState.yaw;
  threeCamera.camera.rotation.x = cameraState.pitch;
}

export function moveCameraRight(threeCamera: ThreeCamera, delta: number): void {
  threeCamera.controls.moveRight(delta);
}

export function rotateCameraPitch(threeCamera: ThreeCamera, delta: number): void {
  const camera = threeCamera.camera;
  const newPitch = camera.rotation.x + delta;
  camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newPitch));
}

/**
 * Rotates the camera's yaw (left/right).
 * @param threeCamera The camera state object.
 * @param delta The angle in radians to rotate.
 */
export function rotateCameraYaw(threeCamera: ThreeCamera, delta: number): void {
  // In PointerLockControls, yaw is controlled by rotating the parent object.
  threeCamera.controls.getObject().rotation.y += delta;
}

export function getCameraYaw(threeCamera: ThreeCamera): number {
  return threeCamera.controls.getObject().rotation.y;
}

export function getCameraPitch(threeCamera: ThreeCamera): number {
  return threeCamera.camera.rotation.x;
}

export function handleCameraResize(threeCamera: ThreeCamera, renderer: WebGLRenderer): void {
  threeCamera.camera.aspect = window.innerWidth / window.innerHeight;
  threeCamera.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function lockMouse(threeCamera: ThreeCamera): void {
  threeCamera.controls.lock();
}

export function unlockMouse(threeCamera: ThreeCamera): void {
  threeCamera.controls.unlock();
}
