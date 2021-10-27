import { KeyMap } from './keyboard'
import { GameInterface } from './game'
import { TerrianInterface } from './terrian'
import { ConfigureInterface } from './configure'
import { isCollideCameraAndBlock } from './utils'
import { BLOCK, CAMERA, GRAVITY } from './constant'

interface CharacterInterface {
  keymaps: KeyMap[]
  ySpeed: number
  calcurateGravity: () => void
}

class Character implements CharacterInterface {
  private game: GameInterface
  private config: ConfigureInterface
  private terrian: TerrianInterface

  public ySpeed = 0
  private canJump = true

  public keymaps: KeyMap[]

  constructor(game: GameInterface, config: ConfigureInterface, terrian: TerrianInterface) {
    this.game = game
    this.config = config
    this.terrian = terrian

    this.keymaps = [
      { key: 'w', callback: this.handleUp.bind(this) },
      { key: 'a', callback: this.handleLeft.bind(this) },
      { key: 's', callback: this.handleDown.bind(this) },
      { key: 'd', callback: this.handleRight.bind(this) },
      { key: ' ', callback: this.handleJump.bind(this) },
    ]
  }

  public calcurateGravity(): void {
    this.game.camera.position.y = this.game.camera.position.y - this.ySpeed
    this.ySpeed = this.ySpeed + GRAVITY

    this.terrian.chunks.forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera, block) &&
        this.game.camera.position.y <= block.position.y + BLOCK.SIZE / 2 &&
        this.game.camera.position.y >= block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.camera.position.y = block.position.y + BLOCK.SIZE / 2
        this.ySpeed = 0
        this.canJump = true
      }
    })
  }

  /**
   * handle key event
   */
  private handleUp() {
    this.game.controls.moveForward(CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.chunks.forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera, block) &&
        this.game.camera.position.y <= block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveForward(-1 * CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleLeft() {
    this.game.controls.moveRight(-1 * CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.chunks.forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera, block) &&
        this.game.camera.position.y === block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveRight(CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleDown() {
    this.game.controls.moveForward(-1 * CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.chunks.forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera, block) &&
        this.game.camera.position.y === block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveForward(CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleRight() {
    this.game.controls.moveRight(CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.chunks.forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera, block) &&
        this.game.camera.position.y === block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveRight(-1 * CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleJump() {
    if (!this.canJump) return
    this.canJump = false
    this.ySpeed = -1 * CAMERA.JUMP_HEIGHT
  }
}

export { Character, CharacterInterface }
