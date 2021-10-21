import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { color } from './assets'
import { Chunks } from './terrian'
import { BLOCK, TERRIAN, CAMERA } from './constant'

interface GameInterface {
  stats: Stats
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: PointerLockControls

  loop: (update: () => void) => void
  addChunksToScene: (chunks: Chunks) => void
}

class Game implements GameInterface {
  public stats: Stats
  public scene: THREE.Scene
  public renderer: THREE.WebGLRenderer
  public camera: THREE.PerspectiveCamera
  public controls: PointerLockControls

  constructor() {
    // for stats
    this.stats = Stats()
    this.stats.showPanel(0)
    document.body.appendChild(this.stats.dom)

    // for scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(color.sky)

    // for renderer
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    // for camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.x = ((CAMERA.RENDER_DISTANCE * TERRIAN.CHUNK_SIZE) / 2) * BLOCK.SIZE
    this.camera.position.z = ((CAMERA.RENDER_DISTANCE * TERRIAN.CHUNK_SIZE) / 2) * BLOCK.SIZE
    this.camera.position.y = 100

    // for control
    this.controls = new PointerLockControls(this.camera, document.body)
    document.body.addEventListener('click', () => this.controls.lock())

    // resize event
    window.addEventListener('resize', this.handleResizeWindow)
  }

  public loop(update: () => void): void {
    requestAnimationFrame(this.loop.bind(this, update))
    this.stats.begin()
    update()
    this.render()
    this.stats.end()
  }

  public addChunksToScene(chunks: Chunks): void {
    chunks.forEach((chunk) => {
      chunk.forEach((block) => {
        const { blockMesh, lineSegment } = block.display()
        this.scene.add(blockMesh)
        this.scene.add(lineSegment)
      })
    })
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  private handleResizeWindow(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }
}

export { Game, GameInterface }
