import * as THREE from 'three'

import { Game } from './game'
import { Terrian } from './terrian'
import { Keyboard } from './keyboard'
import { BlockInterface } from './blocks'
import { BLOCK, CAMERA, GRAVITY } from './constant'

let canJump = true
let autoJump = true
let ySpeed = 0

const game = new Game()
const terrian = new Terrian()
terrian.generate(0, 0)
game.addChunksToScene(terrian.chunks)

///////////////////////////////////////////////////////////////////////////////
//                                 collision                                 //
///////////////////////////////////////////////////////////////////////////////

const isCollideCameraAndBlock = (camera: THREE.PerspectiveCamera, block: BlockInterface): boolean => {
  return (
    camera.position.x <= block.position.x + BLOCK.SIZE / 2 &&
    camera.position.x >= block.position.x - BLOCK.SIZE / 2 &&
    camera.position.z <= block.position.z + BLOCK.SIZE / 2 &&
    camera.position.z >= block.position.z - BLOCK.SIZE / 2
  )
}

///////////////////////////////////////////////////////////////////////////////
//                                 key event                                 //
///////////////////////////////////////////////////////////////////////////////

const keymaps: KeyMap[] = [
  {
    key: 'w',
    callback: (() => {
      game.controls.moveForward(CAMERA.MOVING_SPEED)
      if (autoJump) return
      terrian.chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (
            isCollideCameraAndBlock(game.camera, block) &&
            game.camera.position.y <= block.position.y - BLOCK.SIZE / 2
          ) {
            game.controls.moveForward(-1 * CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: 'a',
    callback: (() => {
      game.controls.moveRight(-1 * CAMERA.MOVING_SPEED)
      if (autoJump) return
      terrian.chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (
            isCollideCameraAndBlock(game.camera, block) &&
            game.camera.position.y === block.position.y - BLOCK.SIZE / 2
          ) {
            game.controls.moveRight(CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: 's',
    callback: (() => {
      game.controls.moveForward(-1 * CAMERA.MOVING_SPEED)
      if (autoJump) return
      terrian.chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (
            isCollideCameraAndBlock(game.camera, block) &&
            game.camera.position.y === block.position.y - BLOCK.SIZE / 2
          ) {
            game.controls.moveForward(CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: 'd',
    callback: (() => {
      game.controls.moveRight(CAMERA.MOVING_SPEED)
      if (autoJump) return
      terrian.chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (
            isCollideCameraAndBlock(game.camera, block) &&
            game.camera.position.y === block.position.y - BLOCK.SIZE / 2
          ) {
            game.controls.moveRight(-1 * CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: ' ',
    callback: (() => {
      if (!canJump) return
      canJump = false
      ySpeed = -1 * CAMERA.JUMP_HEIGHT
    }).bind(this),
  },
]
const keyboard = new Keyboard(keymaps)

document.addEventListener('keyup', (e: KeyboardEvent) => keyboard.handleKeyUp(e))
document.addEventListener('keydown', (e: KeyboardEvent) => keyboard.handleKeyDown(e))

///////////////////////////////////////////////////////////////////////////////
//                                 dom event                                 //
///////////////////////////////////////////////////////////////////////////////

const autoJumpButton = document.getElementById('auto-jump')

autoJumpButton?.addEventListener('click', () => {
  autoJump = !autoJump
  autoJumpButton.innerHTML = `AutoJump: ${autoJump ? 'On' : 'Off'}`
})

///////////////////////////////////////////////////////////////////////////////
//                                 game event                                //
///////////////////////////////////////////////////////////////////////////////

const update = () => {
  // keyboard
  keyboard.dispatch()

  // gravity
  game.camera.position.y = game.camera.position.y - ySpeed
  ySpeed = ySpeed + GRAVITY

  terrian.chunks.forEach((chunk) =>
    chunk.forEach((block) => {
      if (
        isCollideCameraAndBlock(game.camera, block) &&
        game.camera.position.y <= block.position.y + BLOCK.SIZE / 2 &&
        game.camera.position.y >= block.position.y - BLOCK.SIZE / 2
      ) {
        game.camera.position.y = block.position.y + BLOCK.SIZE / 2
        ySpeed = 0
        canJump = true
      }
    }),
  )
}

game.loop(update)
