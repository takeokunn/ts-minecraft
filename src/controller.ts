import { PerspectiveCamera, Raycaster, Vector2 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { CAMERA } from '@src/constant'
import { windowSize } from '@src/assets'

interface ControllerInterface {
  mouse: Vector2
  raycaster: Raycaster
  perspective: PerspectiveCamera

  setFar: (far: number) => void
  handleResizeWindow: () => void
  moveForward: (distance: number) => void
  moveRight: (distance: number) => void
}

class Controller implements ControllerInterface {
  public mouse: Vector2
  public raycaster: Raycaster
  public perspective: PerspectiveCamera

  private pointerLock: PointerLockControls
  private isLock: boolean = false

  constructor() {
    this.mouse = new Vector2()
    this.mouse.x = 0.5 * 2 - 1
    this.mouse.y = -1 * 0.5 * 2 + 1

    this.perspective = new PerspectiveCamera(75, windowSize.width / windowSize.height, 0.1, CAMERA.PERSPECTIVE.NEAR)
    this.perspective.position.x = 0
    this.perspective.position.z = 0
    this.perspective.position.y = CAMERA.INITIALIZE.POSITION_Y

    this.raycaster = new Raycaster()

    this.pointerLock = new PointerLockControls(this.perspective, document.body)

    document.body.addEventListener('click', this.handleClick.bind(this))
  }

  private handleClick(): void {
    this.isLock = !this.isLock
    this.isLock ? this.pointerLock.lock() : this.pointerLock.unlock()
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
