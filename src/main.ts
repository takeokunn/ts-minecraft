import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'

import { Game } from './game'
import { Keyboard } from './keyboard'
import { Dart, BlockInterface } from './blocks'
import { BLOCK, TERRIAN, CAMERA, GRAVITY } from './constant'

const simplex = new SimplexNoise(Math.random())

///////////////////////////////////////////////////////////////////////////////
//                                 initialize                                //
///////////////////////////////////////////////////////////////////////////////
const game = new Game()

///////////////////////////////////////////////////////////////////////////////
//                                 variables                                 //
///////////////////////////////////////////////////////////////////////////////

const chunks: BlockInterface[][] = []
let canJump = true
let autoJump = true
let ySpeed = 0

///////////////////////////////////////////////////////////////////////////////
//                              generate terrian                             //
///////////////////////////////////////////////////////////////////////////////

const generateTerrian = () => {
  let xoff = 0
  let zoff = 0
  for (let outer = 0; outer < CAMERA.RENDER_DISTANCE; outer++) {
    const chunk: BlockInterface[] = []
    for (let inner = 0; inner < CAMERA.RENDER_DISTANCE; inner++) {
      for (let x = outer * TERRIAN.CHUNK_SIZE; x < outer * TERRIAN.CHUNK_SIZE + TERRIAN.CHUNK_SIZE; x++) {
        for (let z = inner * TERRIAN.CHUNK_SIZE; z < inner * TERRIAN.CHUNK_SIZE + TERRIAN.CHUNK_SIZE; z++) {
          xoff = TERRIAN.INCREMENT_OFFSET * x
          zoff = TERRIAN.INCREMENT_OFFSET * z
          const y = Math.round((Math.abs(simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE)
          chunk.push(new Dart(new THREE.Vector3(x * BLOCK.SIZE, y * BLOCK.SIZE, z * BLOCK.SIZE)))
        }
      }
    }
    chunks.push(chunk)
  }

  chunks.forEach((chunk) =>
    chunk.forEach((block) => {
      const { blockMesh, lineSegment } = block.display()
      game.scene.add(blockMesh)
      game.scene.add(lineSegment)
    }),
  )
}

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
      chunks.forEach((chunk) =>
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
      chunks.forEach((chunk) =>
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
      chunks.forEach((chunk) =>
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
      chunks.forEach((chunk) =>
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

  chunks.forEach((chunk) =>
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

generateTerrian()
game.loop(update)
