import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import Block from './block'
import Keyboard from './keyboard'
import { BLOCK, TERRIAN, CAMERA } from './constant'

const simplex = new SimplexNoise(Math.random())

const scene = new THREE.Scene()
const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.x = CAMERA.INIT_X
camera.position.y = CAMERA.INIT_Y
camera.position.z = CAMERA.INIT_Z

let xoff = 0
let zoff = 0
let blocks: Block[] = []

for (let x = 0; x < TERRIAN.WIDTH; x++) {
  xoff = 0
  for (let z = 0; z < TERRIAN.WIDTH; z++) {
    const y = Math.round((Math.abs(simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE)
    blocks = [...blocks, new Block(new THREE.Vector3(-1 * x * BLOCK.SIZE, y * BLOCK.SIZE, -1 * z * BLOCK.SIZE))]
    xoff += TERRIAN.INCREMENT_OFFSET
  }
  zoff += TERRIAN.INCREMENT_OFFSET
}

blocks.forEach((block) => {
  const { blockMesh, lineSegment } = block.display()
  scene.add(blockMesh)
  scene.add(lineSegment)
})

const handleResizeWindow = () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}

window.addEventListener('resize', handleResizeWindow)

const controls = new PointerLockControls(camera, document.body)
document.body.addEventListener('click', () => controls.lock())
// controls.addEventListener('lock', () => console.log('controls lock'))
// controls.addEventListener('unlock', () => console.log('controls unlock'))

const keymaps: KeyMap[] = [
  {
    key: "w",
    callback: () => controls.moveForward(CAMERA.MOVING_SPEED)
  },
  {
    key: "a",
    callback: () => controls.moveRight(-1 * CAMERA.MOVING_SPEED)
  },
  {
    key: "s",
    callback: () => controls.moveForward(-1 * CAMERA.MOVING_SPEED)
  },
  {
    key: "d",
    callback: () => controls.moveRight(CAMERA.MOVING_SPEED)
  },
]
const keyboard = new Keyboard(keymaps)

document.addEventListener('keyup', (e: KeyboardEvent) => keyboard.handleKeyUp(e))
document.addEventListener('keydown', (e: KeyboardEvent) => keyboard.handleKeyDown(e))

const update = () => {
  keyboard.dispatch()
}

const render = () => {
  renderer.render(scene, camera)
}

const gameLoop = () => {
  requestAnimationFrame(gameLoop)
  update()
  render()
}

gameLoop()
