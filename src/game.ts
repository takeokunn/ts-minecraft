import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { color } from '@src/assets'
import { CAMERA } from '@src/constant'
import { ChunkInterface } from '@src/chunk'
import { adjustBlockFaces } from '@src/utils'

interface GameInterface {
  stats: Stats
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: PointerLockControls

  loop: (update: () => void) => void

  addChunksToScene: (blocks: ChunkInterface['blocks']) => void
  addLineSegmentBlock: (blocks: ChunkInterface['blocks']) => void
  removeLineSegmentBlock: () => void

  setCameraFar: (far: number) => void
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
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, CAMERA.PERSPECTIVE.NEAR)
    this.camera.position.x = 0
    this.camera.position.z = 0
    this.camera.position.y = CAMERA.INITIALIZE.POSITION_Y

    // for control
    this.controls = new PointerLockControls(this.camera, document.body)
    document.body.addEventListener('click', () => this.controls.lock())

    // for resize event
    window.addEventListener('resize', this.handleResizeWindow.bind(this))
  }

  public loop(update: () => void): void {
    requestAnimationFrame(this.loop.bind(this, update))
    this.stats.begin()
    update()
    this.render()
    this.stats.end()
  }

  public addChunksToScene(blocks: ChunkInterface['blocks']): void {
    blocks.forEach((block) => {
      if (!block.isDisplayable) return

      const { blockMesh } = block.display(adjustBlockFaces(block, blocks))
      this.scene.add(blockMesh)
    })
  }

  public addLineSegmentBlock(blocks: ChunkInterface['blocks']): void {
    blocks.forEach((block) => {
      if (!block.isDisplayable) return

      const { lineSegment } = block.display(adjustBlockFaces(block, blocks))
      this.scene.add(lineSegment)
    })
  }

  public removeLineSegmentBlock(): void {
    this.scene.children.filter((obj) => obj.type === 'LineSegments').forEach((obj) => this.scene.remove(obj))
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  private handleResizeWindow(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
  }

  public setCameraFar(far: number): void {
    this.camera.far = far
    this.camera.updateProjectionMatrix()
  }
}

export { Game, GameInterface }
