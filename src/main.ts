import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import Block from './block'
import { BLOCK, TERRIAN } from './constant'

const scene = new THREE.Scene()
const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.x = 10
camera.position.y = 80
camera.position.z = 10

const blocks: Block[] = []

const simplex = new SimplexNoise(Math.random())

let xoff = 0
let zoff = 0

for (let x = 0; x < 50; x++) {
  xoff = 0
  for (let z = 0; z < 50; z++) {
    const y = Math.round(Math.abs(simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE / BLOCK.SIZE)
    blocks.push(new Block(new THREE.Vector3(-1 * x * BLOCK.SIZE, y * BLOCK.SIZE, -1 * z * BLOCK.SIZE)))
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
controls.addEventListener('lock', () => console.log('controls lock'))
controls.addEventListener('unlock', () => console.log('controls unlock'))

// const update = () => {}

const render = () => {
  renderer.render(scene, camera)
}

const gameLoop = () => {
  requestAnimationFrame(gameLoop)
  // update()
  render()
}

gameLoop()
