import { KeyMap } from '@src/keyboard'
import { GameInterface } from '@src/game'
import { TerrianInterface } from '@src/terrian'
import { ConfigureInterface } from '@src/configure'
import { isCollideCameraAndBlock } from '@src/utils'
import { BLOCK, CAMERA, GRAVITY } from '@src/constant'

interface CharacterInterface {
  keymaps: KeyMap[]
  calcurateGravity: () => void
}

class Character implements CharacterInterface {
  private game: GameInterface
  private config: ConfigureInterface
  private terrian: TerrianInterface

  private ySpeed = 0
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
    this.game.camera.perspective.position.y = this.game.camera.perspective.position.y - this.ySpeed
    this.ySpeed = this.ySpeed + GRAVITY

    this.terrian.getChunkBlocks().forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera.perspective, block) &&
        this.game.camera.perspective.position.y <= block.position.y + BLOCK.SIZE / 2 &&
        this.game.camera.perspective.position.y >= block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.camera.perspective.position.y = block.position.y + BLOCK.SIZE / 2
        this.ySpeed = 0
        this.canJump = true
      }
    })
  }

  /**
   * handle key event
   */
  private handleUp(): void {
    this.game.controls.moveForward(CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.getChunkBlocks().forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera.perspective, block) &&
        this.game.camera.perspective.position.y <= block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveForward(-1 * CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleLeft(): void {
    this.game.controls.moveRight(-1 * CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.getChunkBlocks().forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera.perspective, block) &&
        this.game.camera.perspective.position.y === block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveRight(CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleDown(): void {
    this.game.controls.moveForward(-1 * CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.getChunkBlocks().forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera.perspective, block) &&
        this.game.camera.perspective.position.y === block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveForward(CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleRight(): void {
    this.game.controls.moveRight(CAMERA.MOVING_SPEED)
    if (this.config.autoJump) return
    this.terrian.getChunkBlocks().forEach((block) => {
      if (
        isCollideCameraAndBlock(this.game.camera.perspective, block) &&
        this.game.camera.perspective.position.y === block.position.y - BLOCK.SIZE / 2
      ) {
        this.game.controls.moveRight(-1 * CAMERA.MOVING_SPEED)
      }
    })
  }

  private handleJump(): void {
    if (!this.canJump) return
    this.canJump = false
    this.ySpeed = -1 * CAMERA.JUMP_HEIGHT
  }
}

export { Character, CharacterInterface }
