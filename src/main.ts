import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'
import Stats from 'three/examples/jsm/libs/stats.module'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { color } from './assets'
import { Keyboard } from './keyboard'
import { Dart, BlockInterface } from './blocks'
import { BLOCK, TERRIAN, CAMERA, GRAVITY } from './constant'

const simplex = new SimplexNoise(Math.random())

///////////////////////////////////////////////////////////////////////////////
//                                 initialize                                //
///////////////////////////////////////////////////////////////////////////////
const stats = Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

const scene = new THREE.Scene()
scene.background = new THREE.Color(color.sky)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.x = ((CAMERA.RENDER_DISTANCE * TERRIAN.CHUNK_SIZE) / 2) * BLOCK.SIZE
camera.position.z = ((CAMERA.RENDER_DISTANCE * TERRIAN.CHUNK_SIZE) / 2) * BLOCK.SIZE
camera.position.y = 100

const controls = new PointerLockControls(camera, document.body)
document.body.addEventListener('click', () => controls.lock())
// controls.addEventListener('lock', () => console.log('controls lock'))
// controls.addEventListener('unlock', () => console.log('controls unlock'))

const handleResizeWindow = () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}

window.addEventListener('resize', handleResizeWindow)

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
      scene.add(blockMesh)
      scene.add(lineSegment)
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
      controls.moveForward(CAMERA.MOVING_SPEED)
      if (autoJump) return
      chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (isCollideCameraAndBlock(camera, block) && camera.position.y <= block.position.y - BLOCK.SIZE / 2) {
            controls.moveForward(-1 * CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: 'a',
    callback: (() => {
      controls.moveRight(-1 * CAMERA.MOVING_SPEED)
      if (autoJump) return
      chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (isCollideCameraAndBlock(camera, block) && camera.position.y === block.position.y - BLOCK.SIZE / 2) {
            controls.moveRight(CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: 's',
    callback: (() => {
      controls.moveForward(-1 * CAMERA.MOVING_SPEED)
      if (autoJump) return
      chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (isCollideCameraAndBlock(camera, block) && camera.position.y === block.position.y - BLOCK.SIZE / 2) {
            controls.moveForward(CAMERA.MOVING_SPEED)
          }
        }),
      )
    }).bind(this),
  },
  {
    key: 'd',
    callback: (() => {
      controls.moveRight(CAMERA.MOVING_SPEED)
      if (autoJump) return
      chunks.forEach((chunk) =>
        chunk.forEach((block) => {
          if (isCollideCameraAndBlock(camera, block) && camera.position.y === block.position.y - BLOCK.SIZE / 2) {
            controls.moveRight(-1 * CAMERA.MOVING_SPEED)
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
  camera.position.y = camera.position.y - ySpeed
  ySpeed = ySpeed + GRAVITY

  chunks.forEach((chunk) =>
    chunk.forEach((block) => {
      if (
        isCollideCameraAndBlock(camera, block) &&
        camera.position.y <= block.position.y + BLOCK.SIZE / 2 &&
        camera.position.y >= block.position.y - BLOCK.SIZE / 2
      ) {
        camera.position.y = block.position.y + BLOCK.SIZE / 2
        ySpeed = 0
        canJump = true
      }
    }),
  )
}

const render = () => {
  renderer.render(scene, camera)
}

const gameLoop = () => {
  requestAnimationFrame(gameLoop)
  stats.begin()
  update()
  render()
  stats.end()
}

generateTerrian()
gameLoop()
