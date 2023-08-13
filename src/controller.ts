import { PerspectiveCamera } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { CAMERA } from '@src/constant'
import { windowSize } from '@src/assets'

interface ControllerInterface {
  moveForward: (distance: number) => void
  moveRight: (distance: number) => void
}

class Controller implements ControllerInterface {
  public perspective: PerspectiveCamera
  private pointerLock: PointerLockControls
  private isLock: boolean = false

  constructor() {
    this.perspective = new PerspectiveCamera(75, windowSize.width / windowSize.height, 0.1, CAMERA.PERSPECTIVE.NEAR)
    this.perspective.position.x = 0
    this.perspective.position.z = 0
    this.perspective.position.y = CAMERA.INITIALIZE.POSITION_Y

    this.pointerLock = new PointerLockControls(this.perspective, document.body)
    document.body.addEventListener('click', () => {
      this.isLock = !this.isLock
      this.isLock ? this.pointerLock.lock() : this.pointerLock.unlock()
    })
  }

  public setFar(far: number): void {
    this.perspective.far = far
    this.perspective.updateProjectionMatrix()
  }

  public handleResizeWindow(): void {
    this.perspective.aspect = windowSize.width / windowSize.height
    this.perspective.updateProjectionMatrix()
  }

  public moveForward(distance: number): void {
    this.pointerLock.moveForward(distance)
  }

  public moveRight(distance: number): void {
    this.pointerLock.moveRight(distance)
  }
}

export { Controller }
