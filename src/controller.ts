import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { Camera } from '@src/camera'

interface ControllerInterface {
  moveForward: (distance: number) => void
  moveRight: (distance: number) => void
}

class Controller implements ControllerInterface {
  private pointerLock: PointerLockControls
  private isLock: boolean = false

  constructor(camera: Camera) {
    this.pointerLock = new PointerLockControls(camera.perspective, document.body)
    document.body.addEventListener('click', () => {
      this.isLock = !this.isLock
      this.isLock ? this.pointerLock.lock() : this.pointerLock.unlock()
    })
  }

  public moveForward(distance: number): void {
    this.pointerLock.moveForward(distance)
  }

  public moveRight(distance: number): void {
    this.pointerLock.moveRight(distance)
  }
}

export { Controller }
