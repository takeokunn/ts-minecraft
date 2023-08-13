import { PerspectiveCamera } from 'three'

import { CAMERA } from '@src/constant'

interface CameraInterface {
  perspective: PerspectiveCamera
}

class Camera implements CameraInterface {
  public perspective: PerspectiveCamera

  constructor() {
    this.perspective = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, CAMERA.PERSPECTIVE.NEAR)
    this.perspective.position.x = 0
    this.perspective.position.z = 0
    this.perspective.position.y = CAMERA.INITIALIZE.POSITION_Y
  }

  public setFar(far: number): void {
    this.perspective.far = far
    this.perspective.updateProjectionMatrix()
  }

  public handleResizeWindow(): void {
    this.perspective.aspect = window.innerWidth / window.innerHeight
    this.perspective.updateProjectionMatrix()
  }
}

export { Camera, CameraInterface }