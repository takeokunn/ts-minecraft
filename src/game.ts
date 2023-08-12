import { Scene, WebGLRenderer, Color } from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import { color } from '@src/assets'
import { ChunkInterface } from '@src/chunk'
import { adjustBlockFaces } from '@src/utils'
import { Camera } from '@src/camera'

interface GameInterface {
  camera: Camera
  controls: PointerLockControls

  loop: (update: () => void) => void

  addChunksToScene: (blocks: ChunkInterface['blocks']) => void
  addLineSegmentBlock: (blocks: ChunkInterface['blocks']) => void
  removeLineSegmentBlock: () => void
}

class Game implements GameInterface {
  private stats: Stats
  private scene: Scene
  private renderer: WebGLRenderer
  public camera: Camera
  public controls: PointerLockControls

  private isLock: boolean = false

  constructor() {
    // for stats
    this.stats = new Stats()
    this.stats.showPanel(0)
    document.body.appendChild(this.stats.dom)

    // for scene
    this.scene = new Scene()
    this.scene.background = new Color(color.sky)

    // for renderer
    this.renderer = new WebGLRenderer()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    // for camera
    this.camera = new Camera()

    // for control
    this.controls = new PointerLockControls(this.camera.perspective, document.body)
    document.body.addEventListener('click', () => {
      this.isLock = !this.isLock
      this.isLock ? this.controls.lock() : this.controls.unlock()
    })

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
    this.renderer.render(this.scene, this.camera.perspective)
  }

  private handleResizeWindow(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.camera.handleResizeWindow()
  }
}

export { Game, GameInterface }
